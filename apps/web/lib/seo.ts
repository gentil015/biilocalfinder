export const PRODUCTION_SITE_URL = 'https://biilocalfinder.com';

const PROJECT_PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;
const DEPLOYMENT_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

export const SITE_NAME = 'BII Localfinder';

// `NEXT_PUBLIC_SITE_URL` always wins. Otherwise production canonicalises to the
// custom domain, not to a Vercel preview/deployment URL, so crawlers never see
// multiple hosts for the same page. Local development keeps localhost.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === 'production'
    ? PRODUCTION_SITE_URL
    : PROJECT_PRODUCTION_URL || DEPLOYMENT_URL || process.env.WEB_URL) ||
  'http://localhost:3000'
).replace(/\/+$/, '');

export const DEFAULT_TITLE = 'BII Localfinder — Find trusted local service providers';
export const DEFAULT_DESCRIPTION =
  'Find verified plumbers, electricians, mechanics, cleaners and more across Rwanda. Compare clear quotes and book trusted local professionals.';

// Public company and contact details. The phone and email are shown in the
// landing-page About section, the site footer and the organization JSON-LD.
// They can still be overridden at deploy time without a code change.
export const COMPANY_NAME = 'BII Technology';
export const COMPANY_LEADER = 'Dushime Gentil';
export const COMPANY_LEADER_ROLE = 'Co-founder and CEO';
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biilocalfinder.com';
export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+250 795 946 213';
export const SERVICE_AREAS = ['Kigali', 'Rubavu', 'Musanze', 'Huye'];
export const COMPANY_LOCATION = 'Kigali, Rwanda';

export const DEFAULT_KEYWORDS = [
  'local service providers Rwanda',
  'find a plumber in Kigali',
  'electricians Kigali',
  'mechanics near me Rwanda',
  'verified service providers',
  'home services Rwanda',
  'professional services Kigali',
  'get a quote Rwanda',
  'hire local professionals',
  'BII Localfinder',
];

export function absoluteUrl(path = '/') {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function absoluteImageUrl(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return absoluteUrl(value);
}

export function truncateText(value: string | null | undefined, maxLength = 160) {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function providerTitle(provider: any) {
  const service = provider.services?.[0]?.service?.name ?? provider.services?.[0]?.title;
  const city = provider.location?.city;
  if (service && city) return `${provider.businessName} — ${service} in ${city}`;
  if (service) return `${provider.businessName} — ${service}`;
  if (city) return `${provider.businessName} — Local provider in ${city}`;
  return provider.businessName ?? 'Local service provider';
}

export function providerDescription(provider: any) {
  const explicit = provider.description || provider.bio;
  if (explicit) return truncateText(explicit);

  const services = (provider.services ?? [])
    .map((offering: any) => offering.title || offering.service?.name)
    .filter(Boolean)
    .slice(0, 4);
  const city = provider.location?.city;
  const place = city ? ` in ${city}` : ' in Rwanda';
  const offering = services.length ? services.join(', ') : 'local services';
  return truncateText(
    `${provider.businessName} offers ${offering}${place}. View their profile, compare quotes and book directly on BII Localfinder.`,
  );
}
