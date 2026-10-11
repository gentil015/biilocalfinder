/**
 * Demo data for local development: 20 providers, their services, and enough
 * marketplace activity (requests, quotes, bookings, reviews, messages) to
 * exercise every screen without hand-creating data.
 *
 * Design notes
 * ------------
 * - Idempotent. Every row is upserted on a stable natural key, so this can be
 *   re-run after changing the dataset without duplicating anything. The
 *   transactional rows (requests/quotes/bookings/reviews) are keyed on a
 *   deterministic UUID derived from their own identity, which keeps the chain
 *   re-runnable even though they have no natural unique key of their own.
 * - One provider per leaf category, so every category in the platform has at
 *   least one live profile and no category is empty in search. Plumbing and
 *   Photography get a second provider so the compare/filter flows have more
 *   than one result to work with.
 * - Verification state is written as *records*, not just the denormalized
 *   column: VERIFIED requires a live IDENTITY record plus a verified phone
 *   (see verification/verification-status.ts), and the denormalized
 *   Provider.verificationStatus is set to match what that rule derives.
 * - Provider.rating / reviewCount / verifiedReviewCount are recomputed from
 *   the published reviews at the end, using the same aggregate the reviews
 *   module uses, rather than being made up.
 * - No portfolio/review images: uploads need S3-compatible storage, which
 *   isn't configured in the local dev environment. Entries exist so the
 *   portfolio screens have content; add storage to attach media.
 *
 * Usage: npm run prisma:demo
 */

import { PrismaClient, AttributeType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const PROVIDER_PASSWORD = 'Provider123!';
const CLIENT_PASSWORD = 'Client123!';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// A deterministic UUID from a natural key. Postgres uuid columns accept these
// (they're valid RFC-4122 layout, version nibble included), which lets the
// request/quote/booking/review chain be upserted on a key that means something.
function demoId(key: string): string {
  const h = createHash('md5').update(`bii-demo:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const timeAt = (n: number, h: number) => {
  const d = daysFromNow(n);
  d.setHours(h, 0, 0, 0);
  return d;
};

// ---------------------------------------------------------------------------
// Locations — Kigali neighbourhoods plus two out-of-town cities, so radius
// search and "providers near me" have something meaningful to sort.
// ---------------------------------------------------------------------------
const LOCATIONS = {
  'kigali-centre': { label: 'Kigali City Centre', addressLine: 'KN 5 Ave', city: 'Kigali', lat: -1.9441, lng: 30.0619 },
  nyamirambo: { label: 'Nyamirambo', addressLine: 'KN 42 St', city: 'Kigali', lat: -1.9833, lng: 30.0444 },
  nyarutarama: { label: 'Nyarutarama', addressLine: 'KG 12 Ave', city: 'Kigali', lat: -1.93, lng: 30.1 },
  gikondo: { label: 'Gikondo', addressLine: 'KG 7 Ave', city: 'Kigali', lat: -1.978, lng: 30.073 },
  remera: { label: 'Remera', addressLine: 'KG 4 Ave', city: 'Kigali', lat: -1.953, lng: 30.118 },
  kimisagara: { label: 'Kimisagara', addressLine: 'KN 25 St', city: 'Kigali', lat: -1.953, lng: 30.039 },
  gacuriro: { label: 'Gacuriro', addressLine: 'KN 103 St', city: 'Kigali', lat: -1.913, lng: 30.083 },
  kanombe: { label: 'Kanombe', addressLine: 'KG 507 Ave', city: 'Kigali', lat: -1.918, lng: 30.145 },
  musanze: { label: 'Musanze Town', addressLine: 'Main Road', city: 'Musanze', lat: -1.88, lng: 29.87 },
  huye: { label: 'Huye (Butare)', addressLine: 'Station Road', city: 'Huye', lat: -2.51, lng: 29.74 },
} as const;

type LocationKey = keyof typeof LOCATIONS;

// The shared service catalogue: two entries per leaf category. Keys must match
// the leaf category display names used by prisma/seed.ts.
const SERVICES: Record<string, string[]> = {
  'Car repair': ['Engine diagnostics and repair', 'Full vehicle servicing'],
  'Car electrical': ['Battery and alternator diagnostics', 'Wiring and fault tracing'],
  'Brake repair': ['Brake pad and disc replacement', 'Brake fluid and line servicing'],
  'Tire services': ['Tire fitting and balancing', 'Wheel alignment'],
  Plumbing: ['Leak detection and pipe repair', 'Water tank and pump installation'],
  Electrical: ['Wiring and socket installation', 'Solar back-up installation'],
  Cleaning: ['Deep cleaning for homes and offices', 'Post-construction cleaning'],
  Painting: ['Interior and exterior painting', 'Wall texture and finishing'],
  Carpentry: ['Custom furniture and cabinets', 'Doors, windows and wood repair'],
  'Software development': ['Custom web application development', 'Mobile app development'],
  'Website development': ['Business website design and build', 'Website maintenance and SEO'],
  'Computer repair': ['Laptop and desktop repair', 'Data recovery and malware removal'],
  Networking: ['Office network installation', 'Wi-Fi and router configuration'],
  Photography: ['Event and wedding photography', 'Product and portrait photography'],
  Videography: ['Event videography', 'Corporate video production'],
  Decoration: ['Wedding and event decoration', 'Floral arrangements'],
  DJ: ['Wedding and event DJ', 'PA and sound system rental'],
  'Wedding Services': ['Full wedding planning', 'Wedding day-of coordination'],
};

type ProviderTypeName = 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';

interface ProviderSpec {
  /** Business display name; also the workspace name. */
  businessName: string;
  /** Owner's name, used for the user account. */
  owner: { firstName: string; lastName: string };
  category: string;
  location: LocationKey;
  type: ProviderTypeName;
  years: number;
  radiusKm: number;
  bio: string;
  description: string;
  verification: 'VERIFIED' | 'PENDING' | 'UNVERIFIED' | 'EXPIRED' | 'SUSPENDED';
  subscription: 'ACTIVE' | 'EXPIRED' | 'TRIALING' | 'PAST_DUE';
  availability: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  responseRate: number;
  responseTimeMinutes: number;
  /** service name -> [price, priceType, duration] */
  offerings: Array<{
    service: string;
    price: number;
    priceType?: 'FIXED' | 'HOURLY' | 'PER_DAY' | 'STARTING_FROM' | 'CUSTOM_QUOTE';
    duration: string;
    description: string;
  }>;
  /** Extra service areas beyond the primary location. */
  extraAreas?: Array<{ label: string; lat: number; lng: number; radiusKm: number }>;
  portfolio: Array<{ title: string; description: string; monthsAgo: number; service?: string }>;
  /** Weekly availability; omitted days are unavailable. */
  workingDays?: number[];
  /**
   * Category attribute values, keyed by the attribute display name from
   * prisma/seed.ts. Anything not listed falls back to a type-appropriate
   * default so every filterable attribute has a real value.
   */
  attrs?: Record<string, string | number | boolean | string[]>;
}

const PROVIDERS: ProviderSpec[] = [
  {
    businessName: 'Kigali AutoCare Centre',
    owner: { firstName: 'Eric', lastName: 'Niyonsenga' },
    category: 'Car repair',
    location: 'kimisagara',
    type: 'BUSINESS',
    years: 12,
    radiusKm: 25,
    bio: 'Full-service garage running four bays and two diagnostic benches. We handle Japanese imports weekly and keep most common parts in stock.',
    description:
      'Established in Kimisagara in 2014. Two qualified technicians, transparent pricing before any work starts, and a 3-month workmanship warranty on repairs.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 98,
    responseTimeMinutes: 25,
    offerings: [
      { service: 'Engine diagnostics and repair', price: 85000, priceType: 'STARTING_FROM', duration: '2–4 hours', description: 'Full diagnostic pass with a written report, then a fixed quote before any repair is authorised.' },
      { service: 'Full vehicle servicing', price: 120000, priceType: 'FIXED', duration: 'half day', description: 'Oil, filters, fluids, brake check and a 30-point inspection. Parts included for sedans.' },
    ],
    extraAreas: [
      { label: 'Kicukiro', lat: -1.9555, lng: 30.0899, radiusKm: 18 },
      { label: 'Gikondo', lat: -1.978, lng: 30.073, radiusKm: 12 },
    ],
    portfolio: [
      { title: 'Toyota RAV4 60,000km service', description: 'Full service with timing belt inspection and new belts fitted.', monthsAgo: 2, service: 'Full vehicle servicing' },
      { title: 'Nissan Note intermittent no-start', description: 'Traced to a corroded earth strap behind the battery loom.', monthsAgo: 5, service: 'Engine diagnostics and repair' },
    ],
    workingDays: [1, 2, 3, 4, 5, 6],
    attrs: { 'Vehicle Types': ['Cars', 'SUVs'], 'Brands Supported': ['Toyota', 'Nissan', 'Honda'], 'Diagnostic Equipment': true, 'Mobile Repair': false, 'Emergency Service': false },
  },
  {
    businessName: 'Munyaneza Auto Electrics',
    owner: { firstName: 'Jean', lastName: 'Munyaneza' },
    category: 'Car electrical',
    location: 'nyamirambo',
    type: 'INDIVIDUAL',
    years: 8,
    radiusKm: 15,
    bio: 'Mobile auto electrician. I come to you for battery, alternator and wiring faults anywhere in Kigali.',
    description:
      'Twelve years on the road with a laptop and a multimeter. Most faults diagnosed on the spot at the customer’s location.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'BUSY',
    responseRate: 92,
    responseTimeMinutes: 40,
    offerings: [
      { service: 'Battery and alternator diagnostics', price: 35000, priceType: 'STARTING_FROM', duration: '1 hour', description: 'Load test, charging system check and a written verdict on whether the battery or alternator is at fault.' },
      { service: 'Wiring and fault tracing', price: 30000, priceType: 'HOURLY', duration: 'per hour', description: 'Chasing shorted or chafed wiring, including aftermarket audio and lighting installs.' },
    ],
    extraAreas: [{ label: 'Kigali City Centre', lat: -1.9441, lng: 30.0619, radiusKm: 12 }],
    portfolio: [{ title: 'Alternator replacement, Hilux', description: 'Diagnosed a failing diode, sourced a remanufactured unit, fitted same day.', monthsAgo: 1, service: 'Battery and alternator diagnostics' }],
    workingDays: [1, 2, 3, 4, 5, 6, 0],
    attrs: { 'Vehicle Types': ['Cars', 'Trucks', 'SUVs'], 'Brands Supported': ['Toyota', 'Nissan', 'Ford'], 'Diagnostic Equipment': true, 'Mobile Repair': true, 'Emergency Service': true },
  },
  {
    businessName: 'SafeBrake Kigali',
    owner: { firstName: 'Divine', lastName: 'Ingabire' },
    category: 'Brake repair',
    location: 'gikondo',
    type: 'TEAM',
    years: 6,
    radiusKm: 20,
    bio: 'Brake specialists. Pads, discs, fluid and ABS — nothing else, so we do it properly and fast.',
    description:
      'A small team focused entirely on braking systems. Free safety check with every brake job.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 95,
    responseTimeMinutes: 30,
    offerings: [
      { service: 'Brake pad and disc replacement', price: 95000, priceType: 'STARTING_FROM', duration: '2–3 hours', description: 'Pads and discs front or rear, with a bed-in procedure and a road test before handover.' },
      { service: 'Brake fluid and line servicing', price: 60000, priceType: 'FIXED', duration: '1–2 hours', description: 'Fluid flush, line inspection and ABS bleed where fitted.' },
    ],
    portfolio: [{ title: 'Front brake overhaul, Prado', description: 'Both front discs warped after a hill descent. Replaced and bedded in properly.', monthsAgo: 3, service: 'Brake pad and disc replacement' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'RubberTech Tyres',
    owner: { firstName: 'Fabrice', lastName: 'Nkurunziza' },
    category: 'Tire services',
    location: 'gacuriro',
    type: 'INDIVIDUAL',
    years: 9,
    radiusKm: 22,
    bio: 'Fitting, balancing, alignment and puncture repair. Fast while you wait.',
    description: 'Mobile tyre service across Kigali — I bring the machine to your driveway or office.',
    verification: 'SUSPENDED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 74,
    responseTimeMinutes: 180,
    offerings: [
      { service: 'Tire fitting and balancing', price: 15000, priceType: 'PER_DAY', duration: 'per tire', description: 'Fit, balance and valve replacement. Puncture repair included where the tread allows.' },
      { service: 'Wheel alignment', price: 45000, priceType: 'FIXED', duration: '1 hour', description: 'Four-wheel alignment with a printout of before and after readings.' },
    ],
    portfolio: [{ title: 'Full set of four, commercial van', description: 'Fit and balance plus a full alignment on a heavily loaded Transit.', monthsAgo: 1, service: 'Wheel alignment' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'Impera Plumbing & Drainage',
    owner: { firstName: 'Patrick', lastName: 'Habimana' },
    category: 'Plumbing',
    location: 'nyamirambo',
    type: 'TEAM',
    years: 14,
    radiusKm: 30,
    bio: 'Plumbing and drainage for homes, restaurants and small commercial sites. Available for emergencies day and night.',
    description:
      'Founded 2012. Four vans, a drain jetter, and a crew that turns up when they say they will.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 99,
    responseTimeMinutes: 15,
    offerings: [
      { service: 'Leak detection and pipe repair', price: 45000, priceType: 'STARTING_FROM', duration: '1–3 hours', description: 'Pressure and acoustic leak detection, then a permanent repair — not a clamp.' },
      { service: 'Water tank and pump installation', price: 280000, priceType: 'FIXED', duration: '1 day', description: 'Tank, pump, pressure switch and pipework installed and tested. 6-month workmanship warranty.' },
    ],
    extraAreas: [
      { label: 'Kigali City Centre', lat: -1.9441, lng: 30.0619, radiusKm: 20 },
      { label: 'Kimisagara', lat: -1.953, lng: 30.039, radiusKm: 16 },
    ],
    portfolio: [
      { title: 'Guesthouse re-pipe, Nyamirambo', description: 'Replaced 40m of galvanised pipe with PPR and added isolation valves at every fixture.', monthsAgo: 2, service: 'Water tank and pump installation' },
      { title: 'Recurring kitchen leak', description: 'Traced to a failed flexi connector under a triple-sink unit rather than the visible joint.', monthsAgo: 4, service: 'Leak detection and pipe repair' },
    ],
    workingDays: [1, 2, 3, 4, 5, 6, 0],
    attrs: { Residential: true, Commercial: true, 'Emergency Service': true, Installation: true, Repair: true },
  },
  {
    businessName: 'UWASE Water Systems',
    owner: { firstName: 'Diane', lastName: 'Uwase' },
    category: 'Plumbing',
    location: 'remera',
    type: 'INDIVIDUAL',
    years: 5,
    radiusKm: 18,
    bio: 'Solar water heating and borehole pumping, installed and maintained for homes and small businesses.',
    description: 'Specialises in off-grid water: boreholes, solar pumps and hot water that works in a power cut.',
    verification: 'PENDING',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 90,
    responseTimeMinutes: 60,
    offerings: [
      { service: 'Water tank and pump installation', price: 340000, priceType: 'STARTING_FROM', duration: '1–2 days', description: 'Solar pump and storage tank, sized to your household’s real daily use.' },
      { service: 'Leak detection and pipe repair', price: 40000, priceType: 'HOURLY', duration: 'per hour', description: 'Leak finding and repair on above-ground and buried pipework.' },
    ],
    portfolio: [{ title: 'Solar pump, 2,000L storage', description: 'Aimed a 2,000 litre tank at a borehole so the household has running water without a generator.', monthsAgo: 6, service: 'Water tank and pump installation' }],
    workingDays: [1, 2, 3, 4, 5],
    attrs: { Residential: true, Commercial: false, 'Emergency Service': false, Installation: true, Repair: true },
  },
  {
    businessName: 'Volt Rwanda Electricals',
    owner: { firstName: 'Alice', lastName: 'Mutesi' },
    category: 'Electrical',
    location: 'remera',
    type: 'BUSINESS',
    years: 11,
    radiusKm: 28,
    bio: 'Certified electrical contractor. Commercial fit-outs, solar back-up and maintenance contracts.',
    description: 'A licensed contractor working on homes, shops and small commercial buildings across Kigali.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 94,
    responseTimeMinutes: 35,
    offerings: [
      { service: 'Wiring and socket installation', price: 75000, priceType: 'HOURLY', duration: 'per hour', description: 'Full rewire, new circuits, sockets and lighting, with a certificate on completion.' },
      { service: 'Solar back-up installation', price: 2400000, priceType: 'STARTING_FROM', duration: '2–3 days', description: 'Inverter, lithium or lead-acid bank and panels, sized against your actual load.' },
    ],
    extraAreas: [{ label: 'Kanombe', lat: -1.918, lng: 30.145, radiusKm: 20 }],
    portfolio: [
      { title: 'Restaurant rewire, Kicukiro', description: 'Split the kitchen and dining circuits and added a proper distribution board.', monthsAgo: 3, service: 'Wiring and socket installation' },
      { title: '3kW solar back-up install', description: 'Panels, inverter and battery with a changeover switch for the shop.', monthsAgo: 8, service: 'Solar back-up installation' },
    ],
    workingDays: [1, 2, 3, 4, 5],
    attrs: { Residential: true, Commercial: true, Wiring: true, Solar: true, 'Emergency Service': false },
  },
  {
    businessName: 'Girimpamo Cleaning Co.',
    owner: { firstName: 'Sandrine', lastName: 'Iradukunda' },
    category: 'Cleaning',
    location: 'gacuriro',
    type: 'TEAM',
    years: 7,
    radiusKm: 20,
    bio: 'Recurring and one-off cleaning for homes, offices and clinics. Same team every visit.',
    description: 'A team of six, not a rotating pool of subcontractors. Recurring slots booked weekly or fortnightly.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 97,
    responseTimeMinutes: 20,
    offerings: [
      { service: 'Deep cleaning for homes and offices', price: 90000, priceType: 'HOURLY', duration: 'per hour', description: 'Kitchen, bathrooms, glass, floors and skirting. Materials and equipment supplied.' },
      { service: 'Post-construction cleaning', price: 6, priceType: 'PER_DAY', duration: 'per day', description: 'Dust, adhesive, silicone and paint-spatter removal after renovation or fit-out.' },
    ],
    portfolio: [{ title: 'Office clean, 3 floors', description: 'Nightly service, 60 staff area, with a monthly deep clean.', monthsAgo: 2, service: 'Deep cleaning for homes and offices' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'Ibyara Paint & Decor',
    owner: { firstName: 'Olivier', lastName: 'Rwema' },
    category: 'Painting',
    location: 'nyamirambo',
    type: 'INDIVIDUAL',
    years: 10,
    radiusKm: 20,
    bio: 'Interior and exterior painting, wall textures and finishing. Free colour consultation.',
    description: 'One painter, one assistant, proper preparation. Every job gets a written quote before we start.',
    verification: 'UNVERIFIED',
    subscription: 'TRIALING',
    availability: 'AVAILABLE',
    responseRate: 85,
    responseTimeMinutes: 90,
    offerings: [
      { service: 'Interior and exterior painting', price: 3800, priceType: 'PER_DAY', duration: 'per m²', description: 'Per square metre including preparation, two coats and cleanup.' },
      { service: 'Wall texture and finishing', price: 12000, priceType: 'PER_DAY', duration: 'per m²', description: 'Skimming, textured finishes and decorative painting.' },
    ],
    portfolio: [{ title: 'House repaint, Kicukiro', description: 'Full interior and exterior repaint with skimming on two rooms.', monthsAgo: 4, service: 'Interior and exterior painting' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'Umwenge Woodworks',
    owner: { firstName: 'Thierry', lastName: 'Ndayisaba' },
    category: 'Carpentry',
    location: 'kanombe',
    type: 'BUSINESS',
    years: 15,
    radiusKm: 35,
    bio: 'Custom furniture, fitted kitchens, doors and windows. Solid mahogany and hardwood, built to measure.',
    description: 'A workshop in Kanombe with four carpenters. We measure, build and install — including site work.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'BUSY',
    responseRate: 96,
    responseTimeMinutes: 45,
    offerings: [
      { service: 'Custom furniture and cabinets', price: 650000, priceType: 'CUSTOM_QUOTE', duration: '2–3 weeks', description: 'Built-in wardrobes, kitchens and shelving, measured on site and installed by our team.' },
      { service: 'Doors, windows and wood repair', price: 180000, priceType: 'STARTING_FROM', duration: '1–2 days', description: 'Supply and fit hardwood doors and windows, or repair existing joinery.' },
    ],
    extraAreas: [{ label: 'Kigali City Centre', lat: -1.9441, lng: 30.0619, radiusKm: 22 }],
    portfolio: [
      { title: 'Solid mahogany fitted kitchen', description: 'Fourteen cabinets, quartz worktop, fitted in five working days on site.', monthsAgo: 3, service: 'Custom furniture and cabinets' },
      { title: 'Rehanging and repairing doors', description: 'Restored four old doors and hung three replacements.', monthsAgo: 7, service: 'Doors, windows and wood repair' },
    ],
    workingDays: [1, 2, 3, 4, 5],
  },
  {
    businessName: 'CodeKigali Labs',
    owner: { firstName: 'Ineza', lastName: 'Keza' },
    category: 'Software development',
    location: 'nyamirambo',
    type: 'TEAM',
    years: 8,
    radiusKm: 15,
    bio: 'Small product team. Web and mobile builds, integrations, and taking over other people’s codebases.',
    description: 'Five developers building and maintaining web and mobile products, mostly for Rwandan businesses.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 93,
    responseTimeMinutes: 120,
    offerings: [
      { service: 'Custom web application development', price: 4500000, priceType: 'CUSTOM_QUOTE', duration: '6–12 weeks', description: 'Discovery, build and handover with source code, documentation and deployment.' },
      { service: 'Mobile app development', price: 3200000, priceType: 'CUSTOM_QUOTE', duration: '8–10 weeks', description: 'Cross-platform apps for Android and iOS, including a store submission pass.' },
    ],
    portfolio: [
      { title: 'Inventory system for a distributor', description: 'Stock, purchasing and reporting across three warehouses.', monthsAgo: 5, service: 'Custom web application development' },
      { title: 'Field-service app, Android', description: 'Offline-first job app for technicians with photo evidence capture.', monthsAgo: 9, service: 'Mobile app development' },
    ],
    workingDays: [1, 2, 3, 4, 5],
  },
  {
    businessName: 'Website Rwanda Studio',
    owner: { firstName: 'Bosco', lastName: 'Nshimiyimana' },
    category: 'Website development',
    location: 'gacuriro',
    type: 'INDIVIDUAL',
    years: 6,
    radiusKm: 20,
    bio: 'Business websites built fast, in English or Kinyarwanda, with hosting and maintenance handled.',
    description: 'I build and look after small-business websites — domain, hosting, updates and content changes.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 91,
    responseTimeMinutes: 60,
    offerings: [
      { service: 'Business website design and build', price: 850000, priceType: 'STARTING_FROM', duration: '1–3 weeks', description: 'Up to eight pages, mobile-first, with a contact form and Google Maps.' },
      { service: 'Website maintenance and SEO', price: 90000, priceType: 'PER_DAY', duration: 'per month', description: 'Hosting, backups, uptime checks, content edits and local SEO.' },
    ],
    portfolio: [{ title: 'Restaurant website with reservations', description: 'Six pages, bilingual copy, table booking form wired to email.', monthsAgo: 2, service: 'Business website design and build' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'TechFix Kigali',
    owner: { firstName: 'Emmanuel', lastName: 'Bizimana' },
    category: 'Computer repair',
    location: 'kigali-centre',
    type: 'INDIVIDUAL',
    years: 9,
    radiusKm: 15,
    bio: 'Laptops and desktops repaired at the bench. Data recovery, malware removal, honest diagnostics.',
    description: 'Repairs laptops, desktops and monitors in my workshop in the city centre, same-day for most jobs.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 96,
    responseTimeMinutes: 25,
    offerings: [
      { service: 'Laptop and desktop repair', price: 45000, priceType: 'STARTING_FROM', duration: 'same day', description: 'Diagnosis, board-level repair where needed, and a 3-month warranty on the repair.' },
      { service: 'Data recovery and malware removal', price: 75000, priceType: 'FIXED', duration: '1–2 days', description: 'Recovery from failing drives and full cleanup of persistent malware.' },
    ],
    portfolio: [{ title: 'Laptop recovery after liquid damage', description: 'Cleaned the board and recovered a failing SSD’s data.', monthsAgo: 1, service: 'Data recovery and malware removal' }],
    workingDays: [1, 2, 3, 4, 5, 6],
  },
  {
    businessName: 'NetPro Rwanda',
    owner: { firstName: 'Christian', lastName: 'Uwimana' },
    category: 'Networking',
    location: 'gacuriro',
    type: 'BUSINESS',
    years: 7,
    radiusKm: 30,
    bio: 'Structured cabling, office networks, Wi-Fi coverage and server rooms. Certified installers.',
    description: 'Network infrastructure for offices and schools — cabling, racks, Wi-Fi and ongoing support.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 89,
    responseTimeMinutes: 90,
    offerings: [
      { service: 'Office network installation', price: 1200000, priceType: 'CUSTOM_QUOTE', duration: '1–2 weeks', description: 'Cat6 structured cabling, patching, rack build and labelling to an agreed standard.' },
      { service: 'Wi-Fi and router configuration', price: 180000, priceType: 'FIXED', duration: '1 day', description: 'Access points placed and tuned for real coverage, not just installed.' },
    ],
    extraAreas: [{ label: 'Remera', lat: -1.953, lng: 30.118, radiusKm: 18 }],
    portfolio: [{ title: 'School network, 40 points', description: 'Two lab rooms plus staff offices, with a controller and per-room VLANs.', monthsAgo: 6, service: 'Office network installation' }],
    workingDays: [1, 2, 3, 4, 5],
  },
  {
    businessName: 'LensLight Studios',
    owner: { firstName: 'Claudine', lastName: 'Iradukunda' },
    category: 'Photography',
    location: 'nyarutarama',
    type: 'TEAM',
    years: 11,
    radiusKm: 40,
    bio: 'Wedding and event photography team of three. Two cameras, fast turnaround, gallery delivery.',
    description: 'Covering weddings and corporate events across Kigali. Edited gallery delivered in two weeks.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'BUSY',
    responseRate: 95,
    responseTimeMinutes: 40,
    offerings: [
      { service: 'Event and wedding photography', price: 650000, priceType: 'STARTING_FROM', duration: '6 hours', description: 'Two photographers, full day coverage, and an edited gallery delivered online.' },
      { service: 'Product and portrait photography', price: 180000, priceType: 'HOURLY', duration: 'per hour', description: 'Studio or on-location portraits, and product shots for catalogues and menus.' },
    ],
    extraAreas: [
      { label: 'Kigali City Centre', lat: -1.9441, lng: 30.0619, radiusKm: 25 },
      { label: 'Huye (Butare)', lat: -2.51, lng: 29.74, radiusKm: 60 },
    ],
    portfolio: [
      { title: 'Garden wedding, 300 guests', description: 'Full-day coverage, 640 edited images, delivered as a private gallery.', monthsAgo: 1, service: 'Event and wedding photography' },
      { title: 'Hotel portrait series', description: 'Executives and staff photographed on location in a single afternoon.', monthsAgo: 4, service: 'Product and portrait photography' },
    ],
    workingDays: [2, 3, 4, 5, 6, 0],
    attrs: { 'Camera Brand': 'Canon', 'Camera Resolution': '6K', 'Drone Available': true, 'Editing Included': true, 'Photography Types': ['Wedding', 'Corporate', 'Product'] },
  },
  {
    businessName: 'Muhoza Photography',
    owner: { firstName: 'Fabrice', lastName: 'Mukamana' },
    category: 'Photography',
    location: 'musanze',
    type: 'INDIVIDUAL',
    years: 6,
    radiusKm: 80,
    bio: 'Wedding, portrait and events photographer based in Musanze. Travel to Kigali for larger jobs.',
    description: 'Natural-light photographer working mainly in the Northern Province, available for travel.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 92,
    responseTimeMinutes: 75,
    offerings: [
      { service: 'Event and wedding photography', price: 420000, priceType: 'FIXED', duration: '5 hours', description: 'One photographer, outdoor and venue coverage, gallery in ten days.' },
      { service: 'Product and portrait photography', price: 120000, priceType: 'HOURLY', duration: 'per hour', description: 'Portraits and small product sets, studio or on location.' },
    ],
    portfolio: [{ title: 'Intimate civil wedding', description: 'Sixty guests at a home in Musanze, natural light only.', monthsAgo: 3, service: 'Event and wedding photography' }],
    workingDays: [4, 5, 6, 0],
    attrs: { 'Camera Brand': 'Sony', 'Camera Resolution': '4K', 'Drone Available': false, 'Editing Included': true, 'Photography Types': ['Wedding', 'Portrait'] },
  },
  {
    businessName: 'FrameOne Films',
    owner: { firstName: 'Yvan', lastName: 'Nshimiyimana' },
    category: 'Videography',
    location: 'gikondo',
    type: 'TEAM',
    years: 8,
    radiusKm: 35,
    bio: 'Event films and corporate video. Drone operator, colour grading, and a proper edit rather than a montage.',
    description: 'Two-camera event coverage and scripted corporate video, including interviews and drone shots.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 90,
    responseTimeMinutes: 60,
    offerings: [
      { service: 'Event videography', price: 900000, priceType: 'STARTING_FROM', duration: '6 hours', description: 'Two cameras, highlight film plus a full-length edit, graded and delivered in four weeks.' },
      { service: 'Corporate video production', price: 1200000, priceType: 'CUSTOM_QUOTE', duration: '2–3 weeks', description: 'Script, shoot and edit, including interviews, studio inserts and drone establishing shots.' },
    ],
    portfolio: [{ title: 'Conference highlight film', description: 'Two days, three stages, condensed to a four-minute film with speaker interviews.', monthsAgo: 5, service: 'Event videography' }],
    workingDays: [3, 4, 5, 6, 0],
    attrs: { 'Video Resolution': '4K', 'Drone Available': true, 'Editing Included': true, 'Event Types': ['Corporate', 'Wedding'], 'Live Streaming': false },
  },
  {
    businessName: 'Ibwiza Events & Decor',
    owner: { firstName: 'Divine', lastName: 'Umugwaneza' },
    category: 'Decoration',
    location: 'kigali-centre',
    type: 'BUSINESS',
    years: 9,
    radiusKm: 45,
    bio: 'Event decoration and florals. Themed setups for weddings, corporate and church events.',
    description: 'Design, flowers and setup for events from 20 to 800 guests, with our own rental inventory.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'BUSY',
    responseRate: 94,
    responseTimeMinutes: 50,
    offerings: [
      { service: 'Wedding and event decoration', price: 1500000, priceType: 'STARTING_FROM', duration: '1 day setup', description: 'Full venue styling, arch, tables, linens and lighting, installed the day before.' },
      { service: 'Floral arrangements', price: 150000, priceType: 'PER_DAY', duration: 'per arrangement', description: 'Table, entrance and stage arrangements in locally grown and imported stems.' },
    ],
    extraAreas: [{ label: 'Nyarutarama', lat: -1.93, lng: 30.1, radiusKm: 20 }],
    portfolio: [{ title: 'Corporate gala, Kigali Serena', description: 'Stage, eight table arrangements and a photo backdrop for 400 guests.', monthsAgo: 2, service: 'Wedding and event decoration' }],
    workingDays: [1, 2, 3, 4, 5, 6],
    attrs: { 'Services Included': ['Decoration', 'Floral', 'Lighting'], 'Guest Capacity': 400, 'Full Day Service': true, 'Package Type': 'Premium' },
  },
  {
    businessName: 'BassCulture DJ',
    owner: { firstName: 'Danny', lastName: 'Kwizera' },
    category: 'DJ',
    location: 'nyamirambo',
    type: 'INDIVIDUAL',
    years: 10,
    radiusKm: 40,
    bio: 'DJ for weddings, parties and corporate events. Sound and lighting included.',
    description: 'Wedding and party DJ with a full PA, mixing desk and lighting rig.',
    verification: 'EXPIRED',
    subscription: 'PAST_DUE',
    availability: 'UNAVAILABLE',
    responseRate: 78,
    responseTimeMinutes: 120,
    offerings: [
      { service: 'Wedding and event DJ', price: 250000, priceType: 'FIXED', duration: '5 hours', description: 'Five hours of mixing, MCing and ceremony music, with all equipment.' },
      { service: 'PA and sound system rental', price: 150000, priceType: 'PER_DAY', duration: 'per day', description: 'PA, mixer and two speakers for an event you are running yourself.' },
    ],
    portfolio: [{ title: 'Wedding reception, 250 guests', description: 'Rwandan and international sets across a five-hour reception.', monthsAgo: 6, service: 'Wedding and event DJ' }],
    workingDays: [5, 6],
    attrs: { 'Event Types': ['Wedding', 'Birthday', 'Corporate'], 'Live Streaming': false },
  },
  {
    businessName: 'Byose Events',
    owner: { firstName: 'Solange', lastName: 'Nyiraneza' },
    category: 'Wedding Services',
    location: 'nyarutarama',
    type: 'AGENCY',
    years: 13,
    radiusKm: 60,
    bio: 'Full wedding planning and day-of coordination, with vetted suppliers for everything else.',
    description: 'A planning agency handling the whole wedding: timelines, suppliers, and a coordinator on the day.',
    verification: 'VERIFIED',
    subscription: 'ACTIVE',
    availability: 'AVAILABLE',
    responseRate: 97,
    responseTimeMinutes: 30,
    offerings: [
      { service: 'Full wedding planning', price: 3200000, priceType: 'CUSTOM_QUOTE', duration: '6 months', description: 'From concept and supplier booking through to the day itself, with a written plan.' },
      { service: 'Wedding day-of coordination', price: 800000, priceType: 'FIXED', duration: '1 day', description: 'On-the-day coordination so your family and your suppliers are not left managing each other.' },
    ],
    extraAreas: [{ label: 'Huye (Butare)', lat: -2.51, lng: 29.74, radiusKm: 90 }],
    portfolio: [{ title: '450-guest wedding, full service', description: 'Twelve-month planning, five supplier contracts, and a day-of team of six.', monthsAgo: 7, service: 'Full wedding planning' }],
    workingDays: [1, 2, 3, 4, 5],
    attrs: { 'Services Included': ['Photography', 'Decoration', 'Catering', 'Lighting'], 'Guest Capacity': 450, 'Full Day Service': true, 'Package Type': 'Custom' },
  },
];

// ---------------------------------------------------------------------------
// Clients — used for the transactional layer (requests → quotes → bookings →
// reviews), so the marketplace has real history rather than empty states.
// ---------------------------------------------------------------------------
const CLIENTS = [
  { firstName: 'Aline', lastName: 'Mukamana', location: 'kigali-centre' as LocationKey },
  { firstName: 'Bruno', lastName: 'Ndayisime', location: 'nyamirambo' as LocationKey },
  { firstName: 'Chantal', lastName: 'Umutoni', location: 'kicukiro' as LocationKey },
  { firstName: 'Didas', lastName: 'Hakizimana', location: 'remera' as LocationKey },
  { firstName: 'Eliane', lastName: 'Ingabire', location: 'gacuriro' as LocationKey },
  { firstName: 'Francois', lastName: 'Nshimiyimana', location: 'kigali-centre' as LocationKey },
];

// Extra area label used by the client spec above (kept out of LOCATIONS so it
// only exists as a request location).
const kicukiro = { label: 'Kicukiro', addressLine: 'KG 5 Ave', city: 'Kigali', lat: -1.9555, lng: 30.0899 };

// ---------------------------------------------------------------------------
// Transactional scenario definitions. `kind` drives the status cascade so the
// data exercises every state a real platform accumulates.
// ---------------------------------------------------------------------------
type ScenarioKind = 'OPEN' | 'QUOTED' | 'BOOKED' | 'COMPLETED' | 'CANCELLED';

interface Scenario {
  kind: ScenarioKind;
  provider: string; // businessName
  service: string;
  client: number; // index into CLIENTS
  title: string;
  description: string;
  daysAgo: number;
  budget?: [number, number];
  /** For QUOTED: a second competing provider, so /compare has two quotes. */
  rivalProvider?: string;
  quote?: { price: number; duration: string; materials: string; included: string[]; excluded: string[]; description: string };
  /** For COMPLETED: the review left behind. */
  review?: { rating: number; comment: string; quality: number; communication: number; professionalism: number; value: number };
}

const SCENARIOS: Scenario[] = [
  // --- OPEN: new, unanswered requests (the provider inbox) ---
  { kind: 'OPEN', provider: 'Impera Plumbing & Drainage', service: 'Leak detection and pipe repair', client: 0, title: 'Kitchen tap leaking for a week', description: 'The mixer tap drips constantly and the cabinet underneath is damp. Need someone to find the leak and fix it properly.', daysAgo: 1, budget: [40000, 90000] },
  { kind: 'OPEN', provider: 'Volt Rwanda Electricals', service: 'Wiring and socket installation', client: 3, title: 'Rewire a two-bedroom flat', description: 'The wiring in this flat is original and I would like it replaced before renting it out. Two bedrooms, kitchen and living room.', daysAgo: 2, budget: [800000, 1500000] },
  { kind: 'OPEN', provider: 'LensLight Studios', service: 'Event and wedding photography', client: 4, title: '50th birthday party, 120 guests', description: 'Afternoon function at a hotel in Kicukiro. Want photos of the family and the speeches, roughly four hours.', daysAgo: 2, budget: [400000, 800000] },
  { kind: 'OPEN', provider: 'CodeKigali Labs', service: 'Custom web application development', client: 5, title: 'Booking system for a small clinic', description: 'We need patients to book appointments and staff to see the day at a glance. Currently on paper in the front desk.', daysAgo: 3, budget: [3000000, 6000000] },
  { kind: 'OPEN', provider: 'Girimpamo Cleaning Co.', service: 'Deep cleaning for homes and offices', client: 2, title: 'Fortnightly office clean', description: 'Small office, about eight desks, two meeting rooms. Twice a week would suit us.', daysAgo: 4, budget: [150000, 350000] },
  { kind: 'OPEN', provider: 'Umwenge Woodworks', service: 'Custom furniture and cabinets', client: 1, title: 'Built-in wardrobe, 3m wide', description: 'Master bedroom, floor to ceiling, with hanging space and drawers below. I have measurements.', daysAgo: 5, budget: [500000, 1200000] },
  { kind: 'OPEN', provider: 'TechFix Kigali', service: 'Laptop and desktop repair', client: 0, title: 'Laptop will not charge', description: 'My work laptop stopped charging and I need it for work tomorrow. USB-C port may be loose.', daysAgo: 1, budget: [40000, 120000] },
  { kind: 'OPEN', provider: 'NetPro Rwanda', service: 'Office network installation', client: 5, title: 'Cabling for a 20-desk office', description: 'Second floor needs network points in every desk position plus Wi-Fi. Building owner is paying.', daysAgo: 6, budget: [900000, 2000000] },
  { kind: 'OPEN', provider: 'FrameOne Films', service: 'Corporate video production', client: 3, title: 'Company profile video', description: 'Three minutes for our website and social. We have a warehouse site and two staff who can be filmed.', daysAgo: 7, budget: [1000000, 2500000] },
  { kind: 'OPEN', provider: 'UWASE Water Systems', service: 'Water tank and pump installation', client: 2, title: 'Solar pump for a rural home', description: 'Borehole already drilled in Musanze. Need a pump and storage so we stop depending on the generator.', daysAgo: 8, budget: [250000, 600000] },

  // --- QUOTED: quotes sent, some with a competing quote to compare ---
  { kind: 'QUOTED', provider: 'Kigali AutoCare Centre', service: 'Full vehicle servicing', client: 1, title: 'Full service for two vehicles', description: 'Toyota Hilux and a Nissan Note, both due. Would like both done together if possible.', daysAgo: 4, budget: [200000, 350000], rivalProvider: 'Munyaneza Auto Electrics', quote: { price: 240000, duration: '1 day', materials: 'Oil, oil filter, air filter and a new air filter', included: ['Oil and filters', 'Fluid top-up', '30-point inspection', 'Brake check'], excluded: ['Replacement parts beyond filters', 'Tyres'], description: 'Both vehicles in and out the same day. I will show you the old parts before they go in the bin.' } },
  { kind: 'QUOTED', provider: 'SafeBrake Kigali', service: 'Brake pad and disc replacement', client: 0, title: 'Rear brakes squeaking', description: 'Squeak when braking gently, worse on hills. Would like discs checked at the same time.', daysAgo: 6, budget: [80000, 180000], quote: { price: 135000, duration: '3 hours', materials: 'Rear pads and discs supplied', included: ['Rear pads and discs', 'Bed-in procedure', 'Road test'], excluded: ['Front brake work', 'Handbrake cable'], description: 'Discs are within spec but the pads are worn unevenly, which points at a sticking caliper — I will inspect it while the wheel is off.' } },
  { kind: 'QUOTED', provider: 'Ibyara Paint & Decor', service: 'Interior and exterior painting', client: 2, title: 'Repaint two rooms and a corridor', description: 'Two bedrooms and a corridor. Walls need skimming in places, then two coats.', daysAgo: 9, budget: [300000, 700000], quote: { price: 520000, duration: '4 days', materials: 'Two coats of emulsion, primer on bare patches', included: ['Surface preparation', 'Two coats', 'Floor and furniture protection'], excluded: ['Ceiling painting', 'Wallpapering'], description: 'Skimming in two places is extra if the plaster is worse than it looks — I have allowed for a small amount here and will tell you before going further.' } },
  { kind: 'QUOTED', provider: 'Website Rwanda Studio', service: 'Business website design and build', client: 3, title: 'Website for a hardware shop', description: 'Product categories, opening hours, map and a WhatsApp button. English and Kinyarwanda.', daysAgo: 10, budget: [500000, 1500000], quote: { price: 780000, duration: '12 days', materials: 'Hosting for the first year included', included: ['Up to 8 pages', 'Mobile-first build', 'WhatsApp button', 'Google Maps'], excluded: ['Online payments', 'Product database'], description: 'I would build this with a simple page set you can edit yourself. If you later want a real product catalogue with stock, that is a different build.' } },
  { kind: 'QUOTED', provider: 'Girimpamo Cleaning Co.', service: 'Post-construction cleaning', client: 5, title: 'Post-renovation clean, 2-bed apartment', description: 'Painting and tiling just finished. Walls, floors, windows and the glass need doing properly.', daysAgo: 5, budget: [200000, 500000], quote: { price: 260000, duration: '2 days', materials: 'All cleaning materials and equipment supplied', included: ['Dust removal', 'Window and glass cleaning', 'Floor cleaning', 'Skirting and edges'], excluded: ['Waste removal', 'Post-construction snag repairs'], description: 'Two people for two days. The windows and glass are most of the time — the floors are quick once the dust is gone.' } },
  { kind: 'QUOTED', provider: 'LensLight Studios', service: 'Event and wedding photography', client: 0, title: 'Wedding in Kicukiro, 200 guests', description: 'Church ceremony around 2pm, reception until late. Want the day covered properly.', daysAgo: 12, budget: [800000, 1500000], rivalProvider: 'Muhoza Photography', quote: { price: 1100000, duration: '8 hours', materials: 'Two photographers, all equipment', included: ['Ceremony coverage', 'Reception coverage', 'Family group photos', 'Edited gallery'], excluded: ['Drone footage', 'Same-day edit', 'Printed albums'], description: 'Two of us from preparation through to the end of the reception, so the getting-ready shots and the speeches are both covered.' } },

  // --- BOOKED: quote accepted, work scheduled ---
  { kind: 'BOOKED', provider: 'Impera Plumbing & Drainage', service: 'Water tank and pump installation', client: 3, title: 'Tank and pump for a two-storey house', description: 'Burst a pipe and lost pressure. Need a 5,000 litre tank with a pressure pump installed in the yard.', daysAgo: 15, budget: [200000, 400000], quote: { price: 325000, duration: '1 day', materials: '5,000L tank, pressure pump and 20m of pipework', included: ['Tank and pump supplied', 'Pipework to the house', 'Pressure testing'], excluded: ['Wiring for the pump', 'Civil work for the plinth'], description: 'I would put the plinth myself — you will need a mason for that. Everything else is included and tested before I leave.' } },
  { kind: 'BOOKED', provider: 'Ibwiza Events & Decor', service: 'Wedding and event decoration', client: 1, title: 'Corporate end-of-year function, 180 guests', description: 'Hotel function room. Stage, tables, lighting and a photo backdrop.', daysAgo: 18, budget: [1000000, 2500000], quote: { price: 1650000, duration: '1 day setup', materials: 'Linens, arch, stage dressing and floral arrangements', included: ['Stage styling', '8 table arrangements', 'Uplighting', 'Photo backdrop'], excluded: ['Catering', 'Photography', 'Furniture hire beyond our inventory'], description: 'Setup the afternoon before so the room is ready before guests arrive. Florals are seasonal, so the colour palette can shift slightly.' } },
  { kind: 'BOOKED', provider: 'TechFix Kigali', service: 'Laptop and desktop repair', client: 2, title: 'Slow laptop, possible SSD failure', description: 'Freezes for a minute at a time and takes forever to start. Worried the drive is going.', daysAgo: 20, budget: [60000, 200000], quote: { price: 95000, duration: '2 days', materials: 'Diagnostic only unless you approve the drive', included: ['Full health check', 'Data backup to external drive', 'Operating system repair'], excluded: ['Replacement SSD', 'Data recovery if the drive is unreadable'], description: 'The SMART data will tell us within an hour whether the SSD is failing. I will back your data up before anything else touches the drive.' } },

  // --- COMPLETED: finished work with a review attached ---
  { kind: 'COMPLETED', provider: 'Kigali AutoCare Centre', service: 'Full vehicle servicing', client: 1, title: 'Full service, Toyota RAV4', description: '60,000km service. Also mentioned a noise from the front left.', daysAgo: 45, budget: [100000, 250000], quote: { price: 165000, duration: 'half day', materials: 'Oil, filters, brake fluid', included: ['Oil and filters', 'Brake fluid', 'Full inspection report'], excluded: ['Timing belt', 'Tyres'], description: 'Service as booked. The noise turned out to be a worn CV boot — I have priced that separately and not done it.' }, review: { rating: 5, comment: 'Worked on my car exactly as quoted and called me to explain the CV boot before doing anything extra. Clear, honest, and the car came back spotless.', quality: 5, communication: 5, professionalism: 5, value: 4 } },
  { kind: 'COMPLETED', provider: 'Girimpamo Cleaning Co.', service: 'Deep cleaning for homes and offices', client: 0, title: 'Deep clean before hosting family', description: 'Whole house after a long absence. Needed it in one day.', daysAgo: 52, budget: [80000, 200000], quote: { price: 110000, duration: '1 day', materials: 'All materials supplied', included: ['Full deep clean', 'Windows inside', 'Kitchen degreasing'], excluded: ['Carpet shampooing', 'Outside areas'], description: 'Four people for one day, which is what a whole house needs if you have not been living in it.' }, review: { rating: 4, comment: 'Arrived on time and did a genuinely thorough job, especially the kitchen. Only reason it is not five stars is that they did not get to the second bathroom in the time.', quality: 5, communication: 4, professionalism: 5, value: 4 } },
  { kind: 'COMPLETED', provider: 'Umwenge Woodworks', service: 'Custom furniture and cabinets', client: 2, title: 'Fitted kitchen units', description: 'Four base units and a tall pantry to replace the old ones.', daysAgo: 60, budget: [600000, 1500000], quote: { price: 980000, duration: '2 weeks', materials: 'Solid mahogany, hinges and runners supplied', included: ['Measure and template', 'Four base units and pantry', 'Installation and alignment'], excluded: ['Worktop', 'Sink and tap fitting', 'Appliances'], description: 'Built after templating your wall, so the units are cut to the actual uneven wall. Worktop is yours to arrange separately.' }, review: { rating: 5, comment: 'The units fit an old crooked wall better than anything from a shop. Two weeks exactly as quoted, and they cleaned up every evening.', quality: 5, communication: 5, professionalism: 5, value: 4 } },
  { kind: 'COMPLETED', provider: 'Impera Plumbing & Drainage', service: 'Leak detection and pipe repair', client: 4, title: 'Water leaking inside a wall', description: 'Water marks on a bedroom wall but no visible leak. Two other people could not find it.', daysAgo: 70, budget: [50000, 150000], quote: { price: 95000, duration: '1 day', materials: 'Copper pipe and fittings', included: ['Acoustic and pressure leak detection', 'Permanent repair', 'Wall access and making good'], excluded: ['Painting and decoration', 'Ceiling repair'], description: 'Found it in a joint behind the skirting, not where the marks were. Access and making good included.' }, review: { rating: 5, comment: 'Located a leak three other people had missed and explained why it was there. Fixed it the same day. Worth every franc.', quality: 5, communication: 5, professionalism: 5, value: 5 } },
  { kind: 'COMPLETED', provider: 'LensLight Studios', service: 'Event and wedding photography', client: 1, title: 'Wedding at a Kigali venue', description: '250 guests, full day. Needed both the ceremony and the reception.', daysAgo: 85, budget: [700000, 1400000], quote: { price: 950000, duration: '7 hours', materials: 'Two photographers', included: ['Full day coverage', 'Family group photos', 'Edited online gallery'], excluded: ['Album printing', 'Same-day edit'], description: 'Two photographers means one is never behind the group photo while something else is happening.' }, review: { rating: 5, comment: 'They were there before we were and stayed until the last song. The gallery arrived in ten days and the family photos are beautiful.', quality: 5, communication: 5, professionalism: 5, value: 4 } },
  { kind: 'COMPLETED', provider: 'Volt Rwanda Electricals', service: 'Solar back-up installation', client: 5, title: 'Solar back-up for a small office', description: 'Outages were costing us more than the power bill. Wanted to keep computers and router running.', daysAgo: 95, budget: [1500000, 3000000], quote: { price: 2350000, duration: '3 days', materials: '2kW array, inverter and battery bank', included: ['Survey and load calculation', 'Panels, inverter and batteries', 'Installation and commissioning'], excluded: ['Generator changeover upgrade', 'Annual maintenance contract'], description: 'I sized this on your actual measured load during the survey, not on a rule of thumb.' }, review: { rating: 4, comment: 'Good installation and they clearly explained what the system can and cannot run. Took a day longer than planned because of a missing part, but they told me the same morning.', quality: 4, communication: 5, professionalism: 4, value: 4 } },
  { kind: 'COMPLETED', provider: 'TechFix Kigali', service: 'Data recovery and malware removal', client: 0, title: 'Laptop full of pop-ups', description: 'A site I visited installed something and now my laptop is unusable.', daysAgo: 110, budget: [50000, 150000], quote: { price: 70000, duration: '1 day', materials: 'Clean OS reinstall with data preserved', included: ['Malware removal', 'Data backup and restore', 'Browser hardening'], excluded: ['Replacement of a failed drive', 'Licence recovery'], description: 'Everything is cleaned, but if the drive is failing it is worth replacing at the same time.' }, review: { rating: 5, comment: 'Removed everything and kept all my files, which I did not expect. Explained what happened so I could avoid it again.', quality: 5, communication: 5, professionalism: 5, value: 5 } },
  { kind: 'COMPLETED', provider: 'Kigali AutoCare Centre', service: 'Engine diagnostics and repair', client: 4, title: 'Check engine light, rough idle', description: 'Light came on and the engine idles roughly. Was hoping it was nothing serious.', daysAgo: 130, budget: [80000, 200000], quote: { price: 120000, duration: '1 day', materials: 'Ignition coils and plugs', included: ['Full diagnostics', 'Coil and plug replacement', 'Road test'], excluded: ['Injector cleaning', 'Turbo work'], description: 'Diagnostics showed three failing coils. Plugs done at the same time since they were due anyway.' }, review: { rating: 4, comment: 'Found the problem quickly and did not try to sell me extra work I did not need. Price matched the quote.', quality: 4, communication: 5, professionalism: 5, value: 5 } },
  { kind: 'COMPLETED', provider: 'Byose Events', service: 'Wedding day-of coordination', client: 2, title: 'Day-of coordination for a family wedding', description: 'We had the venue and suppliers sorted but needed someone to run the day.', daysAgo: 150, budget: [500000, 1200000], quote: { price: 750000, duration: '1 day', materials: 'Coordinator and two assistants from 5am', included: ['Timeline and supplier coordination', 'On-the-day team of three', 'Setup supervision'], excluded: ['Planning from scratch', 'Catering', 'Florals'], description: 'You keep your own suppliers; I make sure they arrive in the right order and the day runs to time.' }, review: { rating: 5, comment: 'The whole day ran to schedule and my parents were not asked to manage anything. I could actually enjoy it.', quality: 5, communication: 5, professionalism: 5, value: 4 } },
  { kind: 'COMPLETED', provider: 'Website Rwanda Studio', service: 'Website maintenance and SEO', client: 1, title: 'Ongoing site updates', description: 'Monthly updates to prices and photos, plus keeping it online.', daysAgo: 40, budget: [80000, 200000], quote: { price: 90000, duration: 'per month', materials: 'Hosting, backups and uptime monitoring', included: ['Hosting', 'Monthly content updates', 'Local SEO work'], excluded: ['Paid advertising', 'New pages beyond the agreed set'], description: 'A fixed monthly amount covering hosting and small content changes. Anything structural is quoted separately.' }, review: { rating: 4, comment: 'Reliable and quick to respond when the site needs something. It is exactly the maintenance arrangement I wanted.', quality: 4, communication: 5, professionalism: 4, value: 5 } },
  { kind: 'COMPLETED', provider: 'Muhoza Photography', service: 'Event and wedding photography', client: 4, title: 'Wedding in Musanze', description: 'Small wedding at my parents’ home. Travel was part of the quote.', daysAgo: 75, budget: [350000, 700000], quote: { price: 480000, duration: '6 hours', materials: 'One photographer, all equipment', included: ['Ceremony and reception', 'Family photos', 'Gallery in 10 days'], excluded: ['Second photographer', 'Drone footage'], description: 'Natural-light coverage at an outdoor venue, which suits this style of photography.' }, review: { rating: 5, comment: 'Beautiful, relaxed photos and nothing forced. Arrived early and stayed late without being asked.', quality: 5, communication: 4, professionalism: 5, value: 5 } },

  // --- CANCELLED: realistic dead weight in the marketplace ---
  { kind: 'CANCELLED', provider: 'BassCulture DJ', service: 'PA and sound system rental', client: 5, title: 'PA for a community event', description: 'Outdoor gathering of about 300 people in a school field.', daysAgo: 25, budget: [100000, 250000], quote: { price: 180000, duration: '1 day', materials: 'PA, mixer and speakers', included: ['Two speakers', 'Mixer', 'Delivery and collection'], excluded: ['Operator', 'Generator'], description: 'Equipment delivered the morning of and collected the same evening.' } },
  { kind: 'CANCELLED', provider: 'RubberTech Tyres', service: 'Tire fitting and balancing', client: 0, title: 'Four tires for a truck', description: 'Commercial truck tyres, but I no longer have the vehicle.', daysAgo: 35, budget: [60000, 150000] },
  { kind: 'CANCELLED', provider: 'CodeKigali Labs', service: 'Mobile app development', client: 3, title: 'Consumer app idea', description: 'Explored an app but decided the budget was better spent elsewhere this year.', daysAgo: 28, budget: [2000000, 5000000] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function defaultAttributeValue(type: AttributeType, options: string[] | null | undefined) {
  switch (type) {
    case 'BOOLEAN':
      return true;
    case 'NUMBER':
      return 8;
    case 'TEXT':
      return '';
    case 'SELECT':
      return options?.[0] ?? '';
    case 'MULTI_SELECT':
      return (options ?? []).slice(0, 2);
    default:
      return null;
  }
}

// Just the value columns of a ServiceOfferingAttributeValue. The relation keys
// are supplied by the caller, so this deliberately doesn't use Prisma's
// generated create-input type (which would require them).
interface AttributeValueFields {
  textValue?: string | null;
  numberValue?: number | null;
  booleanValue?: boolean | null;
  // Not nullable: Prisma's Json input type uses a sentinel for JSON null, and
  // these attributes are never genuinely null.
  jsonValue?: Prisma.InputJsonValue;
}

function attributeValueInput(
  value: string | number | boolean | string[] | null,
  type: AttributeType,
): AttributeValueFields {
  if (value === null) return {};
  if (type === 'BOOLEAN') return { booleanValue: Boolean(value) };
  if (type === 'NUMBER') return { numberValue: Number(value) };
  if (type === 'TEXT' || type === 'SELECT') return { textValue: String(value) };
  if (type === 'MULTI_SELECT') return { jsonValue: (Array.isArray(value) ? value : [value]) as Prisma.InputJsonValue };
  return { textValue: String(value) };
}

// CategoryAttribute.options is a Json column holding a string[] for
// SELECT/MULTI_SELECT, so it has to be narrowed before use.
function attributeOptions(options: Prisma.JsonValue | null): string[] | null {
  return Array.isArray(options) ? options.map((o) => String(o)) : null;
}

function attributeInputFor(
  attribute: { name: string; type: AttributeType; options: Prisma.JsonValue | null },
  override: Record<string, string | number | boolean | string[]> | undefined,
): AttributeValueFields {
  const raw = override?.[attribute.name];
  const value = raw === undefined ? defaultAttributeValue(attribute.type, attributeOptions(attribute.options)) : raw;
  return attributeValueInput(value, attribute.type);
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Seeding Bii Localfinder demo data…');

  const providerPasswordHash = await bcrypt.hash(PROVIDER_PASSWORD, 12);
  const clientPasswordHash = await bcrypt.hash(CLIENT_PASSWORD, 12);

  // --- Locations (reused across providers) --------------------------------
  const locationIdByKey = new Map<string, string>();
  for (const [key, loc] of Object.entries(LOCATIONS)) {
    const row = await prisma.location.upsert({
      where: { id: demoId(`location:${key}`) },
      update: { label: loc.label, addressLine: loc.addressLine, city: loc.city, latitude: loc.lat, longitude: loc.lng },
      create: { id: demoId(`location:${key}`), label: loc.label, addressLine: loc.addressLine, city: loc.city, country: 'Rwanda', latitude: loc.lat, longitude: loc.lng },
    });
    locationIdByKey.set(key, row.id);
  }
  const kicukiroLocation = await prisma.location.upsert({
    where: { id: demoId('location:kicukiro') },
    update: { label: kicukiro.label, addressLine: kicukiro.addressLine, city: kicukiro.city, latitude: kicukiro.lat, longitude: kicukiro.lng },
    create: { id: demoId('location:kicukiro'), label: kicukiro.label, addressLine: kicukiro.addressLine, city: kicukiro.city, country: 'Rwanda', latitude: kicukiro.lat, longitude: kicukiro.lng },
  });

  // --- Service catalogue --------------------------------------------------
  const categoryByChildName = new Map<string, string>();
  for (const cat of await prisma.serviceCategory.findMany({ where: { parentId: { not: null } } })) {
    categoryByChildName.set(cat.name, cat.id);
  }
  const missingCategories = Object.keys(SERVICES).filter((c) => !categoryByChildName.has(c));
  if (missingCategories.length) {
    throw new Error(
      `Seed data references categories that prisma/seed.ts does not create: ${missingCategories.join(', ')}. ` +
        'Run `npm run prisma:seed` first.',
    );
  }

  const serviceIdByName = new Map<string, string>();
  for (const [categoryName, serviceNames] of Object.entries(SERVICES)) {
    const categoryId = categoryByChildName.get(categoryName)!;
    for (const serviceName of serviceNames) {
      const row = await prisma.service.upsert({
        where: { categoryId_slug: { categoryId, slug: slugify(serviceName) } },
        update: { name: serviceName, isActive: true },
        create: { categoryId, name: serviceName, slug: slugify(serviceName), description: `${serviceName} in the ${categoryName} category.` },
      });
      serviceIdByName.set(serviceName, row.id);
    }
  }

  // --- Providers ----------------------------------------------------------
  const providerIdByName = new Map<string, string>();
  const offeringIdsByProvider = new Map<string, Array<{ id: string; serviceId: string; serviceName: string; basePrice: number | null }>>();

  for (const [index, spec] of PROVIDERS.entries()) {
    const email = `${slugify(spec.businessName).slice(0, 28)}@demo.biilocalfinder.dev`;
    const phone = `+250788${String(100000 + index * 1111).slice(0, 6)}`;
    // VERIFIED is derived from a live IDENTITY record + a verified phone, so
    // verified providers must also have phoneVerified set. A SUSPENDED provider
    // was verified before being suspended, so the phone is verified there too.
    const phoneVerified = spec.verification === 'VERIFIED' || spec.verification === 'SUSPENDED';
    const businessVerified = spec.verification === 'VERIFIED' && (spec.type === 'BUSINESS' || spec.type === 'AGENCY');

    const user = await prisma.user.upsert({
      where: { email },
      update: { firstName: spec.owner.firstName, lastName: spec.owner.lastName, phone, phoneVerified },
      create: {
        email,
        passwordHash: providerPasswordHash,
        firstName: spec.owner.firstName,
        lastName: spec.owner.lastName,
        phone,
        role: 'PROVIDER',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified,
      },
    });

    const workspaceSlug = slugify(spec.businessName);
    const workspace = await prisma.workspace.upsert({
      where: { slug: workspaceSlug },
      update: { name: spec.businessName, type: spec.type, status: 'ACTIVE' },
      create: {
        name: spec.businessName,
        slug: workspaceSlug,
        type: spec.type,
        ownerId: user.id,
        status: 'ACTIVE',
        onboardingStep: 'COMPLETED',
        onboardingCompletedAt: daysFromNow(-400),
      },
    });
    await prisma.workspaceMembership.upsert({
      where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER', status: 'ACTIVE', joinedAt: daysFromNow(-400) },
    });

    const provider = await prisma.provider.upsert({
      where: { workspaceId: workspace.id },
      update: {
        userId: user.id,
        businessName: spec.businessName,
        bio: spec.bio,
        description: spec.description,
        phone,
        locationId: locationIdByKey.get(spec.location)!,
        serviceRadiusKm: spec.radiusKm,
        yearsOfExperience: spec.years,
        providerType: spec.type,
        onboardingStep: 'COMPLETED',
        verificationStatus: spec.verification,
        identityVerified: spec.verification === 'VERIFIED',
        businessVerified,
        responseRate: spec.responseRate,
        responseTimeMinutes: spec.responseTimeMinutes,
        availabilityStatus: spec.availability,
        subscriptionStatus: spec.subscription,
      },
      create: {
        userId: user.id,
        workspaceId: workspace.id,
        businessName: spec.businessName,
        bio: spec.bio,
        description: spec.description,
        phone,
        locationId: locationIdByKey.get(spec.location)!,
        serviceRadiusKm: spec.radiusKm,
        yearsOfExperience: spec.years,
        providerType: spec.type,
        onboardingStep: 'COMPLETED',
        onboardingCompletedAt: daysFromNow(-400),
        registrationNumber: spec.type === 'BUSINESS' || spec.type === 'AGENCY' ? `RW-${10000 + index * 37}` : null,
        representativeName: spec.type === 'INDIVIDUAL' ? null : `${spec.owner.firstName} ${spec.owner.lastName}`,
        teamSize: spec.type === 'TEAM' || spec.type === 'BUSINESS' ? 3 + (index % 6) : null,
        verificationStatus: spec.verification,
        identityVerified: spec.verification === 'VERIFIED',
        businessVerified,
        rating: 0,
        reviewCount: 0,
        verifiedReviewCount: 0,
        responseRate: spec.responseRate,
        responseTimeMinutes: spec.responseTimeMinutes,
        availabilityStatus: spec.availability,
        subscriptionStatus: spec.subscription,
      },
    });
    providerIdByName.set(spec.businessName, provider.id);

    // Verification records — the source of truth the badge is derived from.
    const recordStatus = spec.verification;
    if (recordStatus !== 'UNVERIFIED') {
      // A SUSPENDED provider was verified first and was later suspended, so it
      // keeps its verifiedAt and its decision note.
      const everVerified = recordStatus === 'VERIFIED' || recordStatus === 'SUSPENDED';
      const identity = await prisma.verificationRecord.upsert({
        where: { id: demoId(`verification:${workspaceSlug}:IDENTITY`) },
        update: { status: recordStatus, legalName: `${spec.owner.firstName} ${spec.owner.lastName}`, referenceNumber: `ID-${20000 + index * 13}`, expiresAt: recordStatus === 'EXPIRED' ? daysFromNow(-12) : daysFromNow(365) },
        create: {
          id: demoId(`verification:${workspaceSlug}:IDENTITY`),
          providerId: provider.id,
          type: 'IDENTITY',
          status: recordStatus,
          legalName: `${spec.owner.firstName} ${spec.owner.lastName}`,
          referenceNumber: `ID-${20000 + index * 13}`,
          submitterNote: 'National ID and a utility bill, submitted at onboarding.',
          decisionNote:
            recordStatus === 'VERIFIED'
              ? 'Documents checked against the national register.'
              : recordStatus === 'SUSPENDED'
                ? 'Suspended by an administrator pending review of repeated no-show reports.'
                : recordStatus === 'EXPIRED'
                  ? 'The identity document expired before the renewal deadline.'
                  : null,
          submittedAt: daysFromNow(-380),
          reviewedAt: everVerified ? daysFromNow(-375) : null,
          verifiedAt: everVerified ? daysFromNow(-375) : null,
          expiresAt: recordStatus === 'EXPIRED' ? daysFromNow(-12) : daysFromNow(365),
          updatedAt: daysFromNow(-375),
        },
      });
      await prisma.verificationDocument.upsert({
        where: { id: demoId(`verification-doc:${workspaceSlug}:id`) },
        update: {},
        create: {
          id: demoId(`verification-doc:${workspaceSlug}:id`),
          verification: { connect: { id: identity.id } },
          documentType: 'NATIONAL_ID',
          storageKey: `demo/verification/${workspaceSlug}/national-id.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 184_320,
          originalName: 'national-id.pdf',
        },
      });
      await prisma.verificationDocument.upsert({
        where: { id: demoId(`verification-doc:${workspaceSlug}:proof`) },
        update: {},
        create: {
          id: demoId(`verification-doc:${workspaceSlug}:proof`),
          verification: { connect: { id: identity.id } },
          documentType: 'OTHER',
          storageKey: `demo/verification/${workspaceSlug}/proof-of-address.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: 92_160,
          originalName: 'proof-of-address.pdf',
        },
      });
      if (businessVerified || spec.type === 'BUSINESS' || spec.type === 'AGENCY') {
        await prisma.verificationRecord.upsert({
          where: { id: demoId(`verification:${workspaceSlug}:BUSINESS`) },
          update: { status: recordStatus === 'VERIFIED' ? 'VERIFIED' : recordStatus, legalName: spec.businessName, expiresAt: daysFromNow(365) },
          create: {
            id: demoId(`verification:${workspaceSlug}:BUSINESS`),
            providerId: provider.id,
            type: 'BUSINESS',
            status: recordStatus === 'VERIFIED' ? 'VERIFIED' : recordStatus,
            legalName: spec.businessName,
            referenceNumber: `RW-${10000 + index * 37}`,
            submitterNote: 'Business registration certificate.',
            decisionNote: recordStatus === 'VERIFIED' ? 'Registration confirmed with the Rwanda Business Registry.' : null,
            submittedAt: daysFromNow(-380),
            reviewedAt: recordStatus === 'VERIFIED' ? daysFromNow(-374) : null,
            verifiedAt: recordStatus === 'VERIFIED' ? daysFromNow(-374) : null,
            expiresAt: daysFromNow(365),
            updatedAt: daysFromNow(-374),
          },
        });
      }
    }

    // Primary service area at the business location, plus any extras.
    const primary = LOCATIONS[spec.location];
    await prisma.serviceArea.upsert({
      where: { id: demoId(`area:${workspaceSlug}:primary`) },
      update: { label: primary.label, latitude: primary.lat, longitude: primary.lng, radiusKm: spec.radiusKm },
      create: { id: demoId(`area:${workspaceSlug}:primary`), provider: { connect: { id: provider.id } }, label: primary.label, latitude: primary.lat, longitude: primary.lng, radiusKm: spec.radiusKm },
    });
    for (const [aIndex, area] of (spec.extraAreas ?? []).entries()) {
      await prisma.serviceArea.upsert({
        where: { id: demoId(`area:${workspaceSlug}:extra:${aIndex}`) },
        update: { label: area.label, latitude: area.lat, longitude: area.lng, radiusKm: area.radiusKm },
        create: { id: demoId(`area:${workspaceSlug}:extra:${aIndex}`), provider: { connect: { id: provider.id } }, label: area.label, latitude: area.lat, longitude: area.lng, radiusKm: area.radiusKm },
      });
    }

    // Weekly availability.
    const workingDays = spec.workingDays ?? [1, 2, 3, 4, 5];
    for (let day = 0; day <= 6; day++) {
      const isWorking = workingDays.includes(day);
      await prisma.availability.upsert({
        where: { providerId_dayOfWeek: { providerId: provider.id, dayOfWeek: day } },
        update: { isActive: isWorking },
        create: { providerId: provider.id, dayOfWeek: day, startTime: day === 0 ? '09:00' : '08:00', endTime: day === 0 ? '16:00' : '18:00', isActive: isWorking },
      });
    }

    // Service offerings + their category attribute values.
    const categoryId = categoryByChildName.get(spec.category)!;
    const attributes = await prisma.categoryAttribute.findMany({ where: { categoryId } });
    const offerings: Array<{ id: string; serviceId: string; serviceName: string; basePrice: number | null }> = [];

    for (const offering of spec.offerings) {
      const serviceId = serviceIdByName.get(offering.service);
      if (!serviceId) throw new Error(`Unknown service "${offering.service}" for ${spec.businessName}`);

      const row = await prisma.serviceOffering.upsert({
        where: { providerId_serviceId: { providerId: provider.id, serviceId } },
        update: {
          title: offering.service,
          description: offering.description,
          basePrice: offering.price,
          priceType: offering.priceType ?? 'FIXED',
          duration: offering.duration,
          isActive: true,
        },
        create: {
          providerId: provider.id,
          serviceId,
          title: offering.service,
          description: offering.description,
          basePrice: offering.price,
          priceType: offering.priceType ?? 'FIXED',
          duration: offering.duration,
          currency: 'RWF',
        },
      });
      offerings.push({ id: row.id, serviceId, serviceName: offering.service, basePrice: offering.price });

      for (const attribute of attributes) {
        await prisma.serviceOfferingAttributeValue.upsert({
          where: { serviceOfferingId_categoryAttributeId: { serviceOfferingId: row.id, categoryAttributeId: attribute.id } },
          update: attributeInputFor(attribute, spec.attrs),
          create: { serviceOfferingId: row.id, categoryAttributeId: attribute.id, ...attributeInputFor(attribute, spec.attrs) },
        });
      }
    }
    offeringIdsByProvider.set(spec.businessName, offerings);

    // Portfolio (no images — there is no S3-compatible storage in dev).
    for (const [pIndex, item] of spec.portfolio.entries()) {
      const serviceId = item.service ? serviceIdByName.get(item.service) : null;
      await prisma.portfolio.upsert({
        where: { id: demoId(`portfolio:${workspaceSlug}:${pIndex}`) },
        update: { title: item.title, description: item.description, projectDate: daysFromNow(-item.monthsAgo * 30), serviceId },
        create: {
          id: demoId(`portfolio:${workspaceSlug}:${pIndex}`),
          providerId: provider.id,
          serviceId,
          title: item.title,
          description: item.description,
          projectDate: daysFromNow(-item.monthsAgo * 30),
        },
      });
    }

    // Subscription row, so subscription state is consistent with the profile.
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { workspaceType: spec.type, name: spec.subscription === 'TRIALING' ? 'FREE' : 'STANDARD' },
    });
    if (plan) {
      // No unique constraint on ProviderSubscription.providerId, so match on it.
      const existing = await prisma.providerSubscription.findFirst({ where: { providerId: provider.id } });
      const subData = {
        planId: plan.id,
        status: spec.subscription,
        startDate: daysFromNow(-60),
        endDate: spec.subscription === 'ACTIVE' ? daysFromNow(305) : spec.subscription === 'PAST_DUE' ? daysFromNow(-5) : null,
        renewalDate: spec.subscription === 'ACTIVE' ? daysFromNow(305) : null,
      };
      const sub = existing
        ? await prisma.providerSubscription.update({ where: { id: existing.id }, data: subData })
        : await prisma.providerSubscription.create({ data: { providerId: provider.id, ...subData } });

      const paid = await prisma.subscriptionTransaction.findFirst({ where: { subscriptionId: sub.id } });
      if (!paid) {
        await prisma.subscriptionTransaction.create({
          data: {
            subscriptionId: sub.id,
            amount: plan.price,
            currency: 'RWF',
            paymentProvider: 'mock',
            paymentStatus: spec.subscription === 'PAST_DUE' ? 'FAILED' : 'SUCCEEDED',
          },
        });
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`  ${PROVIDERS.length} providers, ${serviceIdByName.size} services, ${await prisma.serviceOffering.count()} offerings`);

  // --- Clients ------------------------------------------------------------
  const clientIds: Array<{ userId: string; profileId: string; locationId: string }> = [];
  for (const [index, client] of CLIENTS.entries()) {
    const email = `${slugify(`${client.firstName}.${client.lastName}`)}@client.demo.biilocalfinder.dev`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { phoneVerified: true },
      create: {
        email,
        passwordHash: clientPasswordHash,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: `+250787${String(200000 + index * 1111).slice(0, 6)}`,
        role: 'CLIENT',
        status: 'ACTIVE',
        emailVerified: true,
        phoneVerified: true,
      },
    });
    const profile = await prisma.clientProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, bio: null },
    });
    clientIds.push({ userId: user.id, profileId: profile.id, locationId: locationIdByKey.get(client.location)! });
  }

  // --- Requests → quotes → bookings → reviews → messages ------------------
  let requestCount = 0;
  let quoteCount = 0;
  let bookingCount = 0;
  let reviewCount = 0;
  let messageCount = 0;

  for (const [sIndex, scenario] of SCENARIOS.entries()) {
    const providerId = providerIdByName.get(scenario.provider);
    if (!providerId) throw new Error(`Scenario references unknown provider "${scenario.provider}"`);
    const client = clientIds[scenario.client];

    const offering = offeringIdsByProvider
      .get(scenario.provider)!
      .find((o) => o.serviceName === scenario.service);
    if (!offering) throw new Error(`Provider ${scenario.provider} does not offer "${scenario.service}"`);

    const createdAt = daysFromNow(-scenario.daysAgo);
    const requestStatus =
      scenario.kind === 'OPEN' ? 'OPEN'
      : scenario.kind === 'QUOTED' ? 'QUOTED'
      : scenario.kind === 'BOOKED' ? 'BOOKED'
      : scenario.kind === 'COMPLETED' ? 'ACCEPTED'
      : 'CANCELLED';

    const request = await prisma.serviceRequest.upsert({
      where: { id: demoId(`request:${sIndex}`) },
      update: { status: requestStatus },
      create: {
        id: demoId(`request:${sIndex}`),
        clientId: client.profileId,
        providerId,
        serviceId: offering.serviceId,
        serviceOfferingId: offering.id,
        locationId: sIndex % 4 === 3 ? kicukiroLocation.id : client.locationId,
        title: scenario.title,
        description: scenario.description,
        preferredDate: daysFromNow(7 + (sIndex % 20)),
        preferredTime: ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)'][sIndex % 3],
        budgetMin: scenario.budget?.[0],
        budgetMax: scenario.budget?.[1],
        additionalNotes: 'Submitted through the demo dataset.',
        status: requestStatus,
        createdAt,
        updatedAt: createdAt,
      },
    });
    requestCount++;

    if (scenario.kind === 'OPEN' || !scenario.quote) continue;

    // Quote from the target provider.
    const quote = await prisma.quote.upsert({
      where: { id: demoId(`quote:${sIndex}:primary`) },
      update: {},
      create: {
        id: demoId(`quote:${sIndex}:primary`),
        requestId: request.id,
        providerId,
        price: scenario.quote.price,
        currency: 'RWF',
        estimatedDuration: scenario.quote.duration,
        proposedDate: daysFromNow(5 + (sIndex % 14)),
        description: scenario.quote.description,
        materials: scenario.quote.materials,
        includedItems: scenario.quote.included,
        excludedItems: scenario.quote.excluded,
        status: scenario.kind === 'COMPLETED' || scenario.kind === 'BOOKED' ? 'ACCEPTED' : scenario.kind === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
        expiresAt: daysFromNow(10),
        createdAt,
        updatedAt: createdAt,
      },
    });
    quoteCount++;

    // A second, competing quote so the compare view has something to compare.
    if (scenario.rivalProvider) {
      const rivalId = providerIdByName.get(scenario.rivalProvider);
      if (rivalId) {
        const rivalOffering = offeringIdsByProvider.get(scenario.rivalProvider)![0];
        await prisma.quote.upsert({
          where: { id: demoId(`quote:${sIndex}:rival`) },
          update: {},
          create: {
            id: demoId(`quote:${sIndex}:rival`),
            requestId: request.id,
            providerId: rivalId,
            price: Math.round(scenario.quote.price * 0.88),
            currency: 'RWF',
            estimatedDuration: scenario.quote.duration,
            proposedDate: daysFromNow(6 + (sIndex % 12)),
            description: 'Quoted slightly lower to win the job, with the same scope.',
            materials: scenario.quote.materials,
            includedItems: scenario.quote.included,
            excludedItems: [...scenario.quote.excluded, 'Post-job follow-up visit'],
            status: 'PENDING',
            expiresAt: daysFromNow(10),
            createdAt,
            updatedAt: createdAt,
          },
        });
        quoteCount++;
        void rivalOffering;
      }
    }

    // A message thread on quoted/active requests.
    if (scenario.kind !== 'CANCELLED') {
      const conversation = await prisma.conversation.upsert({
        where: { serviceRequestId: request.id },
        update: {},
        create: { serviceRequestId: request.id, createdAt, updatedAt: createdAt },
      });
      await prisma.conversationParticipant.upsert({
        where: { conversationId_clientId_providerId: { conversationId: conversation.id, clientId: client.profileId, providerId } },
        update: {},
        create: { conversationId: conversation.id, clientId: client.profileId, providerId, lastReadAt: createdAt },
      });

      const thread: Array<{ from: 'client' | 'provider'; body: string; minutesAfter: number }> = [
        { from: 'client', body: scenario.description, minutesAfter: 0 },
        { from: 'provider', body: `Thanks for the details. I can take this on — I have sent you a quote with exactly what is included.`, minutesAfter: 95 },
        { from: 'client', body: 'Thank you. Is the price fixed, or could it change once you look at it?', minutesAfter: 140 },
        { from: 'provider', body: 'The quote above is what I would charge for the scope described. If I find something different on inspection, I will tell you and ask before doing it.', minutesAfter: 205 },
      ];
      for (const [mIndex, message] of thread.entries()) {
        await prisma.message.upsert({
          where: { id: demoId(`message:${sIndex}:${mIndex}`) },
          update: {},
          create: {
            id: demoId(`message:${sIndex}:${mIndex}`),
            conversationId: conversation.id,
            senderId: message.from === 'client' ? client.userId : (await prisma.provider.findUniqueOrThrow({ where: { id: providerId }, select: { userId: true } })).userId,
            body: message.body,
            readAt: mIndex < thread.length - 1 ? createdAt : null,
            createdAt: new Date(createdAt.getTime() + message.minutesAfter * 60 * 1000),
          },
        });
        messageCount++;
      }
    }

    if (scenario.kind !== 'BOOKED' && scenario.kind !== 'COMPLETED') continue;

    const booking = await prisma.booking.upsert({
      where: { id: demoId(`booking:${sIndex}`) },
      update: {},
      create: {
        id: demoId(`booking:${sIndex}`),
        serviceRequestId: request.id,
        quoteId: quote.id,
        clientId: client.profileId,
        providerId,
        status: scenario.kind === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED',
        agreedPrice: scenario.quote.price,
        currency: 'RWF',
        scheduledAt: daysFromNow(-scenario.daysAgo + 5),
        completedAt: scenario.kind === 'COMPLETED' ? daysFromNow(-scenario.daysAgo + 7) : null,
        createdAt,
        updatedAt: createdAt,
      },
    });
    bookingCount++;

    // Status history, so the booking timeline has something to render. Model
    // has no natural key, so each row gets a deterministic id and is upserted.
    const historyRows = [
      { key: 'requested', fromStatus: null, toStatus: 'REQUESTED' as const, note: 'Quote accepted, booking opened.', createdAt },
      { key: 'accepted', fromStatus: 'REQUESTED' as const, toStatus: 'ACCEPTED' as const, note: 'Scope agreed between both parties.', createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000) },
      scenario.kind === 'COMPLETED'
        ? { key: 'completed', fromStatus: 'ACCEPTED' as const, toStatus: 'COMPLETED' as const, note: 'Work finished and confirmed by the client.', createdAt: daysFromNow(-scenario.daysAgo + 7) }
        : { key: 'confirmed', fromStatus: 'ACCEPTED' as const, toStatus: 'CONFIRMED' as const, note: 'Date confirmed, work scheduled.', createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000) },
    ];
    for (const row of historyRows) {
      const id = demoId(`booking-history:${booking.id}:${row.key}`);
      await prisma.bookingStatusHistory.upsert({
        where: { id },
        update: { fromStatus: row.fromStatus, toStatus: row.toStatus, note: row.note, createdAt: row.createdAt },
        create: { id, bookingId: booking.id, fromStatus: row.fromStatus, toStatus: row.toStatus, note: row.note, createdAt: row.createdAt },
      });
    }

    if (scenario.kind !== 'COMPLETED' || !scenario.review) continue;

    await prisma.review.upsert({
      where: { bookingId: booking.id },
      update: {},
      create: {
        bookingId: booking.id,
        clientId: client.profileId,
        providerId,
        rating: scenario.review.rating,
        qualityRating: scenario.review.quality,
        communicationRating: scenario.review.communication,
        professionalismRating: scenario.review.professionalism,
        valueRating: scenario.review.value,
        comment: scenario.review.comment,
        // The client has a verified email and the booking is COMPLETED, which
        // is exactly what makes a review a "strong" verified signal.
        verifiedBooking: true,
        integrityFlags: [],
        status: 'PUBLISHED',
        createdAt: daysFromNow(-scenario.daysAgo + 8),
      },
    });
    reviewCount++;
  }

  // eslint-disable-next-line no-console
  console.log(
    `  ${clientIds.length} clients, ${requestCount} requests, ${quoteCount} quotes, ${bookingCount} bookings, ${reviewCount} reviews, ${messageCount} messages`,
  );

  // --- Recompute provider aggregates from the published reviews -----------
  // Same aggregate the reviews module uses, so the denormalised rating and
  // counts on the profile always agree with the reviews list.
  for (const providerId of providerIdByName.values()) {
    const [agg, verifiedCount] = await Promise.all([
      prisma.review.aggregate({ where: { providerId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true }),
      prisma.review.count({ where: { providerId, status: 'PUBLISHED', verifiedBooking: true } }),
    ]);
    await prisma.provider.update({
      where: { id: providerId },
      data: {
        rating: agg._avg.rating != null ? Math.round(Number(agg._avg.rating) * 100) / 100 : 0,
        reviewCount: agg._count,
        verifiedReviewCount: verifiedCount,
      },
    });
  }

  // --- Personalization input: interactions, interests, favourites, searches
  // Without these, every account sees the cold-start page and the
  // "because you viewed" and "recently viewed" branches never run.
  const withInterest = CLIENTS[0];
  const interestUser = (
    await prisma.user.findUniqueOrThrow({ where: { email: `${slugify(`${withInterest.firstName}.${withInterest.lastName}`)}@client.demo.biilocalfinder.dev` } })
  );

  type InteractionEntityType = 'PROVIDER' | 'SERVICE_OFFERING' | 'SERVICE' | 'SERVICE_REQUEST' | 'QUOTE' | null;
  const interestTargets: { business: string; service: string; type: 'VIEW_PROVIDER' | 'SEARCH'; entityType: InteractionEntityType }[] = [
    { business: 'Impera Plumbing & Drainage', service: 'Leak detection and pipe repair', type: 'VIEW_PROVIDER', entityType: 'PROVIDER' },
    { business: 'Impera Plumbing & Drainage', service: 'Leak detection and pipe repair', type: 'SEARCH', entityType: null },
    { business: 'Volt Rwanda Electricals', service: 'Wiring and socket installation', type: 'VIEW_PROVIDER', entityType: 'PROVIDER' },
  ];

  for (const [iIndex, target] of interestTargets.entries()) {
    const providerId = providerIdByName.get(target.business)!;
    // A SEARCH interaction isn't about a specific entity, so it carries no
    // entityId rather than borrowing the first offering's id.
    let entityId: string | null = null;
    if (target.entityType === 'PROVIDER') entityId = providerId;
    else if (target.entityType === 'SERVICE_OFFERING') entityId = offeringIdsByProvider.get(target.business)![0].id;

    await prisma.userInteraction.upsert({
      where: { id: demoId(`interaction:${iIndex}`) },
      update: { type: target.type, entityType: target.entityType, entityId, metadata: { source: 'demo-seed' }, createdAt: daysFromNow(-(6 - iIndex * 2)) },
      create: {
        id: demoId(`interaction:${iIndex}`),
        userId: interestUser.id,
        type: target.type,
        entityType: target.entityType,
        entityId,
        metadata: { source: 'demo-seed' },
        createdAt: daysFromNow(-(6 - iIndex * 2)),
      },
    });

    // UserInterest's unique key contains NULLable columns, which Postgres
    // doesn't enforce as unique — so match-then-write rather than upsert.
    const offering = offeringIdsByProvider.get(target.business)![0];
    const serviceId = offering.serviceId;
    const categoryId = categoryByChildName.get(PROVIDERS.find((p) => p.businessName === target.business)!.category)!;
    const existingInterest = await prisma.userInterest.findFirst({
      where: { userId: interestUser.id, categoryId, serviceId },
    });
    if (existingInterest) {
      await prisma.userInterest.update({
        where: { id: existingInterest.id },
        data: { score: existingInterest.score + 5, interactionCount: existingInterest.interactionCount + 1, lastInteractionAt: daysFromNow(-(6 - iIndex * 2)) },
      });
    } else {
      await prisma.userInterest.create({
        data: { userId: interestUser.id, categoryId, serviceId, score: 5, interactionCount: 1, lastInteractionAt: daysFromNow(-(6 - iIndex * 2)) },
      });
    }
  }

  // Favourites and a saved search for the same user.
  for (const [fIndex, business] of ['LensLight Studios', 'Umwenge Woodworks'].entries()) {
    await prisma.favorite.upsert({
      where: { userId_providerId: { userId: interestUser.id, providerId: providerIdByName.get(business)! } },
      update: {},
      create: { id: demoId(`favorite:${fIndex}`), userId: interestUser.id, providerId: providerIdByName.get(business)! },
    });
  }
  await prisma.savedSearch.upsert({
    where: { id: demoId('saved-search:plumbing') },
    update: {},
    create: {
      id: demoId('saved-search:plumbing'),
      userId: interestUser.id,
      name: 'Emergency plumbing in Nyamirambo',
      categoryId: categoryByChildName.get('Plumbing'),
      city: 'Kigali',
      verifiedOnly: true,
      maxPrice: 150000,
      isActive: true,
    },
  });

  // --- Report -------------------------------------------------------------
  // eslint-disable-next-line no-console
  const totals = {
    providers: await prisma.provider.count(),
    verified: await prisma.provider.count({ where: { verificationStatus: 'VERIFIED' } }),
    services: await prisma.service.count(),
    offerings: await prisma.serviceOffering.count(),
    serviceAreas: await prisma.serviceArea.count(),
    portfolios: await prisma.portfolio.count(),
    clients: await prisma.clientProfile.count(),
    requests: await prisma.serviceRequest.count(),
    quotes: await prisma.quote.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
    messages: await prisma.message.count(),
  };
  // eslint-disable-next-line no-console
  console.log('Totals:', totals);
  // eslint-disable-next-line no-console
  console.log(`\nDemo provider login: <slug>@demo.biilocalfinder.dev / ${PROVIDER_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log(`  e.g. ${slugify(PROVIDERS[4].businessName)}@demo.biilocalfinder.dev`);
  // eslint-disable-next-line no-console
  console.log(`Demo client login:   ${slugify(`${CLIENTS[0].firstName}.${CLIENTS[0].lastName}`)}@client.demo.biilocalfinder.dev / ${CLIENT_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log('Admins: unchanged (admin@biilocalfinder.dev / ChangeMe123!)');
  // eslint-disable-next-line no-console
  console.log('Safe to re-run: every row is upserted on a stable natural key, so this');
  // eslint-disable-next-line no-console
  console.log('refreshes the dataset in place rather than duplicating it. To wipe it,');
  // eslint-disable-next-line no-console
  console.log('drop the schema and re-run prisma:migrate + prisma:seed + this script.');
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
