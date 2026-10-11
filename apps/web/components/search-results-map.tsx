'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

export interface MapProvider {
  id: string;
  businessName: string;
  latitude: number | null;
  longitude: number | null;
}

export function SearchResultsMap({
  providers,
  userLocation,
  height = 420,
}: {
  providers: MapProvider[];
  userLocation?: { lat: number; lng: number } | null;
  height?: number | string;
}) {
  const router = useRouter();
  const markers = providers
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      id: p.id,
      lat: p.latitude as number,
      lng: p.longitude as number,
      label: p.businessName,
      onClick: () => router.push(`/providers/${p.id}`),
    }));

  if (markers.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-2xl border border-ink-100 bg-ink-50 text-sm text-ink-400">
        None of these results have a pinned location yet.
      </div>
    );
  }

  return <LeafletMap markers={markers} userMarker={userLocation ?? undefined} height={height} />;
}
