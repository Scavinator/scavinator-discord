import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Pages extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Pages.init({
    discord_thread_id: DataTypes.TEXT,
    discord_message_id: DataTypes.TEXT,
    page_number: DataTypes.INTEGER,
    team_scav_hunt_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'pages',
    timestamps: false
  });
  return Pages;
};
