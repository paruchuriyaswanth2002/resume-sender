import { sequelize } from '../config/db.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { decrypt } from '../utils/crypto.js';
import { render } from '../utils/template.js';
import Campaign from '../models/Campaign.js';
import RecipientMessage from '../models/RecipientMessage.js';
import User from '../models/User.js';
import { clientFromRefreshToken, sendMail, classifyError, FRIENDLY_ERRORS } from './gmail.js';

const running = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function failPending(campaignId, category) {
  await RecipientMessage.update(
    { status: 'failed', errorCategory: category, errorMessage: FRIENDLY_ERRORS[category] },
    { where: { campaignId, status: 'pending' } }
  );
}

async function finish(campaignId) {
  const pending = await RecipientMessage.count({ where: { campaignId, status: 'pending' } });
  await Campaign.update({ status: pending > 0 ? 'paused' : 'done' }, { where: { id: campaignId } });
}

// Atomically take the next pending recipient: the UPDATE only succeeds if it is still pending,
// so the same address can never be claimed (or sent) twice.
async function claimNext(campaignId) {
  for (;;) {
    const next = await RecipientMessage.findOne({
      where: { campaignId, status: 'pending' },
      order: [['id', 'ASC']],
    });
    if (!next) return null;
    const [changed] = await RecipientMessage.update(
      { status: 'sending', attempts: sequelize.literal('attempts + 1') },
      { where: { id: next.id, status: 'pending' } }
    );
    if (changed === 1) return next;
  }
}

// Sends one email per pending recipient, one at a time, with a delay between sends.
export async function runCampaign(campaignId) {
  const key = String(campaignId);
  if (running.has(key)) return;
  running.add(key);

  try {
    const campaign = await Campaign.unscoped().findByPk(campaignId); // includes the PDF
    const user = campaign && (await User.unscoped().findByPk(campaign.userId)); // includes the token
    if (!campaign || !user) return;

    if (user.gmailStatus !== 'connected' || !user.encryptedRefreshToken) {
      await failPending(campaignId, 'auth');
      await finish(campaignId);
      return;
    }

    let auth;
    try {
      auth = clientFromRefreshToken(decrypt(user.encryptedRefreshToken));
    } catch {
      // Stored token unreadable (for example ENCRYPTION_KEY changed): ask the user to sign in again.
      logger.error('could not decrypt refresh token', { userId: user.id });
      await User.update({ gmailStatus: 'revoked' }, { where: { id: user.id } });
      await failPending(campaignId, 'auth');
      await finish(campaignId);
      return;
    }
    const attachment = { filename: campaign.attachmentFilename, data: campaign.attachmentData };
    await Campaign.update({ status: 'running' }, { where: { id: campaignId } });
    logger.info('campaign started', { campaignId: key });

    for (;;) {
      const msg = await claimNext(campaignId);
      if (!msg) break;

      try {
        const providerId = await sendMail({
          auth,
          fromName: user.name || user.email,
          fromEmail: user.email,
          to: msg.email,
          subject: render(campaign.subject, msg),
          text: render(campaign.body, msg),
          attachment,
        });
        await RecipientMessage.update(
          { status: 'sent', providerMessageId: providerId, sentAt: new Date(), errorCategory: null, errorMessage: null },
          { where: { id: msg.id } }
        );
        logger.info('email sent', { campaignId: key, messageId: msg.id });
      } catch (err) {
        const category = classifyError(err);
        await RecipientMessage.update(
          { status: 'failed', errorCategory: category, errorMessage: FRIENDLY_ERRORS[category] },
          { where: { id: msg.id } }
        );
        logger.warn('email failed', {
          campaignId: key,
          messageId: msg.id,
          category,
          httpStatus: err?.response?.status,
        });

        if (category === 'auth') {
          await User.update({ gmailStatus: 'revoked' }, { where: { id: user.id } });
          await failPending(campaignId, 'auth');
          break;
        }
        if (category === 'quota') break; // leave the rest pending; retry resumes later
      }

      await sleep(env.sendDelayMs + Math.floor(Math.random() * 1000));
    }

    await finish(campaignId);
    logger.info('campaign finished', { campaignId: key });
  } catch (err) {
    logger.error('campaign crashed', { campaignId: key, err: err.message });
    await Campaign.update({ status: 'paused' }, { where: { id: campaignId } }).catch(() => {});
  } finally {
    running.delete(key);
  }
}

// On boot, anything left mid-send by a crash or deploy is marked failed so it is never silently resent.
export async function recoverInterrupted() {
  const [messages] = await RecipientMessage.update(
    { status: 'failed', errorCategory: 'interrupted', errorMessage: FRIENDLY_ERRORS.interrupted },
    { where: { status: 'sending' } }
  );
  const [campaigns] = await Campaign.update({ status: 'paused' }, { where: { status: 'running' } });
  if (messages || campaigns) logger.warn('recovered interrupted sends', { messages, campaigns });
}
