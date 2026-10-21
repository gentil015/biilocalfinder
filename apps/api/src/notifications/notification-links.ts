import { NotificationType } from '@prisma/client';

// Deep-links a notification back into the web app, so a notification email
// can carry a "View booking" button instead of ending in dead text. This is
// deliberately a pure function of (type, data): callers already put the
// identifier the recipient needs into `data` (bookingId, …), and the
// processor is the one place every channel passes through — so the mapping
// lives here rather than being repeated in each service.
//
// Returning null is the common, correct case: many notifications have no
// single page to land on, and their email is plain text with no button.
export interface NotificationLink {
  href: string;
  label: string;
}

// WEB_URL is the web app's origin — the same value the password-reset email
// builds its link from (auth-email-templates.ts). Trailing slashes are
// trimmed so a configured value can't produce `//bookings/…`.
function webUrl(): string {
  return (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function notificationLink(
  type: NotificationType,
  data: Record<string, unknown> | undefined,
): NotificationLink | null {
  const bookingId = data && typeof data.bookingId === 'string' ? data.bookingId : undefined;
  if (!bookingId) return null;

  switch (type) {
    // The booking detail page resolves the viewer's role itself, so both the
    // client and the provider land on the same URL.
    case 'BOOKING_CREATED':
    case 'BOOKING_UPDATED':
    case 'BOOKING_COMPLETED':
    case 'BOOKING_REMINDER':
      return { href: `${webUrl()}/bookings/${bookingId}`, label: 'View booking' };
    default:
      return null;
  }
}
