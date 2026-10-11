import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProviderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { EntitlementsService } from './entitlements.service';
import { ProviderContextService } from '../providers/provider-context.service';

function addInterval(date: Date, interval: 'MONTHLY' | 'YEARLY') {
  const d = new Date(date);
  if (interval === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private paymentProvider: PaymentProvider,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
    private providerContext: ProviderContextService,
  ) {}

  // --- Plans (admin-managed, spec §4) ---

  // workspaceType filters to plans a given workspace can actually
  // subscribe to (spec §7: "A workspace must only be assigned plans
  // compatible with its workspace type") — the billing page passes its
  // own workspace's type rather than showing all twelve plans.
  listPlans(workspaceType?: ProviderType) {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true, ...(workspaceType ? { workspaceType } : {}) },
      orderBy: [{ workspaceType: 'asc' }, { price: 'asc' }],
    });
  }

  async createPlan(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({ data: dto as any });
  }

  async updatePlan(id: string, dto: Partial<CreateSubscriptionPlanDto> & { isActive?: boolean }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.subscriptionPlan.update({ where: { id }, data: dto as any });
  }

  // --- Subscribing (spec §17) ---

  async subscribe(providerUserId: string, planId: string) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) throw new BadRequestException('Plan not found');
    // Backend-enforced, not just filtered out of what the frontend shows
    // (spec §8: "Hiding a frontend button is not sufficient
    // authorization") — a request built with any other type's planId is
    // rejected here regardless of what the client sent.
    this.entitlements.assertPlanMatchesType(plan, provider.providerType);

    const charge = await this.paymentProvider.charge({
      amount: Number(plan.price),
      currency: plan.currency,
      description: `${plan.name} subscription — ${provider.businessName}`,
      metadata: { providerId: provider.id, planId: plan.id },
    });

    const now = new Date();
    const renewalDate = addInterval(now, plan.billingInterval);

    const subscription = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.providerSubscription.create({
        data: {
          providerId: provider.id,
          planId: plan.id,
          status: charge.status === 'SUCCEEDED' ? 'ACTIVE' : 'PAST_DUE',
          startDate: now,
          renewalDate,
        },
      });
      await tx.subscriptionTransaction.create({
        data: {
          subscriptionId: created.id,
          amount: plan.price,
          currency: plan.currency,
          paymentProvider: process.env.SUBSCRIPTION_PAYMENT_PROVIDER ?? 'mock',
          transactionReference: charge.transactionReference,
          paymentStatus: charge.status,
        },
      });
      if (charge.status === 'SUCCEEDED') {
        await tx.provider.update({ where: { id: provider.id }, data: { subscriptionStatus: 'ACTIVE' } });
      }
      return created;
    });

    if (charge.status !== 'SUCCEEDED') {
      throw new BadRequestException('Payment could not be completed');
    }

    return this.prisma.providerSubscription.findUnique({
      where: { id: subscription.id },
      include: { plan: true, transactions: true },
    });
  }

  async current(providerUserId: string) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    return this.prisma.providerSubscription.findFirst({
      where: { providerId: provider.id, status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async history(providerUserId: string) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    return this.prisma.providerSubscription.findMany({
      where: { providerId: provider.id },
      include: { plan: true, transactions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Usage vs. limits for the workspace's billing page (spec §7: "Display
  // plan limits and usage to workspace owners"). Display-only — the
  // actual enforcement is EntitlementsService.assertCanAdd, called from
  // wherever a resource is created.
  async usage(providerUserId: string) {
    const provider = await this.providerContext.resolveForUser(providerUserId);
    return this.entitlements.getUsageSummary(provider);
  }

  async cancel(providerUserId: string, subscriptionId: string) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    const subscription = await this.prisma.providerSubscription.findUnique({ where: { id: subscriptionId } });
    if (!subscription || subscription.providerId !== provider.id) {
      throw new NotFoundException('Subscription not found');
    }

    // Cancelling never deletes provider data (spec §55) — the provider's
    // profile stays visible, only premium marketplace features drop off
    // once `endDate` passes (enforced by whatever reads subscriptionStatus,
    // not by removing rows here).
    const updated = await this.prisma.providerSubscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', endDate: new Date() },
    });
    await this.prisma.provider.update({ where: { id: provider.id }, data: { subscriptionStatus: 'CANCELLED' } });

    return updated;
  }
}
