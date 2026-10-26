import 'dotenv/config';

const need = (key) => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required environment variable: ${key}`);
  return v;
};

const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || '';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 5000),
  appUrl: need('APP_URL').replace(/\/$/, ''),
  db: {
    url: databaseUrl,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: databaseUrl ? '' : need('DB_USER'),
    password: process.env.DB_PASSWORD || '',
    name: databaseUrl ? '' : need('DB_NAME'),
    ssl: process.env.DB_SSL === 'true',
  },
  googleClientId: need('GOOGLE_CLIENT_ID'),
  googleClientSecret: need('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: need('GOOGLE_REDIRECT_URI'),
  jwtSecret: need('JWT_SECRET'),
  cookieSecret: need('COOKIE_SECRET'),
  encryptionKey: need('ENCRYPTION_KEY'),
  allowedEmails: need('ALLOWED_EMAILS')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  maxRecipients: Number(process.env.MAX_RECIPIENTS || 50),
  dailyLimit: Number(process.env.DAILY_LIMIT || 100),
  sendDelayMs: Number(process.env.SEND_DELAY_MS || 2500),
  maxPdfMb: Number(process.env.MAX_PDF_MB || 5),
};

if (Buffer.from(env.encryptionKey, 'hex').length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}
