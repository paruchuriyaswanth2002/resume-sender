import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB } from './config/db.js';
import { sameOriginOnly } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';
import { recoverInterrupted } from './services/sender.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Render/Railway/Nginx so secure cookies and rate limits work

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.googleusercontent.com'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: env.isProd ? [] : null,
      },
    },
  })
);

// Request log: method, path (no query string), status, time. Never bodies, cookies, or tokens.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.originalUrl === '/api/health') return;
    logger.info('http', { method: req.method, path: req.originalUrl.split('?')[0], status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser(env.cookieSecret));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));
app.use('/api', sameOriginOnly);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' },
  }),
  authRoutes
);
app.use('/api/campaigns', campaignRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built React app from the same origin (no CORS needed, cookies stay first-party)
const dist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status && err.status < 500 ? err.status : 500;
  let message = status < 500 ? err.message : 'Something went wrong';
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `Resume must be under ${env.maxPdfMb} MB` : 'Upload failed';
  }
  if (status >= 500) logger.error('unhandled error', { path: req.path, err: err.message });
  res.status(status).json({ error: message });
});

async function start() {
  try {
    await connectDB();
    await recoverInterrupted();
    const server = app.listen(env.port, () => logger.info(`Server listening on port ${env.port}`));

    const shutdown = async () => {
      logger.info('Shutting down');
      try {
        await connectDB().disconnect(); // Ensure DB connections are closed
        logger.info('Database connection closed');
      } catch (err) {
        logger.error('Error during database disconnection', { err: err.message });
      }
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('failed to start', { err: err.message });
    process.exit(1);
  }
}

start();