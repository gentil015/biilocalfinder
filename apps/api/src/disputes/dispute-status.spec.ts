import { canTransition, isOpenForActivity } from './dispute-status';

describe('canTransition', () => {
  it('lets a respondent reply move OPEN to RESPONDED', () => {
    expect(canTransition('OPEN', 'RESPONDED')).toBe(true);
  });

  it('lets an admin pull either OPEN or RESPONDED into review', () => {
    expect(canTransition('OPEN', 'UNDER_REVIEW')).toBe(true);
    expect(canTransition('RESPONDED', 'UNDER_REVIEW')).toBe(true);
  });

  it('only allows resolving from UNDER_REVIEW', () => {
    expect(canTransition('UNDER_REVIEW', 'RESOLVED')).toBe(true);
    expect(canTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(canTransition('OPEN', 'RESOLVED')).toBe(false);
    expect(canTransition('RESPONDED', 'RESOLVED')).toBe(false);
  });

  it('treats RESOLVED and REJECTED as terminal', () => {
    expect(canTransition('RESOLVED', 'UNDER_REVIEW')).toBe(false);
    expect(canTransition('REJECTED', 'UNDER_REVIEW')).toBe(false);
  });
});

describe('isOpenForActivity', () => {
  it('allows messages/evidence up through UNDER_REVIEW', () => {
    expect(isOpenForActivity('OPEN')).toBe(true);
    expect(isOpenForActivity('RESPONDED')).toBe(true);
    expect(isOpenForActivity('UNDER_REVIEW')).toBe(true);
  });

  it('locks a resolved or rejected dispute', () => {
    expect(isOpenForActivity('RESOLVED')).toBe(false);
    expect(isOpenForActivity('REJECTED')).toBe(false);
  });
});
