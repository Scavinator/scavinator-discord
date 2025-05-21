import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class ListCategories extends Model {
  declare name: string
  declare team_id: number
  declare id: CreationOptional<number>
}

ListCategories.init({
  name: DataTypes.TEXT,
  team_id: DataTypes.INTEGER,
}, {
  sequelize,
  modelName: 'list_categories',
  underscored: true
});
