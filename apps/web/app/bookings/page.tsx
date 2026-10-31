'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, AlertCircle } from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { bookingStatusMeta } from '@/components/booking-flow';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

function counterpart(b: any): string {
  const providerName = b.provider?.businessName;
  const clientName = `${b.client?.user?.firstName ?? ''} ${b.client?.user?.lastName ?? ''}`.trim();
  return providerName || clientName || 'Booking';
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try both — the failing one 403s harmlessly depending on the viewer's role.
    Promise.allSettled([bookingsApi.mineAsClient(), bookingsApi.mineAsProvider()])
      .then(([clientRes, providerRes]) => {
        const items = [
          ...(clientRes.status === 'fulfilled' ? clientRes.value : []),
          ...(providerRes.status === 'fulfilled' ? providerRes.value : []),
        ];
        setBookings(items);
        if (clientRes.status === 'rejected' && providerRes.status === 'rejected') {
          setError('Unable to load your bookings');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Schedule"
        title="Your bookings"
        description="Every job you've agreed — as a client or a provider. Open one to see its stage and exactly what happens next."
      />

      {loading && <LoadingBlock label="Loading your bookings…" />}

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && bookings.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          title="No bookings yet"
          body="Once you accept a quote, the booking appears here with its status and agreed price."
        />
      )}

      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id}>
            <Link
              href={`/bookings/${b.id}`}
              className="surface-card-interactive group flex items-center justify-between gap-4 p-4 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-ink-950 group-hover:text-brand-700">
                  {b.serviceRequest?.title ?? b.serviceRequest?.service?.name}
                </h3>
                <p className="mt-1 truncate text-sm text-ink-500">{counterpart(b)}</p>
                {b.scheduledAt && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink-500">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    Scheduled{' '}
                    {new Date(b.scheduledAt).toLocaleDateString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                )}
                <p className="mt-1 text-xs leading-relaxed text-ink-400">
                  {bookingStatusMeta(b.status).summary}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={b.status} />
                <p className="text-sm font-bold tabular text-ink-700">
                  {Number(b.agreedPrice).toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-ink-400">{b.currency}</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
