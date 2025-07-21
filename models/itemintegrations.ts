import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { Item } from './items';

export class ItemIntegration extends Model {
  declare item_id: number
  declare integration_data: CreationOptional<{thread_id?: string, message_id?: string, summary?: string}>
  declare type: 'discord'

  declare item?: NonAttribute<Item>;
}

ItemIntegration.init({
  item_id: {
    type: DataTypes.INTEGER,
    primaryKey: true
  },
  integration_data: DataTypes.JSONB,
  type: {
    type: DataTypes.ENUM('discord'),
    primaryKey: true
  }
}, {
  sequelize,
  modelName: 'item_integrations',
  underscored: true
});
