import { ActionRowBuilder, MessageComponentInteraction, MessageFlags, ModalBuilder, ModalSubmitInteraction, TextChannel, TextInputBuilder, TextInputStyle, ThreadChannel } from "discord.js"
import { TeamScavHunts } from "../models/teamscavhunts";
import { Item } from "../models/items";
import { ItemIntegration } from "../models/itemintegrations";
import { PageIntegration } from "../models/pageintegrations";
import { page_thread_message } from "./page_thread";
import { item_thread_name } from "./item_create";
import { update_items_message } from "./items_channel";
import { item_thread_message } from "./item_thread";
import { Pages } from "../models/pages";

// =============================================
// For the big button in the pages channel
// =============================================
export const ITEM_SUBMIT_MODAL_ID = 'submitItemModal';
export const ITEM_SUBMIT_MODAL_ID_REGEXP = new RegExp(`^${ITEM_SUBMIT_MODAL_ID}(?:\\-(\\d+))?$`)

export const ITEM_SUBMIT_MODAL_SUBMISSION_KEY = 'itemInfo';

export const ITEM_SUBMIT_MODAL = new ModalBuilder()
  .setCustomId(ITEM_SUBMIT_MODAL_ID)
  .setTitle('Submit Item')
  .addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('itemNumber')
        .setLabel('Item Number')
        .setRequired(true)
        .setStyle(TextInputStyle.Short)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId(ITEM_SUBMIT_MODAL_SUBMISSION_KEY)
        .setLabel('Submission')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
    ),
  )

// =============================================
// For editing/creating comments from individual threads
// =============================================
export const ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX = 'itemSubmissionEditBtn'
export const ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX_REGEXP = new RegExp(`^${ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX}\-(\\d+)$`)

export const ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX = 'itemSubmissionEditModal'
export const ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX_REGEXP = new RegExp(`^${ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX}\-(\\d+)$`)

export const ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX = 'itemSubmissionAddModal'
export const ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX_REGEXP = new RegExp(`^${ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX}\-(\\d+)$`)

export const ITEM_SUBMISSION_COMMENT_EDIT_TEXT_ID = 'itemSubmissionEditModalTxt'

export function gen_submission_edit_modal(item: Item, is_new: boolean = false): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`${is_new ? ITEM_SUBMISSION_COMMENT_ADD_MODAL_PREFIX : ITEM_SUBMISSION_COMMENT_EDIT_MODAL_PREFIX}-${item.id}`)
    .setTitle(is_new ? `Submitting Item ${item.number}` : `Editing Item ${item.number} Comment`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(ITEM_SUBMISSION_COMMENT_EDIT_TEXT_ID)
          .setLabel('Submission')
          .setRequired(is_new ? false : true)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(item.submission_summary || '')
      ),
    )
}


// =============================================
// Item submission management
// =============================================
export async function setItemStatus(interaction: MessageComponentInteraction | ModalSubmitInteraction, team_scav_hunt: TeamScavHunts, item: Item, integration: ItemIntegration, newStatus: 'box' | null) {
  await item.update({status: newStatus})
  const client = interaction.client;
  let item_thread: TextChannel | ThreadChannel | null = null;
  if (integration.integration_data['thread_id']) {
    const chan = await client.channels.fetch(integration.integration_data['thread_id']);
    if (chan instanceof TextChannel || chan instanceof ThreadChannel) {
      item_thread = chan
    }
  }
  await Promise.all([
    update_items_message(client, team_scav_hunt),
    (async () => {
      if (item_thread && integration.integration_data['message_id']) {
        await item_thread.messages.edit(integration.integration_data['message_id'], await item_thread_message(team_scav_hunt, item));
      }
    })()
  ])
  let statusMsg;
  if (newStatus === 'box') {
    statusMsg = `Item ${item.number} marked as completed!`
  } else {
    statusMsg = 'Item completion undone'
  }
  if (integration.integration_data && interaction.channelId === integration.integration_data['thread_id']) {
    await interaction.reply({content: statusMsg})
  } else {
    await interaction.reply({content: statusMsg, flags: MessageFlags.Ephemeral})
    if (item_thread) {
      if (integration.integration_data['message_id']) {
        await item_thread.send({content: statusMsg, reply: {messageReference: integration.integration_data['message_id']}})
      } else {
        await item_thread.send({content: statusMsg})
      }
    }
  }
  if (item.page_number) {
    const page = await PageIntegration.findOne({where: {type: 'discord'}, include: {model: Pages, where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}}});
    if (page?.integration_data['thread_id']) {
      const page_chan = await client.channels.fetch(page.integration_data['thread_id']);
      if (page_chan instanceof ThreadChannel) {
        await page_thread_message(page_chan, page, team_scav_hunt, item.page_number)
      }
    }
  }
  if (item_thread) {
    await item_thread.setName(await item_thread_name(team_scav_hunt, item, integration))
  }
}
