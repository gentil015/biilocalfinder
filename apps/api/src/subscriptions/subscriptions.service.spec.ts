import { BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { EntitlementsService } from './entitlements.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;
  let paymentProvider: any;

  const plan = {
    id: 'plan-1',
    workspaceType: 'INDIVIDUAL',
    name: 'PRO',
    price: 8000,
    currency: 'RWF',
    billingInterval: 'MONTHLY',
    isActive: true,
  };
  const provider = { id: 'provider-1', userId: 'user-1', providerType: 'INDIVIDUAL', businessName: 'Acme Plumbing' };

  beforeEach(() => {
    prisma = {
      provider: { findUnique: jest.fn().mockResolvedValue(provider), update: jest.fn() },
      subscriptionPlan: { findUnique: jest.fn().mockResolvedValue(plan) },
      providerSubscription: {
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', plan, transactions: [] }),
      },
      subscriptionTransaction: { create: jest.fn() },
      $transaction: jest.fn((cb) =>
        cb({
          providerSubscription: prisma.providerSubscription,
          subscriptionTransaction: prisma.subscriptionTransaction,
          provider: prisma.provider,
        }),
      ),
    };
    paymentProvider = { charge: jest.fn() };
    service = new SubscriptionsService(
      prisma,
      paymentProvider,
      { notify: jest.fn() } as any,
      new EntitlementsService(prisma),
      { resolveForUser: jest.fn().mockResolvedValue(provider) } as any,
    );
  });

  it('activates the provider subscription when the charge succeeds', async () => {
    paymentProvider.charge.mockResolvedValue({ status: 'SUCCEEDED', transactionReference: 'ref-1' });

    await service.subscribe('user-1', 'plan-1');

    expect(prisma.provider.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscriptionStatus: 'ACTIVE' } }),
    );
  });

  it('does not activate the provider when the charge fails', async () => {
    paymentProvider.charge.mockResolvedValue({ status: 'FAILED', transactionReference: 'ref-2' });

    await expect(service.subscribe('user-1', 'plan-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.provider.update).not.toHaveBeenCalled();
  });

  it('never charges for anything other than the subscription plan price', async () => {
    paymentProvider.charge.mockResolvedValue({ status: 'SUCCEEDED', transactionReference: 'ref-3' });

    await service.subscribe('user-1', 'plan-1');

    expect(paymentProvider.charge).toHaveBeenCalledWith(
      expect.objectContaining({ amount: plan.price, currency: plan.currency }),
    );
  });

  it('rejects subscribing to a plan meant for a different workspace type', async () => {
    prisma.subscriptionPlan.findUnique.mockResolvedValue({ ...plan, workspaceType: 'AGENCY' });

    await expect(service.subscribe('user-1', 'plan-1')).rejects.toThrow(
      /is for agency workspaces, not individual ones/,
    );
    expect(paymentProvider.charge).not.toHaveBeenCalled();
  });
});
