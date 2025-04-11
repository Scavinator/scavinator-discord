'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('team_scav_hunts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      discord_items_channel_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      discord_pages_channel_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      discord_pages_message_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      discord_items_message_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      discord_guild_id: {
        allowNull: false,
        type: Sequelize.TEXT
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('team_scav_hunts');
  }
};
