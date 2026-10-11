'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { ApiError, ProviderOnboardingState, ProviderType, providerOnboardingApi } from '@/lib/api';
import { onboardingStepPath } from '@/lib/onboarding';
import { LoadingBlock } from '@/components/ui/page';

const LABELS: Record<ProviderType, { name: string; namePlaceholder: string; bio: string; photo: string }> = {
  INDIVIDUAL: { name: 'Full name', namePlaceholder: 'e.g. Jean-Paul Habimana', bio: 'Short professional bio', photo: 'Profile photo' },
  TEAM: { name: 'Team or group name', namePlaceholder: 'e.g. Kigali Cleaning Crew', bio: 'About your team', photo: 'Team logo or photo' },
  BUSINESS: { name: 'Registered business name', namePlaceholder: 'e.g. Amahoro Construction Ltd', bio: 'Business description', photo: 'Business logo' },
  AGENCY: { name: 'Agency name', namePlaceholder: 'e.g. Kigali Staffing Agency', bio: 'Agency description', photo: 'Agency logo' },
};

export default function ProviderOnboardingProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ProviderOnboardingState | null>(null);
  const [form, setForm] = useState({
    businessName: '',
    bio: '',
    phone: '',
    registrationNumber: '',
    representativeName: '',
    teamSize: '',
    logoUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    providerOnboardingApi
      .getState()
      .then((s) => {
        if (!s.providerType) {
          // Can't fill out a type-specific form with no type chosen yet —
          // send them back to step 1 rather than showing a broken form.
          router.replace('/provider/onboarding');
          return;
        }
        setState(s);
        setForm({
          businessName: s.businessName ?? '',
          bio: s.bio ?? '',
          phone: s.phone ?? s.accountPhone ?? '',
          registrationNumber: s.registrationNumber ?? '',
          representativeName: s.representativeName ?? '',
          teamSize: s.teamSize != null ? String(s.teamSize) : '',
          logoUrl: s.logoUrl ?? '',
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    try {
      const result = await providerOnboardingApi.uploadLogo(file);
      setForm((f) => ({ ...f, logoUrl: result.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that image');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state) return;
    setError(null);

    if (!form.businessName.trim()) {
      setError(state.providerType === 'INDIVIDUAL' ? 'Full name is required' : 'Name is required');
      return;
    }
    if ((state.providerType === 'BUSINESS' || state.providerType === 'AGENCY') && !form.representativeName.trim()) {
      setError("Authorized representative's name is required");
      return;
    }

    setSaving(true);
    try {
      const provider = await providerOnboardingApi.updateProfile({
        businessName: form.businessName.trim(),
        bio: form.bio.trim() || undefined,
        phone: form.phone.trim() || undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        representativeName: form.representativeName.trim() || undefined,
        teamSize: form.teamSize ? Number(form.teamSize) : undefined,
        logoUrl: form.logoUrl || undefined,
      });
      router.push(onboardingStepPath(provider.onboardingStep));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !state?.providerType) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your profile…" />
      </main>
    );
  }

  const labels = LABELS[state.providerType];
  const showRepresentative = state.providerType === 'BUSINESS' || state.providerType === 'AGENCY' || state.providerType === 'TEAM';
  const representativeLabel = state.providerType === 'TEAM' ? 'Team leader / owner' : "Authorized representative's name";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <div className="mb-2 flex items-center gap-1.5" aria-hidden="true">
        {['bg-brand-600', 'bg-brand-600', 'bg-ink-200'].map((c, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${c}`} />
        ))}
      </div>
      <p className="mb-6 text-xs font-medium text-ink-400">Step 2 of 3</p>

      <h1 className="mb-1 text-2xl font-bold text-ink-950">Tell us about {state.providerType === 'INDIVIDUAL' ? 'you' : 'your organization'}</h1>
      <p className="mb-6 text-sm text-ink-500">
        You can always update these details later from your provider dashboard.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="field">
          <span className="label">{labels.photo}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-300 bg-ink-50 text-ink-400 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-60"
              aria-label={`Upload ${labels.photo.toLowerCase()}`}
            >
              {form.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
            <div className="text-xs leading-relaxed text-ink-500">
              {uploadingLogo ? 'Uploading…' : 'JPEG, PNG or WEBP. Optional — you can add this later.'}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onLogoSelected} />
        </div>

        <div className="field">
          <label htmlFor="profile-name" className="label">
            {labels.name}
          </label>
          <input
            id="profile-name"
            required
            placeholder={labels.namePlaceholder}
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="profile-phone" className="label">
            Phone number
          </label>
          <input
            id="profile-phone"
            placeholder="e.g. +250 7xx xxx xxx"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        {showRepresentative && (
          <div className="field">
            <label htmlFor="profile-representative" className="label">
              {representativeLabel}
              {(state.providerType === 'BUSINESS' || state.providerType === 'AGENCY') && (
                <span className="text-danger-600"> *</span>
              )}
            </label>
            <input
              id="profile-representative"
              required={state.providerType === 'BUSINESS' || state.providerType === 'AGENCY'}
              placeholder="Full name"
              value={form.representativeName}
              onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
            />
          </div>
        )}

        {state.providerType === 'BUSINESS' && (
          <div className="field">
            <label htmlFor="profile-registration" className="label">
              Business registration number <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="profile-registration"
              placeholder="Leave blank if you don't have one yet"
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
            />
          </div>
        )}

        {state.providerType === 'TEAM' && (
          <div className="field">
            <label htmlFor="profile-team-size" className="label">
              Number of members <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <input
              id="profile-team-size"
              type="number"
              min={1}
              placeholder="e.g. 5"
              value={form.teamSize}
              onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="profile-bio" className="label">
            {labels.bio}
          </label>
          <textarea
            id="profile-bio"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => router.push('/provider/onboarding')}
            className="btn-secondary flex-1"
          >
            Back
          </button>
          <button disabled={saving} className="btn-primary flex-[1.4]">
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </form>
    </main>
  );
}