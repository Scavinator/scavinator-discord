'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      team_scav_hunt_id: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: {
            tableName: 'team_scav_hunts'
          },
          key: 'id',
        },
      },
      page_number: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      discord_thread_id: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      discord_message_id: {
        allowNull: false,
        type: Sequelize.TEXT
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pages');
  }
};
