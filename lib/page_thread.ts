import { TextChannel, TextDisplayBuilder, ContainerBuilder, MessageFlags, MessageCreateOptions, MessageEditOptions, SectionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ThreadChannel, DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';
import { Item, TeamScavHunts, ItemIntegration, PageIntegration } from '../models/models';
import { update_pages_message } from './pages_channel';
import { ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX } from './item_submit';

type PageThreadComponent = ContainerBuilder | TextDisplayBuilder | SectionBuilder;

export async function page_thread_message(page_thread: ThreadChannel, page_integration: PageIntegration, team_scav_hunt: TeamScavHunts, page_number: number): Promise<void> {
  const items = await Item.findAll({where: {team_scav_hunt_id: team_scav_hunt.id, page_number, list_category_id: null}, include: {model: ItemIntegration, where: {type: 'discord'}, required: false}, order: [['number', 'ASC']]})
  const messages: (MessageEditOptions & MessageCreateOptions)[] = [];
  let containers: PageThreadComponent[] = [];
  let component_count = 0;
  for (const item of items) {
    // Assemble text to display
    const status = item.status === 'box' ? '✅' : '❌'
    let cts = `### ${status} Item ${item.number}`
    if (item?.item_integration?.integration_data && item.item_integration.integration_data['thread_id']) {
      cts += ` (<#${item.item_integration.integration_data['thread_id']}>)`
    }
    if (item.submission_summary) {
      cts += '\n'
      cts += item.submission_summary.slice(0, 4000 - cts.length)
    }

    // Compile text into a component
    let new_component_count = 0;
    let container: PageThreadComponent;
    if (item.submission_summary) {
      container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(cts))
      new_component_count += 2;
      container = container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX}-${item.id}`)
            .setLabel("Edit Comment")
            .setStyle(ButtonStyle.Primary)
        )
      )
      new_component_count += 2
    } else if (item.status === 'box') {
      container = new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(cts))
      new_component_count += 2;
      container = container.setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`${ITEM_SUBMISSION_COMMENT_EDIT_BUTTON_PREFIX}-${item.id}`)
          .setLabel("+ Add Comment")
          .setStyle(ButtonStyle.Success)
      )
      new_component_count += 1
    } else {
      container = new TextDisplayBuilder().setContent(cts)
      new_component_count += 1
    }

    // Append component to message and manage message list
    if (component_count + new_component_count > 40) {
      messages.push({flags: MessageFlags.IsComponentsV2, components: containers, embeds: [], content: ""})
      containers = [container]
      component_count = new_component_count
    } else {
      containers.push(container)
      component_count += new_component_count
    }
  }
  if (containers.length > 0) {
    messages.push({flags: MessageFlags.IsComponentsV2, components: containers, embeds: [], content: ""})
  }

  // Send/update messages
  try {
    // .slice() required so that sequelize realizes we've changed the value when we update and save
    const message_ids = page_integration.integration_data['message_ids']?.slice() ?? []
    if (message_ids instanceof Array) {
      let i = 0;
      while (i < message_ids.length || i < messages.length) {
        if (message_ids[i] && messages[i]) {
          try {
            await page_thread.messages.edit(message_ids[i], messages[i]);
          } catch (error) {
            if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownMessage) {
              message_ids[i] = (await page_thread.send(messages[i])).id
            } else {
              throw error
            }
          }
        } else if (i >= messages.length) {
          await page_thread.bulkDelete(message_ids.slice(i))
          message_ids.splice(i)
          break
        } else if (i >= message_ids.length) {
          message_ids.push((await page_thread.send(messages[i])).id);
        }
        i += 1
      }
      await page_integration.update({'integration_data.message_ids': message_ids})
    }
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.UnknownChannel) {
      await page_integration.destroy();
      if (page_thread.parent instanceof TextChannel) {
        await update_pages_message(page_thread.client, team_scav_hunt, page_thread.parent);
      }
    } else {
      throw error;
    }
  }
}
