import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class TeamIntegration extends Model {
  declare team_id: number
  declare integration_data: CreationOptional<Object>
  declare id: CreationOptional<number>
}

TeamIntegration.init({
  team_id: DataTypes.INTEGER,
  integration_data: DataTypes.JSON,
}, {
  sequelize,
  modelName: 'team_integrations',
  underscored: true
});
