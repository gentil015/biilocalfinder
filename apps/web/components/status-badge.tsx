'use client';

import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';

/**
 * One status → one visual tone, for the whole product.
 *
 * The lifecycle is grouped by *meaning*, not by enum order: anything that
 * means "action needed" is amber, anything that means "done and good" is
 * green, anything terminal-and-negative is red, and quiet/closed states are
 * neutral so they recede. Bookings that are locked in read as brand because
 * they are the active, in-progress state — not "pending".
 */
const STYLES: Record<string, string> = {
  // New, awaiting a first response.
  OPEN: 'bg-info-50 text-info-700',
  // A quote is on the table and the ball is in the other court.
  QUOTED: 'bg-warning-50 text-warning-700',
  NEGOTIATING: 'bg-warning-50 text-warning-700',
  PENDING: 'bg-warning-50 text-warning-700',
  // Committed and active.
  ACCEPTED: 'bg-brand-50 text-brand-700',
  BOOKED: 'bg-brand-50 text-brand-700',
  CONFIRMED: 'bg-brand-50 text-brand-700',
  IN_PROGRESS: 'bg-brand-700 text-white dark:text-home-night',
  // Finished successfully.
  COMPLETED: 'bg-success-50 text-success-700',
  // Terminal negatives.
  CANCELLED: 'bg-danger-50 text-danger-700',
  FAILED: 'bg-danger-50 text-danger-700',
  REJECTED: 'bg-danger-50 text-danger-700',
  DISPUTED: 'bg-danger-50 text-danger-700',
  // Quiet / historical.
  EXPIRED: 'bg-ink-100 text-ink-500',
  SUPERSEDED: 'bg-ink-100 text-ink-500',
  DRAFT: 'bg-ink-100 text-ink-500',
  ARCHIVED: 'bg-ink-100 text-ink-500',
  // Admin review states.
  APPROVED: 'bg-success-50 text-success-700',
  FLAGGED: 'bg-danger-50 text-danger-700',
  // Moderation queues (verification, dispute, report). These live in tables
  // where a dozen rows share the screen, so they can't fall through to the
  // neutral default — a "verified" row that reads grey reads as unreviewed.
  UNVERIFIED: 'bg-ink-100 text-ink-500',
  VERIFIED: 'bg-success-50 text-success-700',
  SUSPENDED: 'bg-danger-50 text-danger-700',
  RESPONDED: 'bg-info-50 text-info-700',
  UNDER_REVIEW: 'bg-brand-50 text-brand-700',
  DISMISSED: 'bg-ink-100 text-ink-500',
  // Workspace membership / subscription lifecycle.
  ACTIVE: 'bg-success-50 text-success-700',
  INVITED: 'bg-warning-50 text-warning-700',
  REMOVED: 'bg-ink-100 text-ink-500',
  PAST_DUE: 'bg-danger-50 text-danger-700',
  TRIALING: 'bg-info-50 text-info-700',
};

// Enum → catalog key. Statuses share a meaning across models, so one label
// map serves requests, bookings, verifications, disputes and reports.
const LABELS: Record<string, MessageKey> = {
  OPEN: 'status.open',
  QUOTED: 'status.quoted',
  NEGOTIATING: 'status.negotiating',
  PENDING: 'status.pending',
  ACCEPTED: 'status.accepted',
  BOOKED: 'status.booked',
  CONFIRMED: 'status.confirmed',
  IN_PROGRESS: 'status.inProgress',
  COMPLETED: 'status.completed',
  CANCELLED: 'status.cancelled',
  REJECTED: 'status.rejected',
  DISPUTED: 'status.disputed',
  EXPIRED: 'status.expired',
  SUPERSEDED: 'status.superseded',
  DRAFT: 'status.draft',
  ARCHIVED: 'status.archived',
  APPROVED: 'status.approved',
  FLAGGED: 'status.flagged',
  UNVERIFIED: 'status.unverified',
  VERIFIED: 'status.verified',
  SUSPENDED: 'status.suspended',
  RESPONDED: 'status.responded',
  UNDER_REVIEW: 'status.underReview',
  DISMISSED: 'status.dismissed',
  ACTIVE: 'status.active',
  INVITED: 'status.invited',
  REMOVED: 'status.removed',
  PAST_DUE: 'status.pastDue',
  TRIALING: 'status.trialing',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const style = STYLES[status] ?? 'bg-ink-100 text-ink-600';
  const labelKey = LABELS[status];
  const label = labelKey ? t(labelKey) : status.replace(/_/g, ' ').toLowerCase();
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}
