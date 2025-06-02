import { RESTError, TextChannel, RESTJSONErrorCodes, Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageCreateOptions, MessageEditOptions } from 'discord.js';
import { Op } from 'sequelize';
import { TeamScavHunts, Pages, PageIntegration } from '../models/models';

export async function update_pages_message(client: Client, team_scav_hunt: TeamScavHunts, pages_channel: TextChannel | null = null) {
  console.log(Date.now(), "Upd pg msg")
  if (!pages_channel) {
    pages_channel = await client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.fetch(team_scav_hunt.discord_pages_channel_id, {cache: true}) as TextChannel;
  }
  if (team_scav_hunt.discord_pages_message_id) {
    try {
      await pages_channel!.messages.edit(team_scav_hunt.discord_pages_message_id, await gen_pages_message(client, team_scav_hunt));
    } catch (error) {
      if ((error as RESTError).code === RESTJSONErrorCodes.UnknownMessage) {
        const pages_msg = await pages_channel!.send(await gen_pages_message(client, team_scav_hunt))
        await team_scav_hunt.update({discord_pages_message_id: pages_msg.id})
      } else {
        throw error;
      }
    }
  } else {
    const pages_message = await pages_channel!.send(await gen_pages_message(client, team_scav_hunt))
    await team_scav_hunt.update({discord_pages_message_id: pages_message.id})
  }
  console.log(Date.now(), "Done upd pg msg")
}

export const PAGE_CHANNEL_SUBMIT_BUTTON_ID = 'pageChannelSubmitItem'

async function gen_pages_message(client: Client, team_scav_hunt: TeamScavHunts): Promise<MessageCreateOptions & MessageEditOptions> {
  return {embeds: [await pages_embed(client, team_scav_hunt)], components: [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(PAGE_CHANNEL_SUBMIT_BUTTON_ID)
        .setStyle(ButtonStyle.Success)
        .setLabel("Submit Item")
        .setEmoji("📦")
    )
  ]}
}

async function pages_embed(client: Client, team_scav_hunt: TeamScavHunts): Promise<EmbedBuilder> {
  console.log(Date.now(), "Gen pg msg")
  const base_embed = new EmbedBuilder().setTitle("Pages");
  const pages = await Pages.findAll({where: {team_scav_hunt_id: team_scav_hunt.id}, include: {model: PageIntegration, where: {[Op.not]: {integration_data: {thread_id: null}}}}, order: [['page_number', 'ASC']]})
  if (pages.length === 0) return base_embed
  const threads = (client.guilds.cache.get(team_scav_hunt.discord_guild_id)!.channels.cache.get(team_scav_hunt.discord_pages_channel_id)! as TextChannel).threads;
  const page_str_list = (await Promise.all(pages.map(async page => {
    const thread = await threads.fetch(page.page_integration!.integration_data['thread_id']!, {cache: true});
    return `- Page ${page.page_number}: ${thread}`
  })));
  console.log(Date.now(), "Done gen pg msg")
  return base_embed.setDescription(page_str_list.join("\n"))
}
