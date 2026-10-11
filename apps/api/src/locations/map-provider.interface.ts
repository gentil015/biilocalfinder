// Defined here rather than in locations.module.ts: the controller injects this
// token, and importing it back from the module file creates a circular import
// that leaves the token undefined at decoration time.
export const MAP_PROVIDER = 'MAP_PROVIDER';

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

// Business logic never talks to Mapbox/Google directly — only through this
// interface, so the provider can be swapped via MAP_PROVIDER without
// touching callers (spec §"Maps": "Do not tightly couple business logic
// to the map provider.").
export interface MapProvider {
  geocode(query: string): Promise<GeocodeResult[]>;
  reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null>;
}
