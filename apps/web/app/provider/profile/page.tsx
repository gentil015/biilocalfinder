'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { providersApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const AVAILABILITY_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available', hint: 'Taking new work' },
  { value: 'BUSY', label: 'Busy', hint: 'Booked up for now' },
  { value: 'UNAVAILABLE', label: 'Unavailable', hint: 'Not taking work at all' },
] as const;

/**
 * Editing surface for the provider's own public profile.
 *
 * Distinct from /provider/onboarding/profile, which is step 2 of onboarding
 * and saves through a different, narrower endpoint. This page uses
 * GET/PATCH /providers/me/profile so a provider who finished onboarding can
 * still change their details — the onboarding step is unreachable once the
 * step is COMPLETED, which used to leave these fields frozen permanently.
 */
export default function ProviderProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [providerType, setProviderType] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: '',
    description: '',
    bio: '',
    phone: '',
    yearsOfExperience: '',
    serviceRadiusKm: '',
    availabilityStatus: 'AVAILABLE' as 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE',
  });

  useEffect(() => {
    providersApi
      .getMe()
      .then((p) => {
        setProviderType(p.providerType);
        setForm({
          businessName: p.businessName ?? '',
          description: p.description ?? '',
          bio: p.bio ?? '',
          phone: p.phone ?? p.user?.phone ?? '',
          yearsOfExperience: p.yearsOfExperience != null ? String(p.yearsOfExperience) : '',
          serviceRadiusKm: p.serviceRadiusKm != null ? String(p.serviceRadiusKm) : '',
          availabilityStatus: p.availabilityStatus ?? 'AVAILABLE',
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your profile'))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  const nameLabel = providerType === 'INDIVIDUAL' ? 'Full name' : 'Business name';

  const checklist = [
    { label: 'Business description', done: !!form.description.trim() },
    { label: 'Contact phone', done: !!form.phone.trim() },
    { label: 'Service radius', done: form.serviceRadiusKm.trim() !== '' },
    { label: 'Availability status', done: true },
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.businessName.trim()) {
      setError(`${nameLabel} is required`);
      return;
    }
    if (form.yearsOfExperience.trim() && Number(form.yearsOfExperience) < 0) {
      setError('Years of experience cannot be negative');
      return;
    }
    if (form.serviceRadiusKm.trim() && Number(form.serviceRadiusKm) < 1) {
      setError('Service radius must be at least 1 km');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await providersApi.updateMe({
        businessName: form.businessName.trim(),
        // Empty text means "clear it", not "leave as-is" — the fields are
        // optional, so sending '' is the only way to remove a value.
        description: form.description.trim(),
        bio: form.bio.trim(),
        phone: form.phone.trim(),
        yearsOfExperience: form.yearsOfExperience.trim() ? Number(form.yearsOfExperience) : undefined,
        serviceRadiusKm: form.serviceRadiusKm.trim() ? Number(form.serviceRadiusKm) : undefined,
        availabilityStatus: form.availabilityStatus,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your profile…" />
      </main>
    );
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Profile"
        description="This is what clients see on your public profile. Changes go live as soon as you save."
      />

      <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="space-y-5">
          <Panel title="Basics" description="How your business appears in search results and on your profile page.">
            <div className="space-y-4">
              <div className="field">
                <label htmlFor="businessName" className="label">
                  {nameLabel}
                </label>
                <input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="field">
                <label htmlFor="description" className="label">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={500}
                  placeholder="One or two lines on what you do and who you work best for."
                />
                <p className="hint">
                  This counts toward your profile strength.{' '}
                  <span className="tabular">{form.description.length}/500</span>
                </p>
              </div>

              <div className="field">
                <label htmlFor="bio" className="label">
                  About you <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  maxLength={2000}
                  placeholder="More detail about your experience, approach and the work you take on."
                />
                <p className="hint">
                  <span className="tabular">{form.bio.length}/2000</span>
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="Contact">
            <div className="field">
              <label htmlFor="phone" className="label">
                Phone <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+250788000000"
              />
              <p className="hint">Clients see this only after you accept their request.</p>
            </div>
          </Panel>

          <Panel title="Experience and reach">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="yearsOfExperience" className="label">
                  Years of experience <span className="font-normal text-ink-400">(optional)</span>
                </label>
                <input
                  id="yearsOfExperience"
                  type="number"
                  min={0}
                  max={60}
                  value={form.yearsOfExperience}
                  onChange={(e) => set('yearsOfExperience', e.target.value)}
                  placeholder="e.g. 7"
                />
              </div>

              <div className="field">
                <label htmlFor="serviceRadiusKm" className="label">
                  Service radius (km)
                </label>
                <input
                  id="serviceRadiusKm"
                  type="number"
                  min={1}
                  value={form.serviceRadiusKm}
                  onChange={(e) => set('serviceRadiusKm', e.target.value)}
                  placeholder="e.g. 25"
                />
                <p className="hint">
                  For specific named areas, use{' '}
                  <a href="/provider/service-areas" className="font-semibold text-brand-700 underline">
                    Coverage areas
                  </a>{' '}
                  instead.
                </p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Availability status"
            description="A quick signal for clients while your detailed schedule lives under Availability."
          >
            <fieldset>
              <legend className="sr-only">Availability status</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {AVAILABILITY_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                      form.availabilityStatus === o.value
                        ? 'border-brand-500 bg-brand-50/60'
                        : 'border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="availabilityStatus"
                      value={o.value}
                      checked={form.availabilityStatus === o.value}
                      onChange={() => set('availabilityStatus', o.value)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">{o.label}</span>
                      <span className="block text-2xs text-ink-400">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Panel>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !error && (
              <span role="status" className="flex items-center gap-1.5 text-sm font-semibold text-success-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Saved
              </span>
            )}
          </div>
        </div>

        <Panel title="Profile strength" className="lg:sticky lg:top-6">
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border-2 border-ink-300" aria-hidden="true" />
                )}
                <span className={item.done ? 'text-ink-500' : 'font-medium text-ink-800'}>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-2xs leading-relaxed text-ink-400">
            Services, pricing, portfolio photos and phone verification are managed on their own pages.
          </p>
        </Panel>
      </form>
    </main>
  );
}