import { ButtonBuilder, ActionRowBuilder, RESTError, TextChannel, RESTJSONErrorCodes, Client, EmbedBuilder, ButtonStyle, AnyThreadChannel, TextInputBuilder, TextInputStyle, ModalBuilder, ThreadChannel } from 'discord.js';
import { TeamScavHunts, ListCategories, Item, ItemIntegration } from '../models/models';
import { Op } from 'sequelize';

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

export const ITEM_CREATE_CUSTOM_ID = 'createItem';
export const ADVANCED_ITEM_CREATE_CUSTOM_ID = 'advancedCreateItem';

export async function update_items_message(client: Client, team_scav_hunt: TeamScavHunts, items_channel: TextChannel | null = null) {
  console.log(Date.now(), "Upd item msg")
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
  const items_message_content = {embeds: [ITEMS_CHANNEL_INSTRUCTIONS_EMBED, ...await items_embed(client, team_scav_hunt)], components: [items_message_buttons.toJSON()]};
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
  console.log(Date.now(), "Done upd item msg")
}

async function items_embed(client: Client, team_scav_hunt: TeamScavHunts) {
  console.log(Date.now(), "Gen items msg")
  const list_categories = Object.fromEntries((await ListCategories.findAll({where: {team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})).map(category => [category.id, category.name]));
  const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id}, include: {model: ItemIntegration, where: {integration_data: {thread_id: {[Op.not]: null}}, type: 'discord'}}, order: [['list_category_id', 'DESC', 'NULLS LAST'], ['status', 'ASC'], ['number', 'ASC']]})
  if (items.length === 0) return []
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_items_channel_id)! as TextChannel).threads;
  const active_threads = (await threads.fetchActive()).threads;
  const archived_threads = (await threads.fetchArchived()).threads;
  const item_list: {[key: string]: any[]} = {};
  for (const item of items) {
    const thread = active_threads.find((i: AnyThreadChannel) => item.item_integration!.integration_data['thread_id'] === i.id) || archived_threads.find((i: AnyThreadChannel) => item.item_integration!.integration_data['thread_id'] === i.id);
    if (!thread) {
      await item.item_integration!.update({'integration_data.thread_id': null});
    } else {
      const key = item.list_category_id === null ? "Items" : list_categories[item.list_category_id]
      item_list[key] ||= []
      item_list[key].push([item, thread])
    }
  }
  console.log(Date.now(), "Done gen items msg")
  return Object.entries(item_list).map(([category, items]) => {
    let chunked_items = []
    while (items.length > 0) chunked_items.push(items.splice(0, 100))
    return [new EmbedBuilder()
      .setTitle(category)
      .setDescription((chunked_items.shift() ?? [] ).map(([item, thread]) => item_list_element(item, thread)).join("\n")),
      ...chunked_items.map(chunk => {
        return new EmbedBuilder()
          .setDescription(chunk.map(([item, thread]) => item_list_element(item, thread)).join("\n"))
      })
    ]
  }).flat()
}

function item_list_element(item: Item, thread: ThreadChannel): string {
  let done_prefix = item.status === 'box' ? '✅ ' : '';
  return `- ${done_prefix}Item ${item.number}: ${thread}`
}

export const CREATE_ITEM_MODAL_ID = 'createItemModal';
export const CREATE_ITEM_MODAL_ID_REGEXP = new RegExp(`^${CREATE_ITEM_MODAL_ID}(?:\\-(\\d+))?$`)

export function itemCreateModal(category: ListCategories | null = null) {
  let modal = new ModalBuilder()
    .setCustomId(category ? `${CREATE_ITEM_MODAL_ID}-${category.id}` : CREATE_ITEM_MODAL_ID)
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

