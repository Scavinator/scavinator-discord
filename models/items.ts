import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class Item extends Model {
  declare number: number
  declare page_number: CreationOptional<number>
  declare content: CreationOptional<string>
  declare discord_thread_id: CreationOptional<string>
  declare discord_message_id: CreationOptional<string>
  declare team_scav_hunt_id: number
  declare list_category_id: CreationOptional<number>
}

Item.init({
  number: DataTypes.INTEGER,
  page_number: DataTypes.INTEGER,
  content: DataTypes.TEXT,
  discord_thread_id: DataTypes.TEXT,
  discord_message_id: DataTypes.TEXT,
  team_scav_hunt_id: DataTypes.INTEGER,
  list_category_id: DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'items',
  underscored: true
});
