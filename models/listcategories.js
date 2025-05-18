import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class ListCategories extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  ListCategories.init({
    name: DataTypes.TEXT,
    team_id: DataTypes.INTEGER,
  }, {
    sequelize,
    modelName: 'list_categories',
    underscored: true
  });
  return ListCategories;
};
