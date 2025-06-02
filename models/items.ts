import { Model, DataTypes, CreationOptional, NonAttribute } from 'sequelize';
import { sequelize } from './base';
import { ItemIntegration } from './itemintegrations';

export class Item extends Model {
  declare id: number
  declare number: number
  declare page_number: CreationOptional<number>
  declare content: CreationOptional<string>
  declare team_scav_hunt_id: number
  declare list_category_id: CreationOptional<number>
  declare status: CreationOptional<string>

  declare item_integration?: NonAttribute<ItemIntegration>;
}

Item.init({
  number: DataTypes.INTEGER,
  page_number: DataTypes.INTEGER,
  content: DataTypes.TEXT,
  team_scav_hunt_id: DataTypes.INTEGER,
  list_category_id: DataTypes.INTEGER,
  status: DataTypes.ENUM('box')
}, {
  sequelize,
  modelName: 'items',
  underscored: true
});
