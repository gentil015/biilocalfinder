'use client';

import { CalendarClock, CalendarX } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';

export interface AvailabilitySummary {
  paused: boolean;
  availableToday: boolean;
  availableTomorrow: boolean;
  nextAvailableDate: string | null;
  nextAvailableLabel: string;
}

// Used on search cards and the provider profile — spec §3:
// "Available today" / "Available tomorrow" / "Next available: Friday".
export function AvailabilityBadge({ availability }: { availability?: AvailabilitySummary | null }) {
  const { t } = useI18n();
  if (!availability) return null;

  if (availability.paused || !availability.nextAvailableDate) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400">
        <CalendarX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {t('availability.notAvailable')}
      </span>
    );
  }

  const text = availability.availableToday
    ? t('availability.today')
    : availability.availableTomorrow
      ? t('availability.tomorrow')
      : t('availability.next', { label: availability.nextAvailableLabel });

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}