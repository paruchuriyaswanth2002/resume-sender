import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    name: DataTypes.STRING(200),
    picture: DataTypes.STRING(500),
    googleId: DataTypes.STRING(64),
    // AES-256-GCM encrypted. Hidden from normal queries (see defaultScope).
    encryptedRefreshToken: DataTypes.TEXT,
    gmailStatus: { type: DataTypes.ENUM('connected', 'revoked'), allowNull: false, defaultValue: 'connected' },
    lastLoginAt: DataTypes.DATE,
  },
  {
    tableName: 'users',
    defaultScope: { attributes: { exclude: ['encryptedRefreshToken'] } },
  }
);

export default User;
