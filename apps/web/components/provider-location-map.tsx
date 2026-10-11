'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

export function ProviderLocationMap({
  latitude,
  longitude,
  serviceAreas = [],
  height = 260,
}: {
  latitude: number;
  longitude: number;
  serviceAreas?: { latitude: number; longitude: number; radiusKm: number; label?: string }[];
  height?: number;
}) {
  return (
    <LeafletMap
      center={{ lat: latitude, lng: longitude }}
      circles={serviceAreas.map((a) => ({ lat: a.latitude, lng: a.longitude, radiusKm: a.radiusKm }))}
      zoom={11}
      height={height}
    />
  );
}
