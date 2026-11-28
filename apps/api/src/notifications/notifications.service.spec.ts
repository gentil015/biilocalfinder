import { NotificationType } from '@prisma/client';
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

describe('NotificationsService queue failures', () => {
  const data = { userId: 'u1', type: NotificationType.NEW_SERVICE_REQUEST, title: 'New service request' };

  it('does not fail the caller when a single notification cannot be queued', async () => {
    const queue: any = { add: jest.fn().mockRejectedValue(new Error('redis down')), addBulk: jest.fn() };
    const service = new NotificationsService({} as any, queue);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(service.notify(data)).resolves.toBeUndefined();
  });

  it('does not fail the caller when bulk notifications cannot be queued', async () => {
    const queue: any = { add: jest.fn(), addBulk: jest.fn().mockRejectedValue(new Error('redis down')) };
    const service = new NotificationsService({} as any, queue);
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);

    await expect(service.notifyMany([data])).resolves.toBeUndefined();
  });
});
