import { Client, Events, GatewayIntentBits, MessageType, MessageFlags, RESTJSONErrorCodes, ThreadChannel, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel, RESTError, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, BaseInteraction, MessageComponentInteraction, TextBasedChannel, SendableChannels, BaseGuildTextChannel, GuildTextBasedChannel } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { Op } from 'sequelize';

import { readFileSync } from 'fs';
const { token, clientId } = JSON.parse(readFileSync('./config.json', 'utf8'))
import { Item, TeamScavHunts, Pages, ListCategories, ItemIntegration, PageIntegration } from './models/models';

import { update_items_message, itemCreateModal, ADVANCED_ITEM_CREATE_CUSTOM_ID, ITEM_CREATE_CUSTOM_ID, CREATE_ITEM_MODAL_ID_REGEXP } from './lib/items_channel';
import { handle_create_item, item_thread_name } from './lib/item_create';
import { PAGE_CHANNEL_SUBMIT_BUTTON_ID, update_pages_message } from './lib/pages_channel';
import { item_command } from './commands/item';
import { gen_setup_command, handle_setup } from './commands/setup';
import { page_thread_message } from './lib/page_thread';
import { handle_refresh, refresh_command, refresh_item_thread, refresh_items_channel, refresh_page_thread, refresh_pages_channel } from './commands/refresh';
import { ITEM_SUBMIT_MODAL, ITEM_SUBMIT_MODAL_ID, ITEM_SUBMIT_MODAL_ID_REGEXP, ITEM_SUBMIT_MODAL_SUBMISSION_KEY, gen_submission_edit_modal, ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX, ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX_REGEXP, ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX_REGEXP, ITEM_SUBMISSION_COMMENT_EDIT_TEXT_ID, setItemStatus, ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX_REGEXP } from './lib/item_submit';
import { item_thread_message, ITEM_THREAD_SUBMIT_BUTTON_ID, ITEM_THREAD_UNSUBMIT_BUTTON_ID } from './lib/item_thread';

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
    const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id}, include: {model: ItemIntegration, where: {integration_data: {thread_id: thread.id}, type: 'discord'}}})
    if (item) {
      console.log(`Item thread deleted for item ${item.number}`)
      await item.item_integration?.destroy();
      await update_items_message(client, team_scav_hunt, (thread.parent as TextChannel));
      const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}, include: {model: PageIntegration, where: {type: 'discord'}}});
      if (page && page.page_integration?.integration_data['message_id'] && page.page_integration?.integration_data['thread_id']) {
        const pages_channel = await thread.guild.channels.fetch(team_scav_hunt.discord_pages_channel_id) as TextChannel | null;
        if (pages_channel === null) return
        try {
          const page_thread = await pages_channel.threads.fetch(page.page_integration.integration_data['thread_id']);
          if (page_thread) {
            await page_thread_message(page_thread, page.page_integration, team_scav_hunt, page.page_number);
          }
        } catch (error) {
          if ((error as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
            await page.page_integration?.destroy();
            await update_pages_message(client, team_scav_hunt, pages_channel);
          } else {
            throw error;
          }
        }
      }
    }
  } else if (thread.parent!.id === team_scav_hunt.discord_pages_channel_id) {
    const page = await PageIntegration.findOne({where: {integration_data: {thread_id: thread.id}, type: 'discord'}, include: {model: Pages, where: {team_scav_hunt_id: team_scav_hunt.id}}});
    if (page) {
      console.log(`Page thread for page ${page.page!.page_number} deleted`)
      await page.destroy();
      await update_pages_message(client, team_scav_hunt, thread.parent as TextChannel);
    }
  }
})

client.on(Events.MessageCreate, async message => {
  if (message.author.id === clientId && message.type === MessageType.ThreadCreated) {
    await message.delete()
  }
})

client.rest.on('restDebug', (e) => {
  console.log("REST DEBUG:", e)
})

client.rest.on('rateLimited', (e) => {
  console.log("RATE LIMIT:", e)
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
    } else if (interaction.customId === PAGE_CHANNEL_SUBMIT_BUTTON_ID) {
      await interaction.showModal(ITEM_SUBMIT_MODAL);
    } else if (interaction.customId === ITEM_THREAD_SUBMIT_BUTTON_ID || interaction.customId == ITEM_THREAD_UNSUBMIT_BUTTON_ID) {
      // Note: Doing this by thread is safe, tested pushing the button, leaving the channel, and then seeing + submitting the modal and it still was attached to the original channel (7/20/2025)
      const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id}, include: {model: ItemIntegration, where: {integration_data: {thread_id: interaction.channelId}}}});
      if (item?.item_integration) {
        let newStatus: 'box' | null;
        if (interaction.customId === ITEM_THREAD_SUBMIT_BUTTON_ID) {
          // newStatus = 'box';
          return interaction.showModal(gen_submission_edit_modal(item, true));
        } else {
          newStatus = null
        }
        await setItemStatus(interaction, team_scav_hunt, item, item.item_integration, newStatus);
      } else {
        return await interaction.reply({content: 'Could not locate item. This is a bug.', flags: MessageFlags.Ephemeral})
      }
    } else if (interaction.customId.startsWith(ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX)) {
      const itemId = interaction.customId.match(ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX_REGEXP);
      if (itemId !== null) {
        const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, id: itemId[1]}});
        if (item !== null) {
          interaction.showModal(gen_submission_edit_modal(item));
        } else {
          interaction.reply({flags: MessageFlags.Ephemeral, content: "Unknown button. If you're seeing this, this is a bug."})
        }
      }
    }
  } else if (interaction.isStringSelectMenu() && interaction instanceof StringSelectMenuInteraction) {
    if (interaction.customId === "listCategory") {
      const list_category = await ListCategories.findOne({where: {id: interaction.values[0], team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
      await interaction.showModal(itemCreateModal(list_category))
      await interaction.deleteReply();
    }
  } else if (interaction.isModalSubmit()) {
    const submitItemMatch = interaction.customId.match(ITEM_SUBMIT_MODAL_ID_REGEXP)
    if (submitItemMatch) {
      let item_number;
      try {
        item_number = BigInt(interaction.fields.getTextInputValue('itemNumber'));
      } catch (e) {
        return await interaction.reply({flags: MessageFlags.Ephemeral, content: `Invalid item number`});
      }
      const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, number: item_number}, include: {model: ItemIntegration, where: {type: 'discord'}, required: false}})
      if (item) {
        await item.update({submission_summary: interaction.fields.getTextInputValue(ITEM_SUBMIT_MODAL_SUBMISSION_KEY)})
        if (item.item_integration) {
          return await setItemStatus(interaction, team_scav_hunt, item, item.item_integration, 'box');
        } else {
          return await interaction.reply({flags: MessageFlags.Ephemeral, content: `Item number not found`});
        }
      }
    }
    const editItemSubmissionMatch = interaction.customId.match(ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX_REGEXP)
    const addItemSubmissionMatch = interaction.customId.match(ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX_REGEXP)
    const itemSubmissionMatch = editItemSubmissionMatch || addItemSubmissionMatch;
    if (itemSubmissionMatch) {
      const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, id: itemSubmissionMatch[1]}, include: {model: ItemIntegration, where: {type: 'discord'}, required: false}});
      if (item !== null) {
        const item_updates: {submission_summary: string, status?: 'box' | null} = {submission_summary: interaction.fields.getTextInputValue(ITEM_SUBMISSION_COMMENT_EDIT_TEXT_ID)};
        if (addItemSubmissionMatch && item.status !== 'box') {
          item_updates['status'] = 'box'
        }
        await item.update(item_updates)
        if (addItemSubmissionMatch) {
          await setItemStatus(interaction, team_scav_hunt, item, item.item_integration!, item.status)
        } else {
          const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}, include: {model: PageIntegration, where: {type: 'discord'}}});
          if (page?.page_integration?.integration_data === null || !page?.page_integration?.integration_data['thread_id']) return
          const pages_channel = await interaction.guild!.channels.fetch(team_scav_hunt.discord_pages_channel_id) as TextChannel | null;
          if (pages_channel === null) return
          const page_thread = await pages_channel.threads.fetch(page.page_integration.integration_data['thread_id']);
          if (page_thread === null) return
          await page_thread_message(page_thread, page.page_integration, team_scav_hunt, page.page_number);
        }
      }
    }
    const createItemMatch = interaction.customId.match(CREATE_ITEM_MODAL_ID_REGEXP)
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
