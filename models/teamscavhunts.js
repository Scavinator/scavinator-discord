import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class TeamScavHunts extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  TeamScavHunts.init({
    discord_items_channel_id: DataTypes.TEXT,
    discord_pages_channel_id: DataTypes.TEXT,
    discord_items_message_id: DataTypes.TEXT,
    discord_pages_message_id: DataTypes.TEXT,
    discord_guild_id: DataTypes.TEXT,
    team_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'team_scav_hunts',
    timestamps: false
  });
  return TeamScavHunts;
};
