import { Injectable } from '@nestjs/common';
import { GeocodeResult, MapProvider } from '../map-provider.interface';

// Real implementation used when MAP_PROVIDER=mapbox and MAP_PROVIDER_KEY is
// set. Talks to the Mapbox Geocoding API; callers never know the
// difference from MockMapProvider.
@Injectable()
export class MapboxProvider implements MapProvider {
  private readonly baseUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

  async geocode(query: string): Promise<GeocodeResult[]> {
    const token = process.env.MAP_PROVIDER_KEY;
    const url = `${this.baseUrl}/${encodeURIComponent(query)}.json?access_token=${token}&limit=5`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []).map((f: any) => ({
      label: f.place_name,
      longitude: f.center[0],
      latitude: f.center[1],
      city: f.context?.find((c: any) => c.id.startsWith('place'))?.text,
      country: f.context?.find((c: any) => c.id.startsWith('country'))?.text,
    }));
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    const token = process.env.MAP_PROVIDER_KEY;
    const url = `${this.baseUrl}/${lng},${lat}.json?access_token=${token}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    return {
      label: f.place_name,
      longitude: f.center[0],
      latitude: f.center[1],
      city: f.context?.find((c: any) => c.id.startsWith('place'))?.text,
      country: f.context?.find((c: any) => c.id.startsWith('country'))?.text,
    };
  }
}
