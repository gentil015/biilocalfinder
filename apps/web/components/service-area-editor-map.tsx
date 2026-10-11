'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

export function ServiceAreaEditorMap({
  center,
  radiusKm,
  onCenterChange,
  height = 300,
}: {
  center: { lat: number; lng: number };
  radiusKm: number;
  onCenterChange: (pos: { lat: number; lng: number }) => void;
  height?: number;
}) {
  return (
    <LeafletMap
      center={center}
      circles={[{ lat: center.lat, lng: center.lng, radiusKm }]}
      draggableCenter
      onCenterChange={onCenterChange}
      onMapClick={onCenterChange}
      zoom={11}
      height={height}
    />
  );
}
