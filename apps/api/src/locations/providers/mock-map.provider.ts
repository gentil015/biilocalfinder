import { Injectable } from '@nestjs/common';
import { GeocodeResult, MapProvider } from '../map-provider.interface';

// Default provider when no MAP_PROVIDER_KEY is configured — lets the app
// run end-to-end in development without an external API key. Swap for
// MapboxProvider/GoogleMapsProvider (same interface) once a key is set.
@Injectable()
export class MockMapProvider implements MapProvider {
  private readonly knownPlaces: GeocodeResult[] = [
    { label: 'Kigali, Rwanda', latitude: -1.9441, longitude: 30.0619, city: 'Kigali', country: 'Rwanda' },
    { label: 'Rubavu, Rwanda', latitude: -1.6791, longitude: 29.2664, city: 'Rubavu', country: 'Rwanda' },
    { label: 'Musanze, Rwanda', latitude: -1.4995, longitude: 29.6335, city: 'Musanze', country: 'Rwanda' },
    { label: 'Huye, Rwanda', latitude: -2.5967, longitude: 29.7392, city: 'Huye', country: 'Rwanda' },
  ];

  async geocode(query: string): Promise<GeocodeResult[]> {
    const q = query.trim().toLowerCase();
    return this.knownPlaces.filter((p) => p.label.toLowerCase().includes(q));
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    let closest: GeocodeResult | null = null;
    let closestDist = Infinity;
    for (const p of this.knownPlaces) {
      const d = Math.hypot(p.latitude - lat, p.longitude - lng);
      if (d < closestDist) {
        closestDist = d;
        closest = p;
      }
    }
    return closest;
  }
}
