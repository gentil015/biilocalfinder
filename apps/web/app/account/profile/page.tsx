'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ImagePlus, UserRound } from 'lucide-react';
import { clientsApi, ApiError, type ClientProfile } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * A 401 here means request() already tried to refresh and failed, i.e. the
 * stored session is genuinely dead — showing the raw "Unauthorized" is no help,
 * so say what to do about it.
 */
function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.status === 401 ? 'Your session expired. Please log in again.' : err.message;
  }
  return fallback;
}

/**
 * A client editing their own profile.
 *
 * Uses GET/PATCH /clients/me, which is the only endpoint that can write the
 * `client_profiles.bio` column alongside the account's name and avatar. The
 * generic /users/me is read-only, so without this page a client's details
 * were frozen at registration.
 */
export default function ClientProfilePage() {
  const { user, loading: sessionLoading, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    avatarUrl: '',
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    clientsApi
      .getMe()
      .then((p) => {
        setProfile(p);
        setForm({
          firstName: p.user.firstName ?? '',
          lastName: p.user.lastName ?? '',
          bio: p.bio ?? '',
          avatarUrl: p.user.avatarUrl ?? '',
        });
      })
      .catch((err) => setError(describeError(err, 'Could not load your profile')))
      .finally(() => setLoading(false));
  }, [sessionLoading, user]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (JPG or PNG).');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image must be 5MB or smaller.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { url } = await clientsApi.uploadAvatar(file);
      set('avatarUrl', url);
    } catch (err) {
      setError(describeError(err, 'Could not upload the image'));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await clientsApi.updateMe({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        // Empty text means "clear it" — the field is optional, so '' is the
        // only way to remove a previously set bio.
        bio: form.bio.trim(),
        avatarUrl: form.avatarUrl,
      });
      setProfile(updated);
      // Push the new name/avatar into the session so the header and account
      // page reflect the change without a full reload.
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(describeError(err, 'Could not save your profile'));
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your profile…" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-workspace py-16">
        <div className="empty-state">
          <p className="text-sm font-bold text-ink-900">You are signed out</p>
          <p className="mt-1.5 text-sm text-ink-500">Sign in to edit your profile.</p>
          <Link href="/login" className="btn-primary btn-sm mt-5">
            Log in
          </Link>
        </div>
      </main>
    );
  }

  if (user.role !== 'CLIENT') {
    return (
      <main className="page-narrow py-16">
        <div className="empty-state">
          <p className="text-sm font-bold text-ink-900">This page is for client accounts</p>
          <p className="mt-1.5 text-sm text-ink-500">
            {user.role === 'PROVIDER'
              ? 'Manage your business details from your provider profile.'
              : 'Your account is managed from the admin console.'}
          </p>
          <Link href={user.role === 'PROVIDER' ? '/provider/profile' : '/account'} className="btn-secondary btn-sm mt-5">
            Go back
          </Link>
        </div>
      </main>
    );
  }

  const initials = `${form.firstName?.[0] ?? ''}${form.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Update the name, photo and short bio attached to your account."
        actions={
          <Link href="/account" className="btn-secondary btn-sm">
            Back to account
          </Link>
        }
      />

      <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="space-y-5">
          <Panel title="Photo">
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-ink-100 text-ink-500">
                {form.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : initials ? (
                  <span className="font-display text-xl font-extrabold text-ink-700">{initials}</span>
                ) : (
                  <UserRound className="h-6 w-6" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn-secondary btn-sm"
                  >
                    <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    {uploading ? 'Uploading…' : 'Change photo'}
                  </button>
                  {form.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => set('avatarUrl', '')}
                      className="btn-secondary btn-sm border-ink-200 text-ink-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="hint mt-2">JPG or PNG, up to 5MB.</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickAvatar}
                  className="hidden"
                />
              </div>
            </div>
          </Panel>

          <Panel title="Your details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field">
                <label htmlFor="firstName" className="label">
                  First name
                </label>
                <input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  maxLength={60}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="lastName" className="label">
                  Last name
                </label>
                <input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  maxLength={60}
                  required
                />
              </div>
            </div>

            <div className="field mt-4">
              <label htmlFor="bio" className="label">
                About you <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                maxLength={1000}
                placeholder="A short line providers can see when you get in touch."
              />
              <p className="hint">
                <span className="tabular">{form.bio.length}/1000</span>
              </p>
            </div>
          </Panel>

          {error && (
            <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving || uploading} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && !error && (
              <span role="status" className="flex items-center gap-1.5 text-sm font-semibold text-success-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Saved
              </span>
            )}
          </div>
        </div>

        <Panel title="Account" className="lg:sticky lg:top-6">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-2xs uppercase tracking-[0.14em] text-ink-400">Email</dt>
              <dd className="mt-0.5 truncate font-medium text-ink-800">{profile?.user.email ?? user.email}</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-[0.14em] text-ink-400">Phone</dt>
              <dd className="mt-0.5 font-medium text-ink-800">{profile?.user.phone ?? 'Not set'}</dd>
            </div>
          </dl>
          <p className="mt-4 text-2xs leading-relaxed text-ink-400">
            Email and phone are used for account security and cannot be changed here.
          </p>
        </Panel>
      </form>
    </main>
  );
}
