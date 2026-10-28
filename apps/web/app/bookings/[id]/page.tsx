'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Flag, Info, Star, Wallet } from 'lucide-react';
import { bookingsApi, reviewsApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { ReviewForm } from '@/components/review-form';
import { WorkspaceAssignment } from '@/components/workspace-assignment';
import { EmptyState, Panel, Skeleton } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';
import {
  BookingCurrentStep,
  BookingProgress,
  bookingStatusLabel,
} from '@/components/booking-flow';

/** A booking is an agreement, so the price and the payment arrangement sit at
 *  the top — that is the first thing either party opens this page to check. */
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewInfo, setReviewInfo] = useState<{ review: any; canReview: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const b = await bookingsApi.getOne(id);
      setBooking(b);
      if (b.status === 'COMPLETED') {
        reviewsApi
          .forBooking(id)
          .then(setReviewInfo)
          .catch(() => setReviewInfo(null));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this booking');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function transition(to: string) {
    setBusy(true);
    setError(null);
    try {
      await bookingsApi.updateStatus(id, to);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update booking');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-8">
        <Skeleton className="h-7 w-64" />
        <Panel className="mt-8 p-6">
          <Skeleton className="h-24 w-full" />
        </Panel>
        <Panel className="mt-5 p-6">
          <Skeleton className="h-32 w-full" />
        </Panel>
      </main>
    );
  }

  if (error && !booking) {
    return (
      <main className="page-narrow py-8">
        <EmptyState
          icon={AlertCircle}
          title="We couldn't load this booking"
          body={error}
          action={
            <Link href="/bookings" className="btn-secondary btn-sm">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to bookings
            </Link>
          }
        />
      </main>
    );
  }

  const counterpart =
    booking.viewerRole === 'CLIENT'
      ? booking.provider?.businessName
      : `${booking.client?.user?.firstName ?? ''} ${booking.client?.user?.lastName ?? ''}`.trim();

  return (
    <main className="page-narrow py-8">
      <BackButton variant="link" label="All bookings" fallbackHref="/bookings" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">
            {booking.serviceRequest?.title ?? booking.serviceRequest?.service?.name}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-500">{counterpart}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <BookingProgress
        status={booking.status}
        history={booking.statusHistory}
        className="mt-6"
      />

      <Panel className="mt-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow-muted">Agreed price</p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular tracking-tight text-ink-950">
              {Number(booking.agreedPrice).toLocaleString()}
              <span className="ml-1.5 text-sm font-bold text-ink-400">{booking.currency}</span>
            </p>
          </div>
        </div>

        {booking.paymentArrangementNote && (
          <div className="alert alert-info mt-5">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            {booking.paymentArrangementNote}
          </div>
        )}
      </Panel>

      {booking.viewerRole === 'PROVIDER' && (
        <WorkspaceAssignment
          resource="booking"
          resourceId={booking.id}
          providerId={booking.providerId}
          assignedMembershipId={booking.assignedMembershipId}
          assignedMembership={booking.assignedMembership}
          onAssigned={load}
        />
      )}

      {error && (
        <div className="alert alert-error mt-5" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Where the booking stands right now, and what each legal next action
          does. The note under every button answers "what will this do?". */}
      <BookingCurrentStep
        status={booking.status}
        viewerRole={booking.viewerRole}
        busy={busy}
        onTransition={transition}
        className="mt-5"
      />

      {booking.status === 'COMPLETED' && booking.viewerRole === 'CLIENT' && reviewInfo?.canReview && (
        <div className="mt-6">
          <ReviewForm
            bookingId={id}
            onSubmitted={() => reviewsApi.forBooking(id).then(setReviewInfo)}
          />
        </div>
      )}

      {reviewInfo?.review && (
        <Panel title="Your review" className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-sm font-bold text-ink-900">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <Star className="h-4 w-4 fill-rating-400 text-rating-400" />
              </span>
              <span className="tabular">{reviewInfo.review.rating}</span>
              <span className="sr-only">out of 5</span>
            </span>
            {reviewInfo.review.verifiedBooking && (
              <span className="badge badge-success gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Verified booking
              </span>
            )}
          </div>

          {reviewInfo.review.comment && (
            <p className="prose-copy mt-3 whitespace-pre-line">{reviewInfo.review.comment}</p>
          )}

          {reviewInfo.review.providerResponse && (
            <div className="mt-4 rounded-lg bg-ink-50 p-4">
              <p className="eyebrow-muted mb-1.5">Provider response</p>
              <p className="prose-copy">{reviewInfo.review.providerResponse.text}</p>
            </div>
          )}
        </Panel>
      )}

      {booking.statusHistory?.length > 0 && (
        <Panel title="Status history" className="mt-6">
          <ol className="space-y-0">
            {booking.statusHistory.map((h: any, i: number) => (
              <li key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  {i < booking.statusHistory.length - 1 && (
                    <span className="my-1 w-px flex-1 bg-ink-200" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-4">
                  <p className="min-w-0 text-sm text-ink-700">
                    {h.fromStatus
                      ? `Moved from “${bookingStatusLabel(h.fromStatus)}” to “${bookingStatusLabel(h.toStatus)}”`
                      : bookingStatusLabel(h.toStatus)}
                    {h.note && <span className="text-ink-500"> — {h.note}</span>}
                  </p>
                  <p className="shrink-0 text-xs text-ink-400">
                    <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleDateString()}</time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {!['REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(booking.status) && (
        <div className="mt-8 border-t border-ink-200 pt-6">
          <p className="text-xs leading-relaxed text-ink-500">
            Something not right about the work, the price or the conduct? A dispute opens a
            structured conversation that our team can review. The platform never moves money.
          </p>
          <Link
            href={`/disputes/new?bookingId=${id}`}
            className="text-link mt-3 inline-flex items-center gap-1.5 text-xs"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            Report a problem with this booking
          </Link>
        </div>
      )}
    </main>
  );
}
