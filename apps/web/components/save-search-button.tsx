'use client';

import { useEffect, useId, useState } from 'react';
import { BookmarkPlus, CheckCircle2, X } from 'lucide-react';
import { categoriesApi, servicesApi, savedSearchesApi, ApiError } from '@/lib/api';
import { categoryGroups, type CategoryNode } from '@/lib/categories';
import { useAuth } from '@/components/auth-provider';

export function SaveSearchButton() {
  // Auth state comes from context, not isLoggedIn(). isLoggedIn() reads
  // localStorage, which is empty on the server and populated on the client's
  // first render — so gating render on it made the server emit `null` while
  // the client emitted a <button>, which React reports as a hydration
  // mismatch. `loading` is true on the server and until the session probe
  // settles, so the first client render matches the server and the button
  // appears once the real session is known.
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [city, setCity] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const titleId = useId();
  const nameId = useId();
  const categoryIdField = useId();
  const serviceIdField = useId();
  const cityId = useId();

  useEffect(() => {
    if (open && categories.length === 0) {
      categoriesApi.tree().then(setCategories).catch(() => setCategories([]));
    }
  }, [open]);

  useEffect(() => {
    if (categoryId) {
      servicesApi.list(categoryId).then(setServices).catch(() => setServices([]));
    } else {
      setServices([]);
    }
    setServiceId('');
  }, [categoryId]);

  if (loading || !user) return null;

  async function submit() {
    if (!name.trim()) {
      setError('Give this search a name');
      return;
    }
    if (!categoryId && !city.trim()) {
      setError('Pick a category or a city');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savedSearchesApi.create({
        name: name.trim(),
        categoryId: categoryId || undefined,
        serviceId: serviceId || undefined,
        city: city.trim() || undefined,
        verifiedOnly,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this search');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <BookmarkPlus className="h-4 w-4" aria-hidden="true" /> Save search
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 backdrop-blur-sm md:items-center md:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl md:p-6"
          >
            {done ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-ink-900">Saved. We&apos;ll let you know about new matches.</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setDone(false);
                    setName('');
                    setCategoryId('');
                    setCity('');
                    setVerifiedOnly(false);
                  }}
                  className="btn-primary mt-6 w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow-muted">Alert me</p>
                    <h3 id={titleId} className="card-title mt-1">
                      Save this search
                    </h3>
                  </div>
                  <button onClick={() => setOpen(false)} aria-label="Close" className="icon-btn -mr-1.5 -mt-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor={nameId} className="label">
                      Name this search
                    </label>
                    <input
                      id={nameId}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Wedding photographers in Kigali"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={categoryIdField} className="label">
                      Category
                    </label>
                    <select
                      id={categoryIdField}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Any category</option>
                      {categoryGroups(categories).map((group) => (
                        <optgroup key={group.group} label={group.group}>
                          {group.options.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {services.length > 0 && (
                    <div className="field">
                      <label htmlFor={serviceIdField} className="label">
                        Service
                      </label>
                      <select id={serviceIdField} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                        <option value="">Any service in this category</option>
                        {services.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor={cityId} className="label">
                      City
                    </label>
                    <input id={cityId} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kigali" />
                  </div>

                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={verifiedOnly}
                      onChange={(e) => setVerifiedOnly(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-sm font-medium text-ink-700">Verified providers only</span>
                  </label>
                </div>

                {error && (
                  <div className="alert alert-error mt-4" role="alert">
                    <span>{error}</span>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button onClick={() => setOpen(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={busy} aria-busy={busy} className="btn-primary flex-1">
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
