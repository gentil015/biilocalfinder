import type { Metadata } from 'next';

const title = 'Terms and Conditions';
const description =
  'Terms for using Bii Localfinder to find local services and work with independent providers.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/terms' },
  openGraph: {
    title,
    description,
    url: '/terms',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
