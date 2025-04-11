import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class ItemChannel extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ItemChannel.init({
    // TeamScavHunt
    items_channel_id: DataTypes.TEXT,
    pages_channel_id: DataTypes.TEXT,
    items_message_id: DataTypes.TEXT,
    pages_message_id: DataTypes.TEXT,
    // Team
    guild_id: DataTypes.TEXT
  }, {
    sequelize,
    modelName: 'ItemChannel',
  });
  return ItemChannel;
};
