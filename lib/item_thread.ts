import { EmbedBuilder } from 'discord.js';
import { Item, TeamScavHunts, Pages, PageIntegration } from '../models/models';
import { Op } from 'sequelize';

export async function item_thread_embed(team_scav_hunt: TeamScavHunts, item: Item) {
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
