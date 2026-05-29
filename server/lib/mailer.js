/**
 * mailer.js — Pluggable transactional email.
 *
 * Default transport is a console logger so every email-driven flow (verify,
 * reset, invite) works with ZERO setup in dev/test. Wire a real provider
 * (SMTP / Resend / SES) by calling setTransport() at boot; the call sites
 * (sendMail + the link builders) never change.
 *
 * We only ever put a single-use, short-lived token in the link — never a
 * password or secret — so console output is safe in development.
 */
const appBaseUrl = () => (process.env.APP_BASE_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

export const verifyEmailLink = (token) => `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
export const resetPasswordLink = (token) => `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
export const inviteLink = (token) => `${appBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;

let _transport = null;
/** Provide a real transport: async ({ to, subject, text, html }) => result. */
export function setTransport(fn) { _transport = typeof fn === 'function' ? fn : null; }

export async function sendMail({ to, subject, text, html }) {
  if (_transport) {
    try { return await _transport({ to, subject, text, html }); }
    catch (e) { console.warn('[mailer] transport failed:', e.message); return { delivered: false, error: e.message }; }
  }
  // Console transport (default).
  console.log(`\n[mailer:console] to=${to}\n  subject: ${subject}\n  ${String(text || '').replace(/\n/g, '\n  ')}\n`);
  return { delivered: false, transport: 'console' };
}

export default { sendMail, setTransport, verifyEmailLink, resetPasswordLink, inviteLink };
