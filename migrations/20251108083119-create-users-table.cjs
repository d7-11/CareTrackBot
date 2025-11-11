'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY NOT NULL,
        medicines TEXT[] NOT NULL DEFAULT '{}',
        dates TEXT[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS users;');
  }
};