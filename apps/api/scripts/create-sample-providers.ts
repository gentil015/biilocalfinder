import { PrismaClient, ProviderType, OfferingPriceType, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const firstNames = ['Jean', 'Marie', 'Paul', 'Alice', 'Emmanuel', 'Grace', 'Eric', 'Claudine', 'Patrick', 'Diane', 'Joseph', 'Solange', 'Daniel', 'Aline', 'Robert', 'Beatrice', 'Samuel', 'Christine', 'Thomas', 'Julienne', 'Vincent', 'Esther', 'Olivier', 'Sandrine', 'Fabrice'];
const lastNames = ['Uwimana', 'Mukamana', 'Niyonzima', 'Iradukunda', 'Habimana', 'Mukeshimana', 'Bizimana', 'Uwera', 'Nsengiyumva', 'Mugisha', 'Nkurunziza', 'Ingabire', 'Nzeyimana', 'Nyirahabimana', 'Kalisa', 'Uwase', 'Rugamba', 'Mutoni', 'Ndayisaba', 'Mukandayisenga', 'Cyusa', 'Umutoni', 'Habyarimana', 'Ineza', 'Tuyisenge'];
const businessSuffixes = ['Services', 'Solutions', 'Experts', 'Pro', 'Plus', 'Hub', 'Works', 'Group'];

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Fetching services and categories...');
  
  const services = await prisma.service.findMany({
    where: { isActive: true },
    take: 50
  });
  
  if (services.length === 0) {
    console.error('No services found. Run seed first.');
    process.exit(1);
  }
  
  const defaultPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  
  const results: any[] = [];
  
  for (let i = 0; i < 25; i++) {
    const firstName = firstNames[i];
    const lastName = lastNames[i];
    const email = `provider${i + 1}@demo.biilocalfinder.com`;
    const phone = `+25078${randomInt(1000000, 9999999)}`;
    
    const providerTypes: ProviderType[] = ['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY'];
    const providerType = randomItem(providerTypes);
    
    let businessName: string;
    if (providerType === 'INDIVIDUAL') {
      businessName = `${firstName} ${lastName}`;
    } else {
      businessName = `${lastName} ${randomItem(businessSuffixes)}`;
    }
    
    const service = randomItem(services);
    const workspaceSlug = slugify(`${businessName}-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`);
    
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            phone,
            passwordHash,
            firstName,
            lastName,
            role: UserRole.PROVIDER,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            phoneVerified: true,
          },
        });
        
        const workspace = await tx.workspace.create({
          data: {
            name: businessName,
            slug: workspaceSlug,
            type: providerType,
            ownerId: user.id,
          },
        });
        
        const location = await tx.location.create({
          data: {
            latitude: -1.9441 + (Math.random() - 0.5) * 0.15,
            longitude: 30.0619 + (Math.random() - 0.5) * 0.15,
            city: 'Kigali',
            addressLine: `KG ${randomInt(1, 999)} St, Kigali`,
          },
        });
        
        const provider = await tx.provider.create({
          data: {
            userId: user.id,
            workspaceId: workspace.id,
            providerType,
            businessName,
            bio: `Professional ${service.name.toLowerCase()} services in Kigali and surrounding areas.`,
            phone,
            onboardingStep: 'COMPLETED',
            onboardingCompletedAt: new Date(),
            locationId: location.id,
            ...(providerType !== 'INDIVIDUAL' && {
              representativeName: `${firstName} ${lastName}`,
            }),
            ...(providerType === 'BUSINESS' && {
              registrationNumber: `REG-${randomInt(10000, 99999)}`,
            }),
          },
        });
        
        await tx.workspaceMembership.create({
          data: {
            workspaceId: workspace.id,
            userId: user.id,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: new Date(),
          },
        });
        
        const offering = await tx.serviceOffering.create({
          data: {
            providerId: provider.id,
            serviceId: service.id,
            title: `${service.name} - ${businessName}`,
            description: `Quality ${service.name.toLowerCase()} services. Experienced and reliable.`,
            basePrice: randomInt(5000, 50000),
            priceType: randomItem([OfferingPriceType.FIXED, OfferingPriceType.HOURLY, OfferingPriceType.STARTING_FROM]),
            isActive: true,
          },
        });
        
        return { user, provider, workspace, offering, service, email };
      });
      
      results.push({ ...result, password: defaultPassword });
      console.log(`✓ Created ${result.provider.businessName} (${result.email}) - ${result.service.name}`);
    } catch (error: any) {
      console.error(`✗ Failed to create provider ${i + 1}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(90));
  console.log('CREATED PROVIDERS - CREDENTIALS');
  console.log('='.repeat(90));
  console.log(`Password for all: ${defaultPassword}\n`);
  
  for (const r of results) {
    console.log(`Email: ${r.email}`);
    console.log(`Password: ${r.password}`);
    console.log(`Business: ${r.provider.businessName} | Type: ${r.provider.providerType}`);
    console.log(`Service: ${r.service.name} | Price: ${r.offering.basePrice} RWF (${r.offering.priceType})`);
    console.log('-'.repeat(60));
  }
  
  console.log(`\nTotal created: ${results.length}/25`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
