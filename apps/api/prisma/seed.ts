import { Prisma, PrismaClient, AttributeType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

interface AttributeSeed {
  name: string;
  type: AttributeType;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  options?: string[];
}

// Category-specific attribute definitions (spec §31) — keyed by the
// child category's display name so they attach after the tree is created.
const CATEGORY_ATTRIBUTES: Record<string, AttributeSeed[]> = {
  Photography: [
    { name: 'Camera Brand', type: 'TEXT' },
    { name: 'Camera Resolution', type: 'SELECT', isFilterable: true, options: ['4K', '6K', '8K'] },
    { name: 'Drone Available', type: 'BOOLEAN', isFilterable: true },
    { name: 'Editing Included', type: 'BOOLEAN', isFilterable: true },
    {
      name: 'Photography Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Wedding', 'Birthday', 'Corporate', 'Portrait', 'Graduation', 'Product'],
    },
  ],
  Videography: [
    { name: 'Video Resolution', type: 'SELECT', isFilterable: true, options: ['1080p', '4K', '6K', '8K'] },
    { name: 'Drone Available', type: 'BOOLEAN', isFilterable: true },
    { name: 'Editing Included', type: 'BOOLEAN', isFilterable: true },
    {
      name: 'Event Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Wedding', 'Birthday', 'Corporate', 'Concert'],
    },
    { name: 'Live Streaming', type: 'BOOLEAN', isFilterable: true },
  ],
  Carpentry: [
    {
      name: 'Furniture Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Tables', 'Chairs', 'Beds', 'Cabinets', 'Doors'],
    },
    { name: 'Wood Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Pine', 'Oak', 'Mahogany', 'MDF'] },
    { name: 'Custom Design', type: 'BOOLEAN', isFilterable: true },
    { name: 'Installation Available', type: 'BOOLEAN', isFilterable: true },
  ],
  'Car repair': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    {
      name: 'Brands Supported',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'],
    },
    { name: 'Diagnostic Equipment', type: 'BOOLEAN', isFilterable: true },
    { name: 'Mobile Repair', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
  ],
  Plumbing: [
    { name: 'Residential', type: 'BOOLEAN', isFilterable: true },
    { name: 'Commercial', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
    { name: 'Installation', type: 'BOOLEAN', isFilterable: true },
    { name: 'Repair', type: 'BOOLEAN', isFilterable: true },
  ],
  'Wedding Services': [
    {
      name: 'Services Included',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Photography', 'Videography', 'Decoration', 'Catering', 'DJ', 'Lighting'],
    },
    { name: 'Guest Capacity', type: 'NUMBER', isFilterable: true },
    { name: 'Full Day Service', type: 'BOOLEAN', isFilterable: true },
    { name: 'Package Type', type: 'SELECT', isFilterable: true, options: ['Basic', 'Standard', 'Premium', 'Custom'] },
  ],
  Electrical: [
    { name: 'Residential', type: 'BOOLEAN', isFilterable: true },
    { name: 'Commercial', type: 'BOOLEAN', isFilterable: true },
    { name: 'Wiring', type: 'BOOLEAN', isFilterable: true },
    { name: 'Solar', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
  ],

  // The rest of the leaf categories. Grouped by parent to match the tree in
  // main() below. Shared names across categories ('Vehicle Types',
  // 'Brands Supported', 'Emergency Service') are deliberate: they are the same
  // concepts, so a provider moving between automotive categories and a user
  // comparing filters see consistent labels.
  'Brake repair': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    { name: 'Brands Supported', type: 'MULTI_SELECT', isFilterable: true, options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'] },
    { name: 'Brake Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Disc', 'Drum', 'ABS', 'Drums & Discs'] },
    { name: 'Mobile Repair', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
  ],
  'Car electrical': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    { name: 'Brands Supported', type: 'MULTI_SELECT', isFilterable: true, options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'] },
    { name: 'Diagnostic Equipment', type: 'BOOLEAN', isFilterable: true },
    { name: 'Battery Replacement', type: 'BOOLEAN', isFilterable: true },
    { name: 'Mobile Repair', type: 'BOOLEAN', isFilterable: true },
  ],
  'Tire services': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    { name: 'Brands Supported', type: 'MULTI_SELECT', isFilterable: true, options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'] },
    {
      name: 'Services Offered',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Tire Change', 'Balancing', 'Puncture Repair', 'Wheel Alignment', 'Tire Storage'],
    },
    { name: 'Tire Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Summer', 'Winter', 'All-Season', 'Spare'] },
    { name: 'Mobile Service', type: 'BOOLEAN', isFilterable: true },
  ],
  Cleaning: [
    {
      name: 'Property Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Apartment', 'House', 'Office', 'Commercial', 'Hotel'],
    },
    {
      name: 'Cleaning Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Standard', 'Deep', 'Move-in/Move-out', 'Post-construction', 'Window'],
    },
    { name: 'Frequency', type: 'SELECT', isFilterable: true, options: ['One-time', 'Weekly', 'Bi-weekly', 'Monthly'] },
    { name: 'Supplies Included', type: 'BOOLEAN', isFilterable: true },
    { name: 'Eco-Friendly Products', type: 'BOOLEAN', isFilterable: true },
  ],
  Painting: [
    { name: 'Scope', type: 'MULTI_SELECT', isFilterable: true, options: ['Interior', 'Exterior', 'Both'] },
    {
      name: 'Surfaces',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Walls', 'Ceiling', 'Doors', 'Woodwork', 'Metal'],
    },
    { name: 'Paint Brands', type: 'MULTI_SELECT', isFilterable: true, options: ['Dulux', 'Jotun', 'Sherwin-Williams', 'Local'] },
    { name: 'Number of Rooms', type: 'NUMBER', isFilterable: true },
    { name: 'Paint Supplied', type: 'BOOLEAN', isFilterable: true },
  ],
  'Software development': [
    {
      name: 'Project Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Web App', 'Mobile App', 'API', 'Desktop', 'Automation'],
    },
    { name: 'Tech Stacks', type: 'MULTI_SELECT', isFilterable: true, options: ['React', 'Node.js', 'Python', 'Java', 'Go'] },
    { name: 'Maintenance Included', type: 'BOOLEAN', isFilterable: true },
    { name: 'Agile Delivery', type: 'BOOLEAN', isFilterable: true },
    { name: 'Post-Launch Support', type: 'SELECT', isFilterable: true, options: ['None', '1 month', '3 months', '6 months'] },
  ],
  'Website development': [
    {
      name: 'Website Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Business', 'Portfolio', 'E-commerce', 'Blog', 'Landing Page'],
    },
    { name: 'Platforms', type: 'MULTI_SELECT', isFilterable: true, options: ['WordPress', 'Webflow', 'Shopify', 'Next.js', 'Custom'] },
    { name: 'Responsive Design', type: 'BOOLEAN', isFilterable: true },
    { name: 'SEO Included', type: 'BOOLEAN', isFilterable: true },
    { name: 'Hosting Included', type: 'BOOLEAN', isFilterable: true },
  ],
  'Computer repair': [
    {
      name: 'Device Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Desktop', 'Laptop', 'Tablet', 'Printer', 'Server'],
    },
    { name: 'Brands Supported', type: 'MULTI_SELECT', isFilterable: true, options: ['Dell', 'HP', 'Lenovo', 'Apple', 'Asus'] },
    { name: 'On-Site Service', type: 'BOOLEAN', isFilterable: true },
    { name: 'Data Recovery', type: 'BOOLEAN', isFilterable: true },
    { name: 'Software Installation', type: 'BOOLEAN', isFilterable: true },
  ],
  Networking: [
    { name: 'Network Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Wired', 'Wireless', 'Hybrid', 'Mesh Wi-Fi'] },
    {
      name: 'Services Offered',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Installation', 'Configuration', 'Troubleshooting', 'Security'],
    },
    { name: 'Equipment Brands', type: 'MULTI_SELECT', isFilterable: true, options: ['TP-Link', 'Ubiquiti', 'Cisco', 'MikroTik', 'Netgear'] },
    { name: 'Business Support', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Support', type: 'BOOLEAN', isFilterable: true },
  ],
  Decoration: [
    {
      name: 'Event Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Wedding', 'Birthday', 'Corporate', 'Graduation', 'Anniversary'],
    },
    {
      name: 'Decoration Styles',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Traditional', 'Modern', 'Floral', 'Balloon', 'Themed'],
    },
    { name: 'Venue', type: 'SELECT', isFilterable: true, options: ['Indoor', 'Outdoor', 'Both'] },
    { name: 'Setup Included', type: 'BOOLEAN', isFilterable: true },
    { name: 'Rental Available', type: 'BOOLEAN', isFilterable: true },
  ],
  DJ: [
    { name: 'Event Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Party'] },
    {
      name: 'Equipment Provided',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Sound System', 'Lighting', 'Mixer', 'Microphones', 'Projector'],
    },
    { name: 'Performance', type: 'SELECT', isFilterable: true, options: ['Live', 'Recorded', 'Both'] },
    { name: 'MC / Hosting', type: 'BOOLEAN', isFilterable: true },
    { name: 'Playlist Requests', type: 'BOOLEAN', isFilterable: true },
  ],
};

// Phase 1 seed: categories, subscription plans, one admin account, and
// (as of the category-attributes feature) category-specific attribute
// definitions for the categories in CATEGORY_ATTRIBUTES above. Providers/
// clients/bookings/reviews seed data (spec §53) lands once those flows
// are exercised in a real dev environment.
async function main() {
  const categories = [
    { name: 'Automotive', slug: 'automotive', children: ['Car repair', 'Car electrical', 'Brake repair', 'Tire services'] },
    { name: 'Home Services', slug: 'home-services', children: ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Carpentry'] },
    { name: 'Technology', slug: 'technology', children: ['Software development', 'Website development', 'Computer repair', 'Networking'] },
    { name: 'Events', slug: 'events', children: ['Photography', 'Videography', 'Decoration', 'DJ', 'Wedding Services'] },
  ];

  const categoryIdByName = new Map<string, string>();

  for (const cat of categories) {
    const parent = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug },
    });
    categoryIdByName.set(cat.name, parent.id);

    for (const childName of cat.children) {
      const slug = `${cat.slug}-${childName.toLowerCase().replace(/\s+/g, '-')}`;
      const child = await prisma.serviceCategory.upsert({
        where: { slug },
        update: {},
        create: { name: childName, slug, parentId: parent.id },
      });
      categoryIdByName.set(childName, child.id);
    }
  }

  for (const [categoryName, attributes] of Object.entries(CATEGORY_ATTRIBUTES)) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) continue; // category not in this seed run — skip quietly

    for (const [index, attribute] of attributes.entries()) {
      const slug = slugify(attribute.name);
      await prisma.categoryAttribute.upsert({
        where: { categoryId_slug: { categoryId, slug } },
        update: {},
        create: {
          categoryId,
          name: attribute.name,
          slug,
          type: attribute.type,
          isRequired: attribute.isRequired ?? false,
          isFilterable: attribute.isFilterable ?? false,
          isSearchable: attribute.isSearchable ?? false,
          options: attribute.options,
          displayOrder: index,
        },
      });
    }
  }

  const SERVICES_BY_CATEGORY: Record<string, string[]> = {
    'Car repair': ['General repair', 'Engine diagnostics', 'Oil change', 'Full vehicle servicing'],
    'Car electrical': ['Battery replacement', 'Wiring repair', 'Alternator repair'],
    'Brake repair': ['Brake pad replacement', 'Brake disc replacement', 'Brake inspection'],
    'Tire services': ['Tire change', 'Wheel balancing', 'Puncture repair', 'Wheel alignment'],
    Plumbing: ['Pipe repair', 'Leak fixing', 'Toilet repair', 'Water heater installation'],
    Electrical: ['Wiring', 'Outlet repair', 'Lighting installation', 'Circuit breaker repair'],
    Cleaning: ['House cleaning', 'Office cleaning', 'Deep cleaning', 'Move-in/move-out cleaning'],
    Painting: ['Interior painting', 'Exterior painting', 'Wall preparation', 'Touch-up painting'],
    Carpentry: ['Furniture repair', 'Cabinet making', 'Door installation', 'Custom furniture'],
    'Software development': ['Web app development', 'API development', 'Mobile app development'],
    'Website development': ['Business website', 'E-commerce website', 'Landing page'],
    'Computer repair': ['Laptop repair', 'Desktop repair', 'Virus removal', 'Data recovery'],
    Networking: ['Network setup', 'WiFi installation', 'Network troubleshooting'],
    Photography: ['Event photography', 'Portrait photography', 'Product photography'],
    Videography: ['Event videography', 'Corporate video', 'Wedding videography'],
    Decoration: ['Event decoration', 'Balloon decoration', 'Floral decoration'],
    DJ: ['Wedding DJ', 'Party DJ', 'Corporate event DJ'],
    'Wedding Services': ['Full wedding planning', 'Wedding coordination', 'Wedding decor package'],
  };

  for (const [categoryName, serviceNames] of Object.entries(SERVICES_BY_CATEGORY)) {
    const categoryId = categoryIdByName.get(categoryName);
    if (!categoryId) continue;
    for (const serviceName of serviceNames) {
      const slug = slugify(serviceName);
      await prisma.service.upsert({
        where: { categoryId_slug: { categoryId, slug } },
        update: { isActive: true },
        create: { categoryId, name: serviceName, slug, isActive: true },
      });
    }
  }

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
