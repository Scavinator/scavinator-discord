import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { PageIntegration } from './pageintegrations';

export class Pages extends Model {
  declare id: number
  declare page_number: CreationOptional<number>
  declare team_scav_hunt_id: number

  declare page_integration?: NonAttribute<PageIntegration>;
}

Pages.init({
  page_number: DataTypes.INTEGER,
  team_scav_hunt_id: DataTypes.INTEGER
}, {
  sequelize,
  modelName: 'pages',
  underscored: true
});
