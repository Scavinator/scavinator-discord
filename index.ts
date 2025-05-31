import { Client, Events, GatewayIntentBits, MessageType, MessageFlags, RESTJSONErrorCodes, ThreadChannel, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, RESTError, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { Op } from 'sequelize';

import { readFileSync } from 'fs';
const { token, clientId } = JSON.parse(readFileSync('./config.json', 'utf8'))
import { Item } from './models/items';
import { TeamScavHunts } from './models/teamscavhunts';
import { Pages } from './models/pages';
import { ListCategories } from './models/listcategories';

import { update_items_message, itemCreateModal, ADVANCED_ITEM_CREATE_CUSTOM_ID, ITEM_CREATE_CUSTOM_ID } from './lib/items_channel';
import { handle_create_item } from './lib/item_create';
import { update_pages_message } from './lib/pages_channel';
import { item_command } from './commands/item';
import { gen_setup_command, handle_setup } from './commands/setup';
import { page_thread_embed } from './lib/page_thread';
import { handle_refresh, refresh_command, refresh_item_thread, refresh_items_channel, refresh_page_thread, refresh_pages_channel } from './commands/refresh';

(async () => {
  const rest = new REST().setToken(token);
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [item_command, refresh_command, await gen_setup_command()] },
  );
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.on(Events.ThreadDelete, async thread => {
  const team_scav_hunt = await TeamScavHunts.findOne({where: {discord_guild_id: thread.guild.id}})
  if (team_scav_hunt === null) return
  if (thread.parent!.id === team_scav_hunt.discord_items_channel_id) {
    const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: thread.id}})
    if (item) {
      console.log(`Item thread deleted for item ${item.number}`)
      await item.update({discord_thread_id: null});
      await update_items_message(client, team_scav_hunt, (thread.parent as TextChannel));
      const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}});
      if (page && page.discord_message_id && page.discord_thread_id) {
        const pages_channel = await thread.guild.channels.fetch(team_scav_hunt.discord_pages_channel_id) as TextChannel | null;
        if (pages_channel === null) {
          await page.update({discord_thread_id: null, discord_message_id: null})
          return
        }
        try {
          const page_thread = await pages_channel.threads.fetch(page.discord_thread_id);
          if (page_thread) {
            await page_thread.messages.edit(page.discord_message_id, {embeds: [await page_thread_embed(client, team_scav_hunt, page.page_number)]});
          }
        } catch (error) {
          if ((error as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
            await page.update({discord_thread_id: null, discord_message_id: null})
            await update_pages_message(client, team_scav_hunt, pages_channel);
          } else {
            throw error;
          }
        }
      }
    }
  } else if (thread.parent!.id === team_scav_hunt.discord_pages_channel_id) {
    const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: thread.id}});
    if (page) {
      console.log(`Page thread for page ${page.page_number} deleted`)
      await page.update({discord_thread_id: null, discord_message_id: null});
      await update_pages_message(client, team_scav_hunt, thread.parent as TextChannel);
    }
  }
})

client.on(Events.MessageCreate, async message => {
  if (message.author.id === clientId && message.type === MessageType.ThreadCreated) {
    await message.delete()
  }
})

client.on(Events.InteractionCreate, async interaction => {
  console.log(Date.now(), "Start")

  // Typescript so fun
  if (!(interaction instanceof ChatInputCommandInteraction || interaction instanceof ModalSubmitInteraction || interaction instanceof ButtonInteraction || interaction instanceof StringSelectMenuInteraction)) {
    console.log("Invalid interaction type?", interaction);
    return
  }

  // Setup command doesn't require an existing TeamScavHunt
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    await handle_setup(interaction);
    return
  }

  // Commands that only work on an existing hunt
  const parent_channel_id = interaction.channel instanceof ThreadChannel ? interaction.channel.parentId : interaction.channelId;
  const team_scav_hunt = await TeamScavHunts.findOne({where: {[Op.or]: {discord_items_channel_id: parent_channel_id, discord_pages_channel_id: parent_channel_id}, discord_guild_id: interaction.guildId}});
  if (!team_scav_hunt) {
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: "You are not currently in a channel that has been set up for item tracking"});
  }

  if (interaction.isButton()) {
    if (interaction.customId === ITEM_CREATE_CUSTOM_ID) {
      console.log(Date.now(), "Showing modal");
      await interaction.showModal(itemCreateModal())
      console.log(Date.now(), "Showed modal");
    } else if (interaction.customId === ADVANCED_ITEM_CREATE_CUSTOM_ID) {
      const categories = await ListCategories.findAll({where: {team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
      await interaction.reply({flags: MessageFlags.Ephemeral, content: "Which type of item are you creating?", components: [
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .setComponents(new StringSelectMenuBuilder()
            .setPlaceholder("Category")
            .setCustomId("listCategory")
            .setOptions(
              categories.map(category => new StringSelectMenuOptionBuilder()
                .setLabel(category.name)
                .setValue(category.id.toString())
              )
            )
          )
      ]})
    }
  } else if (interaction.isStringSelectMenu() && interaction instanceof StringSelectMenuInteraction) {
    if (interaction.customId === "listCategory") {
      const list_category = await ListCategories.findOne({where: {id: interaction.values[0], team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
      await interaction.showModal(itemCreateModal(list_category))
      await interaction.deleteReply();
    }
  } else if (interaction.isModalSubmit()) {
    const createItemMatch = interaction.customId.match(/^createItemModal(?:\-(\d+))?$/)
    if (createItemMatch) {
      const list_category = createItemMatch[1] === undefined ? null : Number(createItemMatch[1])
      let item_number, page_number;
      try {
        item_number = BigInt(interaction.fields.getTextInputValue('itemNumber'));
      } catch (e) {
        return await interaction.reply({flags: MessageFlags.Ephemeral, content: `Invalid item number`});
      }
      try {
        page_number = list_category ? null : BigInt(interaction.fields.getTextInputValue('pageNumber'));
      } catch (e) {
        return await interaction.reply({flags: MessageFlags.Ephemeral, content: `Invalid page number`});
      }
      const name_suffix = interaction.fields.getTextInputValue('nameSuffix');
      return await handle_create_item(interaction, team_scav_hunt, item_number, page_number, name_suffix, list_category);
    }
  } else if (interaction.isChatInputCommand()) {
    const channel = interaction.channel;
    if (channel === null) {
      console.log("Invalid interaction channel?", interaction);
      return
    }
    if (interaction.commandName === "item" && channel.id === team_scav_hunt.discord_items_channel_id && channel instanceof TextChannel) {
      const page_number = interaction.options.getNumber('page');
      const item_number = interaction.options.getNumber('number');
      const name_suffix = interaction.options.getString('summary');
      return await handle_create_item(interaction, team_scav_hunt, item_number, page_number, name_suffix);
    } else if (interaction.commandName === "refresh") {
      await handle_refresh(interaction, team_scav_hunt);
    } else {
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Not configured to handle \`/${interaction.commandName}\` in ${interaction.channel}`})
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
