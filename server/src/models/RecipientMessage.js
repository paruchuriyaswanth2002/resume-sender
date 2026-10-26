import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const RecipientMessage = sequelize.define(
  'RecipientMessage',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    campaignId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'campaigns', key: 'id' },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    email: { type: DataTypes.STRING(254), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    company: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
    status: {
      type: DataTypes.ENUM('pending', 'sending', 'sent', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorCategory: DataTypes.ENUM('auth', 'quota', 'invalid', 'temporary', 'interrupted', 'unknown'),
    errorMessage: DataTypes.STRING(255),
    providerMessageId: DataTypes.STRING(100),
    attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    sentAt: DataTypes.DATE,
  },
  {
    tableName: 'recipient_messages',
    indexes: [
      // One email per address per campaign: this is what prevents double sends.
      { unique: true, name: 'uq_campaign_email', fields: ['campaignId', 'email'] },
      { name: 'rm_campaign_status', fields: ['campaignId', 'status'] },
      { name: 'rm_user_status_sent', fields: ['userId', 'status', 'sentAt'] },
    ],
  }
);

export default RecipientMessage;
