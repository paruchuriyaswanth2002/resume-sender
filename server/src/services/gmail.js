import { google } from 'googleapis';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import { env } from '../config/env.js';

export const SCOPES = ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/gmail.send'];

const newOAuthClient = () =>
  new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);

export const buildAuthUrl = (state) =>
  newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always returns a refresh token
    scope: SCOPES,
    state,
  });

export async function exchangeCode(code) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  return { tokens, profile: ticket.getPayload() };
}

export function clientFromRefreshToken(refreshToken) {
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

const clean = (s) => String(s).replace(/[\r\n"<>]+/g, ' ').trim();

export async function sendMail({ auth, fromName, fromEmail, to, subject, text, attachment }) {
  const mail = new MailComposer({
    from: `"${clean(fromName)}" <${fromEmail}>`,
    to, // exactly one recipient per message
    subject: clean(subject),
    text,
    attachments: [
      { filename: attachment.filename, content: attachment.data, contentType: 'application/pdf' },
    ],
  });
  const message = await mail.compile().build();
  const gmail = google.gmail({ version: 'v1', auth });
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: message.toString('base64url') },
  });
  return res.data.id;
}

export const FRIENDLY_ERRORS = {
  auth: 'Gmail access expired or was revoked. Sign in again.',
  quota: 'Gmail sending limit reached. Try again later.',
  invalid: 'Gmail rejected this address or message.',
  temporary: 'Temporary Gmail error. Retry shortly.',
  interrupted: 'Server restarted during send. Check your Sent folder before retrying.',
  unknown: 'Unexpected error while sending.',
};

export function classifyError(err) {
  const status = err?.response?.status ?? err?.status;
  const data = err?.response?.data;
  const reason = data?.error?.errors?.[0]?.reason || '';
  const text = `${err?.message || ''} ${typeof data?.error === 'string' ? data.error : ''}`;

  if (/invalid_grant|invalid_client|unauthorized_client/i.test(text) || status === 401) return 'auth';
  if (status === 429 || /rateLimitExceeded|userRateLimitExceeded|dailyLimitExceeded/i.test(reason) || (status === 403 && /quota|limit/i.test(text))) return 'quota';
  if (status === 400) return 'invalid';
  if ((status && status >= 500) || /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(`${err?.code} ${text}`)) return 'temporary';
  return 'unknown';
}
