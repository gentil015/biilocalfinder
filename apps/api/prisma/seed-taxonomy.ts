import { PrismaClient } from '@prisma/client';
import { seedTaxonomy } from './taxonomy';

/**
 * Upserts only the category/service taxonomy. Unlike prisma/seed.ts this does
 * not create subscription plans or an admin account, so it is safe to run
 * against an existing (including production) database.
 *
 * Usage: npm run prisma:seed:taxonomy
 */
const prisma = new PrismaClient();

async function main() {
  await seedTaxonomy(prisma);
  // eslint-disable-next-line no-console
  console.log('Taxonomy sync complete.');
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
