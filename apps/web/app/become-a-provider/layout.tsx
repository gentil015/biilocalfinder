import type { Metadata } from 'next';

const title = 'Become a service provider in Rwanda';
const description =
  'Turn your trade into a steady stream of local work. Create a free provider account, list your services, receive client requests and quote directly on BII Localfinder.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/become-a-provider' },
  openGraph: {
    title,
    description,
    url: '/become-a-provider',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function BecomeAProviderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
