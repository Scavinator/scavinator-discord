import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Item extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Item.init({
    number: DataTypes.INTEGER,
    page_number: DataTypes.INTEGER,
    discord_thread_id: DataTypes.TEXT,
    team_scav_hunt_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'items',
    timestamps: false
  });
  return Item;
};
