import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedTaxonomy } from './taxonomy';

const prisma = new PrismaClient();

// Phase 1 seed: categories/services/attributes (via the shared taxonomy), the
// subscription plans, and one admin account. Providers/clients/bookings/reviews
// seed data (spec §53) lands once those flows are exercised in a real dev
// environment.
async function main() {
  await seedTaxonomy(prisma);

  // Type-specific plans (spec §7): FREE/STANDARD/PRO per workspace type,
  // matching the brief's illustrative structure. Prices, limits and
  // features here are seed defaults, not final business rules — all of
  // it is editable afterwards through the admin plan endpoints
  // (POST/PATCH /admin/subscription-plans), never hardcoded elsewhere.
  const plans: Array<{
    workspaceType: 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';
    name: string;
    price: number;
    maxServices: number | null;
    maxPortfolioImages: number | null;
    maxMonthlyRequests: number | null;
    maxTeamMembers: number | null;
    maxManagedProviders: number | null;
    features: Prisma.InputJsonValue;
  }> = [
    // INDIVIDUAL
    { workspaceType: 'INDIVIDUAL', name: 'FREE', price: 0, maxServices: 2, maxPortfolioImages: 3, maxMonthlyRequests: 5, maxTeamMembers: null, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'none' } },
    { workspaceType: 'INDIVIDUAL', name: 'STANDARD', price: 4000, maxServices: 5, maxPortfolioImages: 10, maxMonthlyRequests: 20, maxTeamMembers: null, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'basic' } },
    { workspaceType: 'INDIVIDUAL', name: 'PRO', price: 8000, maxServices: 10, maxPortfolioImages: 20, maxMonthlyRequests: 50, maxTeamMembers: null, maxManagedProviders: null, features: { visibility: 'boosted', analytics: 'advanced' } },
    // TEAM
    { workspaceType: 'TEAM', name: 'FREE', price: 0, maxServices: 3, maxPortfolioImages: 5, maxMonthlyRequests: 10, maxTeamMembers: 2, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'none', scheduling: 'basic' } },
    { workspaceType: 'TEAM', name: 'STANDARD', price: 10000, maxServices: 8, maxPortfolioImages: 15, maxMonthlyRequests: 40, maxTeamMembers: 6, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'basic', scheduling: 'calendar', jobAssignment: true } },
    { workspaceType: 'TEAM', name: 'PRO', price: 18000, maxServices: 15, maxPortfolioImages: 30, maxMonthlyRequests: 100, maxTeamMembers: 15, maxManagedProviders: null, features: { visibility: 'boosted', analytics: 'advanced', scheduling: 'calendar', jobAssignment: true } },
    // BUSINESS
    { workspaceType: 'BUSINESS', name: 'FREE', price: 0, maxServices: 3, maxPortfolioImages: 5, maxMonthlyRequests: 10, maxTeamMembers: 2, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'none', branches: 1 } },
    { workspaceType: 'BUSINESS', name: 'STANDARD', price: 15000, maxServices: 12, maxPortfolioImages: 20, maxMonthlyRequests: 60, maxTeamMembers: 10, maxManagedProviders: null, features: { visibility: 'standard', analytics: 'business', branches: 3 } },
    { workspaceType: 'BUSINESS', name: 'PRO', price: 30000, maxServices: 25, maxPortfolioImages: 40, maxMonthlyRequests: null, maxTeamMembers: 30, maxManagedProviders: null, features: { visibility: 'priority', analytics: 'advanced', branches: null } },
    // AGENCY
    { workspaceType: 'AGENCY', name: 'FREE', price: 0, maxServices: null, maxPortfolioImages: null, maxMonthlyRequests: 10, maxTeamMembers: 2, maxManagedProviders: 3, features: { visibility: 'standard', analytics: 'none' } },
    { workspaceType: 'AGENCY', name: 'STANDARD', price: 20000, maxServices: null, maxPortfolioImages: null, maxMonthlyRequests: 60, maxTeamMembers: 8, maxManagedProviders: 15, features: { visibility: 'standard', analytics: 'agency', matching: 'basic' } },
    { workspaceType: 'AGENCY', name: 'PRO', price: 40000, maxServices: null, maxPortfolioImages: null, maxMonthlyRequests: null, maxTeamMembers: 20, maxManagedProviders: 50, features: { visibility: 'priority', analytics: 'advanced', matching: 'priority' } },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { workspaceType_name: { workspaceType: plan.workspaceType, name: plan.name } },
      update: {},
      create: { ...plan, currency: 'RWF', billingInterval: 'MONTHLY' },
    });
  }

  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@biilocalfinder.dev' },
    update: {},
    create: {
      email: 'admin@biilocalfinder.dev',
      passwordHash: adminPasswordHash,
      firstName: 'Bii',
      lastName: 'Admin',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Demo admin: admin@biilocalfinder.dev / ChangeMe123!');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
