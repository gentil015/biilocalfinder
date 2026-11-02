'use client';

import { useI18n } from '@/components/locale-provider';
export function OnboardingProgress({
  step,
  total = 3,
  label,
}: {
  step: number;
  total?: number;
  label?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index < step ? 'bg-brand-600' : 'bg-ink-200'}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
        {t('onboarding.step', { step, total })}
        {label ? ` · ${label}` : ''}
      </p>
    </div>
  );
}
