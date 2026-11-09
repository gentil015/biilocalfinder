import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms and Conditions',
  description: 'Terms for using Bii Localfinder to find local services and work with independent providers.',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
