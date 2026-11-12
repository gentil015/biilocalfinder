'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  FileCheck2,
  Flag,
  Mail,
  MailCheck,
  MapPin,
  Pencil,
  Phone,
  PhoneCall,
  ShieldCheck,
  ShieldOff,
  Star,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { adminApi, ApiError, type AdminProviderDetail, type AdminUserDetail } from '@/lib/api';
import { BackButton } from '@/components/back-button';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, LoadingBlock, PageHeader, Panel, StatCard } from '@/components/ui/page';

const PROVIDER_TYPES = ['INDIVIDUAL', 'TEAM', 'BUSINESS', 'AGENCY'];

function formatMoney(value: string | number | null | undefined, currency = 'RWF') {
  if (value == null) return '—';
  return `${Number(value).toLocaleString()} ${currency}`;
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 py-2.5 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink-900">{value ?? '—'}</dd>
    </div>
  );
}

function ProviderEditor({
  provider,
  onSaved,
  onCancel,
}: {
  provider: AdminProviderDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    businessName: provider.businessName ?? '',
    providerType: provider.providerType ?? 'INDIVIDUAL',
    phone: provider.phone ?? '',
    description: provider.description ?? '',
    bio: provider.bio ?? '',
    yearsOfExperience: String(provider.yearsOfExperience ?? 0),
    registrationNumber: provider.registrationNumber ?? '',
    representativeName: provider.representativeName ?? '',
    teamSize: provider.teamSize != null ? String(provider.teamSize) : '',
    serviceRadiusKm: String(provider.serviceRadiusKm ?? 10),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminApi.updateProvider(provider.id, {
        businessName: form.businessName,
        providerType: form.providerType,
        phone: form.phone,
        description: form.description,
        bio: form.bio,
        yearsOfExperience: form.yearsOfExperience === '' ? 0 : Number(form.yearsOfExperience),
        registrationNumber: form.registrationNumber,
        representativeName: form.representativeName,
        teamSize: form.teamSize === '' ? null : Number(form.teamSize),
        serviceRadiusKm: form.serviceRadiusKm === '' ? 0 : Number(form.serviceRadiusKm),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save these changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="provider-business-name">Business name</label>
          <input
            id="provider-business-name"
            required
            value={form.businessName}
            onChange={(event) => update('businessName', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-type">Provider type</label>
          <select
            id="provider-type"
            value={form.providerType ?? ''}
            onChange={(event) => update('providerType', event.target.value)}
          >
            {PROVIDER_TYPES.map((type) => (
              <option key={type} value={type}>{type.toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-phone">Business phone</label>
          <input
            id="provider-phone"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-radius">Service radius (km)</label>
          <input
            id="provider-radius"
            type="number"
            min={0}
            max={500}
            value={form.serviceRadiusKm}
            onChange={(event) => update('serviceRadiusKm', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-years">Years of experience</label>
          <input
            id="provider-years"
            type="number"
            min={0}
            max={80}
            value={form.yearsOfExperience}
            onChange={(event) => update('yearsOfExperience', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-team-size">Team size</label>
          <input
            id="provider-team-size"
            type="number"
            min={1}
            max={10000}
            value={form.teamSize}
            onChange={(event) => update('teamSize', event.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-registration">Registration number</label>
          <input
            id="provider-registration"
            value={form.registrationNumber}
            onChange={(event) => update('registrationNumber', event.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="provider-representative">Representative name</label>
          <input
            id="provider-representative"
            value={form.representativeName}
            onChange={(event) => update('representativeName', event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="provider-description">Business description</label>
        <textarea
          id="provider-description"
          rows={3}
          maxLength={2000}
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="provider-bio">About the provider</label>
        <textarea
          id="provider-bio"
          rows={3}
          maxLength={2000}
          value={form.bio}
          onChange={(event) => update('bio', event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save business details'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ProviderCard({
  provider,
  onChanged,
  onNotice,
  onError,
}: {
  provider: AdminProviderDetail;
  onChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'verify' | 'unverify' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingVerification = provider.verifications.find((record: any) => record.status === 'PENDING');
  const latestVerification = pendingVerification ?? provider.verifications[0];
  const isVerified = provider.verificationStatus === 'VERIFIED';

  async function verify() {
    setBusy('verify');
    setError(null);
    try {
      await adminApi.verifyProvider(provider.id);
      onNotice(`${provider.businessName} is now verified.`);
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not verify this provider';
      setError(message);
      onError(message);
    } finally {
      setBusy(null);
    }
  }

  async function unverify() {
    const reason = window.prompt(
      `Why are you removing the verification badge from ${provider.businessName}? The provider will see this.`,
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setError('Give a reason of at least 5 characters.');
      return;
    }
    setBusy('unverify');
    setError(null);
    try {
      await adminApi.unverifyProvider(provider.id, reason.trim());
      onNotice(`${provider.businessName} is no longer verified.`);
      onChanged();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not remove verification';
      setError(message);
      onError(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-extrabold tracking-tight text-ink-950">
              {provider.businessName}
            </h3>
            <StatusBadge status={provider.verificationStatus} />
            <span className="chip px-2 py-0.5 text-2xs font-semibold uppercase">
              {provider.providerType ?? 'No type'}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {provider.workspace?.name ?? 'Workspace'}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Joined {formatDate(provider.createdAt)}
            </span>
            {provider.location?.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {provider.location.city}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/providers/${provider.id}`} className="btn-secondary btn-sm" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Public profile
          </Link>
          <button type="button" onClick={() => setEditing((value) => !value)} className="btn-secondary btn-sm">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            {editing ? 'Close editor' : 'Edit details'}
          </button>
          {isVerified ? (
            <button
              type="button"
              onClick={() => void unverify()}
              disabled={busy !== null}
              className="btn-secondary btn-sm"
            >
              <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
              {busy === 'unverify' ? 'Removing…' : 'Remove verification'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void verify()}
              disabled={busy !== null}
              className="btn-primary btn-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {busy === 'verify' ? 'Verifying…' : 'Verify provider'}
            </button>
          )}
          {latestVerification && (
            <Link href={`/admin/verifications/${latestVerification.id}`} className="btn-secondary btn-sm">
              <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
              {pendingVerification ? 'Review submission' : 'Verification history'}
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      {editing && (
        <div className="surface-panel p-4">
          <ProviderEditor provider={provider} onSaved={onChanged} onCancel={() => setEditing(false)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <dl>
            <Row label="Business phone" value={provider.phone ?? '—'} />
            <Row label="Years of experience" value={provider.yearsOfExperience} />
            <Row label="Service radius" value={`${provider.serviceRadiusKm} km`} />
            <Row label="Registration number" value={provider.registrationNumber ?? '—'} />
            <Row label="Representative" value={provider.representativeName ?? '—'} />
            <Row label="Team size" value={provider.teamSize ?? '—'} />
            <Row label="Onboarding" value={provider.onboardingStep.replace(/_/g, ' ').toLowerCase()} />
          </dl>
        </div>
        <div>
          <dl>
            <Row
              label="Rating"
              value={
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-rating-500" aria-hidden="true" />
                  {Number(provider.rating).toFixed(2)} ({provider.reviewCount} reviews)
                </span>
              }
            />
            <Row label="Verified reviews" value={provider.verifiedReviewCount} />
            <Row label="Response rate" value={`${Math.round(Number(provider.responseRate))}%`} />
            <Row label="Response time" value={provider.responseTimeMinutes != null ? `${provider.responseTimeMinutes} min` : '—'} />
            <Row label="Availability" value={provider.availabilityStatus.toLowerCase()} />
            <Row label="Subscription" value={<StatusBadge status={provider.subscriptionStatus} />} />
            <Row label="Badge expires" value={formatDate(provider.verificationExpiresAt)} />
          </dl>
        </div>
      </div>

      {provider.services.length > 0 && (
        <Panel title={`Services (${provider.services.length})`} bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Service</th>
                  <th scope="col">Price</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {provider.services.map((service: any) => (
                  <tr key={service.id}>
                    <td>
                      <span className="block font-medium text-ink-900">{service.title || service.service?.name}</span>
                      <span className="block text-xs text-ink-500">
                        {service.service?.category?.name ?? service.service?.name}
                      </span>
                    </td>
                    <td className="text-sm tabular text-ink-700">
                      {formatMoney(service.basePrice, service.currency)}
                      <span className="block text-2xs uppercase text-ink-400">{service.priceType.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="text-sm text-ink-600">{service.duration ?? '—'}</td>
                    <td>
                      <span className={`badge ${service.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {provider.verifications.length > 0 && (
        <Panel title="Verification history" bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Expires</th>
                  <th scope="col" className="text-right">Review</th>
                </tr>
              </thead>
              <tbody>
                {provider.verifications.map((record: any) => (
                  <tr key={record.id}>
                    <td className="text-sm text-ink-700">
                      {record.type.toLowerCase()}
                      {record.serviceOffering && (
                        <span className="block text-xs text-ink-400">
                          {record.serviceOffering.title || record.serviceOffering.service?.name}
                        </span>
                      )}
                    </td>
                    <td><StatusBadge status={record.status} /></td>
                    <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(record.submittedAt)}</td>
                    <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(record.expiresAt)}</td>
                    <td className="text-right">
                      <Link href={`/admin/verifications/${record.id}`} className="text-link text-xs">
                        Open <ArrowRight className="inline h-3 w-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {provider.subscriptions.length > 0 && (
        <Panel title="Subscriptions" bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Renewal</th>
                </tr>
              </thead>
              <tbody>
                {provider.subscriptions.map((subscription: any) => (
                  <tr key={subscription.id}>
                    <td>
                      <span className="block font-medium text-ink-900">{subscription.plan?.name}</span>
                      <span className="block text-xs text-ink-500">
                        {formatMoney(subscription.plan?.price, subscription.plan?.currency)} ·{' '}
                        {subscription.plan?.billingInterval?.toLowerCase()}
                      </span>
                    </td>
                    <td><StatusBadge status={subscription.status} /></td>
                    <td className="text-xs text-ink-500">{formatDate(subscription.startDate)}</td>
                    <td className="text-xs text-ink-500">{formatDate(subscription.renewalDate ?? subscription.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null);

  const load = () => {
    setLoading(true);
    adminApi
      .user(id)
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this account'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus() {
    if (!data) return;
    const nextStatus = data.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (
      nextStatus === 'SUSPENDED' &&
      !window.confirm(`Suspend ${data.firstName} ${data.lastName}? They will lose access to their account.`)
    ) {
      return;
    }
    setBusy('status');
    setError(null);
    setNotice(null);
    try {
      await adminApi.setUserStatus(data.id, nextStatus);
      setNotice(
        `${data.firstName} ${data.lastName} is now ${nextStatus.toLowerCase()}.`,
      );
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this account');
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!data) return;
    const typed = window.prompt(
      `Deleting deactivates the account and removes personal details, while keeping booking and payment history. Type the account email to confirm:\n${data.email}`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== data.email.toLowerCase()) {
      setError('The email did not match, so nothing was deleted.');
      return;
    }
    setBusy('delete');
    setError(null);
    setNotice(null);
    try {
      await adminApi.deleteUser(data.id);
      router.push('/admin/users');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete this account');
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading account…" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <PageHeader eyebrow="Admin · Users" title="Account not found" />
        <p className="text-sm text-ink-500">{error ?? 'It may have been removed.'}</p>
        <Link href="/admin/users" className="btn-secondary btn-sm mt-4">
          Back to users
        </Link>
      </main>
    );
  }

  const pendingApplications = data.providerApplications.filter((application) => application.status === 'PENDING');
  const totalBookings = data.providers.reduce((total, provider) => total + provider._count.bookings, 0);
  const totalReviews = data.providers.reduce((total, provider) => total + provider._count.reviews, 0);
  const canSuspend = data.status === 'ACTIVE';
  const canActivate = data.status === 'SUSPENDED';
  const isAdmin = data.role === 'ADMIN';

  return (
    <main className="page-workspace py-6 md:py-8">
      <BackButton variant="link" label="Back to users" fallbackHref="/admin/users" className="mb-3" />

      <PageHeader
        eyebrow="Admin · User account"
        title={`${data.firstName} ${data.lastName}`}
        description={`${data.email}${data.phone ? ` · ${data.phone}` : ''} · joined ${formatDate(data.createdAt)}`}
        actions={
          <>
            <span className="flex items-center gap-2">
              <span className="capitalize text-sm font-semibold text-ink-600">{data.role.toLowerCase()}</span>
              <StatusBadge status={data.status} />
            </span>
            {!isAdmin && (canSuspend || canActivate) && (
              <button
                type="button"
                onClick={() => void changeStatus()}
                disabled={busy !== null}
                className={canSuspend ? 'btn-secondary' : 'btn-primary'}
              >
                {busy === 'status' ? 'Updating…' : canSuspend ? 'Suspend account' : 'Reactivate account'}
              </button>
            )}
          </>
        }
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert alert-success mb-4" role="status">
          {notice}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Provider profiles"
          value={String(data.providers.length)}
          sub={data.providers.length === 1 ? 'Workspace' : 'Workspaces'}
          tone={data.providers.length > 0 ? 'brand' : 'neutral'}
        />
        <StatCard icon={CalendarDays} label="Bookings" value={String(totalBookings)} sub="Across providers" />
        <StatCard icon={Star} label="Reviews" value={String(totalReviews)} sub="Across providers" />
        <StatCard
          icon={Flag}
          label="Reports / disputes"
          value={`${data._count.reportsFiled} / ${data._count.disputesAgainst}`}
          sub="Filed / against them"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-5">
          {data.providers.length === 0 && (
            <Panel title="Provider profile">
              <EmptyState
                icon={Users}
                title="This is a client account"
                body="They have not been approved as a provider. Review their application below if they applied."
              />
            </Panel>
          )}

          {data.providers.map((provider) => (
            <Panel key={provider.id} title="Provider profile">
              <ProviderCard
                provider={provider}
                onChanged={load}
                onNotice={setNotice}
                onError={setError}
              />
            </Panel>
          ))}

          <Panel
            title="Provider applications"
            description={pendingApplications.length > 0 ? `${pendingApplications.length} waiting for a decision.` : undefined}
            bodyClassName={data.providerApplications.length === 0 ? 'p-5 sm:p-6' : 'p-0'}
          >
            {data.providerApplications.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title="No applications"
                body="This account has never applied to become a provider."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Business</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Submitted</th>
                      <th scope="col" className="text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providerApplications.map((application) => (
                      <tr key={application.id}>
                        <td>
                          <span className="block font-medium text-ink-900">{application.businessName}</span>
                          {application.decisionNote && (
                            <span className="block text-xs text-ink-500">{application.decisionNote}</span>
                          )}
                        </td>
                        <td className="text-xs uppercase text-ink-500">{application.providerType}</td>
                        <td><StatusBadge status={application.status} /></td>
                        <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(application.createdAt)}</td>
                        <td className="text-right">
                          <Link
                            href={`/admin/provider-applications/${application.id}`}
                            className="btn-secondary btn-sm whitespace-nowrap"
                          >
                            {application.status === 'PENDING' ? 'Review' : 'View'}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {!isAdmin && (
            <Panel title="Danger zone">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">Delete this account</p>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-500">
                    Deactivates the account, removes personal and business profile details, and revokes all
                    sessions. Booking, review and payment history is kept for the other party.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteAccount()}
                  disabled={busy !== null}
                  className="btn-danger"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {busy === 'delete' ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel title="Account">
            <dl>
              <Row label="Email" value={<span className="inline-flex items-center gap-1.5">{data.email}{data.emailVerified && <MailCheck className="h-3.5 w-3.5 text-success-600" aria-label="Verified" />}</span>} />
              <Row label="Phone" value={<span className="inline-flex items-center gap-1.5">{data.phone ?? '—'}{data.phoneVerified && <PhoneCall className="h-3.5 w-3.5 text-success-600" aria-label="Verified" />}</span>} />
              <Row label="Role" value={<span className="capitalize">{data.role.toLowerCase()}</span>} />
              <Row label="Status" value={<StatusBadge status={data.status} />} />
              <Row label="Language" value={data.locale} />
              <Row label="Client profile" value={data.clientProfile ? 'Yes' : 'No'} />
              <Row label="Created" value={formatDateTime(data.createdAt)} />
              <Row label="Updated" value={formatDateTime(data.updatedAt)} />
            </dl>
          </Panel>

          {data.clientProfile && (
            <Panel title="Client activity">
              <dl>
                <Row label="Service requests" value={data.clientProfile._count.serviceRequests} />
                <Row label="Bookings" value={data.clientProfile._count.bookings} />
                <Row label="Reviews written" value={data.clientProfile._count.reviews} />
                <Row label="Reports filed" value={data._count.reportsFiled} />
                <Row label="Disputes raised" value={data._count.disputesRaised} />
                <Row label="Disputes against" value={data._count.disputesAgainst} />
              </dl>
              {data.clientProfile.bio && (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <p className="label">Client bio</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{data.clientProfile.bio}</p>
                </div>
              )}
            </Panel>
          )}

          <Panel title="Quick links">
            <div className="flex flex-col gap-2">
              <Link href={`/admin/provider-applications`} className="btn-secondary btn-sm justify-start">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Provider applications
              </Link>
              <Link href="/admin/verifications" className="btn-secondary btn-sm justify-start">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verification queue
              </Link>
              <Link href="/admin/audit-logs" className="btn-secondary btn-sm justify-start">
                <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                Audit trail
              </Link>
              <Link href="/admin/subscriptions" className="btn-secondary btn-sm justify-start">
                <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                Subscriptions
              </Link>
            </div>
          </Panel>

          <Panel title="Contact">
            <div className="space-y-2 text-sm">
              <a href={`mailto:${data.email}`} className="flex items-center gap-2 text-link">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                {data.email}
              </a>
              {data.phone && (
                <a href={`tel:${data.phone}`} className="flex items-center gap-2 text-link">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  {data.phone}
                </a>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
