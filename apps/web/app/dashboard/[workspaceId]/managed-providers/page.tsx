'use client';

import { useEffect, useState } from 'react';
import { Mail, Network, PhoneCall, Plus, X } from 'lucide-react';
import { ApiError, providerOnboardingApi, type ProviderOnboardingState } from '@/lib/api';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

type ManagedProvider = ProviderOnboardingState['teamMembers'][number];

// spec §5: "Invite and manage providers" / "Associate providers with the
// agency through explicit membership or representation relationships."
// This reuses the roster that already exists on the backend for AGENCY
// (ProviderTeamMember, built during onboarding) rather than building a
// second one — it's a list of represented provider businesses, distinct
// from the workspace Members page, which is about who can log into this
// dashboard (see lib/workspace-nav.ts).
export default function ManagedProvidersPage() {
  const [providers, setProviders] = useState<ManagedProvider[] | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    providerOnboardingApi.listTeamMembers().then(setProviders).catch(() => setProviders([]));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await providerOnboardingApi.addTeamMember({ name: name || undefined, email: email || undefined, phone: phone || undefined });
      const refreshed = await providerOnboardingApi.listTeamMembers();
      setProviders(refreshed);
      setName('');
      setEmail('');
      setPhone('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this provider');
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await providerOnboardingApi.removeTeamMember(id);
      setProviders((prev) => prev!.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (!providers) return <LoadingBlock label="Loading your providers…" />;

  const withEmail = providers.filter((p) => p.email).length;
  const withPhone = providers.filter((p) => p.phone).length;

  return (
    <>
      <PageHeader
        eyebrow="Agency"
        title="Managed providers"
        description="Providers this agency represents. This is separate from who can log into your dashboard — an agency doesn't automatically get access to a provider's messages or account by adding them here."
      />

      {providers.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={Network} label="Represented" value={String(providers.length)} sub="Provider businesses" />
          <StatCard icon={Mail} label="Reachable by email" value={String(withEmail)} sub="On file" />
          <StatCard icon={PhoneCall} label="Reachable by phone" value={String(withPhone)} sub="On file" />
          <StatCard
            label="Incomplete records"
            tone={providers.length - withEmail > 0 ? 'warning' : 'neutral'}
            value={String(providers.length - withEmail)}
            sub="No email on file"
          />
        </div>
      )}

      <Panel title="Add a provider" className="mb-6">
        <form onSubmit={add} className="space-y-4">
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="field">
              <label className="label" htmlFor="provider-name">
                Name
              </label>
              <input
                id="provider-name"
                placeholder="Business or contact name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="provider-email">
                Email
              </label>
              <input
                id="provider-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="provider-phone">
                Phone
              </label>
              <input
                id="provider-phone"
                type="tel"
                placeholder="+250 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || (!name && !email && !phone)}
            className="btn-primary btn-sm"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {adding ? 'Adding…' : 'Add provider'}
          </button>
          <p className="hint">At least one of name, email or phone is enough to add a record.</p>
        </form>
      </Panel>

      {providers.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No managed providers yet"
          body="Add the provider businesses your agency represents so they show up on your agency profile."
        />
      ) : (
        <Panel title="Represented providers" bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Contact</th>
                  <th scope="col" className="w-40">
                    Role
                  </th>
                  <th scope="col" className="w-12 text-right">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td className="max-w-[18rem]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <Network className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <p className="truncate text-sm font-semibold text-ink-950">
                          {p.name ?? p.email ?? p.phone}
                        </p>
                      </div>
                    </td>
                    <td className="text-xs text-ink-500">
                      <span className="block truncate">{p.email ?? '—'}</span>
                      <span className="block truncate tabular">{p.phone ?? '—'}</span>
                    </td>
                    <td>
                      {p.role ? (
                        <span className="chip px-2 py-0.5 text-2xs font-semibold">{p.role}</span>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${p.name ?? p.email ?? p.phone}`}
                        disabled={busyId === p.id}
                        onClick={() => remove(p.id)}
                        className="icon-btn h-8 w-8 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
