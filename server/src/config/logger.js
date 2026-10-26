import path from 'node:path';
import { fileURLToPath } from 'node:url';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(process.env.LOG_DIR || path.join(__dirname, '../../../logs'));

// Never let secrets, tokens, or message contents reach the log files.
const SENSITIVE_KEY = /token|secret|password|authorization|cookie|refresh|^code$|^raw$|^body$|attachment/i;
const TOKEN_PATTERN = /(ya29\.|1\/\/)[\w\-./]+/g;

const scrub = (value, depth = 0) => {
  if (value == null || depth > 4) return value;
  if (typeof value === 'string') return value.replace(TOKEN_PATTERN, '[redacted]');
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
};

const redact = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level' || key === 'timestamp') continue;
    info[key] = key === 'message' ? scrub(info[key]) : SENSITIVE_KEY.test(key) ? '[redacted]' : scrub(info[key]);
  }
  return info;
});

const fileFormat = winston.format.combine(winston.format.timestamp(), redact(), winston.format.json());

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  redact(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${message}${rest}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '14d',
      zippedArchive: true,
      format: fileFormat,
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '30d',
      zippedArchive: true,
      format: fileFormat,
    }),
  ],
});
