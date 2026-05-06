import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { Item } from './items';
import { addToCache } from '../lib/pg_notify_dedupe';

export class ItemSubmission extends Model {
  declare instructions?: string
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
  underscored: true,
  hooks: {
    beforeCreate: (is) => addToCache(is.item_id),
    beforeUpdate: (is) => addToCache(is.item_id),
    beforeSave: (is) => addToCache(is.item_id),
  }
});
