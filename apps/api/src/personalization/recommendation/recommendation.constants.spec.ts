import { INTERACTION_WEIGHTS, recencyFactor } from './recommendation.constants';

describe('recencyFactor', () => {
  it('is close to full weight today', () => {
    expect(recencyFactor(0)).toBeCloseTo(1, 1);
  });

  it('decays as interactions age, and never reorders old-vs-new', () => {
    const today = recencyFactor(0);
    const oneWeek = recencyFactor(7);
    const oneMonth = recencyFactor(30);
    const threeMonths = recencyFactor(90);
    const sixMonths = recencyFactor(180);

    expect(today).toBeGreaterThan(oneWeek);
    expect(oneWeek).toBeGreaterThan(oneMonth);
    expect(oneMonth).toBeGreaterThan(threeMonths);
    expect(threeMonths).toBeGreaterThan(sixMonths);
  });

  it('never decays to exactly zero — floors at MIN_DECAY_FACTOR', () => {
    expect(recencyFactor(10000)).toBeGreaterThan(0);
  });

  it('roughly matches the spec\'s example checkpoints', () => {
    expect(recencyFactor(7)).toBeGreaterThan(0.8);
    expect(recencyFactor(30)).toBeGreaterThan(0.5);
    expect(recencyFactor(90)).toBeLessThan(0.5);
    expect(recencyFactor(180)).toBeLessThan(0.2);
  });
});

describe('INTERACTION_WEIGHTS', () => {
  it('weights a completed booking more than a mere search', () => {
    expect(INTERACTION_WEIGHTS.COMPLETE_BOOKING).toBeGreaterThan(INTERACTION_WEIGHTS.SEARCH);
  });

  it('weights a booking more than a favorite, and a favorite more than a view', () => {
    expect(INTERACTION_WEIGHTS.CREATE_BOOKING).toBeGreaterThan(INTERACTION_WEIGHTS.FAVORITE_PROVIDER);
    expect(INTERACTION_WEIGHTS.FAVORITE_PROVIDER).toBeGreaterThan(INTERACTION_WEIGHTS.VIEW_PROVIDER);
  });

  it('treats unfavoriting and cancelling as negative signals', () => {
    expect(INTERACTION_WEIGHTS.UNFAVORITE_PROVIDER).toBeLessThan(0);
    expect(INTERACTION_WEIGHTS.CANCEL_BOOKING).toBeLessThan(0);
  });
});
