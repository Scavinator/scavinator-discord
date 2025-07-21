import { ActionRowBuilder, BaseMessageOptions, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Item, TeamScavHunts, Pages, PageIntegration, ItemIntegration } from '../models/models';
import { Op } from 'sequelize';

export const ITEM_THREAD_SUBMIT_BUTTON_ID = 'itemThreadSubmit'
export const ITEM_THREAD_UNSUBMIT_BUTTON_ID = 'itemThreadUnsubmit'

export async function item_thread_message(team_scav_hunt: TeamScavHunts, item: Item): Promise<BaseMessageOptions> {
  let button;
  if (item.status === 'box') {
    button = new ButtonBuilder()
                .setLabel('Un-submit')
                .setStyle(ButtonStyle.Danger)
                .setCustomId(ITEM_THREAD_UNSUBMIT_BUTTON_ID)
  } else {
    button = new ButtonBuilder()
                .setLabel('Submit')
                .setStyle(ButtonStyle.Success)
                .setCustomId(ITEM_THREAD_SUBMIT_BUTTON_ID)
  }
  return {embeds: [await item_thread_embed(team_scav_hunt, item)], components: [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        button
      )
  ]}
}

async function item_thread_embed(team_scav_hunt: TeamScavHunts, item: Item) {
  let page_str = "N/A"
  if (item.page_number) {
    const page = await PageIntegration.findOne({where: {integration_data: {thread_id: {[Op.not]: null}}, type: 'discord'}, include: {model: Pages, where: {team_scav_hunt_id: team_scav_hunt.id, page_number: item.page_number}}});
    if (page) {
      page_str = `<#${page.integration_data['thread_id']}> (${item.page_number})`
    } else {
      page_str = item.page_number.toString()
    }
  }
  return new EmbedBuilder()
    .setTitle("Summary")
    .setFields(
      {name: "Page", value: page_str, inline: true},
      {name: "Item", value: item.content ?? "N/A", inline: false},
    )
}
