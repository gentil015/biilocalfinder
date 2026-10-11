'use client';

import { useState } from 'react';
import { AlertCircle, MapPinCheck, MapPinX } from 'lucide-react';
import { providersApi, ApiError } from '@/lib/api';

export function ServesYourAreaCheck({ providerId }: { providerId: string }) {
  const [state, setState] = useState<'idle' | 'checking' | { distanceKm: number | null; serves: boolean } | 'error'>('idle');

  function check() {
    if (!navigator.geolocation) {
      setState('error');
      return;
    }
    setState('checking');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const result = await providersApi.getPublic(providerId, { lat: pos.coords.latitude, lng: pos.coords.longitude });
          setState({ distanceKm: result.distanceKm, serves: !!result.servesQueriedLocation });
        } catch (err) {
          setState('error');
        }
      },
      () => setState('error'),
      { timeout: 8000 },
    );
  }

  if (state === 'idle') {
    return (
      <button onClick={check} className="btn-secondary btn-sm w-full">
        <MapPinCheck className="h-4 w-4" aria-hidden="true" /> Check if this provider serves your area
      </button>
    );
  }

  if (state === 'checking') {
    return (
      <p className="flex items-center gap-2 text-xs font-medium text-ink-500" role="status">
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
        />
        Checking your location…
      </p>
    );
  }

  if (state === 'error') {
    return (
      <p className="flex items-start gap-2 text-xs font-medium text-ink-500" role="status">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
        Couldn&apos;t check your location.
      </p>
    );
  }

  const distance = state.distanceKm != null ? ` — ${state.distanceKm.toFixed(1)} km away` : '';

  return (
    <p
      className={`flex items-start gap-2 px-3 py-2.5 text-xs font-medium ${
        state.serves ? 'border-success-100 bg-success-50 text-success-700' : 'surface-panel text-ink-600'
      }`}
      role="status"
    >
      {state.serves ? (
        <MapPinCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <MapPinX className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>
        {state.serves ? 'Serves your area' : "This provider's coverage doesn't reach your location"}
        {distance}
      </span>
    </p>
  );
}
