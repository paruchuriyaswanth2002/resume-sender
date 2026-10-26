import crypto from 'node:crypto';
import { Router } from 'express';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { encrypt } from '../utils/crypto.js';
import User from '../models/User.js';
import RecipientMessage from '../models/RecipientMessage.js';
import { buildAuthUrl, exchangeCode } from '../services/gmail.js';
import { issueSession, clearSession, requireAuth } from '../middleware/auth.js';

const router = Router();

// Signing in with Google also connects Gmail sending: one flow, one consent screen.
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    signed: true,
    maxAge: 10 * 60 * 1000,
  });
  res.redirect(buildAuthUrl(state));
});

router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const saved = req.signedCookies?.oauth_state;
    res.clearCookie('oauth_state');

    if (error) return res.redirect('/?error=denied');
    if (!code || !state || state !== saved) return res.redirect('/?error=state');

    try {
      const { tokens, profile } = await exchangeCode(String(code));
      const email = profile.email?.toLowerCase();

      if (!profile.email_verified || !env.allowedEmails.includes(email)) {
        logger.warn('login rejected: email not allowed');
        return res.redirect('/?error=not_allowed');
      }
      if (!tokens.scope?.includes('gmail.send') || !tokens.refresh_token) {
        return res.redirect('/?error=scope');
      }

      const fields = {
        name: profile.name || email,
        picture: profile.picture,
        googleId: profile.sub,
        gmailStatus: 'connected',
        lastLoginAt: new Date(),
        encryptedRefreshToken: encrypt(tokens.refresh_token),
      };
      let user = await User.findOne({ where: { email } });
      if (user) await user.update(fields);
      else user = await User.create({ email, ...fields });

      issueSession(res, user);
      logger.info('login ok', { userId: user.id });
      res.redirect('/');
    } catch (err) {
      logger.error('oauth callback failed', { err: err.message });
      res.redirect('/?error=oauth');
    }
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await RecipientMessage.count({
      where: { userId: req.user.id, status: 'sent', sentAt: { [Op.gte]: since } },
    });
    res.json({
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      gmailStatus: req.user.gmailStatus,
      sentToday,
      limits: { maxRecipients: env.maxRecipients, dailyLimit: env.dailyLimit, maxPdfMb: env.maxPdfMb },
    });
  })
);

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

export default router;
