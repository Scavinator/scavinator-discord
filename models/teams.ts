import { Model, DataTypes, CreationOptional } from 'sequelize';
import { sequelize } from './base';

export class Teams extends Model {
  declare affiliation: string
  declare prefix: CreationOptional<string>
  declare uchicago: boolean
  declare virtual: boolean
  declare id: CreationOptional<number>
}

Teams.init({
  affiliation: DataTypes.TEXT,
  prefix: DataTypes.TEXT,
  uchicago: DataTypes.BOOLEAN,
  virtual: DataTypes.BOOLEAN,
}, {
  sequelize,
  modelName: 'teams',
  underscored: true
});
