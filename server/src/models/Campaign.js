import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const Campaign = sequelize.define(
  'Campaign',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    subject: { type: DataTypes.STRING(200), allowNull: false },
    body: { type: DataTypes.TEXT('medium'), allowNull: false },
    attachmentFilename: DataTypes.STRING(120),
    attachmentContentType: DataTypes.STRING(100),
    attachmentSize: DataTypes.INTEGER.UNSIGNED,
    // The PDF itself, kept so failed emails can be retried. Hidden from normal queries.
    attachmentData: DataTypes.BLOB('long'),
    status: { type: DataTypes.ENUM('running', 'paused', 'done'), allowNull: false, defaultValue: 'running' },
    total: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: 'campaigns',
    indexes: [{ fields: ['userId', 'createdAt'] }],
    defaultScope: { attributes: { exclude: ['attachmentData'] } },
  }
);

export default Campaign;
