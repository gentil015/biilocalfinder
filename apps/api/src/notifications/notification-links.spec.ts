import { notificationLink } from './notification-links';

describe('notificationLink', () => {
  const originalWebUrl = process.env.WEB_URL;

  afterEach(() => {
    process.env.WEB_URL = originalWebUrl;
  });

  it('links every booking-lifecycle type to its booking detail page', () => {
    process.env.WEB_URL = 'https://app.bii.example';
    const types = ['BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_COMPLETED', 'BOOKING_REMINDER'] as const;

    for (const type of types) {
      const link = notificationLink(type, { bookingId: 'b-123' });
      expect(link).toEqual({ href: 'https://app.bii.example/bookings/b-123', label: 'View booking' });
    }
  });

  it('trims trailing slashes from WEB_URL so the href has no double slash', () => {
    process.env.WEB_URL = 'http://localhost:3000/';
    expect(notificationLink('BOOKING_UPDATED', { bookingId: 'b1' })?.href).toBe(
      'http://localhost:3000/bookings/b1',
    );
  });

  it('returns null when the bookingId is missing', () => {
    expect(notificationLink('BOOKING_UPDATED', {})).toBeNull();
    expect(notificationLink('BOOKING_UPDATED', undefined)).toBeNull();
  });

  it('links a message notification to its conversation', () => {
    process.env.WEB_URL = 'https://app.bii.example/';
    expect(notificationLink('NEW_MESSAGE', { conversationId: 'c-1' })).toEqual({
      href: 'https://app.bii.example/messages/c-1',
      label: 'View message',
    });
  });

  it('returns null for types with no deep link', () => {
    expect(notificationLink('NEW_MESSAGE', { bookingId: 'b1' })).toBeNull();
    expect(notificationLink('NEW_REVIEW', {})).toBeNull();
  });

  it('ignores a non-string bookingId', () => {
    expect(notificationLink('BOOKING_CREATED', { bookingId: 42 })).toBeNull();
  });
});
