import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js"

export const ITEM_SUBMIT_MODAL_ID = 'submitItemModal';
export const ITEM_SUBMIT_MODAL_ID_REGEXP = new RegExp(`^${ITEM_SUBMIT_MODAL_ID}(?:\\-(\\d+))?$`)

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
        .setCustomId('itemInfo')
        .setLabel('Submission')
        .setRequired(true)
        .setStyle(TextInputStyle.Paragraph)
    ),
  )
