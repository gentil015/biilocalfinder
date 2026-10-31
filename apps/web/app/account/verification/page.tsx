'use client';

import Link from 'next/link';
import { ContactVerificationPanel } from '@/components/contact-verification-panel';
import { useAuth } from '@/components/auth-provider';
import { PageHeader } from '@/components/ui/page';

export default function AccountVerificationPage() {
  const { refresh } = useAuth();

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Account"
        title="Contact verification"
        description="Prove that the email address and phone number on your account belong to you."
        actions={
          <Link href="/account" className="btn-secondary btn-sm">
            Back to account
          </Link>
        }
      />

      <ContactVerificationPanel
        description="We send a one-time code to the address or number on your account. Verification helps protect your account and is required for trust badges."
        onChanged={() => void refresh()}
      />
    </main>
  );
}
