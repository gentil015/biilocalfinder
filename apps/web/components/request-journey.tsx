import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import { Panel } from '@/components/ui/page';

export type JourneyTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral';
export type JourneyStepState = 'done' | 'current' | 'upcoming';

export interface JourneyStep {
  key: string;
  label: string;
  summary: string;
  state: JourneyStepState;
}

export interface RequestJourneyView {
  steps: JourneyStep[];
  headline: string;
  next: string;
  tone: JourneyTone;
  bookingId?: string | null;
}

/**
 * Turns a service request (plus its quotes and booking, when present) into the
 * client-facing journey: what has happened, where they are, and the one thing
 * that happens next. Pure so the request list and request detail can never
 * tell different stories about the same request.
 */
export function requestJourney(request: any, quotes: any[] = []): RequestJourneyView {
  const booking = request?.booking ?? null;
  const providerName = request?.provider?.businessName;
  const pendingQuotes = quotes.filter((q) => q.status === 'PENDING');
  const cancelled = request?.status === 'CANCELLED' || booking?.status === 'CANCELLED';
  const completed = booking?.status === 'COMPLETED';
  const confirmed = !!booking && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status);
  const chosen = !!booking || quotes.some((q) => q.status === 'ACCEPTED');
  const responded = quotes.length > 0 || !!booking;

  const doneFlags = [true, responded, chosen, confirmed, completed];
  const firstOpen = doneFlags.findIndex((done) => !done);

  const steps: JourneyStep[] = [
    {
      key: 'sent',
      label: 'Request sent',
      summary: providerName
        ? `Your brief is with ${providerName}.`
        : 'Your brief is open to matching providers.',
      state: 'done' as const,
    },
    {
      key: 'response',
      label: 'Provider responds',
      summary: 'They review the job and send a quote with a price and scope.',
      state: 'upcoming' as const,
    },
    {
      key: 'choose',
      label: 'You choose a quote',
      summary: 'Accept the offer you want — nothing is booked until you do.',
      state: 'upcoming' as const,
    },
    {
      key: 'confirm',
      label: 'Booking confirmed',
      summary: 'Both sides confirm, and the agreed date is locked in.',
      state: 'upcoming' as const,
    },
    {
      key: 'complete',
      label: 'Job completed',
      summary: 'The provider finishes, then you can leave a review.',
      state: 'upcoming' as const,
    },
  ].map((step, index) => {
    if (doneFlags[index]) return { ...step, state: 'done' as const };
    if (!cancelled && index === firstOpen) return { ...step, state: 'current' as const };
    return step;
  });

  const bookingId = booking?.id ?? null;

  if (cancelled) {
    return {
      steps,
      headline: 'This request was cancelled',
      next: 'No further steps happen on it. You can start a new request whenever you are ready.',
      tone: 'danger',
      bookingId,
    };
  }

  if (completed) {
    return {
      steps,
      headline: 'Job complete',
      next: 'The agreed work is finished. You can leave a review within 60 days.',
      tone: 'success',
      bookingId,
    };
  }

  if (booking?.status === 'IN_PROGRESS') {
    return {
      steps,
      headline: 'Work is in progress',
      next: 'The provider marks the job complete when it is finished. Payment is arranged directly with them.',
      tone: 'info',
      bookingId,
    };
  }

  if (booking?.status === 'CONFIRMED') {
    return {
      steps,
      headline: 'Booking confirmed',
      next: 'The provider starts on the agreed date. Both sides get a reminder 24 hours before.',
      tone: 'success',
      bookingId,
    };
  }

  if (booking) {
    return {
      steps,
      headline: 'Booking created',
      next: 'Open the booking to confirm it and agree the date. Nothing is paid through the platform.',
      tone: 'warning',
      bookingId,
    };
  }

  if (request?.status === 'NEGOTIATING') {
    return {
      steps,
      headline: 'A price is being negotiated',
      next: 'Respond to the latest proposal in the quote thread to keep things moving.',
      tone: 'warning',
      bookingId,
    };
  }

  if (pendingQuotes.length > 0) {
    return {
      steps,
      headline: `${pendingQuotes.length} ${pendingQuotes.length === 1 ? 'quote' : 'quotes'} ready to review`,
      next: 'Compare the price and scope, then accept the one you want. Accepting creates the booking.',
      tone: 'warning',
      bookingId,
    };
  }

  if (quotes.length > 0) {
    return {
      steps,
      headline: 'No open quotes right now',
      next: 'Every quote is closed. You can open this request to more providers or start a new request.',
      tone: 'neutral',
      bookingId,
    };
  }

  return {
    steps,
    headline: 'Waiting for a quote',
    next: providerName
      ? `${providerName} will review your request and reply with a quote. You will be notified when it arrives.`
      : 'Matching providers can send quotes. You will be notified when the first one arrives.',
    tone: 'info',
    bookingId,
  };
}

const TONE_ICONS = {
  info: Info,
  warning: Clock,
  success: CheckCircle2,
  danger: AlertCircle,
  neutral: Info,
} as const;

const TONE_CLASSES: Record<JourneyTone, string> = {
  info: 'alert-info',
  warning: 'alert-warning',
  success: 'alert-success',
  danger: 'alert-error',
  neutral: 'border-ink-200 bg-ink-50 text-ink-700',
};

export function RequestJourney({
  request,
  quotes = [],
  className = '',
}: {
  request: any;
  quotes?: any[];
  className?: string;
}) {
  const journey = requestJourney(request, quotes);
  const ToneIcon = TONE_ICONS[journey.tone];

  return (
    <Panel
      title="Your booking journey"
      description="Where you are and exactly what happens next."
      className={className}
    >
      <div className={`alert ${TONE_CLASSES[journey.tone]}`}>
        <ToneIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{journey.headline}</p>
          <p className="mt-0.5 leading-relaxed opacity-90">{journey.next}</p>
        </div>
        {journey.bookingId && (
          <Link
            href={`/bookings/${journey.bookingId}`}
            className="btn-secondary btn-sm shrink-0 self-center"
          >
            View booking
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <ol className="mt-5 space-y-0">
        {journey.steps.map((step, index) => {
          const done = step.state === 'done';
          const current = step.state === 'current';
          const circleClass = current
            ? 'bg-brand-700 text-white dark:text-home-night ring-4 ring-brand-100 dark:ring-brand-300'
            : done
              ? 'bg-brand-50 text-brand-700'
              : 'bg-ink-100 text-ink-400';

          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circleClass}`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                {index < journey.steps.length - 1 && (
                  <span
                    className={`my-1 w-px flex-1 ${done ? 'bg-brand-200' : 'bg-ink-200'}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <p
                  className={`text-sm font-bold ${
                    current ? 'text-brand-700' : done ? 'text-ink-900' : 'text-ink-400'
                  }`}
                >
                  {step.label}
                  {current && (
                    <span className="ml-2 text-2xs font-bold uppercase tracking-wide text-brand-600">
                      You are here
                    </span>
                  )}
                </p>
                <p
                  className={`mt-0.5 text-xs leading-relaxed ${
                    current ? 'text-ink-600' : 'text-ink-400'
                  }`}
                >
                  {step.summary}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
