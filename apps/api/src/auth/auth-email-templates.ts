import { EmailMessage } from '../notifications/channels/email-sender';

const EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 10);

export function passwordResetCodeEmail(to: string, firstName: string, code: string): EmailMessage {
  return {
    to,
    subject: 'Your Bii Localfinder password reset code',
    body: [
      `Hi ${firstName},`,
      '',
      'We received a request to reset the password for your Bii Localfinder account.',
      '',
      `Your verification code: ${code}`,
      '',
      `The code expires in ${EXPIRY_MINUTES} minutes and can only be used once.`,
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
      <p style="margin:0 0 28px;text-align:center;font-size:32px;letter-spacing:12px;font-weight:700;">${escapeHtml(code)}</p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">This code expires in ${EXPIRY_MINUTES} minutes and can only be used once. If you didn't request it, ignore this email — your current password still works and nothing has changed.</p>
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


export function workspaceInviteEmail(
  to: string,
  workspaceName: string,
  inviterName: string,
  role: string,
  token: string,
): EmailMessage {
  const base = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const href = `${base}/invite/${encodeURIComponent(token)}`;
  return {
    to,
    subject: `You're invited to join ${workspaceName}`,
    body: [
      `Hi,`,
      '',
      `${inviterName} invited you to join ${workspaceName} on Bii Localfinder as ${role.toLowerCase()}.`,
      '',
      'Accept the invitation:',
      href,
      '',
      'This invitation expires in 7 days. If you were not expecting it, you can ignore this email.',
    ].join('\n'),
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1c1917;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">Join ${escapeHtml(workspaceName)}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(inviterName)} invited you to join ${escapeHtml(workspaceName)} on Bii Localfinder as ${escapeHtml(role.toLowerCase())}.</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#166534;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:600;">Accept invitation</a></p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">This invitation expires in 7 days. If you were not expecting it, you can ignore this email.</p>
    </div>
  </body>
</html>`,
  };
}
