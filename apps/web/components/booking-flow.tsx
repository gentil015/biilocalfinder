'use client';

import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Info,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Panel } from '@/components/ui/page';

/**
 * The booking lifecycle, explained in one place.
 *
 * A booking is created the moment a client accepts a quote, so it always
 * starts at ACCEPTED — the earlier REQUESTED/QUOTED/NEGOTIATING states belong
 * to the request/quote flow that comes before a booking exists. From ACCEPTED
 * the only legal moves are those enforced by the backend state machine:
 *
 *   ACCEPTED ──> CONFIRMED ──> IN_PROGRESS ──> COMPLETED
 *       └──────────── CANCELLED ────────────┘
 *
 * Each step below carries enough wording for either party to understand what
 * the step means, whose turn it is, and what happens next.
 */

export type BookingTone = 'brand' | 'success' | 'danger' | 'neutral';

export interface BookingStepMeta {
  status: string;
  /** Short title shown in the progress tracker. */
  label: string;
  /** One-line summary shown under the label in the tracker. */
  summary: string;
  /** Full explanation shown in the "current step" panel. */
  description: string;
  /** What happens after this step, in plain language. */
  next?: string;
  icon: LucideIcon;
  tone: BookingTone;
}

/** Ordered lifecycle. Order drives the progress tracker. */
export const BOOKING_STEPS: BookingStepMeta[] = [
  {
    status: 'ACCEPTED',
    label: 'Price agreed',
    summary: 'Quote accepted — the price is locked in.',
    description:
      'A quote was accepted, so the price is agreed and locked in. The booking is not scheduled yet — the provider only starts once both sides confirm.',
    next: 'Confirm the booking to move ahead. Either side can confirm, and either side can still cancel.',
    icon: Check,
    tone: 'brand',
  },
  {
    status: 'CONFIRMED',
    label: 'Booking confirmed',
    summary: 'Both sides committed — waiting to start.',
    description:
      'Both sides are committed and the job is on. If a date was set, a reminder is sent to both sides in the 24 hours before it.',
    next: 'The provider starts the job when the time comes. Either side can still cancel before work begins.',
    icon: CalendarClock,
    tone: 'brand',
  },
  {
    status: 'IN_PROGRESS',
    label: 'Work in progress',
    summary: 'The provider is doing the job now.',
    description:
      'The provider is doing the job now. The booking can no longer be cancelled from here — the way forward is completion.',
    next: 'The provider marks the job completed when it is finished. If something goes wrong, open a dispute instead.',
    icon: Clock,
    tone: 'brand',
  },
  {
    status: 'COMPLETED',
    label: 'Completed',
    summary: 'Job done — the review window is open.',
    description:
      'The job is finished and marked complete. The agreed price stands; payment is arranged directly between client and provider, never through the platform.',
    next: 'The client can leave a review within 60 days. A dispute can still be opened if needed.',
    icon: CheckCircle2,
    tone: 'success',
  },
];

/** Off-ramp state — not part of the happy path. */
export const CANCELLED_STEP: BookingStepMeta = {
  status: 'CANCELLED',
  label: 'Cancelled',
  summary: 'This booking was cancelled before completion.',
  description:
    'This booking was cancelled before the work was completed. It stays on record, but no further steps happen on it.',
  next: 'If money or conduct is in question, either side can still open a dispute.',
  icon: X,
  tone: 'danger',
};

const FALLBACK_STEP: BookingStepMeta = {
  status: 'UNKNOWN',
  label: 'In progress',
  summary: 'This booking is being worked through.',
  description: 'This booking is being worked through. Open it again shortly for the latest status.',
  icon: Info,
  tone: 'neutral',
};

/** Plain names used in the status-history timeline. */
const HISTORY_LABELS: Record<string, string> = {
  REQUESTED: 'Requested',
  QUOTED: 'Quoted',
  NEGOTIATING: 'Negotiating',
  ACCEPTED: 'Accepted',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function bookingStatusLabel(status: string): string {
  return HISTORY_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

export function bookingStatusMeta(status: string): BookingStepMeta {
  if (status === 'CANCELLED') return CANCELLED_STEP;
  return BOOKING_STEPS.find((s) => s.status === status) ?? FALLBACK_STEP;
}

export interface BookingAction {
  to: string;
  label: string;
  actor: 'CLIENT' | 'PROVIDER' | 'BOTH';
  /** Plain-language explanation of exactly what this action does. */
  description: string;
  destructive?: boolean;
}

/** Every legal move from a status, with a note explaining the consequence. */
const ACTIONS: Record<string, BookingAction[]> = {
  ACCEPTED: [
    {
      to: 'CONFIRMED',
      label: 'Confirm booking',
      actor: 'BOTH',
      description: 'Both sides agree the job is on. The provider can then start when the time comes.',
    },
    {
      to: 'CANCELLED',
      label: 'Cancel booking',
      actor: 'BOTH',
      destructive: true,
      description: 'Ends the booking before any work starts. It stays on record.',
    },
  ],
  CONFIRMED: [
    {
      to: 'IN_PROGRESS',
      label: 'Start job',
      actor: 'PROVIDER',
      description: 'Tells the client you have begun the work.',
    },
    {
      to: 'CANCELLED',
      label: 'Cancel booking',
      actor: 'BOTH',
      destructive: true,
      description: 'Ends the booking before work begins. It stays on record.',
    },
  ],
  IN_PROGRESS: [
    {
      to: 'COMPLETED',
      label: 'Mark completed',
      actor: 'PROVIDER',
      description: 'Tells the client the job is done and opens their 60-day window to leave a review.',
    },
  ],
};

export function bookingActions(status: string, viewerRole: string): BookingAction[] {
  return (ACTIONS[status] ?? []).filter((a) => a.actor === 'BOTH' || a.actor === viewerRole);
}

const ICON_TONES: Record<BookingTone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  success: 'bg-success-50 text-success-600',
  danger: 'bg-danger-50 text-danger-700',
  neutral: 'bg-ink-100 text-ink-500',
};

/**
 * Vertical progress tracker for the booking lifecycle. Vertical rather than
 * horizontal so the per-step summaries stay readable on a phone without
 * truncation, and so it matches the status-history timeline below it.
 */
export function BookingProgress({
  status,
  history,
  className = '',
}: {
  status: string;
  history?: { toStatus: string }[];
  className?: string;
}) {
  const cancelled = status === 'CANCELLED';
  const currentIndex = BOOKING_STEPS.findIndex((s) => s.status === status);

  // For cancelled bookings the current status is the off-ramp, so derive how
  // far the job actually got from the status history instead.
  const reachedIndex = (() => {
    if (!cancelled) return currentIndex;
    if (!history?.length) return 0;
    return history.reduce((max, h) => {
      const idx = BOOKING_STEPS.findIndex((s) => s.status === h.toStatus);
      return idx > max ? idx : max;
    }, 0);
  })();

  return (
    <Panel
      title="Booking progress"
      description="Follow the job from an agreed price through to completion."
      className={className}
    >
      {cancelled && (
        <div className="alert alert-error mb-5">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          This booking was cancelled before it was completed.
        </div>
      )}

      <ol className="space-y-0">
        {BOOKING_STEPS.map((step, i) => {
          const done = cancelled ? i <= reachedIndex : i < currentIndex;
          const active = !cancelled && i === currentIndex;
          const circleClass = active
            ? 'bg-brand-700 text-white ring-4 ring-brand-100'
            : done
              ? 'bg-brand-50 text-brand-700'
              : 'bg-ink-100 text-ink-400';

          return (
            <li key={step.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circleClass}`}
                  aria-hidden="true"
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < BOOKING_STEPS.length - 1 && (
                  <span className={`my-1 w-px flex-1 ${done ? 'bg-brand-200' : 'bg-ink-200'}`} aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-5">
                <p
                  className={`text-sm font-bold ${
                    active ? 'text-brand-700' : done ? 'text-ink-900' : 'text-ink-400'
                  }`}
                >
                  {step.label}
                  {active && <span className="ml-2 text-2xs font-bold uppercase tracking-wide text-brand-600">Current</span>}
                </p>
                <p className={`mt-0.5 text-xs leading-relaxed ${active ? 'text-ink-600' : 'text-ink-400'}`}>
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

/**
 * Explains the current status and renders the legal next actions, each with a
 * note describing what it does. Keeps the "what does this button mean" answer
 * right next to the button.
 */
export function BookingCurrentStep({
  status,
  viewerRole,
  busy,
  onTransition,
  className = '',
}: {
  status: string;
  viewerRole: string;
  busy: boolean;
  onTransition: (to: string) => void;
  className?: string;
}) {
  const meta = bookingStatusMeta(status);
  const Icon = meta.icon;
  const actions = bookingActions(status, viewerRole);

  return (
    <Panel className={className}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_TONES[meta.tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow-muted">Current step</p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-ink-950">{meta.label}</h2>
          <p className="prose-copy mt-1.5">{meta.description}</p>
          {meta.next && (
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              <span className="font-semibold text-ink-800">What happens next: </span>
              {meta.next}
            </p>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="mt-5 grid gap-3 border-t border-ink-100 pt-5 sm:grid-cols-2">
          {actions.map((a) => (
            <div key={a.to} className="flex flex-col">
              <button
                disabled={busy}
                aria-busy={busy}
                onClick={() => onTransition(a.to)}
                className={a.destructive ? 'btn-secondary' : 'btn-primary'}
              >
                {a.label}
              </button>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{a.description}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
