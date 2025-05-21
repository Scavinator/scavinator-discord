import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class Pages extends Model {
  declare discord_thread_id: CreationOptional<string>
  declare discord_message_id: CreationOptional<string>
  declare page_number: CreationOptional<number>
  declare team_scav_hunt_id: number
}

Pages.init({
  discord_thread_id: DataTypes.TEXT,
  discord_message_id: DataTypes.TEXT,
  page_number: DataTypes.INTEGER,
  team_scav_hunt_id: DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'pages',
  underscored: true
});
