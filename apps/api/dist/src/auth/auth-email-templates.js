"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetCodeEmail = passwordResetCodeEmail;
const EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 10);
function passwordResetCodeEmail(to, firstName, code) {
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
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
