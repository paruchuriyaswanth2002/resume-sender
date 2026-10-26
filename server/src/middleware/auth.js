import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const SESSION_COOKIE = 'session';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

export function issueSession(res, user) {
  const token = jwt.sign({ sub: String(user.id) }, env.jwtSecret, { expiresIn: '7d' });
  res.cookie(SESSION_COOKIE, token, cookieOptions);
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Sign in required' });

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }

  const found = await User.findByPk(payload.sub);
  if (!found || !env.allowedEmails.includes(found.email)) {
    return res.status(401).json({ error: 'Sign in required' });
  }
  req.user = found.get({ plain: true });
  next();
});

// Extra CSRF layer on top of SameSite=Lax: reject state-changing requests from other origins.
export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== env.appUrl) {
    return res.status(403).json({ error: 'Blocked cross-site request' });
  }
  next();
}
