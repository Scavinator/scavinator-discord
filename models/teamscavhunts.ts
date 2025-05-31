import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class TeamScavHunts extends Model {
  declare name: string
  declare discord_items_channel_id: CreationOptional<string>
  declare discord_pages_channel_id: CreationOptional<string>
  declare discord_items_message_id: CreationOptional<string>
  declare discord_pages_message_id: CreationOptional<string>
  declare discord_guild_id: CreationOptional<string>
  declare team_id: number
  declare scav_hunt_id: number
  declare id: CreationOptional<number>
}

TeamScavHunts.init({
  name: DataTypes.TEXT,
  discord_items_channel_id: DataTypes.TEXT,
  discord_pages_channel_id: DataTypes.TEXT,
  discord_items_message_id: DataTypes.TEXT,
  discord_pages_message_id: DataTypes.TEXT,
  discord_guild_id: DataTypes.TEXT,
  scav_hunt_id: DataTypes.INTEGER,
  team_id: DataTypes.INTEGER,
}, {
  sequelize,
  modelName: 'team_scav_hunts',
  underscored: true
});
