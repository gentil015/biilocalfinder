'use client';

import Link from 'next/link';
import { MapPin, Scale, Star, MessageSquareQuote, Tag, Clock3, Award } from 'lucide-react';
import type { ProviderSearchItem } from '@/lib/api';
import { VerificationBadge } from '@/components/verification-badge';
import { AvailabilityBadge } from '@/components/availability-badge';
import type { CompareSelection } from '@/components/compare-tray';
import { useI18n } from '@/components/locale-provider';

/**
 * The single most repeated object in the product.
 *
 * Reading order is deliberate and matches how a buyer actually decides:
 *   trust (name + verification) → proof (rating) → proximity (distance,
 *   coverage) → timing (availability) → price.
 *
 * The whole card is a link via a stretched pseudo-element rather than an
 * <a> wrapping the card, so the text inside stays selectable and the compare
 * toggle can sit above the hit area as a real sibling button.
 */
export function ProviderCard({ provider, compare }: { provider: ProviderSearchItem; compare?: CompareSelection }) {
  const { t } = useI18n();
  const selected = compare?.isSelected(provider.id) ?? false;
  const initial = provider.businessName?.charAt(0)?.toUpperCase() ?? 'P';

  return (
    <article
      className={`surface-card-interactive group relative flex flex-col p-4 sm:p-5 ${
        selected ? '!border-brand-400 !ring-4 !ring-brand-500/10' : ''
      }`}
    >
      <Link
        href={`/providers/${provider.id}`}
        className="flex min-w-0 flex-1 gap-4 after:absolute after:inset-0 after:content-[''] sm:gap-5"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 ring-1 ring-inset ring-black/5 sm:h-[72px] sm:w-[72px]">
          {provider.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={provider.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-2xl font-extrabold text-white dark:text-home-night">
              {initial}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 pr-9">
            <h3 className="truncate text-[15px] font-bold tracking-tight text-ink-950">{provider.businessName}</h3>
            <VerificationBadge status={provider.verificationStatus} businessVerified={provider.businessVerified} />
          </div>

          {/* Rating is the strongest single signal on the card, so it gets the
              heaviest type in the body. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            <span className="flex items-center gap-1 font-bold tabular text-ink-950">
              <Star className="h-3.5 w-3.5 fill-rating-400 text-rating-400" aria-hidden="true" />
              {provider.rating.toFixed(1)}
            </span>
            <span className="text-ink-400">({provider.reviewCount})</span>
            {!!provider.verifiedReviewCount && provider.verifiedReviewCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-1.5 py-px text-2xs font-bold text-success-700">
                <MessageSquareQuote className="h-3 w-3" aria-hidden="true" />
                {t('providerCard.verified', { count: provider.verifiedReviewCount })}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-500">
            {provider.distanceKm != null && (
              <span className="inline-flex items-center gap-1 font-medium">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('providerCard.distance', { distance: provider.distanceKm.toFixed(1) })}
              </span>
            )}
            {provider.servesArea && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                {t('providerCard.servesArea')}
              </span>
            )}
            {provider.responseTimeMinutes != null && provider.responseTimeMinutes > 0 && (
              <span className="inline-flex items-center gap-1 font-medium" title={t('providerCard.repliesIn', { minutes: provider.responseTimeMinutes })}>
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {provider.responseTimeMinutes < 60
                  ? t('providerCard.repliesIn', { minutes: provider.responseTimeMinutes })
                  : t('providerCard.repliesInHours', { hours: Math.round(provider.responseTimeMinutes / 60) })}
              </span>
            )}
            {!!provider.yearsOfExperience && provider.yearsOfExperience > 0 && (
              <span className="inline-flex items-center gap-1 font-medium">
                <Award className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('providerCard.yearsExperience', { count: provider.yearsOfExperience })}
              </span>
            )}
            <AvailabilityBadge availability={provider.availability} />
          </div>
        </div>
      </Link>

      {/* Price sits on its own baseline below a hairline so a column of
          results reads as a scannable price list. */}
      <div className="mt-3 flex items-end justify-between gap-3 border-t border-ink-100 pt-3">
        <p className="flex items-center gap-1.5 text-sm font-bold tabular text-ink-950">
          {provider.startingPrice != null ? (
            <>
              <span className="text-xs font-medium text-ink-400">{t('providerCard.from')}</span>
              {provider.startingPrice.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-ink-500">{provider.currency}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-ink-500">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              {t('providerCard.contactForPricing')}
            </span>
          )}
        </p>
      </div>

      {compare && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            compare.toggle(provider.id, provider.businessName);
          }}
          disabled={!selected && compare.isFull}
          title={selected ? t('providerCard.removeFromCompare') : t('providerCard.addToCompare')}
          aria-label={
            selected
              ? t('providerCard.removeAria', { name: provider.businessName })
              : t('providerCard.addAria', { name: provider.businessName })
          }
          className={`absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-30 ${
            selected
              ? 'border-brand-600 bg-brand-600 text-white dark:text-home-night'
              : 'border-ink-200 bg-surface/90 text-ink-400 backdrop-blur hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700'
          }`}
        >
          <Scale className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  );
}
