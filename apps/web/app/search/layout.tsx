import type { Metadata } from 'next';

const title = 'Find verified local service providers in Rwanda';
const description =
  'Search verified plumbers, electricians, mechanics, cleaners, developers, photographers and more near you in Kigali, Rubavu, Musanze and Huye. Compare profiles and request a free quote.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/search' },
  openGraph: {
    title,
    description,
    url: '/search',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
