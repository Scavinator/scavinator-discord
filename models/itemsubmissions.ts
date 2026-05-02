import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { Item } from './items';

export class ItemSubmission extends Model {
  declare instructions: CreationOptional<string>
  declare item_id: number
  declare submitter_discord_id: number | null

  declare item?: NonAttribute<Item>;
}

ItemSubmission.init({
  instructions: DataTypes.TEXT,
  item_id: DataTypes.INTEGER,
  submitter_discord_id: DataTypes.INTEGER,
}, {
  sequelize,
  modelName: 'item_submissions',
  underscored: true
});
