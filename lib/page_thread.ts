import { EmbedBuilder, TextChannel, Client } from 'discord.js';
import { Item } from '../models/items';
import { TeamScavHunts } from '../models/teamscavhunts';
import { Op } from 'sequelize';

export async function page_thread_embed(client: Client, team_scav_hunt: TeamScavHunts, page_number: number) {
  const base_embed = new EmbedBuilder().setTitle("Items");
  const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, page_number, [Op.not]: {discord_thread_id: null}}, order: [['number', 'ASC']]})
  if (items.length === 0) return base_embed;
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_items_channel_id)! as TextChannel).threads;
  return base_embed.setDescription((await Promise.all(items.map(async item => {
    const thread = await threads.fetch(item.discord_thread_id, {cache: true}); 
    return `- Item ${item.number}: ${thread}`
  }))).join("\n"))
}

