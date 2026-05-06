import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { ItemIntegration } from './itemintegrations';
import { ItemSubmission } from './itemsubmissions';
import { addToCache } from '../lib/pg_notify_dedupe';

export class Item extends Model {
  declare id: number
  declare number: number
  declare page_number: CreationOptional<number>
  declare content: CreationOptional<string>
  declare team_scav_hunt_id: number
  declare list_category_id: CreationOptional<number>
  declare digital_submission: boolean
  declare special_formatting: boolean

  declare item_integration?: NonAttribute<ItemIntegration>;
  declare item_submission?: NonAttribute<ItemSubmission>;
}

Item.init({
  number: DataTypes.INTEGER,
  page_number: DataTypes.INTEGER,
  content: DataTypes.TEXT,
  team_scav_hunt_id: DataTypes.INTEGER,
  list_category_id: DataTypes.INTEGER,
  digital_submission: DataTypes.BOOLEAN,
  special_formatting: DataTypes.BOOLEAN
}, {
  sequelize,
  modelName: 'items',
  underscored: true,
  hooks: {
    beforeCreate: (i) => addToCache(i.id),
    beforeUpdate: (i) => addToCache(i.id),
    beforeSave: (i) => addToCache(i.id),
  }
});
