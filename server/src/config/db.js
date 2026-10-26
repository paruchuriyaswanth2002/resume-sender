import { Sequelize } from 'sequelize';
import { env } from './env.js';
import { logger } from './logger.js';

const options = {
  dialect: 'mysql',
  logging: false,
  timezone: '+00:00',
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  pool: { max: 10, min: 0, idle: 10000, acquire: 30000 },
  dialectOptions: env.db.ssl ? { ssl: { rejectUnauthorized: true } } : {},
};

export const sequelize = env.db.url
  ? new Sequelize(env.db.url, options)
  : new Sequelize(env.db.name, env.db.user, env.db.password, {
      ...options,
      host: env.db.host,
      port: env.db.port,
    });

// Models register themselves on import (routes import them), then sync creates any missing tables.
export async function connectDB() {
  await sequelize.authenticate();
  await sequelize.sync();
  logger.info('MySQL connected');
}
