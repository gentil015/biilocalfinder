// Signals that separate a genuine "verified booking" review from one that
// merely came through the booking flow.
//
// Every review already requires a COMPLETED booking. But because a provider
// can move their own booking to COMPLETED, "a booking exists" alone is a weak
// signal — a provider could create a second (client) account and review
// themselves. So the strong badge additionally needs a reviewer whose email
// or phone was verified by a one-time code, and a few softer patterns are
// recorded as admin-only flags for the moderation queue.
export type IntegrityFlag = 'NEW_ACCOUNT' | 'UNVERIFIED_CONTACT' | 'FAST_COMPLETION';

export const NEW_ACCOUNT_DAYS = 7;
export const FAST_COMPLETION_MINUTES = 60;
export const REVIEW_WINDOW_DAYS = 60;

export interface ReviewAssessmentInput {
  bookingCompleted: boolean;
  reviewerCreatedAt: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
  bookingCreatedAt: Date;
  bookingCompletedAt: Date | null;
  now: Date;
}

export interface ReviewAssessment {
  verifiedBooking: boolean;
  flags: IntegrityFlag[];
}

const DAY = 24 * 60 * 60 * 1000;

export function assessReview(input: ReviewAssessmentInput): ReviewAssessment {
  const flags: IntegrityFlag[] = [];
  const contactVerified = input.emailVerified || input.phoneVerified;

  if (!contactVerified) flags.push('UNVERIFIED_CONTACT');
  if (input.now.getTime() - input.reviewerCreatedAt.getTime() < NEW_ACCOUNT_DAYS * DAY) flags.push('NEW_ACCOUNT');
  if (
    input.bookingCompletedAt &&
    input.bookingCompletedAt.getTime() - input.bookingCreatedAt.getTime() < FAST_COMPLETION_MINUTES * 60 * 1000
  ) {
    flags.push('FAST_COMPLETION');
  }

  return { verifiedBooking: input.bookingCompleted && contactVerified, flags };
}

// Last day a client may still review a completed booking.
export function reviewDeadline(completedAt: Date): Date {
  return new Date(completedAt.getTime() + REVIEW_WINDOW_DAYS * DAY);
}

export function reviewerDisplayName(firstName?: string | null, lastName?: string | null): string {
  const first = (firstName ?? '').trim();
  const initial = (lastName ?? '').trim().charAt(0);
  if (!first && !initial) return 'Client';
  return initial ? `${first} ${initial.toUpperCase()}.`.trim() : first;
}
