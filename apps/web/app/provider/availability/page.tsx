'use client';

import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { availabilityApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DayRow {
  dayOfWeek: number;
  isActive: boolean;
  startTime: string;
  endTime: string;
}

const DEFAULT_ROWS: DayRow[] = DAYS.map((_, i) => ({
  dayOfWeek: i,
  isActive: false,
  startTime: '09:00',
  endTime: '17:00',
}));

const STATUS_LABEL: Record<'AVAILABLE' | 'BUSY' | 'UNAVAILABLE', string> = {
  AVAILABLE: 'Open for work',
  BUSY: 'Busy',
  UNAVAILABLE: 'Paused',
};

export default function ProviderAvailabilityPage() {
  const [rows, setRows] = useState<DayRow[]>(DEFAULT_ROWS);
  const [baseline, setBaseline] = useState<DayRow[]>(() => DEFAULT_ROWS.map((r) => ({ ...r })));
  const [status, setStatus] = useState<'AVAILABLE' | 'BUSY' | 'UNAVAILABLE'>('AVAILABLE');
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionNote, setExceptionNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = () =>
    availabilityApi
      .mine()
      .then((data) => {
        setStatus(data.status);
        setExceptions(data.exceptions);
        const next = DAYS.map((_, i) => {
          const existing = data.raw.find((r: any) => r.dayOfWeek === i);
          return existing
            ? { dayOfWeek: i, isActive: existing.isActive, startTime: existing.startTime, endTime: existing.endTime }
            : { dayOfWeek: i, isActive: false, startTime: '09:00', endTime: '17:00' };
        });
        setRows(next);
        setBaseline(next);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  // Derived, not stored: any edit to a day row compared to the last
  // thing we loaded or saved is an unsaved change.
  const dirty = rows.some(
    (r, i) =>
      r.isActive !== baseline[i]?.isActive ||
      r.startTime !== baseline[i]?.startTime ||
      r.endTime !== baseline[i]?.endTime,
  );
  const activeDayCount = rows.filter((row) => row.isActive).length;

  function useWeekdayHours() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        isActive: row.dayOfWeek >= 1 && row.dayOfWeek <= 5,
        startTime: '09:00',
        endTime: '17:00',
      })),
    );
  }

  function updateRow(dayOfWeek: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
  }

  async function saveWeekly() {
    setSaving(true);
    setError(null);
    try {
      const days = rows
        .filter((r) => r.isActive)
        .map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, isActive: true }));
      await availabilityApi.setWeekly(days);
      setBaseline(rows);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your schedule');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(next: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') {
    setStatus(next);
    try {
      await availabilityApi.setStatus(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update status');
    }
  }

  async function addException(isAvailable: boolean) {
    if (!exceptionDate) return;
    setError(null);
    try {
      await availabilityApi.addException({ date: exceptionDate, isAvailable, note: exceptionNote || undefined });
      setExceptionDate('');
      setExceptionNote('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that date');
    }
  }

  async function removeException(id: string) {
    try {
      await availabilityApi.removeException(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that date');
    }
  }

  if (loading)
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your schedule…" />
      </main>
    );

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Availability & scheduling"
        description="Set your weekly hours so clients can see when you're free — and block off specific dates for jobs already booked."
      />

      <Panel title="Status" className="mb-6">
        <div
          className="grid grid-cols-3 gap-1 rounded-xl border border-ink-200 bg-ink-100/70 p-1"
          role="group"
          aria-label="Availability status"
        >
          {(['AVAILABLE', 'BUSY', 'UNAVAILABLE'] as const).map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              aria-pressed={status === s}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                status === s ? 'bg-surface text-ink-950 shadow-xs' : 'text-ink-500 hover:text-ink-900'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {status === 'UNAVAILABLE' && (
          <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium text-warning-800">
            While paused, you won&apos;t show as available on any day — even ones marked open below.
          </p>
        )}
      </Panel>

      <Panel
        className="mb-6"
        title="Weekly hours"
        description="Tick the days you work and set the hours clients will see."
        actions={
          dirty ? (
            <span className="badge badge-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning-600" aria-hidden="true" />
              Unsaved changes
            </span>
          ) : savedAt ? (
            <span className="badge badge-success">Saved</span>
          ) : null
        }
      >
        {activeDayCount === 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-50 px-3.5 py-3 text-sm text-warning-800">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              No working days selected yet. Tick at least one day so clients know when to book you.
            </span>
            <button type="button" onClick={useWeekdayHours} className="btn-secondary btn-sm shrink-0">
              Use Mon–Fri, 9–5
            </button>
          </div>
        )}

        <div className="divide-y divide-ink-100 rounded-xl border border-ink-200">
          {rows.map((row) => (
            <div
              key={row.dayOfWeek}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 ${
                row.isActive ? '' : 'opacity-70'
              }`}
            >
              <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-800">
                <input
                  type="checkbox"
                  checked={row.isActive}
                  onChange={(e) => updateRow(row.dayOfWeek, { isActive: e.target.checked })}
                />
                {DAYS[row.dayOfWeek]}
              </label>
              {row.isActive ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { startTime: e.target.value })}
                    aria-label={`${DAYS[row.dayOfWeek]} start time`}
                    className="w-32 rounded-lg px-2 py-1.5 text-sm tabular sm:w-36"
                  />
                  <span className="text-sm text-ink-400" aria-hidden="true">
                    –
                  </span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => updateRow(row.dayOfWeek, { endTime: e.target.value })}
                    aria-label={`${DAYS[row.dayOfWeek]} end time`}
                    className="w-32 rounded-lg px-2 py-1.5 text-sm tabular sm:w-36"
                  />
                </div>
              ) : (
                <span className="flex-1 text-xs font-medium text-ink-400">Unavailable</span>
              )}
            </div>
          ))}
        </div>

        {error && <p className="error-text mt-3">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveWeekly} disabled={saving || !dirty} className="btn-primary">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving…' : 'Save weekly hours'}
          </button>
          {savedAt && !dirty && <p className="text-xs text-success-600">Changes saved.</p>}
        </div>
      </Panel>

      <Panel title="Date overrides" description="Block a specific date (already booked) or open up a day you're normally off — this overrides your weekly hours for that date only.">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="field min-w-0">
            <label htmlFor="override-date" className="label">
              Date
            </label>
            <input
              id="override-date"
              type="date"
              value={exceptionDate}
              onChange={(e) => setExceptionDate(e.target.value)}
              className="w-auto"
            />
          </div>
          <div className="field min-w-0 flex-1">
            <label htmlFor="override-note" className="label">
              Note <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="override-note"
              placeholder="e.g. booked for a wedding"
              value={exceptionNote}
              onChange={(e) => setExceptionNote(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={() => addException(false)}
              disabled={!exceptionDate}
              className="btn-danger btn-sm"
            >
              Block
            </button>
            <button
              onClick={() => addException(true)}
              disabled={!exceptionDate}
              className="btn-secondary btn-sm"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Open
            </button>
          </div>
        </div>

        {exceptions.length === 0 ? (
          <p className="text-sm text-ink-500">No upcoming overrides.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {exceptions.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-sm">
                  <span className="font-semibold tabular text-ink-900">
                    {new Date(e.date).toLocaleDateString()}
                  </span>
                  <span
                    className={`badge ${e.isAvailable ? 'badge-success' : 'badge-danger'}`}
                  >
                    {e.isAvailable ? 'Open' : 'Blocked'}
                  </span>
                  {e.note && <span className="text-xs text-ink-500">{e.note}</span>}
                </span>
                <button
                  onClick={() => removeException(e.id)}
                  className="icon-btn h-8 w-8"
                  aria-label={`Remove override for ${new Date(e.date).toLocaleDateString()}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}