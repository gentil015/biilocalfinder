import { NotificationsService } from './notifications.service';

describe('NotificationsService email defaults', () => {
  const queue: any = { add: jest.fn(), addBulk: jest.fn() };

  function build(role: 'PROVIDER' | 'CLIENT', rows: any[] = []) {
    const prisma: any = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue(rows),
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(rows.find((row) => row.category === where.userId_category.category) ?? null),
        ),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role }) },
    };
    return { service: new NotificationsService(prisma, queue) };
  }

  it('turns email on by default for providers', async () => {
    const { service } = build('PROVIDER');
    const prefs = await service.getPreferences('u1');
    expect(prefs.every((pref) => pref.email)).toBe(true);
  });

  it('keeps email off by default for clients', async () => {
    const { service } = build('CLIENT');
    const prefs = await service.getPreferences('u1');
    expect(prefs.every((pref) => !pref.email)).toBe(true);
  });

  it('honours an explicit provider opt-out', async () => {
    const { service } = build('PROVIDER', [
      { category: 'BOOKINGS', inApp: true, push: true, email: false },
    ]);
    const prefs = await service.getPreferences('u1');
    expect(prefs.find((pref) => pref.category === 'BOOKINGS')?.email).toBe(false);
    expect(prefs.find((pref) => pref.category === 'MESSAGES')?.email).toBe(true);
  });

  it('uses the provider default when resolving an effective preference', async () => {
    const { service } = build('PROVIDER');
    const pref = await service.getEffectivePreferenceForType('u1', 'BOOKING_CREATED');
    expect(pref).toMatchObject({ category: 'BOOKINGS', email: true });
  });
});
