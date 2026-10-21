import { NotificationsProcessor } from './notifications.processor';

// Exercises the processor's email branch directly with fakes, so the
// integration (preference/verification gating + rich HTML for mapped types,
// plain fallback otherwise) is covered without a database or an SMTP server.
describe('NotificationsProcessor.dispatchEmail', () => {
  const originalWebUrl = process.env.WEB_URL;
  const sent: Array<{ to: string; subject: string; body: string; html?: string }> = [];

  beforeEach(() => {
    process.env.WEB_URL = 'https://app.bii.example';
    sent.length = 0;
  });

  afterEach(() => {
    process.env.WEB_URL = originalWebUrl;
  });

  function build(overrides: { emailVerified?: boolean; firstName?: string } = {}) {
    const user = {
      email: 'recipient@example.com',
      emailVerified: overrides.emailVerified ?? true,
      firstName: overrides.firstName ?? 'Aline',
    };
    const prisma: any = {
      notification: { create: jest.fn() },
      pushSubscription: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
    };
    const registry: any = { emitToRoom: jest.fn() };
    const notifications: any = {
      getEffectivePreferenceForType: jest.fn().mockResolvedValue({ category: 'BOOKINGS', inApp: false, push: false, email: true }),
    };
    const emailSender: any = { send: jest.fn(async (m: any) => void sent.push(m)) };
    const processor = new NotificationsProcessor(prisma, registry, notifications, { send: jest.fn() } as any, emailSender);
    return { processor };
  }

  it('sends branded HTML with a booking CTA for a booking-lifecycle type', async () => {
    const { processor } = build();
    await (processor as any).dispatchEmail({
      userId: 'u1',
      type: 'BOOKING_UPDATED',
      title: 'Booking confirmed',
      body: 'Your booking is now confirmed.',
      data: { bookingId: 'bk_1' },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Booking confirmed');
    expect(sent[0].html).toContain('href="https://app.bii.example/bookings/bk_1"');
    expect(sent[0].html).toContain('Hi Aline,');
  });

  it('falls back to plain subject/body for a type with no deep link', async () => {
    const { processor } = build();
    await (processor as any).dispatchEmail({
      userId: 'u1',
      type: 'NEW_MESSAGE',
      title: 'New message',
      body: 'You have a new message.',
      data: {},
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].html).toBeUndefined();
    expect(sent[0].body).toBe('You have a new message.');
  });

  it('never emails an unverified address', async () => {
    const { processor } = build({ emailVerified: false });
    await (processor as any).dispatchEmail({
      userId: 'u1',
      type: 'BOOKING_UPDATED',
      title: 'Booking confirmed',
      body: 'x',
      data: { bookingId: 'bk_1' },
    });
    expect(sent).toHaveLength(0);
  });
});
