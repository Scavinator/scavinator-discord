import { Sequelize } from 'sequelize';
import { readFileSync } from 'fs';

const dbConfig = JSON.parse(readFileSync('./config.json', 'utf8')).database;
export const sequelize = new Sequelize({
  dialect: 'postgres',
  logging: console.log,
  ...dbConfig
});
