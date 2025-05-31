import { EmbedBuilder } from 'discord.js';
import { Item } from '../models/items';
import { TeamScavHunts } from '../models/teamscavhunts';
import { Pages } from '../models/pages';
import { Op } from 'sequelize';

export async function item_thread_embed(team_scav_hunt: TeamScavHunts, item: Item) {
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
