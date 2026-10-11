// Pure day-by-day availability logic — no DB, so the "available
// today/tomorrow/next available" rules are unit-tested without a database
// and can't drift between the public summary and the provider's own view.

export interface WeeklySlot {
  dayOfWeek: number; // 0=Sunday .. 6=Saturday
  startTime: string; // "09:00"
  endTime: string;
  isActive: boolean;
}

export interface DateException {
  date: Date; // midnight, local-date semantics
  isAvailable: boolean;
  note?: string | null;
}

export interface AvailabilitySummary {
  // Provider explicitly paused (e.g. on leave) — overrides everything else.
  paused: boolean;
  availableToday: boolean;
  availableTomorrow: boolean;
  // Best-effort search horizon; null means nothing found within it.
  nextAvailableDate: string | null; // YYYY-MM-DD
  nextAvailableLabel: string; // "Today" | "Tomorrow" | "Friday" | "Oct 3" | "Not currently available"
  todayHours: { startTime: string; endTime: string } | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const AVAILABILITY_SEARCH_HORIZON_DAYS = 14;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Is the provider open on this specific calendar date? An exception (if any)
// always wins over the weekly pattern.
export function isAvailableOnDate(
  date: Date,
  weekly: WeeklySlot[],
  exceptions: DateException[],
): { available: boolean; hours: { startTime: string; endTime: string } | null } {
  const key = toDateKey(date);
  const exception = exceptions.find((e) => toDateKey(e.date) === key);
  if (exception) {
    return { available: exception.isAvailable, hours: null };
  }
  const slot = weekly.find((s) => s.dayOfWeek === date.getDay() && s.isActive);
  return { available: !!slot, hours: slot ? { startTime: slot.startTime, endTime: slot.endTime } : null };
}

export function computeAvailabilitySummary(
  weekly: WeeklySlot[],
  exceptions: DateException[],
  opts: { paused: boolean; now?: Date; horizonDays?: number },
): AvailabilitySummary {
  const now = startOfDay(opts.now ?? new Date());
  const horizon = opts.horizonDays ?? AVAILABILITY_SEARCH_HORIZON_DAYS;

  if (opts.paused) {
    return {
      paused: true,
      availableToday: false,
      availableTomorrow: false,
      nextAvailableDate: null,
      nextAvailableLabel: 'Not currently available',
      todayHours: null,
    };
  }

  const today = isAvailableOnDate(now, weekly, exceptions);
  const tomorrow = isAvailableOnDate(new Date(now.getTime() + 86400000), weekly, exceptions);

  let nextAvailableDate: Date | null = null;
  for (let i = 0; i < horizon; i++) {
    const candidate = new Date(now.getTime() + i * 86400000);
    if (isAvailableOnDate(candidate, weekly, exceptions).available) {
      nextAvailableDate = candidate;
      break;
    }
  }

  let nextAvailableLabel = 'Not currently available';
  if (nextAvailableDate) {
    const diffDays = Math.round((nextAvailableDate.getTime() - now.getTime()) / 86400000);
    if (diffDays === 0) nextAvailableLabel = 'Today';
    else if (diffDays === 1) nextAvailableLabel = 'Tomorrow';
    else if (diffDays < 7) nextAvailableLabel = DAY_NAMES[nextAvailableDate.getDay()];
    else nextAvailableLabel = nextAvailableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return {
    paused: false,
    availableToday: today.available,
    availableTomorrow: tomorrow.available,
    nextAvailableDate: nextAvailableDate ? toDateKey(nextAvailableDate) : null,
    nextAvailableLabel,
    todayHours: today.available ? today.hours : null,
  };
}

// Display-friendly weekly schedule, Sunday..Saturday, for a provider's
// profile/settings page — always 7 rows, "Unavailable" filled in for
// missing/inactive days rather than the UI having to handle gaps.
export function toWeeklyDisplay(weekly: WeeklySlot[]): { day: string; dayOfWeek: number; hours: string }[] {
  return DAY_NAMES.map((day, dayOfWeek) => {
    const slot = weekly.find((s) => s.dayOfWeek === dayOfWeek && s.isActive);
    return { day, dayOfWeek, hours: slot ? `${slot.startTime}–${slot.endTime}` : 'Unavailable' };
  });
}
