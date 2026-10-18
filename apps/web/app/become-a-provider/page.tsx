'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock, ShieldCheck, XCircle } from 'lucide-react';
import { ApiError, categoriesApi, providerApplicationsApi } from '@/lib/api';
import { useSession } from '@/components/auth-provider';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const PROVIDER_TYPES = [
  {
    value: 'INDIVIDUAL' as const,
    label: 'Individual',
    hint: 'I work on my own',
  },
  {
    value: 'TEAM' as const,
    label: 'Team',
    hint: 'A small team I work with',
  },
  {
    value: 'BUSINESS' as const,
    label: 'Business',
    hint: 'A registered business',
  },
  {
    value: 'AGENCY' as const,
    label: 'Agency',
    hint: 'An agency representing other providers',
  },
];

/** Flatten the category tree into the leaf services a provider could offer. */
function leafCategories(nodes: any[]): { slug: string; name: string; group: string }[] {
  const out: { slug: string; name: string; group: string }[] = [];
  const walk = (list: any[], parentName?: string) => {
    for (const node of list ?? []) {
      const children = node.children ?? [];
      if (children.length === 0) {
        if (node.slug) out.push({ slug: node.slug, name: node.name, group: parentName ?? 'Other' });
      } else {
        walk(children, node.name);
      }
    }
  };
  walk(nodes);
  return out;
}

export default function ApplyToBecomeProviderPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const [categories, setCategories] = useState<{ slug: string; name: string; group: string }[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerType: 'INDIVIDUAL' as 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY',
    businessName: '',
    description: '',
    phone: '',
    yearsOfExperience: '',
    registrationNumber: '',
    idNumber: '',
    websiteUrl: '',
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Already trading — send them to their dashboard rather than letting them
    // submit an application the API would reject with a 409.
    if (user.role !== 'CLIENT') {
      router.replace(user.role === 'ADMIN' ? '/admin' : '/provider/dashboard');
      return;
    }

    categoriesApi
      .tree()
      .then((tree) => setCategories(leafCategories(tree)))
      .catch(() => setCategories([]));
    providerApplicationsApi
      .mine()
      .then(setApplications)
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, [user, sessionLoading, router]);

  // Default the business name to their own name so the common case is one edit.
  useEffect(() => {
    if (!user) return;
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (name) setForm((f) => (f.businessName ? f : { ...f, businessName: name }));
  }, [user]);

  const pending = applications.find((a) => a.status === 'PENDING');
  const decided = applications.filter((a) => a.status !== 'PENDING');
  const needsLegal = form.providerType === 'BUSINESS' || form.providerType === 'AGENCY';

  const grouped = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }[]>();
    for (const c of categories) {
      const list = map.get(c.group) ?? [];
      list.push({ slug: c.slug, name: c.name });
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [categories]);

  function toggleCategory(slug: string) {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug].slice(0, 12),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.businessName.trim().length < 2) {
      setError('Enter the name clients will see');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await providerApplicationsApi.submit({
        providerType: form.providerType,
        businessName: form.businessName.trim(),
        description: form.description.trim() || undefined,
        phone: form.phone.trim() || undefined,
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
        registrationNumber: form.registrationNumber.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        websiteUrl: form.websiteUrl.trim() || undefined,
        categories: selectedCategories,
      });
      const mine = await providerApplicationsApi.mine();
      setApplications(mine);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your application');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || sessionLoading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading…" />
      </main>
    );
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Become a provider"
        title={pending ? 'Application under review' : 'Apply to become a provider'}
        description={
          pending
            ? 'We are checking your details. We will email you as soon as there is a decision.'
            : 'Tell us what you do. An admin reviews every application, then your existing account is upgraded — you keep your login and your history.'
        }
      />

      {/* A pending application hides the form rather than disabling it: a second
          submit would be rejected by the one-PENDING-per-user index anyway. */}
      {pending && (
        <Panel className="mb-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink-900">
                {pending.businessName} — submitted {new Date(pending.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                You applied as a {pending.providerType.toLowerCase()}. Reviews usually take a day or two.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {decided.length > 0 && (
        <Panel title="Previous applications" className="mb-6">
          <ul className="space-y-3">
            {decided.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                {a.status === 'APPROVED' ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {a.businessName} — {a.status === 'APPROVED' ? 'Approved' : 'Not approved'}
                  </p>
                  {a.decisionNote && <p className="mt-0.5 text-sm text-ink-500">{a.decisionNote}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!pending && (
        <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_18rem] lg:items-start">
          <div className="space-y-5">
            <Panel title="About you" description="How clients and our review team will see you.">
              <div className="space-y-4">
                <fieldset>
                  <legend className="label">What kind of provider are you?</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PROVIDER_TYPES.map((t) => (
                      <label
                        key={t.value}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${
                          form.providerType === t.value
                            ? 'border-brand-500 bg-brand-50/60'
                            : 'border-ink-200 hover:bg-ink-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="providerType"
                          checked={form.providerType === t.value}
                          onChange={() =>
                            setForm((f) => ({ ...f, providerType: t.value, businessName: '' }))
                          }
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink-900">{t.label}</span>
                          <span className="block text-2xs text-ink-400">{t.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="field">
                  <label htmlFor="businessName" className="label">
                    {form.providerType === 'INDIVIDUAL' ? 'Your name as clients see it' : 'Business name'}
                  </label>
                  <input
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    maxLength={120}
                  />
                </div>

                <div className="field">
                  <label htmlFor="description" className="label">
                    What do you offer?
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    maxLength={1000}
                    placeholder="The work you take on, who you are best for, and anything that sets you apart."
                  />
                  <p className="hint">
                    <span className="tabular">{form.description.length}/1000</span>
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Contact and experience">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label htmlFor="phone" className="label">
                    Phone <span className="font-normal text-ink-400">(optional)</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+250788000000"
                  />
                </div>

                <div className="field">
                  <label htmlFor="yearsOfExperience" className="label">
                    Years of experience
                  </label>
                  <input
                    id="yearsOfExperience"
                    type="number"
                    min={0}
                    max={60}
                    value={form.yearsOfExperience}
                    onChange={(e) => setForm((f) => ({ ...f, yearsOfExperience: e.target.value }))}
                  />
                </div>

                <div className="field">
                  <label htmlFor="websiteUrl" className="label">
                    Website or social page{' '}
                    <span className="font-normal text-ink-400">(optional)</span>
                  </label>
                  <input
                    id="websiteUrl"
                    type="url"
                    value={form.websiteUrl}
                    onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>

                <div className="field">
                  <label htmlFor="idNumber" className="label">
                    National ID number{' '}
                    <span className="font-normal text-ink-400">(optional)</span>
                  </label>
                  <input
                    id="idNumber"
                    value={form.idNumber}
                    onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                  />
                  <p className="hint">Helps us verify who you are. Not shown publicly.</p>
                </div>

                {needsLegal && (
                  <div className="field sm:col-span-2">
                    <label htmlFor="registrationNumber" className="label">
                      Business registration number
                    </label>
                    <input
                      id="registrationNumber"
                      value={form.registrationNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, registrationNumber: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="What do you want to offer?"
              description="Pick the services you want to appear for. You can change these later."
            >
              {grouped.length === 0 ? (
                <p className="text-sm text-ink-400">No service categories are available right now.</p>
              ) : (
                <div className="space-y-4">
                  {grouped.map(([group, items]) => (
                    <div key={group}>
                      <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-400">
                        {group}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {items.map((c) => {
                          const active = selectedCategories.includes(c.slug);
                          return (
                            <button
                              key={c.slug}
                              type="button"
                              onClick={() => toggleCategory(c.slug)}
                              aria-pressed={active}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                active
                                  ? 'border-brand-500 bg-brand-600 text-white dark:text-home-night'
                                  : 'border-ink-200 text-ink-700 hover:bg-ink-50'
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="hint">
                    {selectedCategories.length} of 12 selected
                    {selectedCategories.length > 0 && (
                      <>
                        {' '}
                        ·{' '}
                        <button
                          type="button"
                          onClick={() => setSelectedCategories([])}
                          className="font-semibold underline"
                        >
                          Clear
                        </button>
                      </>
                    )}
                  </p>
                </div>
              )}
            </Panel>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Submitting…' : 'Submit application'}
              </button>
              <Link href="/account" className="text-sm font-semibold text-ink-500 underline">
                Cancel
              </Link>
            </div>
          </div>

          <Panel title="What happens next" className="lg:sticky lg:top-6">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="text-ink-600">
                  An admin checks your details against what you have listed.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="text-ink-600">
                  On approval your <strong>existing account</strong> becomes a provider account — same
                  login, same request history.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="text-ink-600">
                  You then add your services and set where you work, and start receiving requests.
                </span>
              </li>
            </ol>
          </Panel>
        </form>
      )}
    </main>
  );
}