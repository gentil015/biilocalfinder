import { AttributeType, PrismaClient } from '@prisma/client';

/**
 * The marketplace taxonomy: broad parent categories, their leaf sub-categories,
 * and the concrete services a provider can turn into an offering.
 *
 * Kept in one place so the dev seed (prisma/seed.ts) and the production
 * taxonomy sync (prisma/seed-taxonomy.ts) can never drift apart. Everything
 * here is idempotent — re-running only upserts, never deletes, so existing
 * offerings and requests keep pointing at the same rows.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export interface AttributeSeed {
  name: string;
  type: AttributeType;
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  options?: string[];
}

export interface ChildCategorySeed {
  name: string;
  services: string[];
}

export interface ParentCategorySeed {
  name: string;
  slug: string;
  children: ChildCategorySeed[];
}

export const CATEGORY_TREE: ParentCategorySeed[] = [
  {
    name: 'Automotive',
    slug: 'automotive',
    children: [
      {
        name: 'Car repair',
        services: ['General repair', 'Engine diagnostics', 'Oil change', 'Full vehicle servicing'],
      },
      {
        name: 'Car electrical',
        services: ['Battery replacement', 'Wiring repair', 'Alternator repair', 'Starter motor repair'],
      },
      {
        name: 'Brake repair',
        services: ['Brake pad replacement', 'Brake disc replacement', 'Brake inspection', 'ABS repair'],
      },
      {
        name: 'Tire services',
        services: ['Tire change', 'Wheel balancing', 'Puncture repair', 'Wheel alignment'],
      },
      {
        name: 'Car wash & detailing',
        services: ['Exterior car wash', 'Interior detailing', 'Full detailing', 'Ceramic coating'],
      },
      {
        name: 'Auto body & paint',
        services: ['Dent removal', 'Panel beating', 'Respray', 'Scratch repair'],
      },
      {
        name: 'Towing & roadside assistance',
        services: ['Towing', 'Jump start', 'Flat tire assistance', 'Fuel delivery'],
      },
      {
        name: 'Vehicle inspection',
        services: ['Pre-purchase inspection', 'Roadworthy inspection', 'Insurance inspection', 'Fleet inspection'],
      },
      {
        name: 'Car rental',
        services: ['Self-drive rental', 'Chauffeur-driven rental', 'Airport car rental', 'Long-term car lease'],
      },
      {
        name: 'Motorcycle repair',
        services: ['Engine repair', 'Chain and sprocket replacement', 'Brake service', 'Motorcycle servicing'],
      },
      {
        name: 'Auto glass repair',
        services: ['Windshield replacement', 'Chip repair', 'Window tinting', 'Side mirror replacement'],
      },
      {
        name: 'Car AC service',
        services: ['AC gas refill', 'AC compressor repair', 'AC leak detection', 'Cabin filter replacement'],
      },
    ],
  },
  {
    name: 'Home Services',
    slug: 'home-services',
    children: [
      { name: 'Plumbing', services: ['Pipe repair', 'Leak fixing', 'Toilet repair', 'Water heater installation'] },
      { name: 'Electrical', services: ['Wiring', 'Outlet repair', 'Lighting installation', 'Circuit breaker repair'] },
      { name: 'Cleaning', services: ['House cleaning', 'Office cleaning', 'Deep cleaning', 'Move-in/move-out cleaning'] },
      { name: 'Painting', services: ['Interior painting', 'Exterior painting', 'Wall preparation', 'Touch-up painting'] },
      { name: 'Carpentry', services: ['Furniture repair', 'Cabinet making', 'Door installation', 'Custom furniture'] },
      { name: 'Masonry', services: ['Bricklaying', 'Plastering', 'Concrete slab', 'Stone work'] },
      { name: 'Roofing', services: ['Roof installation', 'Roof repair', 'Gutter installation', 'Roof waterproofing'] },
      { name: 'Flooring', services: ['Tile installation', 'Wood flooring', 'Laminate flooring', 'Floor polishing'] },
      {
        name: 'Landscaping & gardening',
        services: ['Garden design', 'Lawn mowing', 'Tree trimming', 'Planting'],
      },
      { name: 'Pest control', services: ['Fumigation', 'Rodent control', 'Termite treatment', 'Bed bug treatment'] },
      {
        name: 'Moving & relocation',
        services: ['House moving', 'Office relocation', 'Packing and unpacking', 'Furniture assembly'],
      },
      { name: 'Handyman', services: ['General repairs', 'Furniture assembly', 'Shelf installation', 'Small renovations'] },
      { name: 'Locksmith', services: ['Lock installation', 'Lock repair', 'Emergency lockout', 'Key duplication'] },
      {
        name: 'Solar installation',
        services: ['Solar panel installation', 'Solar battery installation', 'Solar maintenance', 'Solar consultation'],
      },
      {
        name: 'Waterproofing',
        services: ['Roof waterproofing', 'Basement waterproofing', 'Wall waterproofing', 'Damp proofing'],
      },
      {
        name: 'Interior design',
        services: ['Space planning', 'Furniture selection', 'Color consulting', 'Full interior design'],
      },
    ],
  },
  {
    name: 'Technology',
    slug: 'technology',
    children: [
      {
        name: 'Software development',
        services: ['Software development', 'Web app development', 'API development', 'Mobile app development', 'Custom software development'],
      },
      { name: 'Website development', services: ['Business website', 'E-commerce website', 'Landing page', 'Website maintenance'] },
      { name: 'Computer repair', services: ['Laptop repair', 'Desktop repair', 'Virus removal', 'Data recovery'] },
      { name: 'Networking', services: ['Network setup', 'WiFi installation', 'Network troubleshooting', 'Structured cabling'] },
      {
        name: 'Mobile app development',
        services: ['iOS app development', 'Android app development', 'Cross-platform app development', 'App maintenance'],
      },
      { name: 'IT support', services: ['Managed IT support', 'Helpdesk support', 'Software installation', 'Hardware support'] },
      {
        name: 'Cybersecurity',
        services: ['Security audit', 'Penetration testing', 'Firewall setup', 'Data protection consulting'],
      },
      { name: 'Cloud services', services: ['Cloud migration', 'Cloud hosting setup', 'Cloud backup', 'Cloud cost optimization'] },
      { name: 'Data recovery', services: ['Hard drive recovery', 'SSD recovery', 'Phone data recovery', 'RAID recovery'] },
      { name: 'Graphic design', services: ['Logo design', 'Brand identity design', 'Social media graphics', 'Print design'] },
      { name: 'Digital marketing', services: ['Digital marketing strategy', 'Google Ads', 'Facebook Ads', 'Email marketing'] },
      { name: 'SEO services', services: ['SEO audit', 'On-page SEO', 'Local SEO', 'Link building'] },
      {
        name: 'Social media management',
        services: ['Content creation', 'Community management', 'Social media advertising', 'Analytics reporting'],
      },
      { name: 'Video editing', services: ['Video editing', 'Color grading', 'Motion graphics', 'Subtitling'] },
      {
        name: 'CCTV installation',
        services: ['CCTV installation', 'CCTV maintenance', 'Access control installation', 'Alarm system installation'],
      },
      { name: 'Printer repair', services: ['Printer repair', 'Printer maintenance', 'Ink refill', 'Scanner repair'] },
      { name: 'POS systems', services: ['POS setup', 'POS hardware installation', 'POS software support', 'Payment integration'] },
      {
        name: 'Database administration',
        services: ['Database setup', 'Database optimization', 'Database backup', 'Database migration'],
      },
    ],
  },
  {
    name: 'Events',
    slug: 'events',
    children: [
      { name: 'Photography', services: ['Event photography', 'Portrait photography', 'Product photography', 'Wedding photography'] },
      { name: 'Videography', services: ['Event videography', 'Corporate video', 'Wedding videography', 'Music video production'] },
      { name: 'Decoration', services: ['Event decoration', 'Balloon decoration', 'Floral decoration', 'Stage decoration'] },
      { name: 'DJ', services: ['Wedding DJ', 'Party DJ', 'Corporate event DJ', 'Club DJ'] },
      {
        name: 'Wedding Services',
        services: ['Full wedding planning', 'Wedding coordination', 'Wedding decor package', 'Wedding day management'],
      },
      { name: 'Catering', services: ['Event catering', 'Corporate catering', 'Wedding catering', 'Buffet catering'] },
      {
        name: 'Event planning',
        services: ['Corporate event planning', 'Birthday party planning', 'Conference planning', 'Product launch planning'],
      },
      { name: 'MC & entertainment', services: ['Event MC', 'Hosting', 'Comedy entertainment', 'Games and activities'] },
      { name: 'Sound & lighting', services: ['Sound system rental', 'Stage lighting', 'PA system setup', 'Live sound engineering'] },
      { name: 'Event security', services: ['Event security guards', 'Crowd control', 'VIP protection', 'Security consulting'] },
      { name: 'Party rentals', services: ['Chair and table rental', 'Tent rental', 'Bouncy castle rental', 'Glassware rental'] },
      { name: 'Invitation design', services: ['Wedding invitations', 'Digital invitations', 'Event programs', 'Menu design'] },
      { name: 'Wedding cakes', services: ['Wedding cake design', 'Birthday cakes', 'Cupcakes', 'Cake delivery'] },
      { name: 'Makeup & beauty', services: ['Bridal makeup', 'Event makeup', 'Makeup lessons', 'Hair styling'] },
      {
        name: 'Event transportation',
        services: ['Guest shuttle', 'Luxury car rental', 'Party bus rental', 'Airport transfers'],
      },
    ],
  },
  {
    name: 'Professional Services',
    slug: 'professional-services',
    children: [
      { name: 'Accounting & bookkeeping', services: ['Bookkeeping', 'Financial statements', 'Payroll services', 'Audit support'] },
      { name: 'Tax services', services: ['Tax preparation', 'Tax filing', 'Tax consulting', 'VAT registration'] },
      { name: 'Legal services', services: ['Contract drafting', 'Legal consultation', 'Company registration', 'Litigation support'] },
      {
        name: 'Business consulting',
        services: ['Business plan development', 'Market research', 'Operations consulting', 'Financial consulting'],
      },
      { name: 'Translation & interpretation', services: ['Document translation', 'Interpretation', 'Localization', 'Proofreading'] },
      {
        name: 'HR consulting',
        services: ['Recruitment support', 'HR policy development', 'Employee training', 'Performance management'],
      },
      { name: 'Marketing consulting', services: ['Marketing strategy', 'Brand consulting', 'Campaign planning', 'Market analysis'] },
      { name: 'Grant writing', services: ['Grant research', 'Proposal writing', 'Budget preparation', 'Donor reporting'] },
      { name: 'Notary services', services: ['Document notarization', 'Affidavit preparation', 'Contract certification', 'Power of attorney'] },
      { name: 'Insurance services', services: ['Insurance brokerage', 'Claims assistance', 'Risk assessment', 'Policy review'] },
      { name: 'Real estate services', services: ['Property sales', 'Property rental', 'Property management', 'Valuation'] },
      {
        name: 'Architectural services',
        services: ['Building design', '3D visualization', 'Interior architecture', 'Construction drawings'],
      },
      {
        name: 'Engineering services',
        services: ['Structural engineering', 'Civil engineering', 'Mechanical engineering', 'Electrical engineering'],
      },
      { name: 'Surveying', services: ['Land surveying', 'Topographic surveying', 'Boundary surveying', 'Construction surveying'] },
      {
        name: 'Project management',
        services: ['Project planning', 'Construction management', 'IT project management', 'Risk management'],
      },
      { name: 'Virtual assistance', services: ['Administrative support', 'Email management', 'Calendar management', 'Data entry'] },
    ],
  },
  {
    name: 'Health & Wellness',
    slug: 'health-wellness',
    children: [
      { name: 'Personal training', services: ['One-on-one training', 'Group fitness training', 'Online coaching', 'Fitness assessment'] },
      { name: 'Massage therapy', services: ['Swedish massage', 'Deep tissue massage', 'Sports massage', 'Relaxation massage'] },
      { name: 'Physiotherapy', services: ['Physiotherapy assessment', 'Rehabilitation', 'Sports physiotherapy', 'Home physiotherapy'] },
      { name: 'Nutrition counseling', services: ['Diet planning', 'Nutrition assessment', 'Weight management', 'Meal planning'] },
      { name: 'Home nursing', services: ['Home nursing care', 'Post-surgery care', 'Medication management', 'Wound care'] },
      { name: 'Elderly care', services: ['Elderly companionship', 'Personal care assistance', 'Dementia care', 'Respite care'] },
      { name: 'Childcare & babysitting', services: ['Babysitting', 'Nanny services', 'After-school care', 'Newborn care'] },
      { name: 'Counseling & therapy', services: ['Individual counseling', 'Couples therapy', 'Family therapy', 'Online therapy'] },
      { name: 'Yoga instruction', services: ['Private yoga classes', 'Group yoga classes', 'Prenatal yoga', 'Yoga therapy'] },
      { name: 'Dental services', services: ['Dental checkup', 'Teeth cleaning', 'Dental fillings', 'Teeth whitening'] },
      {
        name: 'Medical equipment repair',
        services: ['Wheelchair repair', 'Hospital bed repair', 'Diagnostic equipment repair', 'Oxygen concentrator repair'],
      },
      { name: 'Wellness coaching', services: ['Health coaching', 'Stress management', 'Sleep coaching', 'Lifestyle coaching'] },
      { name: 'Spa services', services: ['Spa treatments', 'Body scrub', 'Facial treatments', 'Aromatherapy'] },
      { name: 'Hair & beauty', services: ['Haircut and styling', 'Hair coloring', 'Hair treatment', 'Bridal hair'] },
      { name: 'Barbering', services: ["Men's haircut", 'Beard trimming', 'Shaving', 'Kids haircut'] },
      { name: 'Nail services', services: ['Manicure', 'Pedicure', 'Gel nails', 'Nail art'] },
    ],
  },
  {
    name: 'Education & Training',
    slug: 'education-training',
    children: [
      { name: 'Tutoring', services: ['Math tutoring', 'Science tutoring', 'English tutoring', 'Exam tutoring'] },
      { name: 'Language lessons', services: ['English lessons', 'French lessons', 'Kinyarwanda lessons', 'Swahili lessons'] },
      { name: 'Music lessons', services: ['Piano lessons', 'Guitar lessons', 'Vocal lessons', 'Drum lessons'] },
      { name: 'Driving lessons', services: ['Driving lessons', 'Defensive driving', 'Motorcycle lessons', 'Refresher driving'] },
      {
        name: 'Test preparation',
        services: ['SAT preparation', 'IELTS preparation', 'TOEFL preparation', 'National exam preparation'],
      },
      {
        name: 'Coding bootcamps',
        services: ['Web development bootcamp', 'Python bootcamp', 'Data science bootcamp', 'Mobile development bootcamp'],
      },
      {
        name: 'Business training',
        services: ['Entrepreneurship training', 'Management training', 'Sales training', 'Customer service training'],
      },
      {
        name: 'First aid training',
        services: ['First aid certification', 'CPR training', 'Workplace first aid', 'Emergency response training'],
      },
      { name: 'Sports coaching', services: ['Football coaching', 'Basketball coaching', 'Athletics coaching', 'Swimming coaching'] },
      { name: 'Art classes', services: ['Drawing classes', 'Painting classes', 'Sculpture classes', 'Digital art classes'] },
      { name: 'Dance classes', services: ['Traditional dance', 'Modern dance', 'Ballroom dance', 'Kids dance'] },
      { name: 'Cooking classes', services: ['Home cooking classes', 'Baking classes', 'Professional cooking', 'Healthy cooking'] },
      {
        name: 'Sewing & tailoring classes',
        services: ['Sewing basics', 'Tailoring', 'Fashion design', 'Embroidery'],
      },
      {
        name: 'Computer training',
        services: ['Computer basics', 'Microsoft Office', 'Graphic design training', 'Digital literacy'],
      },
      { name: 'Career coaching', services: ['CV writing', 'Interview preparation', 'Career planning', 'LinkedIn coaching'] },
      {
        name: 'Study abroad consulting',
        services: ['University application support', 'Visa guidance', 'Scholarship consulting', 'Pre-departure orientation'],
      },
    ],
  },
  {
    name: 'Construction & Trades',
    slug: 'construction-trades',
    children: [
      {
        name: 'General contracting',
        services: ['Residential construction', 'Commercial construction', 'Renovation', 'Project supervision'],
      },
      { name: 'Masonry construction', services: ['Bricklaying', 'Stone masonry', 'Plastering', 'Concrete block work'] },
      { name: 'Concrete works', services: ['Concrete slabs', 'Foundations', 'Reinforced concrete', 'Concrete repair'] },
      { name: 'Steel fabrication', services: ['Steel gates', 'Steel trusses', 'Metal railings', 'Custom steel works'] },
      { name: 'Roofing construction', services: ['Roof installation', 'Roof repair', 'Roof replacement', 'Gutter installation'] },
      { name: 'Tiling', services: ['Floor tiling', 'Wall tiling', 'Bathroom tiling', 'Tile repair'] },
      { name: 'Fencing', services: ['Chain link fencing', 'Wooden fencing', 'Electric fencing', 'Gate installation'] },
      { name: 'Paving', services: ['Paving blocks', 'Driveway paving', 'Sidewalk paving', 'Paving repair'] },
      { name: 'Excavation', services: ['Site excavation', 'Trench digging', 'Land clearing', 'Foundation excavation'] },
      { name: 'Demolition', services: ['Building demolition', 'Interior demolition', 'Debris removal', 'Concrete breaking'] },
      { name: 'Scaffolding', services: ['Scaffolding rental', 'Scaffolding installation', 'Scaffolding inspection', 'Dismantling'] },
      { name: 'Glass & aluminum', services: ['Aluminum windows', 'Glass partitions', 'Shower cubicles', 'Aluminum doors'] },
      { name: 'Welding & metalwork', services: ['Welding', 'Metal fabrication', 'Gate repair', 'Metal furniture'] },
      {
        name: 'Borehole drilling',
        services: ['Borehole drilling', 'Borehole pump installation', 'Borehole maintenance', 'Water testing'],
      },
      {
        name: 'HVAC installation',
        services: ['Air conditioning installation', 'Ventilation installation', 'Heating installation', 'HVAC maintenance'],
      },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty-personal-care',
    children: [
      { name: 'Hair salon', services: ['Haircut', 'Hair coloring', 'Hair treatment', 'Bridal styling'] },
      { name: 'Barber shop', services: ["Men's haircut", 'Beard trim', 'Hot towel shave', 'Kids haircut'] },
      { name: 'Nail salon', services: ['Manicure', 'Pedicure', 'Gel nails', 'Nail art'] },
      { name: 'Makeup artist', services: ['Bridal makeup', 'Party makeup', 'Photoshoot makeup', 'Makeup lessons'] },
      { name: 'Spa & massage', services: ['Full body massage', 'Hot stone massage', 'Aromatherapy massage', 'Couples massage'] },
      { name: 'Skincare', services: ['Facial treatment', 'Acne treatment', 'Skin consultation', 'Body scrub'] },
      { name: 'Bridal beauty', services: ['Bridal makeup', 'Bridal hair', 'Bridal package', 'Bridesmaid makeup'] },
      { name: 'Tattoo & piercing', services: ['Custom tattoo', 'Tattoo removal', 'Ear piercing', 'Body piercing'] },
      { name: 'Waxing', services: ['Leg waxing', 'Underarm waxing', 'Facial waxing', 'Full body waxing'] },
      { name: 'Eyelash extensions', services: ['Classic lashes', 'Volume lashes', 'Lash lift', 'Lash refill'] },
      { name: 'Hair braiding', services: ['Box braids', 'Cornrows', 'Twists', 'Kids braiding'] },
      { name: "Men's grooming", services: ["Men's facial", 'Beard grooming', "Men's hair color", 'Grooming package'] },
      { name: 'Personal styling', services: ['Wardrobe styling', 'Personal shopping', 'Outfit planning', 'Style consultation'] },
      { name: 'Image consulting', services: ['Image assessment', 'Color analysis', 'Personal branding', 'Etiquette coaching'] },
      { name: 'Mobile beauty', services: ['Mobile hairdressing', 'Mobile makeup', 'Mobile nails', 'Mobile spa'] },
      { name: 'Kids haircuts', services: ['Kids haircut', 'Kids styling', 'First haircut', 'Kids party hair'] },
    ],
  },
  {
    name: 'Food & Catering',
    slug: 'food-catering',
    children: [
      { name: 'Catering', services: ['Event catering', 'Corporate catering', 'Wedding catering', 'Private catering'] },
      { name: 'Private chef', services: ['Private dinner', 'Weekly meal prep', 'Special occasion chef', 'Cooking demonstration'] },
      { name: 'Baking', services: ['Cakes', 'Pastries', 'Bread', 'Cookies'] },
      { name: 'Wedding cakes', services: ['Wedding cake', 'Anniversary cake', 'Cake tasting', 'Custom cake design'] },
      { name: 'Food delivery', services: ['Meal delivery', 'Restaurant delivery', 'Grocery delivery', 'Office lunch delivery'] },
      { name: 'Meal preparation', services: ['Weekly meal prep', 'Diet meal prep', 'Family meal prep', 'Corporate meal prep'] },
      { name: 'Bartending', services: ['Event bartending', 'Cocktail service', 'Mobile bar', 'Bartending classes'] },
      {
        name: 'Restaurant supplies',
        services: ['Kitchen equipment supply', 'Restaurant consumables', 'Packaging supplies', 'Menu printing'],
      },
      { name: 'Food photography', services: ['Food photography', 'Menu photography', 'Recipe video', 'Food styling'] },
      { name: 'Menu consulting', services: ['Menu design', 'Menu costing', 'Recipe development', 'Kitchen workflow consulting'] },
      { name: 'Corporate catering', services: ['Office breakfast', 'Corporate lunch', 'Conference catering', 'Training catering'] },
      { name: 'Dietary catering', services: ['Vegan catering', 'Gluten-free catering', 'Diabetic meals', 'Halal catering'] },
      { name: 'Grocery shopping', services: ['Personal grocery shopping', 'Weekly grocery delivery', 'Market shopping', 'Bulk shopping'] },
      { name: 'Butchery', services: ['Meat cutting', 'Meat delivery', 'Custom cuts', 'Meat preparation'] },
      { name: 'Juice & smoothies', services: ['Fresh juice bar', 'Smoothie delivery', 'Detox juices', 'Event juice service'] },
      { name: 'Coffee services', services: ['Mobile coffee bar', 'Office coffee service', 'Barista hire', 'Coffee catering'] },
    ],
  },
  {
    name: 'Transport & Logistics',
    slug: 'transport-logistics',
    children: [
      { name: 'Moving services', services: ['House moving', 'Office moving', 'Long-distance moving', 'Packing services'] },
      { name: 'Courier & delivery', services: ['Same-day courier', 'Parcel delivery', 'Document delivery', 'Bulk delivery'] },
      { name: 'Freight forwarding', services: ['Air freight', 'Sea freight', 'Road freight', 'Customs brokerage'] },
      { name: 'Trucking', services: ['Truck haulage', 'Container transport', 'Heavy cargo transport', 'Local trucking'] },
      { name: 'Taxi & rideshare', services: ['Airport taxi', 'City rides', 'Hourly hire', 'Night rides'] },
      { name: 'Car rental', services: ['Self-drive car rental', 'Chauffeur car rental', 'SUV rental', 'Van rental'] },
      { name: 'Bus services', services: ['Charter bus', 'School bus', 'Staff shuttle', 'Event bus'] },
      { name: 'Warehousing', services: ['Short-term storage', 'Long-term storage', 'Warehouse management', 'Inventory handling'] },
      {
        name: 'Customs clearance',
        services: ['Import clearance', 'Export clearance', 'Customs documentation', 'Duty consulting'],
      },
      { name: 'Packing services', services: ['Home packing', 'Office packing', 'Fragile packing', 'Unpacking services'] },
      { name: 'Bike delivery', services: ['Motorbike delivery', 'Food delivery', 'Parcel delivery', 'Same-day bike courier'] },
      {
        name: 'Cold storage',
        services: ['Refrigerated storage', 'Frozen storage', 'Cold chain transport', 'Pharmaceutical storage'],
      },
      { name: 'Fleet management', services: ['Fleet maintenance', 'Fleet tracking', 'Driver management', 'Fuel management'] },
      { name: 'Airport transfers', services: ['Airport pickup', 'Airport drop-off', 'Meet and greet', 'VIP transfer'] },
      { name: 'Chauffeur services', services: ['Personal chauffeur', 'Corporate chauffeur', 'Wedding chauffeur', 'Hourly chauffeur'] },
    ],
  },
  {
    name: 'Agriculture & Environment',
    slug: 'agriculture-environment',
    children: [
      { name: 'Farming services', services: ['Land preparation', 'Planting', 'Weeding', 'Harvesting'] },
      { name: 'Landscaping', services: ['Landscape design', 'Lawn care', 'Tree planting', 'Irrigation landscaping'] },
      {
        name: 'Irrigation',
        services: ['Drip irrigation installation', 'Sprinkler system installation', 'Irrigation repair', 'Irrigation design'],
      },
      {
        name: 'Greenhouse installation',
        services: ['Greenhouse construction', 'Greenhouse repair', 'Hydroponics setup', 'Greenhouse supplies'],
      },
      { name: 'Vet services', services: ['Veterinary consultation', 'Vaccination', 'Animal surgery', 'Mobile vet services'] },
      { name: 'Animal husbandry', services: ['Livestock farming advice', 'Animal feeding', 'Dairy management', 'Poultry management'] },
      { name: 'Crop consulting', services: ['Crop planning', 'Soil fertility advice', 'Pest management', 'Yield improvement'] },
      {
        name: 'Agricultural pest control',
        services: ['Agricultural pest control', 'Locust control', 'Rodent control', 'Integrated pest management'],
      },
      { name: 'Tree cutting', services: ['Tree felling', 'Tree pruning', 'Stump removal', 'Firewood supply'] },
      { name: 'Soil testing', services: ['Soil analysis', 'Soil fertility testing', 'pH testing', 'Soil sampling'] },
      {
        name: 'Agricultural equipment repair',
        services: ['Tractor repair', 'Irrigation pump repair', 'Farm machinery repair', 'Equipment maintenance'],
      },
      { name: 'Seed supply', services: ['Vegetable seeds', 'Cereal seeds', 'Seedling supply', 'Seed treatment'] },
      { name: 'Fertilizer supply', services: ['Organic fertilizer', 'Inorganic fertilizer', 'Fertilizer application', 'Soil amendment'] },
      { name: 'Harvesting', services: ['Crop harvesting', 'Coffee harvesting', 'Fruit harvesting', 'Harvest labor'] },
      { name: 'Poultry services', services: ['Poultry farming', 'Chicken vaccination', 'Egg supply', 'Poultry equipment'] },
      { name: 'Fish farming', services: ['Fish pond construction', 'Fish fingerling supply', 'Fish feeding', 'Aquaculture consulting'] },
      { name: 'Beekeeping', services: ['Beehive supply', 'Honey harvesting', 'Beekeeping training', 'Pollination services'] },
      {
        name: 'Environmental consulting',
        services: ['Environmental impact assessment', 'Sustainability consulting', 'Environmental compliance', 'Waste audits'],
      },
      { name: 'Waste management', services: ['Garbage collection', 'Industrial waste removal', 'Recycling services', 'Waste bin rental'] },
      { name: 'Recycling', services: ['Plastic recycling', 'Metal recycling', 'Paper recycling', 'E-waste recycling'] },
    ],
  },
];

/**
 * Category-specific form fields, keyed by the leaf category's full slug so a
 * shared display name in two parents can never attach attributes to the wrong
 * branch. New categories work without entries here; they simply use the common
 * title/description/price/duration fields.
 */
export const CATEGORY_ATTRIBUTES: Record<string, AttributeSeed[]> = {
  'events-photography': [
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
  'events-videography': [
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
  'home-services-carpentry': [
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
  'automotive-car-repair': [
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
  'home-services-plumbing': [
    { name: 'Residential', type: 'BOOLEAN', isFilterable: true },
    { name: 'Commercial', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
    { name: 'Installation', type: 'BOOLEAN', isFilterable: true },
    { name: 'Repair', type: 'BOOLEAN', isFilterable: true },
  ],
  'events-wedding-services': [
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
  'home-services-electrical': [
    { name: 'Residential', type: 'BOOLEAN', isFilterable: true },
    { name: 'Commercial', type: 'BOOLEAN', isFilterable: true },
    { name: 'Wiring', type: 'BOOLEAN', isFilterable: true },
    { name: 'Solar', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
  ],
  'automotive-brake-repair': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    {
      name: 'Brands Supported',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'],
    },
    { name: 'Brake Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Disc', 'Drum', 'ABS', 'Drums & Discs'] },
    { name: 'Mobile Repair', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Service', type: 'BOOLEAN', isFilterable: true },
  ],
  'automotive-car-electrical': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    {
      name: 'Brands Supported',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'],
    },
    { name: 'Diagnostic Equipment', type: 'BOOLEAN', isFilterable: true },
    { name: 'Battery Replacement', type: 'BOOLEAN', isFilterable: true },
    { name: 'Mobile Repair', type: 'BOOLEAN', isFilterable: true },
  ],
  'automotive-tire-services': [
    { name: 'Vehicle Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Cars', 'Motorcycles', 'Trucks', 'SUVs'] },
    {
      name: 'Brands Supported',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Toyota', 'BMW', 'Mercedes', 'Honda', 'Ford', 'Nissan'],
    },
    {
      name: 'Services Offered',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Tire Change', 'Balancing', 'Puncture Repair', 'Wheel Alignment', 'Tire Storage'],
    },
    { name: 'Tire Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Summer', 'Winter', 'All-Season', 'Spare'] },
    { name: 'Mobile Service', type: 'BOOLEAN', isFilterable: true },
  ],
  'home-services-cleaning': [
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
  'home-services-painting': [
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
  'technology-software-development': [
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
  'technology-website-development': [
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
  'technology-computer-repair': [
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
  'technology-networking': [
    { name: 'Network Types', type: 'MULTI_SELECT', isFilterable: true, options: ['Wired', 'Wireless', 'Hybrid', 'Mesh Wi-Fi'] },
    {
      name: 'Services Offered',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Installation', 'Configuration', 'Troubleshooting', 'Security'],
    },
    {
      name: 'Equipment Brands',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['TP-Link', 'Ubiquiti', 'Cisco', 'MikroTik', 'Netgear'],
    },
    { name: 'Business Support', type: 'BOOLEAN', isFilterable: true },
    { name: 'Emergency Support', type: 'BOOLEAN', isFilterable: true },
  ],
  'events-decoration': [
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
  'events-dj': [
    {
      name: 'Event Types',
      type: 'MULTI_SELECT',
      isFilterable: true,
      options: ['Wedding', 'Birthday', 'Corporate', 'Concert', 'Party'],
    },
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

/**
 * Runs `task` over `items` with at most `limit` promises in flight. Keeps the
 * sync fast without opening one connection per taxonomy row on Neon.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Idempotently upsert the whole taxonomy. Safe to run repeatedly and against
 * production: it never deletes, and existing categories/services are updated in
 * place so offerings, requests and saved searches keep their references.
 */
export async function seedTaxonomy(prisma: PrismaClient): Promise<void> {
  const categoryIdBySlug = new Map<string, string>();
  const concurrency = 8;

  for (const parent of CATEGORY_TREE) {
    const parentRow = await prisma.serviceCategory.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, isActive: true },
      create: { name: parent.name, slug: parent.slug, isActive: true },
    });
    categoryIdBySlug.set(parent.slug, parentRow.id);

    const childRows = await mapWithConcurrency(
      parent.children,
      concurrency,
      async (child) => {
        const childSlug = `${parent.slug}-${slugify(child.name)}`;
        const childRow = await prisma.serviceCategory.upsert({
          where: { slug: childSlug },
          update: { name: child.name, parentId: parentRow.id, isActive: true },
          create: { name: child.name, slug: childSlug, parentId: parentRow.id, isActive: true },
        });
        categoryIdBySlug.set(childSlug, childRow.id);
        return { child, childRow };
      },
    );

    const serviceJobs = childRows.flatMap(({ child, childRow }) =>
      Array.from(new Set(child.services)).map((serviceName) => ({
        categoryId: childRow.id,
        serviceName,
      })),
    );

    await mapWithConcurrency(serviceJobs, concurrency, ({ categoryId, serviceName }) =>
      prisma.service.upsert({
        where: { categoryId_slug: { categoryId, slug: slugify(serviceName) } },
        update: { name: serviceName, isActive: true },
        create: {
          categoryId,
          name: serviceName,
          slug: slugify(serviceName),
          isActive: true,
        },
      }),
    );
  }

  const attributeJobs = Object.entries(CATEGORY_ATTRIBUTES).flatMap(
    ([categorySlug, attributes]) => {
      const categoryId = categoryIdBySlug.get(categorySlug);
      if (!categoryId) return [];
      return attributes.map((attribute, index) => ({ categoryId, attribute, index }));
    },
  );

  await mapWithConcurrency(attributeJobs, concurrency, ({ categoryId, attribute, index }) => {
    const slug = slugify(attribute.name);
    return prisma.categoryAttribute.upsert({
      where: { categoryId_slug: { categoryId, slug } },
      update: { isActive: true },
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
  });
}
