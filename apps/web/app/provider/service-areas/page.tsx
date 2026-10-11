'use client';

import { useEffect, useState } from 'react';
import { MapPin, Trash2, AlertCircle } from 'lucide-react';
import { providersApi, ApiError } from '@/lib/api';
import { ServiceAreaEditorMap } from '@/components/service-area-editor-map';
import { PageHeader, Panel, LoadingBlock, EmptyState } from '@/components/ui/page';

const DEFAULT_CENTER = { lat: -1.9441, lng: 30.0619 }; // Kigali

export default function ServiceAreasPage() {
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radiusKm, setRadiusKm] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    providersApi
      .getMe()
      .then((provider) => {
        setAreas(provider.serviceAreas ?? []);
        if (provider.location?.latitude != null) {
          setCenter({ lat: provider.location.latitude, lng: provider.location.longitude });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your coverage areas'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function addArea() {
    if (!label.trim()) {
      setError('Give this area a name, e.g. "Kigali city"');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await providersApi.addServiceArea({ label: label.trim(), latitude: center.lat, longitude: center.lng, radiusKm });
      setLabel('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this area');
    } finally {
      setBusy(false);
    }
  }

  async function removeArea(id: string) {
    try {
      await providersApi.removeServiceArea(id);
      setAreas((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this area');
    }
  }

  if (loading)
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading coverage areas…" />
      </main>
    );

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Coverage areas"
        description="Draw circles for the areas you serve. Clients outside your usual radius but inside one of these will still find you, with a &quot;Serves your area&quot; badge."
      />

      {areas.length > 0 && (
        <Panel title="Your coverage areas" className="mb-6">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  <th scope="col" className="text-right">
                    Radius
                  </th>
                  <th scope="col" className="w-10">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td className="flex items-center gap-2.5">
                      <MapPin className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      <span className="font-semibold text-ink-900">{a.label}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <span className="text-sm font-bold tabular text-ink-900">{a.radiusKm}</span>
                      <span className="ml-1 text-xs font-medium text-ink-500">km</span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => removeArea(a.id)}
                        className="icon-btn"
                        aria-label={`Remove ${a.label}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {areas.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="No coverage areas yet"
          body="Add the areas you serve so clients nearby get the confirmation that you can reach them."
        />
      )}

      <Panel title="Add a coverage area" className="mt-6">
        <div className="field">
          <label htmlFor="area-label" className="label">
            Area name
          </label>
          <input
            id="area-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Kigali city or Musanze district"
          />
        </div>

        <p className="mt-4 mb-2 text-xs text-ink-500">Drag the pin, or click the map, to set the center.</p>
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <ServiceAreaEditorMap center={center} radiusKm={radiusKm} onCenterChange={setCenter} />
        </div>

        <div className="field mt-4">
          <label htmlFor="area-radius" className="label">
            Radius: <span className="tabular">{radiusKm} km</span>
          </label>
          <input
            id="area-radius"
            type="range"
            min={1}
            max={100}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {error}
          </p>
        )}

        <button onClick={addArea} disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? 'Adding…' : 'Add coverage area'}
        </button>
      </Panel>
    </main>
  );
}