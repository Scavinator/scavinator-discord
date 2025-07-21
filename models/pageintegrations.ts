import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { Pages } from './pages';

export class PageIntegration extends Model {
  declare page_id: number
  declare integration_data: CreationOptional<{thread_id?: string, message_id?: string, message_ids?: string[]}>
  declare type: string

  declare page?: NonAttribute<Pages>;
}

PageIntegration.init({
  page_id: {
    type: DataTypes.BIGINT,
    primaryKey: true
  },
  integration_data: DataTypes.JSONB,
  type: {
    type: DataTypes.ENUM('discord'),
    primaryKey: true
  }
}, {
  sequelize,
  modelName: 'page_integrations',
  underscored: true
});
