import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Op, fn, col } from 'sequelize';
import { env } from '../config/env.js';
import { sequelize } from '../config/db.js';
import { logger } from '../config/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadResume } from '../middleware/upload.js';
import Campaign from '../models/Campaign.js';
import RecipientMessage from '../models/RecipientMessage.js';
import { runCampaign } from '../services/sender.js';

const router = Router();
router.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });

const startInBackground = (id) =>
  setImmediate(() => runCampaign(id).catch((e) => logger.error('run failed', { err: e.message })));

const blankCounts = () => ({ pending: 0, sending: 0, sent: 0, failed: 0 });

async function countsFor(ids) {
  if (!ids.length) return {};
  const rows = await RecipientMessage.findAll({
    attributes: ['campaignId', 'status', [fn('COUNT', col('id')), 'n']],
    where: { campaignId: { [Op.in]: ids } },
    group: ['campaignId', 'status'],
    raw: true,
  });
  const map = {};
  for (const r of rows) {
    map[r.campaignId] ||= blankCounts();
    map[r.campaignId][r.status] = Number(r.n);
  }
  return map;
}

// Create a campaign and start sending
router.post(
  '/',
  sendLimiter,
  uploadResume,
  asyncHandler(async (req, res) => {
    const subject = String(req.body.subject || '').replace(/[\r\n]+/g, ' ').trim();
    const body = String(req.body.body || '').trim();
    if (!subject || subject.length > 200) return fail(res, 400, 'Subject is required (max 200 characters)');
    if (!body || body.length > 20000) return fail(res, 400, 'Message is required (max 20,000 characters)');

    if (!req.file) return fail(res, 400, 'Attach your resume as a PDF');
    if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return fail(res, 400, 'That file is not a valid PDF');
    }

    let raw;
    try {
      raw = JSON.parse(req.body.recipients || '[]');
    } catch {
      return fail(res, 400, 'Recipients could not be read');
    }
    if (!Array.isArray(raw)) return fail(res, 400, 'Recipients could not be read');

    const seen = new Map();
    const invalid = [];
    for (const r of raw) {
      const email = String(r?.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) {
        invalid.push(email || '(empty)');
        continue;
      }
      if (!seen.has(email)) {
        seen.set(email, {
          email,
          name: String(r.name || '').slice(0, 100).trim(),
          company: String(r.company || '').slice(0, 100).trim(),
        });
      }
    }
    if (invalid.length) return fail(res, 400, 'Some email addresses are invalid', { invalid });

    const recipients = [...seen.values()];
    if (recipients.length === 0) return fail(res, 400, 'Add at least one recipient');
    if (recipients.length > env.maxRecipients) {
      return fail(res, 400, `You can send to at most ${env.maxRecipients} recipients at a time`);
    }

    if (req.user.gmailStatus !== 'connected') {
      return fail(res, 409, 'Gmail access was revoked. Sign in with Google again to reconnect.');
    }
    if (await Campaign.count({ where: { userId: req.user.id, status: 'running' } })) {
      return fail(res, 409, 'Another send is still running. Wait for it to finish.');
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sent24h = await RecipientMessage.count({
      where: { userId: req.user.id, status: 'sent', sentAt: { [Op.gte]: since } },
    });
    if (sent24h + recipients.length > env.dailyLimit) {
      return fail(res, 429, `Daily limit is ${env.dailyLimit} emails. You have ${Math.max(env.dailyLimit - sent24h, 0)} left in the last 24 hours.`);
    }

    const campaign = await sequelize.transaction(async (transaction) => {
      const c = await Campaign.create(
        {
          userId: req.user.id,
          subject,
          body,
          total: recipients.length,
          attachmentFilename: req.file.originalname.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'resume.pdf',
          attachmentContentType: 'application/pdf',
          attachmentSize: req.file.size,
          attachmentData: req.file.buffer,
        },
        { transaction }
      );
      await RecipientMessage.bulkCreate(
        recipients.map((r) => ({ ...r, campaignId: c.id, userId: req.user.id })),
        { transaction }
      );
      return c;
    });

    logger.info('campaign created', { campaignId: campaign.id, recipients: recipients.length });
    startInBackground(campaign.id);
    res.status(201).json({ id: campaign.id });
  })
);

// List campaigns with status counts
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const campaigns = await Campaign.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: 50,
      raw: true,
    });
    const counts = await countsFor(campaigns.map((c) => c.id));
    res.json({
      campaigns: campaigns.map((c) => ({
        id: c.id,
        subject: c.subject,
        status: c.status,
        total: c.total,
        createdAt: c.createdAt,
        counts: counts[c.id] || blankCounts(),
      })),
    });
  })
);

const loadOwned = async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    fail(res, 404, 'Not found');
    return null;
  }
  const campaign = await Campaign.findOne({ where: { id: req.params.id, userId: req.user.id }, raw: true });
  if (!campaign) fail(res, 404, 'Not found');
  return campaign;
};

// One campaign with every recipient's status
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await loadOwned(req, res);
    if (!campaign) return;
    const messages = await RecipientMessage.findAll({
      where: { campaignId: campaign.id },
      order: [['id', 'ASC']],
      attributes: ['id', 'email', 'name', 'company', 'status', 'errorCategory', 'errorMessage', 'sentAt', 'attempts'],
      raw: true,
    });
    res.json({
      campaign: {
        id: campaign.id,
        subject: campaign.subject,
        body: campaign.body,
        status: campaign.status,
        createdAt: campaign.createdAt,
        attachment: { filename: campaign.attachmentFilename, size: campaign.attachmentSize },
      },
      messages,
    });
  })
);

// Retry failed (and any still-pending) recipients. Already-sent ones are never touched.
router.post(
  '/:id/retry',
  sendLimiter,
  asyncHandler(async (req, res) => {
    const campaign = await loadOwned(req, res);
    if (!campaign) return;
    if (campaign.status === 'running') return fail(res, 409, 'This send is still running');
    if (req.user.gmailStatus !== 'connected') {
      return fail(res, 409, 'Gmail access was revoked. Sign in with Google again to reconnect.');
    }
    if (await Campaign.count({ where: { userId: req.user.id, status: 'running', id: { [Op.ne]: campaign.id } } })) {
      return fail(res, 409, 'Another send is still running. Wait for it to finish.');
    }

    // Addresses Gmail rejected as invalid are not retried.
    await RecipientMessage.update(
      { status: 'pending', errorCategory: null, errorMessage: null },
      {
        where: {
          campaignId: campaign.id,
          status: 'failed',
          [Op.or]: [{ errorCategory: null }, { errorCategory: { [Op.ne]: 'invalid' } }],
        },
      }
    );
    const pending = await RecipientMessage.count({ where: { campaignId: campaign.id, status: 'pending' } });
    if (!pending) return fail(res, 400, 'Nothing to retry');

    await Campaign.update({ status: 'running' }, { where: { id: campaign.id } });
    logger.info('campaign retry', { campaignId: campaign.id, pending });
    startInBackground(campaign.id);
    res.json({ retrying: pending });
  })
);

// Delete a campaign, its recipients, and the stored resume
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await loadOwned(req, res);
    if (!campaign) return;
    if (campaign.status === 'running') return fail(res, 409, 'Wait for this send to finish before deleting it');
    await sequelize.transaction(async (transaction) => {
      await RecipientMessage.destroy({ where: { campaignId: campaign.id }, transaction });
      await Campaign.destroy({ where: { id: campaign.id }, transaction });
    });
    logger.info('campaign deleted', { campaignId: campaign.id });
    res.json({ ok: true });
  })
);

export default router;
