'use client';

import { BadgeCheck, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';

// Small, reused wherever a provider's trust signals need to show up:
// search cards, the profile header, and the service-offering page.
export function VerificationBadge({
  status,
  businessVerified,
  size = 'sm',
}: {
  status: string;
  businessVerified?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useI18n();
  if (status !== 'VERIFIED') return null;
  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 align-middle">
      <BadgeCheck className={`${iconSize} text-brand-600`} aria-label={t('verification.verifiedProvider')} />
      {businessVerified && (
        <ShieldCheck className={`${iconSize} text-brand-600`} aria-label={t('verification.businessVerified')} />
      )}
    </span>
  );
}

// Text version for detail pages, e.g. under the provider's name. Verification
// is the platform's core promise, so this uses filled pills rather than bare
// text — the state has to be unmissable on a profile page.
export function VerificationLabel({
  status,
  businessVerified,
}: {
  status: string;
  businessVerified?: boolean;
}) {
  const { t } = useI18n();
  if (status === 'SUSPENDED') {
    return (
      <span className="badge badge-danger">
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        {t('verification.suspended')}
      </span>
    );
  }
  if (status !== 'VERIFIED') return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="badge badge-brand">
        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
        {t('verification.verifiedProvider')}
      </span>
      {businessVerified && (
        <span className="badge badge-info">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          {t('verification.businessVerified')}
        </span>
      )}
    </div>
  );
}