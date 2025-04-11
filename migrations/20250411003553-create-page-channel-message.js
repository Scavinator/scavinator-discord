'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PageThreads', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      items_channel_id: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      thread_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      page_number: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      message_id: {
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
    await queryInterface.dropTable('PageThreads');
  }
};
