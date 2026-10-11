// Haversine great-circle distance in km. Used where a distance/coverage
// check is needed against data already loaded in JS (e.g. a single
// provider's profile) — PostgresProviderSearchService uses PostGIS
// ST_Distance/ST_DWithin instead for the same calculation at query time,
// since search runs across many rows and shouldn't pull raw coordinates
// into the app just to loop over them.
const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export interface CoverageArea {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

// "Serves your area" (spec §12) — true only when the point falls inside a
// coverage circle the provider explicitly drew, not merely "somewhat
// close to their home base". Mirrors the servesArea semantics in
// PostgresProviderSearchService so a provider's own profile page and
// search results never disagree about what "serves your area" means.
export function coversPoint(areas: CoverageArea[], point: { lat: number; lng: number }): boolean {
  return areas.some((area) => haversineKm(area.latitude, area.longitude, point.lat, point.lng) <= area.radiusKm);
}
