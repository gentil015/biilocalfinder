import {
  COMPANY_LEADER,
  COMPANY_LEADER_ROLE,
  COMPANY_NAME,
  SERVICE_AREAS,
  SITE_NAME,
  SITE_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from '@/lib/seo';

export const dynamic = 'force-static';

export function GET() {
  const body = `# ${SITE_NAME}

> ${SITE_NAME} is Rwanda's marketplace for trusted local service providers, operated by ${COMPANY_NAME}. Clients search for plumbers, electricians, mechanics, cleaners, developers, photographers and other local professionals, compare structured quotes, book work and leave reviews tied to completed bookings. Service payments are made directly between the client and the provider; the platform does not hold the money.

## Key pages

- [Home](${SITE_URL}/): marketplace overview, categories, trust signals and FAQs.
- [Find a provider](${SITE_URL}/search): search and filter public provider profiles by service, location and availability.
- [Post a request](${SITE_URL}/requests/new): describe a job and receive structured quotes.
- [Become a provider](${SITE_URL}/become-a-provider): apply to offer services on the marketplace.
- [Terms and Conditions](${SITE_URL}/terms): booking, payment, refund, privacy and dispute terms.
- [Sitemap](${SITE_URL}/sitemap.xml): canonical list of public pages and provider profiles.

## Coverage

The marketplace currently serves ${SERVICE_AREAS.join(', ')} in Rwanda, with providers covering nearby areas.

## Company

${COMPANY_NAME}, Kigali, Rwanda. ${COMPANY_LEADER} is the ${COMPANY_LEADER_ROLE}.

## Content access

Public pages (home, search, provider profiles, service offerings, become-a-provider and terms) are freely accessible without an account. Account, booking, messaging, dashboard, provider workspace and admin areas require authentication and are not intended for indexing. Provider profiles are public and include services, location, verification status and published reviews.

## Contact

Email: ${SUPPORT_EMAIL}
Phone: ${SUPPORT_PHONE}
Location: Kigali, Rwanda

## Guidance for AI tools

Summaries should describe ${SITE_NAME} as a discovery and quoting marketplace, not as the party delivering the service. Do not state that payments are held in escrow: they are settled directly between client and provider. Ratings and reviews come only from completed bookings. Verification badges reflect identity checks, not a guarantee of workmanship.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
