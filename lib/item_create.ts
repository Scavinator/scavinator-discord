import { TextChannel, Client, ChatInputCommandInteraction, ModalSubmitInteraction, MessageFlags, User, Guild, ThreadChannel, RESTJSONErrorCodes, DiscordAPIError } from 'discord.js';
import { TeamScavHunts, ListCategories, Item, ItemIntegration, Pages, PageIntegration } from '../models/models';
import { Op } from 'sequelize';
import { item_thread_embed } from './item_thread';
import { page_thread_embed } from './page_thread';
import { update_pages_message } from './pages_channel';
import { update_items_message } from './items_channel';

async function create_page_thread(page_number: number, pages_channel: TextChannel): Promise<ThreadChannel> {
  const { threads } = await pages_channel.threads.fetchActive();
  let thread = threads.find(thread => thread.name.toLowerCase().match(new RegExp(`.*page.${page_number}([^\\d].*$|$)`)));
  if (!thread) {
    thread = await pages_channel.threads.create({ name: `Page ${page_number}` })
  }
  return thread;
}

// ==========================================
// The Item-Create-O-Tron
// ==========================================

// These functions are for creating page channels and item channels in-sync
// They each yield once in order to be run in parallel and both pause after creating a thread but before sending messages
// This is because the page channel and item have to be created, and *then* the messages can be sent that each contain links to the other
async function* setup_item(client: Client, team_scav_hunt: TeamScavHunts, page_number: number, name_suffix: string | null, item: Item, integration: ItemIntegration, list_category_id: number | null, item_number: number, user: User, channel: TextChannel) {
  let name_prefix = "Item"
  if (list_category_id) {
    const category = await ListCategories.findOne({where: {id: list_category_id, team_id: {[Op.or]: [null, team_scav_hunt.team_id]}}})
    name_prefix = `${category!.name} Item`
  }
  const thread = await channel.threads.create({ name: name_suffix ? `${name_prefix} ${item_number}: ${name_suffix}` : `${name_prefix} ${item_number}` });
  await item.update({page_number})
  integration.set({'integration_data.thread_id': thread.id})
  await integration.save();
  yield thread
  const item_message = await thread.send({embeds: [await item_thread_embed(team_scav_hunt, item)]})
  await integration.update({'integration_data.message_id': item_message.id});
  await Promise.all([
    (async () => {
      await item_message.pin()
      thread.members.add(user)
    })(),
    update_items_message(client, team_scav_hunt, channel)
  ])
}

async function* setup_page(client: Client, team_scav_hunt: TeamScavHunts, page_number: number, user: User, guild: Guild) {
  if (page_number && team_scav_hunt.discord_pages_channel_id) {
    const pages_channel = await guild.channels.fetch(team_scav_hunt.discord_pages_channel_id);
    if (pages_channel === null || !(pages_channel instanceof TextChannel)) {
      console.log("Invalid page channel ID")
      return
    }
    const [page, ] = await Pages.findOrCreate({where: {page_number, team_scav_hunt_id: team_scav_hunt.id}});
    const [integration, ] = await PageIntegration.findOrBuild({where: {page_id: page.id, type: 'discord'}, defaults: {page_id: page.id, type: 'discord'}})
    if (!integration.integration_data || !integration.integration_data['thread_id']) {
      const page_thread = await create_page_thread(page_number, pages_channel);
      integration.set({'integration_data.thread_id': page_thread.id});
      await integration.save();
      yield
      const message = await page_thread.send({embeds: [await page_thread_embed(client, team_scav_hunt, page_number)]});
      await integration.update({'integration_data.message_id': message.id});
      await Promise.all([
        (async () => {
          await message.pin();
          await page_thread.members.add(user);
        })(),
        update_pages_message(client, team_scav_hunt)
      ])
    } else {
      const page_thread = await pages_channel.threads.fetch(integration.integration_data['thread_id']);
      if (page_thread === null) {
        console.log("Invalid page thread ID, clearing")
        integration.set({integration_data: {thread_id: null, message_id: null}})
        await integration.save();
        await update_pages_message(client, team_scav_hunt, pages_channel);
      } else {
        yield
        await Promise.all([
          page_thread.members.add(user),
          (async () => {
            if (integration.integration_data['message_id']) {
              page_thread.messages.edit(integration.integration_data['message_id'], {embeds: [await page_thread_embed(client, team_scav_hunt, page_number)]})
            } else {
              const msg = await page_thread.send({embeds: [await page_thread_embed(client, team_scav_hunt, page_number)]})
              integration.set({'integration_data.message_id': msg.id})
              await integration.save();
              await msg.pin()
            }
          })()
        ])
      }
    }
  }
}

const SQL_MAX_INT = 2147483647
export async function handle_create_item(interaction: ChatInputCommandInteraction | ModalSubmitInteraction, team_scav_hunt: TeamScavHunts, item_number: any, page_number: any, name_suffix: any, list_category_id: number | null = null) {
  let errors = [];
  if (page_number !== null && !(((typeof page_number === 'bigint') || Number.isInteger(page_number)) && page_number > 0 && page_number < SQL_MAX_INT)) {
    errors.push(`\`${page_number}\` is not a valid page number`)
  }
  if (!(typeof item_number === 'bigint' || Number.isInteger(item_number) && item_number > 0 && item_number < SQL_MAX_INT)) {
    errors.push(`\`${item_number}\` is not a valid item number`)
  }
  if (name_suffix.length > 90) {
    errors.push(`Your summary must be less than 90 characters`)
  }
  if (errors.length !== 0) {
    console.log(`${interaction.user?.displayName} was blocked from creating item ${item_number} on page ${page_number} (${name_suffix})`)
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: errors.join(". ")})
  }
  if (interaction.channel === null || !(interaction.channel instanceof TextChannel)) {
    return await interaction.reply({flags: MessageFlags.Ephemeral, content: "Can't create an item from here"})
  }
  let [item, ] = await Item.findOrCreate({where: { number: item_number, team_scav_hunt_id: team_scav_hunt.id, list_category_id}, defaults: {page_number}});
  let [integration, ] = await ItemIntegration.findOrBuild({where: {item_id: item.id, type: 'discord'}, defaults: {item_id: item.id, type: 'discord', integration_data: {summary: name_suffix}}});
  if (integration.integration_data && integration.integration_data['thread_id']) {
    console.log(`${interaction.user?.displayName} was redirected to an existing item channel for item ${item_number}`)
    try {
      const old_thread = await interaction.channel.threads.fetch(integration.integration_data['thread_id']);
      return await interaction.reply({flags: MessageFlags.Ephemeral, content: `An item channel already exists for item ${item_number}: ${old_thread}`})
    } catch (e) {
      if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownChannel) {
        await integration.destroy()
      } else {
        throw e
      }
    }
  }
  console.log(`${interaction.user?.displayName} is creating item ${item_number} on page ${page_number} (${name_suffix})`)


  const item_setup_manager = setup_item(interaction.client, team_scav_hunt, page_number, name_suffix, item, integration, list_category_id, item_number, interaction.user, interaction.channel);
  const page_setup_manager = setup_page(interaction.client, team_scav_hunt, page_number, interaction.user, interaction.guild!);
  const reply = await interaction.reply({flags: MessageFlags.Ephemeral, content: `Setting up item...`})
  console.log(Date.now(), "Starting stages")
  const [item_thread, _] = await Promise.all([
    item_setup_manager.next().then(i => i.value),
    page_setup_manager.next()
  ])
  await reply.edit({content: `Successfully created item thread! ${item_thread}`})
  console.log(Date.now(), "Stage 1 done")
  await Promise.all([
    item_setup_manager.next(),
    page_setup_manager.next()
  ])
  console.log(Date.now(), "Stage 2 done")
  await reply.edit({content: `Successfully set up item thread! ${item_thread}`})
}
