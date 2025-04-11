import { Client, Events, GatewayIntentBits, EmbedBuilder, MessageType, MessageFlags } from 'discord.js';
import { REST, Routes } from 'discord.js';
import { SlashCommandBuilder, SlashCommandChannelOption, SlashCommandNumberOption, SlashCommandStringOption } from 'discord.js';
import { Sequelize, DataTypes } from 'sequelize';

import config from './config.json' with { type: "json" };
const { token, clientId, guildId } = config;
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'development.sqlite'
});
import item_loader from './models/item.js';
import item_channel_loader from './models/itemchannel.js';
import page_thread_loader from './models/pagethread.js';
const Item = item_loader(sequelize, DataTypes);
const ItemChannel = item_channel_loader(sequelize, DataTypes);
const PageThread = page_thread_loader(sequelize, DataTypes);

const item_command = new SlashCommandBuilder()
    .setName('item')
    .setDescription('Create an item thread')
    .addNumberOption(new SlashCommandNumberOption()
      .setName('number')
      .setDescription('Item Number')
      .setRequired(true)
    )
    .addNumberOption(new SlashCommandNumberOption()
      .setName('page')
      .setDescription('Page Number')
      .setRequired(true)
    )
    .addStringOption(new SlashCommandStringOption()
      .setName('summary')
      .setDescription('Item summary to be included in channel name')
      .setMaxLength(80)
      .setRequired(false)
    );

const item_channel_command = new SlashCommandBuilder()
    .setName('setupchannel')
    .setDescription('Set-up a new channel to house item threads')
    .addChannelOption(new SlashCommandChannelOption()
      .setName('item-channel')
      .setDescription('The channel to use for item threads')
      .setRequired(true)
    )
    .addChannelOption(new SlashCommandChannelOption()
      .setName('pages-channel')
      .setDescription('The channel to use for page threads')
    );

const refresh_command = new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Refresh item threads in the current channel (picks up deleted threads)');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

const rest = new REST().setToken(token);

(async () => {
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [item_command, item_channel_command, refresh_command] },
  );
})();

async function items_embed(item_channel = null) {
  const base_embed = new EmbedBuilder().setTitle("Items");
  if (item_channel === null) return base_embed
  const items = await Item.findAll({where: {item_channel_id: item_channel.id}, order: [['item_number', 'ASC']]})
  const threads = client.guilds.cache.get(item_channel.guild_id).channels.cache.get(item_channel.items_channel_id).threads;
  return base_embed.setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.thread_id); 
    return `Item ${item.item_number}: ${thread}`
  }))).join("\n"))
}

async function page_items_embed(item_channel, page_number) {
  const items = await Item.findAll({where: {item_channel_id: item_channel.id, page_number}, order: [['item_number', 'ASC']]})
  const threads = client.guilds.cache.get(item_channel.guild_id).channels.cache.get(item_channel.items_channel_id).threads;
  return new EmbedBuilder().setTitle("Items").setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.thread_id); 
    return `Item ${item.item_number}: ${thread}`
  }))).join("\n"))
}

async function pages_embed(items_channel = null) {
  const base_embed = new EmbedBuilder().setTitle("Pages");
  if (items_channel === null) return base_embed;
  const pages = await PageThread.findAll({where: {items_channel_id: items_channel.id}, order: [['page_number', 'ASC']]})
  const threads = client.guilds.cache.get(items_channel.guild_id).channels.cache.get(items_channel.pages_channel_id).threads;
  return base_embed.setDescription((await Promise.all(pages.map(async page => {
    const thread = await threads.fetch(page.thread_id); 
    return `Page ${page.page_number}: ${thread}`
  }))).join("\n"))
}

client.on(Events.MessageCreate, async message => {
  if (message.author.id === clientId && message.type === MessageType.ThreadCreated) {
    await message.delete()
  }
})

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "setupchannel") {
    const items_channel = interaction.options.getChannel('item-channel');
    const pages_channel = interaction.options.getChannel('pages-channel');
    const items_msg = await items_channel.send({embeds: [await items_embed()]})
    const pages_msg = pages_channel ? await pages_channel.send({embeds: [await pages_embed()]}) : null;
    await ItemChannel.create({
      guild_id: interaction.guildId,
      items_channel_id: items_channel.id,
      pages_channel_id: pages_channel?.id || null,
      items_message_id: items_msg.id,
      pages_message_id: pages_msg?.id || null,
      item_number: interaction.options.getNumber('number')
    });
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `Successfuly set up channel! ${items_msg}`})
  } else {
    const items_channel_id = interaction.channel.id;
    const item_channel = await ItemChannel.findOne({where: {items_channel_id, guild_id: interaction.guildId}});
    if (!item_channel) {
      return await interaction.reply({flags: MessageFlags.Ephemeral, content: "You are not currently in a channel that has been set up for item tracking"});
    }
    const message = await interaction.channel.messages.fetch(item_channel.items_message_id);
    if (interaction.commandName === "item") {
      const page_number = interaction.options.getNumber('page');
      const item_number = interaction.options.getNumber('number');
      const name_suffix = interaction.options.getString('summary');
      const old_item = await Item.findOne({where: { item_number, item_channel_id: item_channel.id}});
      if (old_item) {
        const old_thread = await interaction.channel.threads.fetch(old_item.thread_id);
        return await interaction.reply({flags: MessageFlags.Ephemeral, content: `An item channel already exists for item ${item_number}: ${old_thread}`})
      }
      const thread = await interaction.channel.threads.create({ name: name_suffix ? `Item ${item_number}: ${name_suffix}` : `Item ${item_number}` });
      await thread.members.add(interaction.user);
      await Item.create({ item_number, page_number, item_channel_id: item_channel.id, thread_id: thread.id });
      await message.edit({embeds: [await items_embed(item_channel)]})
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Successfuly set up item thread! ${thread}`})
      if (item_channel.pages_channel_id) {
        const pages_channel = await interaction.guild.channels.fetch(item_channel.pages_channel_id);
        let page_thread = await PageThread.findOne({where: {page_number}});
        if (!page_thread) {
          const { threads } = await pages_channel.threads.fetchActive();
          let thread = threads.find(thread => thread.name.toLowerCase().match(new RegExp(`.*page.${page_number}.*`)));
          if (!thread) {
            thread = await pages_channel.threads.create({ name: `Page ${page_number}` })
          }
          await thread.members.add(interaction.user);
          const message = await thread.send({embeds: [await page_items_embed(item_channel, page_number)]});
          await PageThread.create({thread_id: thread.id, message_id: message.id, page_number, items_channel_id: item_channel.id});
          const pages_message = await pages_channel.messages.fetch(item_channel.pages_message_id);
          await pages_message.edit({embeds: [await pages_embed(item_channel)]})
          await message.pin();
        } else {
          const thread = await pages_channel.threads.fetch(page_thread.thread_id);
          await thread.members.add(interaction.user);
          const message = await thread.messages.fetch(page_thread.message_id);
          await message.edit({embeds: [await page_items_embed(item_channel, page_number)]})
        }
      }
    } else if (interaction.commandName === "refresh") {
      const items = await Item.findAll({item_channel_id: item_channel.id});
      const threads = (await interaction.channel.threads.fetchActive()).threads;
      const archived_threads = (await interaction.channel.threads.fetchArchived()).threads;
      let removed_count = 0;
      for (const item of items) {
        if (!threads.some(t => t.id === item.thread_id) && !archived_threads.some(t => t.id === item.thread_id)) {
          removed_count += 1;
          await item.destroy();
        }
      }
      await message.edit({embeds: [await items_embed(item_channel)]});
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Removed ${removed_count} deleted item channels`});
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
