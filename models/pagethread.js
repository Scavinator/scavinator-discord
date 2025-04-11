import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class PageThread extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  PageThread.init({
    // New Page model
    thread_id: DataTypes.TEXT,
    message_id: DataTypes.TEXT,
    page_number: DataTypes.INTEGER,
    // TeamScavHunt id
    items_channel_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'PageThread',
  });
  return PageThread;
};
