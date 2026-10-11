import { EmailMessage } from '../notifications/channels/email-sender';

const EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 60);

// The link the user clicks. Built from WEB_URL (the web app), not the API,
// because this is the one link a password-reset email sends a human to.
export function passwordResetUrl(token: string): string {
  const base = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

// Auth-critical mail is composed here rather than in the notifications queue:
// that queue is preference-gated and skips unverified addresses, and a reset
// link must go out regardless of either. Text + HTML are both built from the
// same values so they can't drift apart.
export function passwordResetEmail(to: string, firstName: string, token: string): EmailMessage {
  const url = passwordResetUrl(token);

  return {
    to,
    subject: 'Reset your Bii Localfinder password',
    body: [
      `Hi ${firstName},`,
      '',
      'We received a request to reset the password for your Bii Localfinder account.',
      '',
      `Open this link to choose a new password:`,
      url,
      '',
      `The link expires in ${EXPIRY_MINUTES} minutes and can only be used once.`,
      '',
      "If you didn't request this, you can ignore this email — your current password still works and nothing has changed.",
    ].join('\n'),
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Reset your password</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">We received a request to reset the password for your Bii Localfinder account.</p>
      <p style="margin:0 0 24px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">Choose a new password</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#57534e;">Or paste this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="${escapeHtml(url)}" style="color:#2563eb;">${escapeHtml(url)}</a></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">This link expires in ${EXPIRY_MINUTES} minutes and can only be used once. If you didn't request it, ignore this email — your current password still works and nothing has changed.</p>
    </div>
  </body>
</html>`,
  };
}

// firstName is user-supplied at registration, so it is interpolated into HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}