import { BookingStateMachine } from './booking-state-machine';

describe('BookingStateMachine', () => {
  const sm = new BookingStateMachine();

  it('allows the happy path: ACCEPTED -> CONFIRMED -> IN_PROGRESS -> COMPLETED', () => {
    expect(sm.canTransition('ACCEPTED', 'CONFIRMED')).toBe(true);
    expect(sm.canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(sm.canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('rejects skipping states', () => {
    expect(sm.canTransition('ACCEPTED', 'IN_PROGRESS')).toBe(false);
    expect(sm.canTransition('ACCEPTED', 'COMPLETED')).toBe(false);
  });

  it('rejects transitions out of terminal states', () => {
    expect(sm.canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(sm.canTransition('CANCELLED', 'ACCEPTED')).toBe(false);
  });

  it('only lets a provider start or complete work', () => {
    expect(sm.actorAllowed('CONFIRMED', 'IN_PROGRESS', 'PROVIDER')).toBe(true);
    expect(sm.actorAllowed('CONFIRMED', 'IN_PROGRESS', 'CLIENT')).toBe(false);
    expect(sm.actorAllowed('IN_PROGRESS', 'COMPLETED', 'CLIENT')).toBe(false);
  });

  it('lets either party cancel before work starts', () => {
    expect(sm.actorAllowed('ACCEPTED', 'CANCELLED', 'CLIENT')).toBe(true);
    expect(sm.actorAllowed('ACCEPTED', 'CANCELLED', 'PROVIDER')).toBe(true);
  });

  it('does not allow cancelling in-progress or completed bookings', () => {
    expect(sm.canTransition('IN_PROGRESS', 'CANCELLED')).toBe(false);
    expect(sm.canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });
});
