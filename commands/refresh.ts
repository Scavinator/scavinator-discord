import { ChatInputCommandInteraction, Message, MessageFlags, PermissionFlagsBits, RESTError, RESTJSONErrorCodes, SlashCommandBuilder, TextChannel, ThreadChannel } from 'discord.js';
import { Item } from '../models/items';
import { TeamScavHunts } from '../models/teamscavhunts';
import { Pages } from '../models/pages';
import { update_items_message } from '../lib/items_channel';
import { update_pages_message } from '../lib/pages_channel';
import { page_thread_embed } from '../lib/page_thread';
import { Op } from 'sequelize';
import { item_thread_embed } from '../lib/item_thread';

export const refresh_command = new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setName('refresh')
    .setDescription('Refresh item threads in the current channel (picks up deleted threads)');

export async function refresh_items_channel(interaction: ChatInputCommandInteraction, team_scav_hunt: TeamScavHunts, channel: TextChannel): Promise<number> {
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
  await update_items_message(interaction.client, team_scav_hunt, channel);
  return removed_count
}

export async function refresh_pages_channel(interaction: ChatInputCommandInteraction, team_scav_hunt: TeamScavHunts, channel: TextChannel): Promise<number> {
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
  await update_pages_message(interaction.client, team_scav_hunt);
  return removed_count;
}

export async function refresh_page_thread(interaction: ChatInputCommandInteraction, team_scav_hunt: TeamScavHunts, page: Pages, thread: ThreadChannel): Promise<Message> {
  console.log(`Refresh on the pages item channel for page ${page.page_number} initiated by ${interaction.user?.displayName}`)
  let page_items_message;
  try {
    page_items_message = await thread.messages.edit(page.discord_message_id, {embeds: [await page_thread_embed(interaction.client, team_scav_hunt, page.page_number)]});
  } catch (error) {
    if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
      page_items_message = await thread.send({embeds: [await page_thread_embed(interaction.client, team_scav_hunt, page.page_number)]});
      await page.update({discord_message_id: page_items_message.id})
    } else {
      throw error;
    }
  }
  return page_items_message;
}

export async function refresh_item_thread(interaction: ChatInputCommandInteraction, team_scav_hunt: TeamScavHunts, item: Item, thread: ThreadChannel): Promise<Message> {
  console.log(`Refresh on the item channel for item ${item.number} initiated by ${interaction.user?.displayName}`)
  let item_message;
  try {
    item_message = await thread.messages.edit(item.discord_message_id || "0", {embeds: [await item_thread_embed(team_scav_hunt, item)]});
  } catch (error) {
    if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
      item_message = await thread.send({embeds: [await item_thread_embed(team_scav_hunt, item)]});
      await item_message.pin()
      await item.update({discord_message_id: item_message.id})
    } else {
      throw error;
    }
  }
  return item_message;
}

export async function handle_refresh(interaction: ChatInputCommandInteraction, team_scav_hunt: TeamScavHunts) {
  const channel = interaction.channel;
  if (channel instanceof TextChannel && interaction.channelId === team_scav_hunt.discord_items_channel_id) {
    const removed_count = await refresh_items_channel(interaction, team_scav_hunt, channel)
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `Unlinked ${removed_count} deleted item channels`});
  } else if (channel instanceof TextChannel && channel.id === team_scav_hunt.discord_pages_channel_id) {
    const removed_count = await refresh_pages_channel(interaction, team_scav_hunt, channel)
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `Unlinked ${removed_count} deleted page channels`});
  } else if (channel instanceof ThreadChannel) {
    const page = await Pages.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: channel.id}});
    const item = await Item.findOne({where: {team_scav_hunt_id: team_scav_hunt.id, discord_thread_id: channel.id}});
    if (page) {
      const page_items_message = await refresh_page_thread(interaction, team_scav_hunt, page, channel);
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Refreshed message ${page_items_message.url}`})
    } else if (item) {
      const item_message = await refresh_item_thread(interaction, team_scav_hunt, item, channel);
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `Refreshed message ${item_message.url}`})
    } else {
      await interaction.reply({flags: MessageFlags.Ephemeral, content: `No known messages in ${interaction.channel} to refresh`})
    }
  } else {
    await interaction.reply({flags: MessageFlags.Ephemeral, content: `No known messages in ${interaction.channel} to refresh`})
  }
}
