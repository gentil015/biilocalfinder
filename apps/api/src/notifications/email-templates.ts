import { EmailMessage } from './channels/email-sender';
import { NotificationLink } from './notification-links';

// The one HTML shell every notification email is wrapped in. Kept dependency-
// and framework-free on purpose (no React/JSX/MJML): it is a single string
// template, so it can run inside the notifications worker with nothing extra
// installed, and the exact bytes are easy to reason about.
//
// Palette mirrors the web app's Forest Green + Warm Ivory identity
// (apps/web/app/globals.css): ivory canvas, white card, deep-forest header,
// forest-green CTA. It is intentionally light-mode only — email clients
// handle dark mode inconsistently, and a light card on a light reader is the
// most predictable rendering.
const BRAND = {
  forest: '#166534', // brand-700 — header band + CTA button
  forestDeep: '#0B1712', // brand-950 — header text
  ivory: '#FAF8F2', // canvas
  surface: '#FFFFFF', // card
  ink: '#1C2922', // ink-900 — body text
  muted: '#526258', // ink-500 — secondary text
  border: '#DDE5DA', // ink-200
  mint: '#DCFCE7', // brand-50 — accent tint
};

export interface NotificationEmailInput {
  to: string;
  title: string;
  body?: string;
  /** Greeting name; when present the email opens with "Hi {name},". */
  recipientName?: string;
  /** Optional deep-link CTA rendered as a button. */
  link?: NotificationLink | null;
}

// Builds the full EmailMessage (plain-text + HTML) for a notification. Text
// and HTML are both derived from the same values so they cannot drift — the
// same discipline as auth-email-templates.ts. Any value that can contain
// user-supplied data is escaped before it reaches the HTML.
export function notificationEmail(input: NotificationEmailInput): EmailMessage {
  const { to, title, link } = input;
  const body = input.body?.trim() || title;
  const greeting = input.recipientName?.trim();

  const text = buildText({ greeting, body, link });

  return {
    to,
    subject: title,
    body: text,
    html: buildHtml({ title, body, greeting, link }),
  };
}

function buildText({ greeting, body, link }: { greeting?: string; body: string; link?: NotificationLink | null }): string {
  return [
    greeting ? `Hi ${greeting},` : 'Hi,',
    '',
    body,
    ...(link ? ['', `${link.label}:`, link.href] : []),
    '',
    '— Bii Localfinder',
    "You're receiving this because you have email notifications turned on for this category.",
    'Manage what we send you: ' + manageUrl(),
  ].join('\n');
}

function buildHtml({
  title,
  body,
  greeting,
  link,
}: {
  title: string;
  body: string;
  greeting?: string;
  link?: NotificationLink | null;
}): string {
  const e = escapeHtml;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.ivory};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
    <div style="padding:32px 16px;">
      <div style="max-width:520px;margin:0 auto;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
        <div style="background:${BRAND.forest};padding:20px 32px;">
          <p style="margin:0;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">Bii Localfinder</p>
        </div>

        <div style="padding:32px;">
          ${greeting ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.muted};">Hi ${e(greeting)},</p>` : ''}
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:${BRAND.ink};">${e(title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${e(body)}</p>
          ${
            link
              ? `<p style="margin:0 0 8px;">
            <a href="${e(link.href)}" style="display:inline-block;background:${BRAND.forest};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;font-weight:600;">${e(link.label)}</a>
          </p>
          <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:${BRAND.muted};word-break:break-all;">Or open this link: <a href="${e(link.href)}" style="color:${BRAND.forest};">${e(link.href)}</a></p>`
              : ''
          }
        </div>

        <div style="border-top:1px solid ${BRAND.border};background:${BRAND.ivory};padding:20px 32px;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.muted};">You&rsquo;re receiving this because you have email notifications turned on for this category.</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};"><a href="${e(manageUrl())}" style="color:${BRAND.forest};text-decoration:underline;">Manage what we send you</a></p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

function manageUrl(): string {
  const base = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/settings/notifications`;
}

// Values interpolated into HTML can come from user data (names, business
// names, free-text bodies), so everything is escaped — same approach as
// auth-email-templates.ts.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
