'use client';

import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), { ssr: false });

// Used for a provider's own business location (a single point), as
// distinct from ServiceAreaEditorMap which edits a coverage radius.
export function LocationPickerMap({
  center,
  onCenterChange,
  height = 260,
}: {
  center: { lat: number; lng: number };
  onCenterChange: (pos: { lat: number; lng: number }) => void;
  height?: number;
}) {
  return (
    <LeafletMap
      center={center}
      draggableCenter
      onCenterChange={onCenterChange}
      onMapClick={onCenterChange}
      zoom={13}
      height={height}
    />
  );
}
