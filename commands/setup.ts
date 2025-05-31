import { PermissionFlagsBits, SlashCommandBooleanOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandSubcommandBuilder, SlashCommandSubcommandsOnlyBuilder, ChatInputCommandInteraction, MessageFlags, TextChannel } from 'discord.js';
import { ScavHunts } from '../models/scavhunts';
import { sequelize } from '../models/base';
import { UniqueConstraintError } from 'sequelize';
import { Teams } from '../models/teams';
import { TeamIntegration } from '../models/teamintegrations';
import { TeamScavHunts } from '../models/teamscavhunts';
import { update_items_message } from "../lib/items_channel";
import { update_pages_message } from "../lib/pages_channel";

async function hunt_builder(hunt_required: boolean): Promise<SlashCommandSubcommandBuilder> {
  const scav_hunts = await ScavHunts.findAll({limit: 5})
  let b = new SlashCommandSubcommandBuilder()
  if (hunt_required) {
    b = b.addIntegerOption(new SlashCommandIntegerOption()
                      .setMinValue(0)
                      .setName('hunt')
                      .setDescription('Which hunt is this team configured for?')
                      .setRequired(true)
                      .setChoices(scav_hunts.map(sh => ({name: sh.name, value: Number(sh.id)})))
                     )
  }
  return b.addStringOption(new SlashCommandStringOption()
                         .setName('team-name')
                         .setDescription('Team name')
                         .setRequired(true)
                        )
          .addChannelOption(new SlashCommandChannelOption()
                        .setName('items-channel')
                        .setDescription('Items channel')
                        .setRequired(true))
          .addChannelOption(new SlashCommandChannelOption()
                        .setName('boxes-channel')
                        .setDescription('Boxes channel')
                        .setRequired(false))
}

export async function gen_setup_command(): Promise<SlashCommandSubcommandsOnlyBuilder> {
  return new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setName('setup')
    .setDescription('Team configuration functions')
    .addSubcommand(new SlashCommandSubcommandBuilder()
                  .setName('server')
                  .setDescription('Configure this discord server for a particular team')
                  .addStringOption(new SlashCommandStringOption()
                                  .setName('affiliation')
                                  .setDescription('Team affiliation')
                                  .setRequired(true))
                  .addBooleanOption(new SlashCommandBooleanOption()
                                    .setName('virtual')
                                    .setDescription('Is your team primarily virtual?')
                                    .setRequired(true)
                                   )
                  .addBooleanOption(new SlashCommandBooleanOption()
                                    .setName('uchicago')
                                    .setDescription('Is your team affiliated with uchicago?')
                                    .setRequired(true)
                                   )
                  )
    .addSubcommand((await hunt_builder(false))
                  .setName('testhunt')
                  .setDescription('Use only for testing. Set up test channels.')
                  )
    .addSubcommand((await hunt_builder(true))
                  .setName('hunt')
                  .setDescription('Set up channels for a new hunt')
                  )
}

async function setup_server(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const affiliation = interaction.options.getString('affiliation');
  try {
    await sequelize.transaction(async transaction => {
      const team = await Teams.create({affiliation, virtual: interaction.options.getBoolean('virtual'), uchicago: interaction.options.getBoolean('uchicago')}, {transaction})
      await TeamIntegration.create({team_id: team.id, integration_data: interaction.guildId}, {transaction});
    });
    return true
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      return false
    } else {
      throw e
    }
  }
}

async function setup_hunt(interaction: ChatInputCommandInteraction) {
  const ti = await TeamIntegration.findOne({where: {integration_data: interaction.guildId}})
  if (ti === null) {
    await interaction.reply({content: "There isn't a team connected to this server. Use </setup server:1378047953813639320> to create one", flags: MessageFlags.Ephemeral});
  } else {
    const boxes_channel = interaction.options.getChannel('boxes-channel')
    const items_channel = interaction.options.getChannel('items-channel')
    if (!(boxes_channel instanceof TextChannel && items_channel instanceof TextChannel)) {
      await interaction.reply({content: "Invalid channels selected. Must be normal text channels.", flags: MessageFlags.Ephemeral});
      return
    }
    const team_scav_hunt = await TeamScavHunts.create({name: interaction.options.getString('team-name'), team_id: ti.team_id, discord_guild_id: interaction.guildId, discord_items_channel_id: items_channel.id, discord_pages_channel_id: boxes_channel?.id, scav_hunt_id: interaction.options.getInteger('hunt')})
    await update_items_message(interaction.client, team_scav_hunt, interaction.options.getChannel('items-channel'));
    if (boxes_channel !== null) {
      await update_pages_message(interaction.client, team_scav_hunt, boxes_channel);
    }
    await interaction.reply({content: "Setup complete!", flags: MessageFlags.Ephemeral});
  }
}

export async function handle_setup(interaction: ChatInputCommandInteraction) {
  if (interaction.options.getSubcommand() === "server") {
    if (await setup_server(interaction)) {
      await interaction.reply({content: "Team created! Team management commands will only be available to users with the Manage Server permission in this server.", flags: MessageFlags.Ephemeral})
    } else {
      await interaction.reply({content: "There is already a team set up for this server", flags: MessageFlags.Ephemeral})
    }
  } else if (["hunt", "testhunt"].includes(interaction.options.getSubcommand())) {
    await setup_hunt(interaction);
  } else {
    await interaction.reply({content: "Invalid subcommand. This is a bug. Please report this to the developers.", flags: MessageFlags.Ephemeral})
  }
}

