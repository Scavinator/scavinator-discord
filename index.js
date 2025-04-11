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
import items_loader from './models/items.js';
import team_scav_hunts_loader from './models/teamscavhunts.js';
import pages_loader from './models/pages.js';
const Items = items_loader(sequelize, DataTypes);
const TeamScavHunts = team_scav_hunts_loader(sequelize, DataTypes);
const Pages = pages_loader(sequelize, DataTypes);

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

async function items_embed(team_scav_hunt = null) {
  const base_embed = new EmbedBuilder().setTitle("Items");
  if (team_scav_hunt === null) return base_embed
  const items = await Items.findAll({where: {team_scav_hunt_id: team_scav_hunt.id}, order: [['number', 'ASC']]})
  const threads = client.guilds.cache.get(team_scav_hunt.discord_guild_id).channels.cache.get(team_scav_hunt.discord_items_channel_id).threads;
  return base_embed.setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.discord_thread_id, {cache: true}); 
    return `- Item ${item.number}: ${thread}`
  }))).join("\n"))
}

async function page_items_embed(team_scav_hunt, page_number) {
  const items = await Items.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, page_number}, order: [['number', 'ASC']]})
  const threads = client.guilds.cache.get(team_scav_hunt.discord_guild_id).channels.cache.get(team_scav_hunt.discord_items_channel_id).threads;
  return new EmbedBuilder().setTitle("Items").setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.discord_thread_id, {cache: true}); 
    return `- Item ${item.number}: ${thread}`
  }))).join("\n"))
}

async function pages_embed(team_scav_hunt = null) {
  const base_embed = new EmbedBuilder().setTitle("Pages");
  if (team_scav_hunt === null) return base_embed;
  const pages = await Pages.findAll({where: {team_scav_hunt_id: team_scav_hunt.id}, order: [['page_number', 'ASC']]})
  const threads = client.guilds.cache.get(team_scav_hunt.discord_guild_id).channels.cache.get(team_scav_hunt.discord_pages_channel_id).threads;
  const page_str_list = (await Promise.all(pages.map(async page => {
    const thread = await threads.fetch(page.discord_thread_id, {cache: true}); 
    return `- Page ${page.page_number}: ${thread}`
  })));
  return base_embed.setDescription(page_str_list.join("\n"))
}

client.on(Events.ThreadDelete, async thread => {
  const team_scav_hunt = await TeamScavHunts.findOne({where: {discord_guild_id: thread.guild.id}})
  if (thread.parent.id === team_scav_hunt.discord_items_channel_id) {
    const item = await Items.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: thread.id}})
    if (item) {
      await item.destroy();
      const items_message = await thread.parent.messages.fetch(team_scav_hunt.discord_items_message_id, {cache: true});
      await items_message.edit({embeds: [await items_embed(team_scav_hunt)]})
      const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}});
      const pages_channel = await thread.guild.channels.fetch(team_scav_hunt.discord_pages_channel_id);
      const page_thread = await pages_channel.threads.fetch(page.discord_thread_id);
      if (page_thread) {
        const page_message = await page_thread.messages.fetch(page.discord_message_id);
        await page_message.edit({embeds: [await page_items_embed(team_scav_hunt, page.page_number)]});
      }
    }
  }
})

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
    await TeamScavHunts.create({
      discord_guild_id: interaction.guildId,
      discord_items_channel_id: items_channel.id,
      discord_pages_channel_id: pages_channel?.id || null,
      discord_items_message_id: items_msg.id,
      discord_pages_message_id: pages_msg?.id || null
    });
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `Successfuly set up channel! ${items_msg}`})
  } else {
    const items_channel_id = interaction.channel.id;
    const team_scav_hunt = await TeamScavHunts.findOne({where: {discord_items_channel_id: items_channel_id, discord_guild_id: interaction.guildId}});
    if (!team_scav_hunt) {
      return await interaction.reply({flags: MessageFlags.Ephemeral, content: "You are not currently in a channel that has been set up for item tracking"});
    }
    const message = await interaction.channel.messages.fetch(team_scav_hunt.discord_items_message_id);
    if (interaction.commandName === "item") {
      const page_number = interaction.options.getNumber('page');
      const item_number = interaction.options.getNumber('number');
      const name_suffix = interaction.options.getString('summary');
      const old_item = await Items.findOne({where: { number: item_number, team_scav_hunt_id: team_scav_hunt.id}});
      if (old_item) {
        const old_thread = await interaction.channel.threads.fetch(old_item.discord_thread_id);
        return await interaction.reply({flags: MessageFlags.Ephemeral, content: `An item channel already exists for item ${item_number}: ${old_thread}`})
      }
      const thread = await interaction.channel.threads.create({ name: name_suffix ? `Item ${item_number}: ${name_suffix}` : `Item ${item_number}` });
      await Promise.all([
        thread.members.add(interaction.user),
        Items.create({ number: item_number, page_number, team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: thread.id })
      ])
      await message.edit({embeds: [await items_embed(team_scav_hunt)]})
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Successfuly set up item thread! ${thread}`})
      if (team_scav_hunt.discord_pages_channel_id) {
        let [pages_channel, page_thread] = await Promise.all([
          interaction.guild.channels.fetch(team_scav_hunt.discord_pages_channel_id),
          Pages.findOne({where: {page_number, team_scav_hunt_id: team_scav_hunt.id}})
        ])
        if (!page_thread) {
          const { threads } = await pages_channel.threads.fetchActive();
          let thread = threads.find(thread => thread.name.toLowerCase().match(new RegExp(`.*page.${page_number}.*`)));
          if (!thread) {
            thread = await pages_channel.threads.create({ name: `Page ${page_number}` })
          }
          const message = await thread.send({embeds: [await page_items_embed(team_scav_hunt, page_number)]});
          await Pages.create({discord_thread_id: thread.id, discord_message_id: message.id, page_number, team_scav_hunt_id: team_scav_hunt.id});
          await message.pin();
          await thread.members.add(interaction.user);
          const pages_message = await pages_channel.messages.fetch(team_scav_hunt.discord_pages_message_id, {cache: true});
          await pages_message.edit({embeds: [await pages_embed(team_scav_hunt)]})
        } else {
          const thread = await pages_channel.threads.fetch(page_thread.discord_thread_id);
          await thread.members.add(interaction.user);
          const message = await thread.messages.fetch(page_thread.discord_message_id);
          await message.edit({embeds: [await page_items_embed(team_scav_hunt, page_number)]})
        }
      }
    } else if (interaction.commandName === "refresh") {
      const items = await Items.findAll({where: {team_scav_hunt_id: team_scav_hunt.id}});
      const threads = (await interaction.channel.threads.fetchActive()).threads;
      const archived_threads = (await interaction.channel.threads.fetchArchived()).threads;
      let removed_count = 0;
      for (const item of items) {
        if (!threads.some(t => t.id === item.discord_thread_id) && !archived_threads.some(t => t.id === item.discord_thread_id)) {
          removed_count += 1;
          await item.destroy();
        }
      }
      await message.edit({embeds: [await items_embed(team_scav_hunt)]});
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Removed ${removed_count} deleted item channels`});
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.login(token);
