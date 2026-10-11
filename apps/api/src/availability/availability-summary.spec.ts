import { computeAvailabilitySummary, isAvailableOnDate, toWeeklyDisplay, WeeklySlot } from './availability-summary';

const MONDAY = new Date('2026-09-21T10:00:00'); // a Monday

const weekdaysNineToFive: WeeklySlot[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '17:00',
  isActive: true,
}));

describe('computeAvailabilitySummary', () => {
  it('is available today and tomorrow on a normal weekday', () => {
    const summary = computeAvailabilitySummary(weekdaysNineToFive, [], { paused: false, now: MONDAY });
    expect(summary.availableToday).toBe(true);
    expect(summary.availableTomorrow).toBe(true);
    expect(summary.nextAvailableLabel).toBe('Today');
    expect(summary.todayHours).toEqual({ startTime: '09:00', endTime: '17:00' });
  });

  it('is available today on a Friday, since today itself is open', () => {
    const friday = new Date('2026-09-25T10:00:00');
    const summary = computeAvailabilitySummary(weekdaysNineToFive, [], { paused: false, now: friday });
    expect(summary.availableToday).toBe(true);
    expect(summary.availableTomorrow).toBe(false); // Saturday
    expect(summary.nextAvailableLabel).toBe('Today');
  });

  it('finds the next available weekday across a weekend when today is closed', () => {
    const saturday = new Date('2026-09-26T10:00:00');
    const summary = computeAvailabilitySummary(weekdaysNineToFive, [], { paused: false, now: saturday });
    expect(summary.availableToday).toBe(false);
    expect(summary.availableTomorrow).toBe(false); // Sunday
    // next available after Saturday is the following Monday
    expect(summary.nextAvailableLabel).toBe('Monday');
  });

  it('a paused provider is never available, regardless of schedule', () => {
    const summary = computeAvailabilitySummary(weekdaysNineToFive, [], { paused: true, now: MONDAY });
    expect(summary.availableToday).toBe(false);
    expect(summary.nextAvailableDate).toBeNull();
    expect(summary.nextAvailableLabel).toBe('Not currently available');
  });

  it('a blocking exception overrides an otherwise-open weekday', () => {
    const summary = computeAvailabilitySummary(
      weekdaysNineToFive,
      [{ date: MONDAY, isAvailable: false, note: 'Fully booked' }],
      { paused: false, now: MONDAY },
    );
    expect(summary.availableToday).toBe(false);
    expect(summary.nextAvailableLabel).toBe('Tomorrow');
  });

  it('an opening exception makes an otherwise-closed day available', () => {
    const sunday = new Date('2026-09-20T10:00:00');
    const summary = computeAvailabilitySummary(weekdaysNineToFive, [{ date: sunday, isAvailable: true }], {
      paused: false,
      now: sunday,
    });
    expect(summary.availableToday).toBe(true);
  });

  it('reports no next-available date when nothing is open within the horizon', () => {
    const summary = computeAvailabilitySummary([], [], { paused: false, now: MONDAY, horizonDays: 5 });
    expect(summary.nextAvailableDate).toBeNull();
    expect(summary.nextAvailableLabel).toBe('Not currently available');
  });
});

describe('isAvailableOnDate', () => {
  it('falls back to the weekly pattern when there is no exception', () => {
    const result = isAvailableOnDate(MONDAY, weekdaysNineToFive, []);
    expect(result.available).toBe(true);
    expect(result.hours).toEqual({ startTime: '09:00', endTime: '17:00' });
  });
});

describe('toWeeklyDisplay', () => {
  it('always returns 7 rows with Unavailable filled in for missing days', () => {
    const display = toWeeklyDisplay(weekdaysNineToFive);
    expect(display).toHaveLength(7);
    expect(display.find((d) => d.day === 'Wednesday')?.hours).toBe('09:00–17:00');
    expect(display.find((d) => d.day === 'Saturday')?.hours).toBe('Unavailable');
  });
});
