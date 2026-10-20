'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/components/theme-provider';

// Leaflet's default marker icon references image files via relative URLs
// that don't resolve correctly through a bundler — this is the standard
// workaround (point them at a CDN instead of trying to bundle the PNGs).
const DEFAULT_ICON = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  onClick?: () => void;
}

export interface MapCircle {
  lat: number;
  lng: number;
  radiusKm: number;
  color?: string;
}

export function LeafletMap({
  markers = [],
  circles = [],
  center,
  zoom = 12,
  height = 320,
  draggableCenter = false,
  onCenterChange,
  onMapClick,
  userMarker,
}: {
  markers?: MapMarker[];
  circles?: MapCircle[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number | string;
  // When true, `center` renders as a draggable pin (service-area editor).
  draggableCenter?: boolean;
  onCenterChange?: (pos: { lat: number; lng: number }) => void;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
  userMarker?: { lat: number; lng: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const { resolvedTheme } = useTheme();

  // Map instance: created once, torn down on unmount.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const fallback = { lat: -1.9441, lng: 30.0619 }; // Kigali — sane default if nothing else is known
    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [center?.lat ?? fallback.lat, center?.lng ?? fallback.lng],
      zoom,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (onMapClick) {
      map.on('click', (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }

    return () => {
      // A zoom animation can outlive this component. Leaflet finishes it from
      // a 250ms fallback timer plus a `transitionend` listener, and both run
      // `_onZoomTransitionEnd` → `_move` → `_getMapPanePos`, which reads
      // `_mapPane` — and `map.remove()` deletes it. That is the
      // "Cannot read properties of undefined (reading '_leaflet_pos')" crash.
      // Every one of those paths bails out when `_animatingZoom` is false, so
      // clear the flag before tearing the map down.
      (map as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw markers/circles/center whenever the data — or the theme — changes.
  // Service-area strokes and the "your location" dot are brand greens tuned
  // per theme: the light values (#166534/#15803D) sink into the hue-rotated
  // dark tiles, and the darker values glare on the light tiles. In dark they
  // are the light-green accent family (#86EFAC/#BBF7D0) so the map reads
  // as part of the deep-forest theme, not a neon overlay. The map itself
  // (tiles, control chrome) follows the theme via CSS in globals.css.
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const stroke = resolvedTheme === 'dark' ? '#86EFAC' : '#166534';
    const dot = resolvedTheme === 'dark' ? '#BBF7D0' : '#15803D';

    for (const c of circles) {
      L.circle([c.lat, c.lng], { radius: c.radiusKm * 1000, color: c.color ?? stroke, fillOpacity: 0.08 }).addTo(group);
    }

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: DEFAULT_ICON }).addTo(group);
      if (m.label) marker.bindTooltip(m.label);
      if (m.onClick) marker.on('click', m.onClick);
    }

    if (userMarker) {
      L.circleMarker([userMarker.lat, userMarker.lng], {
        radius: 8,
        color: dot,
        fillColor: dot,
        fillOpacity: 0.9,
      })
        .bindTooltip('Your location')
        .addTo(group);
    }

    if (center) {
      const centerMarker = L.marker([center.lat, center.lng], { icon: DEFAULT_ICON, draggable: draggableCenter }).addTo(group);
      if (draggableCenter && onCenterChange) {
        centerMarker.on('dragend', () => {
          const pos = centerMarker.getLatLng();
          onCenterChange({ lat: pos.lat, lng: pos.lng });
        });
      }
    }

    // Fit bounds when there's more than one point to show, otherwise just
    // recenter on whatever the single point of interest is.
    const points: [number, number][] = [
      ...markers.map((m): [number, number] => [m.lat, m.lng]),
      ...(center ? [[center.lat, center.lng] as [number, number]] : []),
      ...(userMarker ? [[userMarker.lat, userMarker.lng] as [number, number]] : []),
    ];
    if (points.length > 1) {
      map.fitBounds(points, { padding: [32, 32], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], zoom);
    }
  }, [markers, circles, center, userMarker, draggableCenter, onCenterChange, zoom, resolvedTheme]);

  return <div ref={containerRef} style={{ height, width: '100%' }} className="overflow-hidden rounded-2xl" />;
}
