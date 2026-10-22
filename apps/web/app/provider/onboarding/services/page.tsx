'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import {
  ApiError,
  ProviderOnboardingState,
  offeringsApi,
  providerOnboardingApi,
  providersApi,
  categoriesApi,
  servicesApi,
} from '@/lib/api';
import { categoryGroups, type CategoryNode } from '@/lib/categories';
import { LocationPickerMap } from '@/components/location-picker-map';
import { LoadingBlock } from '@/components/ui/page';
import { DynamicAttributeForm } from '@/components/attributes/dynamic-attribute-form';

const KIGALI = { lat: -1.9441, lng: 30.0619 };
const TEAM_ROSTER_TYPES = ['TEAM', 'AGENCY'];

export default function ProviderOnboardingServicesPage() {
  const router = useRouter();
  const [state, setState] = useState<ProviderOnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Location
  const [center, setCenter] = useState(KIGALI);
  const [locationSaved, setLocationSaved] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);

  // Services
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [myOfferings, setMyOfferings] = useState<any[]>([]);
  const [addingService, setAddingService] = useState(false);
  const [attributes, setAttributes] = useState<any[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [offeringForm, setOfferingForm] = useState({ title: '', description: '', basePrice: '', priceType: 'FIXED', duration: '' });

  // Team roster (TEAM/AGENCY only)
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    Promise.all([providerOnboardingApi.getState(), categoriesApi.tree(), offeringsApi.mine()])
      .then(([s, cats, offerings]) => {
        if (!s.providerType) {
          router.replace('/provider/onboarding');
          return;
        }
        setState(s);
        setCategories(cats);
        setMyOfferings(offerings);
        if (s.location) {
          setCenter({ lat: s.location.latitude, lng: s.location.longitude });
          setLocationSaved(true);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!categoryId) {
      setServices([]);
      return;
    }
    servicesApi.list(categoryId).then(setServices);
  }, [categoryId]);

  useEffect(() => {
    setAttributeValues({});
    const svc = services.find((s) => s.id === serviceId);
    if (!svc?.category?.id) {
      setAttributes([]);
      return;
    }
    categoriesApi.attributes(svc.category.id).then(setAttributes).catch(() => setAttributes([]));
  }, [serviceId, services]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationSaved(false);
    });
  }

  async function saveLocation() {
    setSavingLocation(true);
    setError(null);
    try {
      await providersApi.setLocation({ latitude: center.lat, longitude: center.lng });
      setLocationSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your location');
    } finally {
      setSavingLocation(false);
    }
  }

  async function addService() {
    if (!serviceId) return;
    setAddingService(true);
    setError(null);
    try {
      const offering = await offeringsApi.create({
        serviceId,
        title: offeringForm.title || undefined,
        description: offeringForm.description || undefined,
        basePrice: offeringForm.basePrice ? Number(offeringForm.basePrice) : undefined,
        priceType: offeringForm.priceType,
        duration: offeringForm.duration || undefined,
        attributeValues,
      });
      setMyOfferings((prev) => [...prev, offering]);
      setServiceId('');
      setAttributeValues({});
      setAttributes([]);
      setOfferingForm({ title: '', description: '', basePrice: '', priceType: 'FIXED', duration: '' });
      setCategoryId('');
      setServices([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that service');
    } finally {
      setAddingService(false);
    }
  }

  async function addMember() {
    if (!memberName.trim()) return;
    setAddingMember(true);
    setError(null);
    try {
      const member = await providerOnboardingApi.addTeamMember({ name: memberName.trim(), role: memberRole.trim() || undefined });
      setState((s) => (s ? { ...s, teamMembers: [...s.teamMembers, member] } : s));
      setMemberName('');
      setMemberRole('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that team member');
    } finally {
      setAddingMember(false);
    }
  }

  async function removeMember(id: string) {
    setState((s) => (s ? { ...s, teamMembers: s.teamMembers.filter((m) => m.id !== id) } : s));
    try {
      await providerOnboardingApi.removeTeamMember(id);
    } catch {
      // best-effort
    }
  }

  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      if (!locationSaved) await saveLocation();
      await providerOnboardingApi.complete();
      router.push('/provider/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finish setup. Please try again.');
    } finally {
      setFinishing(false);
    }
  }

  if (loading || !state) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your setup…" />
      </main>
    );
  }

  const isTeamRoster = TEAM_ROSTER_TYPES.includes(state.providerType ?? '');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8">
      <div className="mb-2 flex items-center gap-1.5" aria-hidden="true">
        {['bg-brand-600', 'bg-brand-600', 'bg-brand-600'].map((c, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${c}`} />
        ))}
      </div>
      <p className="mb-6 text-xs font-medium text-ink-400">Step 3 of 3</p>

      <h1 className="mb-1 text-2xl font-bold text-ink-950">Create your service & location</h1>
      <p className="mb-6 text-sm text-ink-500">
        Add at least one service offering with details so clients can see it publicly on the platform.
      </p>

      <section className="mb-6 rounded-xl border border-ink-200 bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink-800">Your services</h2>

        {myOfferings.length > 0 && (
          <ul className="mb-4 flex flex-col gap-2">
            {myOfferings.map((o) => (
              <li key={o.id} className="rounded-lg border border-ink-200 px-3 py-2 text-sm">
                <div className="font-medium text-ink-800">{o.title || o.service?.name || 'Service'}</div>
                {o.service?.category?.name && <div className="text-xs text-ink-500">{o.service.category.name}</div>}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1"
            aria-label="Service category"
          >
            <option value="">Category…</option>
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
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            disabled={!categoryId}
            className="flex-1"
            aria-label="Service"
          >
            <option value="">Service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {serviceId && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="field mb-0">
                <label className="label">Title (optional)</label>
                <input value={offeringForm.title} onChange={(e) => setOfferingForm({ ...offeringForm, title: e.target.value })} placeholder="e.g. Professional plumbing" />
              </div>
              <div className="field mb-0">
                <label className="label">Base price (RWF)</label>
                <input type="number" value={offeringForm.basePrice} onChange={(e) => setOfferingForm({ ...offeringForm, basePrice: e.target.value })} placeholder="e.g. 15000" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="field mb-0">
                <label className="label">Price type</label>
                <select value={offeringForm.priceType} onChange={(e) => setOfferingForm({ ...offeringForm, priceType: e.target.value })}>
                  <option value="FIXED">Fixed</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="PER_DAY">Per day</option>
                  <option value="STARTING_FROM">Starting from</option>
                  <option value="CUSTOM_QUOTE">Custom quote</option>
                </select>
              </div>
              <div className="field mb-0">
                <label className="label">Duration (optional)</label>
                <input value={offeringForm.duration} onChange={(e) => setOfferingForm({ ...offeringForm, duration: e.target.value })} placeholder="e.g. 2 hours" />
              </div>
            </div>
            <div className="field mb-0">
              <label className="label">Description (optional)</label>
              <textarea rows={2} value={offeringForm.description} onChange={(e) => setOfferingForm({ ...offeringForm, description: e.target.value })} />
            </div>
            {attributes.length > 0 && (
              <div className="rounded-lg border border-ink-200 p-3">
                <p className="mb-2 text-xs font-semibold text-ink-700">Service details</p>
                <DynamicAttributeForm
                  attributes={attributes}
                  values={attributeValues}
                  onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
                />
              </div>
            )}
            <button
              type="button"
              onClick={addService}
              disabled={!serviceId || addingService}
              className="btn-primary w-full sm:w-auto"
            >
              {addingService ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create service offering
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-500">This will be visible publicly on the platform.</p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-800">
          <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" /> Service location
        </h2>
        <div className="overflow-hidden rounded-xl border border-ink-200">
          <LocationPickerMap
            center={center}
            onCenterChange={(pos) => {
              setCenter(pos);
              setLocationSaved(false);
            }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" onClick={useMyLocation} className="text-link text-xs">
            Use my current location
          </button>
          <button
            type="button"
            onClick={saveLocation}
            disabled={savingLocation || locationSaved}
            className="text-xs font-semibold text-brand-700 underline-offset-4 hover:underline disabled:text-ink-400 disabled:no-underline"
          >
            {locationSaved ? 'Location saved' : savingLocation ? 'Saving…' : 'Save this location'}
          </button>
        </div>
      </section>

      {isTeamRoster && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-ink-800">
            {state.providerType === 'AGENCY' ? 'Providers you manage (optional)' : 'Team members (optional)'}
          </h2>
          {state.teamMembers.length > 0 && (
            <ul className="mb-3 flex flex-col gap-2">
              {state.teamMembers.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm">
                  <span className="font-medium text-ink-800">
                    {m.name} {m.role && <span className="text-ink-400">· {m.role}</span>}
                  </span>
                  <button onClick={() => removeMember(m.id)} aria-label={`Remove ${m.name}`} className="icon-btn h-8 w-8">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input placeholder="Name" value={memberName} onChange={(e) => setMemberName(e.target.value)} className="min-w-0 flex-1" />
            <input placeholder="Role" value={memberRole} onChange={(e) => setMemberRole(e.target.value)} className="w-28 shrink-0" />
            <button type="button" onClick={addMember} disabled={!memberName.trim() || addingMember} className="btn-secondary shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="error-text mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto flex gap-3 pt-2">
        <button type="button" onClick={() => router.push('/provider/onboarding/profile')} className="btn-secondary flex-1">
          Back
        </button>
        <button type="button" onClick={finish} disabled={finishing || myOfferings.length === 0} className="btn-primary flex-[1.4]">
          {finishing ? 'Finishing…' : 'Finish setup'}
        </button>
      </div>
      {myOfferings.length === 0 && <p className="mt-2 text-center text-xs text-ink-500">Create at least one service offering to finish setup.</p>}
    </main>
  );
}
