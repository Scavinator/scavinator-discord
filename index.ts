import { Client, Events, GatewayIntentBits, EmbedBuilder, MessageType, MessageFlags, RESTJSONErrorCodes, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, GuildChannel, TextChannel, AnyThreadChannel, RESTError, Interaction, ChatInputCommandInteraction, ButtonInteraction, ModalMessageModalSubmitInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, DMChannel, GuildMember, Guild, User } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { SlashCommandBuilder, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandStringOption } from 'discord.js';
import { Op } from 'sequelize';

import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync('./config.json', 'utf8'))
const { token, clientId } = config;
import { Item } from './models/items';
import { TeamScavHunts } from './models/teamscavhunts';
import { Pages } from './models/pages';
import { ListCategories } from './models/listcategories';

const item_command = new SlashCommandBuilder()
    .setName('item')
    .setDescription('Create an item thread')
    .addIntegerOption(new SlashCommandIntegerOption()
      .setName('number')
      .setDescription('Item Number')
      .setRequired(true)
    )
    .addIntegerOption(new SlashCommandIntegerOption()
      .setName('page')
      .setDescription('Page Number')
      .setRequired(true)
    )
    .addStringOption(new SlashCommandStringOption()
      .setRequired(false)
      .setName('category')
      .setDescription('Which list category does this belong to (if any)')
      .setChoices({name: "Foo", value: "bar"})
    )
    .addStringOption(new SlashCommandStringOption()
      .setName('summary')
      .setDescription('Item summary to be included in channel name')
      .setMaxLength(80)
      .setRequired(false)
    );

const refresh_command = new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setName('refresh')
    .setDescription('Refresh item threads in the current channel (picks up deleted threads)');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const rest = new REST().setToken(token);

(async () => {
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [item_command, refresh_command] },
  );
})();

const ITEMS_CHANNEL_INSTRUCTIONS_EMBED = new EmbedBuilder()
  .setTitle("How to use this channel")
  .setDescription([
    '- **This channel is not for sending messages**',
    '- **Creating an item:** Click the "+ Create Item Thread" button at the bottom of this message. A form will pop up for you to fill out. Once you\'ve filled it out, a thread will be created. For Showcase or Scav Olympics items, select "More Options".',
    '- **Joining an item channel:**',
    '  - Option 1 (easy): Send a message in the item channel',
    '  - Option 2 (hard): Open the channel by clicking on it, then right click (long press on mobile) on the channel name in the sidebar. This will open a menu with an option to "Join Thread"',
    '- This channel will house one thread for each item and will act as an "index" of those item channels.',
    "- _You will probably want to mute this channel unless you'd like ghost notifications every time an item is created_",
    '- If you want to play with the bot, use [the testing server](<https://discord.gg/ryqAwWhdYc>).',
    '- Happy scavving!'
  ].join("\n"));

async function items_embed(team_scav_hunt: TeamScavHunts) {
  const list_categories = Object.fromEntries((await ListCategories.findAll({where: {team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})).map(category => [category.id, category.name]));
  const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, [Op.not]: {discord_thread_id: null}}, order: [['number', 'ASC']]})
  if (items.length === 0) return []
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_items_channel_id)! as TextChannel).threads;
  const active_threads = (await threads.fetchActive()).threads;
  const archived_threads = (await threads.fetchArchived()).threads;
  const item_list: {[key: string]: any[]} = {};
  for (const item of items) {
    const thread = active_threads.find((i: AnyThreadChannel) => item.discord_thread_id === i.id) || archived_threads.find((i: AnyThreadChannel) => item.discord_thread_id === i.id);
    if (!thread) {
      await item.update({discord_thread_id: null});
    } else {
      const key = item.list_category_id === null ? "Items" : list_categories[item.list_category_id]
      item_list[key] ||= []
      item_list[key].push([item, thread])
    }
  }
  return Object.entries(item_list).map(([category, items]) => {
    let chunked_items = []
    while (items.length > 0) chunked_items.push(items.splice(0, 100))
    return [new EmbedBuilder()
      .setTitle(category)
      .setDescription((chunked_items.shift() ?? [] ).map(([item, thread]) => `- Item ${item.number}: ${thread}`).join("\n")),
      ...chunked_items.map(chunk => {
        return new EmbedBuilder()
          .setDescription(chunk.map(([item, thread]) => `- Item ${item.number}: ${thread}`).join("\n"))
      })
    ]
  }).flat()
}

async function page_items_embed(team_scav_hunt: TeamScavHunts, page_number: number) {
  const base_embed = new EmbedBuilder().setTitle("Items");
  const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, page_number, [Op.not]: {discord_thread_id: null}}, order: [['number', 'ASC']]})
  if (items.length === 0) return base_embed;
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_items_channel_id)! as TextChannel).threads;
  return base_embed.setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.discord_thread_id, {cache: true}); 
    return `- Item ${item.number}: ${thread}`
  }))).join("\n"))
}

async function item_embed(team_scav_hunt: TeamScavHunts, item: Item) {
  let page_str = "N/A"
  if (item.page_number) {
    const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number, [Op.not]: {discord_thread_id: null}}})
    if (page) {
      page_str = `<#${page.discord_thread_id!}> (${item.page_number})`
    }
  }
  return new EmbedBuilder()
    .setTitle("Summary")
    .setFields(
      {name: "Page", value: page_str, inline: true},
      {name: "Item", value: item.content ?? "N/A", inline: false},
    )
}

async function pages_embed(team_scav_hunt: TeamScavHunts) {
  const base_embed = new EmbedBuilder().setTitle("Pages");
  const pages = await Pages.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, [Op.not]: {discord_thread_id: null}}, order: [['page_number', 'ASC']]})
  if (pages.length === 0) return base_embed
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_pages_channel_id)! as TextChannel).threads;
  const page_str_list = (await Promise.all(pages.map(async page => {
    const thread = await threads.fetch(page.discord_thread_id, {cache: true}); 
    return `- Page ${page.page_number}: ${thread}`
  })));
  return base_embed.setDescription(page_str_list.join("\n"))
}

async function update_pages_message(team_scav_hunt: TeamScavHunts, pages_channel: TextChannel | null = null) {
  if (!pages_channel) {
    pages_channel = await client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.fetch(team_scav_hunt.discord_pages_channel_id, {cache: true}) as TextChannel;
  }
  if (team_scav_hunt.discord_pages_message_id) {
    try {
      await pages_channel!.messages.edit(team_scav_hunt.discord_pages_message_id, {embeds: [await pages_embed(team_scav_hunt)]});
    } catch (error) {
      if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
        const pages_msg = await pages_channel!.send({embeds: [await pages_embed(team_scav_hunt)]})
        await team_scav_hunt.update({discord_pages_message_id: pages_msg.id})
      } else {
        throw error;
      }
    }
  } else {
    const pages_message = await pages_channel!.send({embeds: [await pages_embed(team_scav_hunt)]})
    await team_scav_hunt.update({discord_pages_message_id: pages_message.id})
  }
}

const ITEM_CREATE_CUSTOM_ID = 'createItem';
const ADVANCED_ITEM_CREATE_CUSTOM_ID = 'advancedCreateItem';

async function update_items_message(team_scav_hunt: TeamScavHunts, items_channel: TextChannel | null = null) {
  if (!items_channel) {
    items_channel = await client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.fetch(team_scav_hunt.discord_items_channel_id, {cache: true}) as TextChannel;
  }
  const items_message_buttons = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(ITEM_CREATE_CUSTOM_ID)
        .setLabel('+ Create Item Thread')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(ADVANCED_ITEM_CREATE_CUSTOM_ID)
        .setLabel('More Options')
        .setStyle(ButtonStyle.Secondary)
    )
  const items_message_content = {embeds: [ITEMS_CHANNEL_INSTRUCTIONS_EMBED, ...await items_embed(team_scav_hunt)], components: [items_message_buttons.toJSON()]};
  if (team_scav_hunt.discord_items_message_id) {
    try {
      await items_channel.messages.edit(team_scav_hunt.discord_items_message_id, items_message_content)
    } catch (error) {
      if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
        const items_msg = await items_channel.send(items_message_content);
        await team_scav_hunt.update({discord_items_message_id: items_msg.id})
      } else {
        throw error;
      }
    }
  } else {
    const items_message = await items_channel.send(items_message_content)
    await team_scav_hunt.update({discord_items_message_id: items_message.id})
  }
}

client.on(Events.ThreadDelete, async thread => {
  const team_scav_hunt = await TeamScavHunts.findOne({where: {discord_guild_id: thread.guild.id}})
  if (team_scav_hunt === null) return
  if (thread.parent!.id === team_scav_hunt.discord_items_channel_id) {
    const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: thread.id}})
    if (item) {
      console.log(`Item thread deleted for item ${item.number}`)
      await item.update({discord_thread_id: null});
      await update_items_message(team_scav_hunt, (thread.parent as TextChannel));
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
            await page_thread.messages.edit(page.discord_message_id, {embeds: [await page_items_embed(team_scav_hunt, page.page_number)]});
          }
        } catch (error) {
          if ((error as RESTError).code === RESTJSONErrorCodes.UnknownChannel) {
            await page.update({discord_thread_id: null, discord_message_id: null})
            await update_pages_message(team_scav_hunt, pages_channel);
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
      await update_pages_message(team_scav_hunt, thread.parent as TextChannel);
    }
  }
})

client.on(Events.MessageCreate, async message => {
  if (message.author.id === clientId && message.type === MessageType.ThreadCreated) {
    await message.delete()
  }
})

const SQL_MAX_INT = 2147483647

async function handle_create_item(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, team_scav_hunt: TeamScavHunts, item_number: any, page_number: any, name_suffix: any, list_category_id: number | null = null) {
  let errors = [];
  if (page_number !== null && !(((typeof page_number === 'bigint') || Number.isInteger(page_number)) && page_number > 0 && page_number < SQL_MAX_INT)) {
    errors.push(`\`${page_number}\` is not a valid page number`)
  }
  if (!(typeof item_number === 'bigint' || Number.isInteger(item_number) && item_number > 0 && item_number < SQL_MAX_INT)) {
    errors.push(`\`${item_number}\` is not a valid item number`)
  }
  if (name_suffix.length > 90) {
    errors.push(`Your summary must be less than 90 characters`)
  }
  if (errors.length !== 0) {
    console.log(`${interaction.user?.displayName} was blocked from creating item ${item_number} on page ${page_number} (${name_suffix})`)
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: errors.join(". ")})
  }
  if (interaction.channel === null || !(interaction.channel instanceof TextChannel)) {
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: "Can't create an item from here"})
  }
  let [item, newItem] = await Item.findOrCreate({where: { number: item_number, team_scav_hunt_id: team_scav_hunt.id, list_category_id}, defaults: {page_number}});
  if (!newItem && item.discord_thread_id) {
    console.log(`${interaction.user?.displayName} was redirected to an existing item channel for item ${item_number}`)
    const old_thread = await interaction.channel.threads.fetch(item.discord_thread_id);
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: `An item channel already exists for item ${item_number}: ${old_thread}`})
  }
  console.log(`${interaction.user?.displayName} is creating item ${item_number} on page ${page_number} (${name_suffix})`)

  // These functions are for creating page channels and item channels in-sync
  // They each yield once in order to be run in parallel and both pause after creating a thread but before sending messages
  // This is because the page channel and item have to be created, and *then* the messages can be sent that each contain links to the other
  async function* setup_item(team_scav_hunt: TeamScavHunts, page_number: number, name_suffix: string | null, item: Item, list_category_id: number | null, item_number: number, user: User, channel: TextChannel) {
    let name_prefix = "Item"
    if (list_category_id) {
      const category = await ListCategories.findOne({where: {id: list_category_id, team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
      name_prefix = `${category!.name} Item`
    }
    const thread = await channel.threads.create({ name: name_suffix ? `${name_prefix} ${item_number}: ${name_suffix}` : `${name_prefix} ${item_number}` });
    await item.update({page_number, discord_thread_id: thread.id})
    yield thread
    const item_message = await thread.send({embeds: [await item_embed(team_scav_hunt, item)]})
    item.discord_message_id = item_message.id
    await item_message.pin()
    thread.members.add(user)
    await item.save()
    await update_items_message(team_scav_hunt, channel);
  }

  async function* setup_page(team_scav_hunt: TeamScavHunts, page_number: number, user: User, guild: Guild) {
    if (page_number && team_scav_hunt.discord_pages_channel_id) {
      const pages_channel = await guild.channels.fetch(team_scav_hunt.discord_pages_channel_id);
      if (pages_channel === null || !(pages_channel instanceof TextChannel)) {
        console.log("Invalid page channel ID")
        return
      }
      const [page, newPage] = await Pages.findOrCreate({where: {page_number, team_scav_hunt_id: team_scav_hunt.id}});
      if (newPage) {
        const page_thread = await create_page_thread(page_number, pages_channel);
        await page.update({discord_thread_id: page_thread.id});
        yield
        const message = await page_thread.send({embeds: [await page_items_embed(team_scav_hunt, page_number)]});
        await page.update({discord_message_id: message.id});
        await message.pin();
        await page_thread.members.add(user);
        await update_pages_message(team_scav_hunt);
      } else {
        const page_thread = await pages_channel.threads.fetch(page.discord_thread_id);
        if (page_thread === null) {
          console.log("Invalid page thread ID, clearing")
          await page.update({discord_thread_id: null, discord_message_id: null})
          await update_pages_message(team_scav_hunt, pages_channel);
        } else {
          yield
          await page_thread.members.add(user);
          await page_thread.messages.edit(page.discord_message_id, {embeds: [await page_items_embed(team_scav_hunt, page_number)]});
        }
      }
    }
  }

  const item_setup_manager = setup_item(team_scav_hunt, page_number, name_suffix, item, list_category_id, item_number, interaction.user, interaction.channel);
  const page_setup_manager = setup_page(team_scav_hunt, page_number, interaction.user, interaction.guild!);
  const [item_thread, _] = await Promise.all([
    item_setup_manager.next().then(i => i.value),
    page_setup_manager.next()
  ])
  await Promise.all([
    item_setup_manager.next(),
    page_setup_manager.next()
  ])
  await interaction.reply({flags: MessageFlags.Ephemeral, content: `Successfully set up item thread! ${item_thread}`})
}

async function create_page_thread(page_number: number, pages_channel: TextChannel): Promise<ThreadChannel> {
  const { threads } = await pages_channel.threads.fetchActive();
  let thread = threads.find(thread => thread.name.toLowerCase().match(new RegExp(`.*page.${page_number}.*`)));
  if (!thread) {
    thread = await pages_channel.threads.create({ name: `Page ${page_number}` })
  }
  return thread;
}

function itemModal(category: ListCategories | null = null) {
  let modal = new ModalBuilder()
    .setCustomId(category ? `createItemModal-${category.id}` : 'createItemModal')
    .setTitle(category ? `Create ${category.name} Item Thread` : 'Create Item Thread')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('itemNumber')
          .setLabel('Item Number')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    )
  if (!category) {
    modal = modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pageNumber')
          .setLabel('Page Number')
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
      )
    )
  }
  return modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('nameSuffix')
          .setLabel('Optional Summary (for thread name)')
          .setMaxLength(80)
          .setRequired(false)
          .setStyle(TextInputStyle.Paragraph)
      )
    )
}

client.on(Events.InteractionCreate, async interaction => {
  const parent_channel_id = interaction.channel instanceof ThreadChannel ? interaction.channel.parentId : interaction.channelId;
  const team_scav_hunt = await TeamScavHunts.findOne({where: {[Op.or]: {discord_items_channel_id: parent_channel_id, discord_pages_channel_id: parent_channel_id}, discord_guild_id: interaction.guildId}});
  if (!(interaction instanceof ChatInputCommandInteraction || interaction instanceof ModalSubmitInteraction || interaction instanceof ButtonInteraction || interaction instanceof StringSelectMenuInteraction)) {
    console.log("Invalid interaction type?", interaction);
    return
  }
  if (!team_scav_hunt) {
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: "You are not currently in a channel that has been set up for item tracking"});
  }
  if (interaction.isButton()) {
    if (interaction.customId === ITEM_CREATE_CUSTOM_ID) {
      return await interaction.showModal(itemModal())
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
  }
  if (interaction.isStringSelectMenu() && interaction instanceof StringSelectMenuInteraction) {
    if (interaction.customId === "listCategory") {
      const list_category = await ListCategories.findOne({where: {id: interaction.values[0], team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
      await interaction.showModal(itemModal(list_category))
      await interaction.deleteReply();
      return;
    }
  }
  if (interaction.isModalSubmit()) {
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
  }
  if (!interaction.isChatInputCommand()) return;
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
    if (interaction.channelId === team_scav_hunt.discord_items_channel_id && channel instanceof TextChannel) {
      console.log(`Refresh on the items channel initiated by ${interaction.user?.displayName}`)
      const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, [Op.not]: {discord_thread_id: null}}});
      const threads = (await channel.threads.fetchActive()).threads;
      const archived_threads = (await channel.threads.fetchArchived()).threads;
      let removed_count = 0;
      for (const item of items) {
        if (!threads.some(t => t.id === item.discord_thread_id) && !archived_threads.some(t => t.id === item.discord_thread_id)) {
          removed_count += 1;
          await item.update({discord_thread_id: null});
        }
      }
      await update_items_message(team_scav_hunt, channel),
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Unlinked ${removed_count} deleted item channels`});
    } else if (channel.id === team_scav_hunt.discord_pages_channel_id && channel instanceof TextChannel) {
      console.log(`Refresh on the pages channel initiated by ${interaction.user?.displayName}`)
      const pages = await Pages.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, [Op.not]: {discord_thread_id: null}}});
      const threads = (await channel.threads.fetchActive()).threads;
      const archived_threads = (await channel.threads.fetchArchived()).threads;
      let removed_count = 0;
      for (const page of pages) {
        if (!threads.some(t => t.id === page.discord_thread_id) && !archived_threads.some(t => t.id === page.discord_thread_id)) {
          removed_count += 1;
          await page.update({discord_thread_id: null});
        }
      }
      await update_pages_message(team_scav_hunt);
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Unlinked ${removed_count} deleted page channels`});
    } else if (channel instanceof ThreadChannel) {
      const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: channel.id}});
      const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: channel.id}});
      if (page) {
        console.log(`Refresh on the pages item channel for page ${page.page_number} initiated by ${interaction.user?.displayName}`)
        let page_items_message;
        try {
          page_items_message = await channel.messages.edit(page.discord_message_id, {embeds: [await page_items_embed(team_scav_hunt, page.page_number)]});
        } catch (error) {
          if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
            page_items_message = await channel.send({embeds: [await page_items_embed(team_scav_hunt, page.page_number)]});
            await page.update({discord_message_id: page_items_message.id})
          } else {
            throw error;
          }
        }
        await interaction.reply({flags: MessageFlags.Ephemeral, content: `Refreshed message ${page_items_message.url}`})
      } else if (item) {
        console.log(`Refresh on the item channel for item ${item.number} initiated by ${interaction.user?.displayName}`)
        let item_message;
        try {
          item_message = await channel.messages.edit(item.discord_message_id || "0", {embeds: [await item_embed(team_scav_hunt, item)]});
        } catch (error) {
          if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
            item_message = await channel.send({embeds: [await item_embed(team_scav_hunt, item)]});
            await item_message.pin()
            await item.update({discord_message_id: item_message.id})
          } else {
            throw error;
          }
        }
        await interaction.reply({flags: MessageFlags.Ephemeral, content: `Refreshed message ${item_message.url}`})
      } else {
        await interaction.reply({flags: MessageFlags.Ephemeral, content: `No known messages in ${interaction.channel} to refresh`})
      }
    } else {
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `No known messages in ${interaction.channel} to refresh`})
    }
  } else {
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `Not configured to handle \`/${interaction.commandName}\` in ${interaction.channel}`})
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
