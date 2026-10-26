-- Optional. The server creates these tables automatically on start (sequelize.sync).
-- Use this file if you prefer to create them yourself or inspect the structure.

CREATE DATABASE IF NOT EXISTS resume_sender CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE resume_sender;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(200),
  picture VARCHAR(500),
  googleId VARCHAR(64),
  encryptedRefreshToken TEXT,
  gmailStatus ENUM('connected','revoked') NOT NULL DEFAULT 'connected',
  lastLoginAt DATETIME,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaigns (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId INT UNSIGNED NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  attachmentFilename VARCHAR(120),
  attachmentContentType VARCHAR(100),
  attachmentSize INT UNSIGNED,
  attachmentData LONGBLOB,
  status ENUM('running','paused','done') NOT NULL DEFAULT 'running',
  total INT UNSIGNED NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  KEY campaigns_user_created (userId, createdAt),
  CONSTRAINT fk_campaigns_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS recipient_messages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaignId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  email VARCHAR(254) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  company VARCHAR(100) NOT NULL DEFAULT '',
  status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
  errorCategory ENUM('auth','quota','invalid','temporary','interrupted','unknown'),
  errorMessage VARCHAR(255),
  providerMessageId VARCHAR(100),
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  sentAt DATETIME,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL,
  -- one email per address per campaign: this is what prevents double sends
  UNIQUE KEY uq_campaign_email (campaignId, email),
  KEY rm_campaign_status (campaignId, status),
  KEY rm_user_status_sent (userId, status, sentAt),
  CONSTRAINT fk_rm_campaign FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_rm_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
