import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class ScavHunts extends Model {
  declare name: string
  declare id: CreationOptional<string>
}

ScavHunts.init({
  name: DataTypes.TEXT,
}, {
  sequelize,
  modelName: 'scav_hunts',
  underscored: true
});
