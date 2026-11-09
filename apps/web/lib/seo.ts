const PROJECT_PRODUCTION_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : null;
const DEPLOYMENT_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

export const SITE_NAME = 'BII Localfinder';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  PROJECT_PRODUCTION_URL ||
  DEPLOYMENT_URL ||
  process.env.WEB_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

export const DEFAULT_TITLE = 'BII Localfinder — Find trusted local service providers';
export const DEFAULT_DESCRIPTION =
  'Find verified plumbers, electricians, mechanics, cleaners, developers, photographers and more across Rwanda. Compare clear quotes and book directly with local professionals.';

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
