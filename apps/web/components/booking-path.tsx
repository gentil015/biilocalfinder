'use client';

import { ChevronRight } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';

/**
 * The three-step promise between deciding on a provider and having a booking.
 *
 * The platform never takes a service payment and a request is not a booking,
 * so both facts need to be visible before the client invests time in a form.
 */
export function BookingPath({
  variant = 'panel',
  showPayNote = true,
  className = '',
}: {
  variant?: 'panel' | 'inline';
  showPayNote?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const steps = [
    { title: t('bookingPath.request.title'), body: t('bookingPath.request.body') },
    { title: t('bookingPath.quote.title'), body: t('bookingPath.quote.body') },
    { title: t('bookingPath.book.title'), body: t('bookingPath.book.body') },
  ];

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs ${className}`}>
        {steps.map((step, i) => (
          <span key={step.title} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-300" aria-hidden="true" />}
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-extrabold tabular text-brand-700 ring-1 ring-inset ring-brand-200">
              {i + 1}
            </span>
            <span className="font-semibold text-ink-700">{step.title}</span>
          </span>
        ))}
        {showPayNote && (
          <span className="text-ink-400">· {t('bookingPath.payShort')}</span>
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={t('bookingPath.eyebrow')}
      className={`rounded-xl border border-brand-200 bg-brand-50/50 p-4 sm:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow text-brand-700">{t('bookingPath.eyebrow')}</h2>
        <span className="rounded-full bg-surface px-2.5 py-1 text-2xs font-bold text-brand-700 ring-1 ring-inset ring-brand-200">
          {t('bookingPath.free')}
        </span>
      </div>

      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface font-display text-xs font-extrabold tabular text-brand-700 ring-1 ring-inset ring-brand-200">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {showPayNote && (
        <p className="mt-3 border-t border-brand-100 pt-2.5 text-2xs leading-relaxed text-ink-500">
          {t('bookingPath.pay')}
        </p>
      )}
    </section>
  );
}
