'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ItemChannels', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      items_channel_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      pages_channel_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      pages_message_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      items_message_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      guild_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ItemChannels');
  }
};
