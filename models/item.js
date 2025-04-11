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
    // Item
    item_number: DataTypes.INTEGER,
    page_number: DataTypes.INTEGER,
    thread_id: DataTypes.TEXT,
    item_channel_id: DataTypes.INTEGER // TeamScavHunt id
  }, {
    sequelize,
    modelName: 'Item',
  });
  return Item;
};
