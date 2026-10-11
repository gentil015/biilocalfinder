import { coversPoint, haversineKm } from './geo';

describe('haversineKm', () => {
  it('returns 0 for the same point', () => {
    expect(haversineKm(-1.9441, 30.0619, -1.9441, 30.0619)).toBeCloseTo(0, 5);
  });

  it('roughly matches the known Kigali-to-Musanze distance (~65km)', () => {
    const km = haversineKm(-1.9441, 30.0619, -1.4990, 29.6339);
    expect(km).toBeGreaterThan(55);
    expect(km).toBeLessThan(75);
  });
});

describe('coversPoint', () => {
  const areas = [{ latitude: -1.9441, longitude: 30.0619, radiusKm: 10 }];

  it('is true for a point inside the circle', () => {
    expect(coversPoint(areas, { lat: -1.95, lng: 30.06 })).toBe(true);
  });

  it('is false for a point well outside every circle', () => {
    expect(coversPoint(areas, { lat: -1.4990, lng: 29.6339 })).toBe(false);
  });

  it('is false with no coverage areas at all', () => {
    expect(coversPoint([], { lat: -1.9441, lng: 30.0619 })).toBe(false);
  });
});
