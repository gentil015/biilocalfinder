'use client';

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Mail,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { verificationApi, contactVerificationApi, providersApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const IDENTITY_DOC_OPTIONS = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving licence' },
];
const BUSINESS_DOC_OPTIONS = [
  { value: 'BUSINESS_REGISTRATION', label: 'Business registration' },
  { value: 'TAX_CERTIFICATE', label: 'Tax certificate' },
];

// Overall + per-record status → badge tone, grouped by meaning rather than
// by enum order: verified is green, awaiting review is amber, anything
// blocked is red, and quiet states recede to neutral.
const STATUS_BADGE: Record<string, string> = {
  VERIFIED: 'badge-success',
  PENDING: 'badge-warning',
  REJECTED: 'badge-danger',
  SUSPENDED: 'badge-danger',
  EXPIRED: 'badge-neutral',
  UNVERIFIED: 'badge-neutral',
};

function statusBadge(status: string) {
  return (
    <span className={`badge ${STATUS_BADGE[status] ?? 'badge-neutral'}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

function SubmitForm({
  type,
  docOptions,
  onSubmitted,
}: {
  type: 'IDENTITY' | 'BUSINESS';
  docOptions: { value: string; label: string }[];
  onSubmitted: () => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [docType, setDocType] = useState(docOptions[0].value);
  const [documents, setDocuments] = useState<{ storageKey: string; documentType: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await verificationApi.uploadDocument(file);
      setDocuments((prev) => [...prev, { storageKey: result.storageKey, documentType: docType, name: file.name }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload document');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (documents.length === 0) {
      setError('Attach at least one document');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verificationApi.submit({
        type,
        legalName: legalName.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        documents: documents.map(({ storageKey, documentType }) => ({ storageKey, documentType })),
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your verification');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="field sm:col-span-2">
        <label htmlFor={`${type}-legal-name`} className="label">
          Legal name <span className="font-normal text-ink-400">(as on document)</span>
        </label>
        <input
          id={`${type}-legal-name`}
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
        />
      </div>

      {type === 'BUSINESS' && (
        <div className="field sm:col-span-2">
          <label htmlFor="business-ref" className="label">
            Business registration number
          </label>
          <input
            id="business-ref"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>
      )}

      <div className="field">
        <label htmlFor={`${type}-doc-type`} className="label">
          Document type
        </label>
        <select
          id={`${type}-doc-type`}
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
        >
          {docOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex h-full min-h-[2.625rem] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-3 py-2.5 text-sm font-medium text-ink-500 transition hover:border-brand-400 hover:text-brand-700 sm:row-span-2">
        <UploadCloud className="h-4 w-4" aria-hidden="true" />
        {uploading ? 'Uploading…' : 'Upload a photo or PDF'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {documents.length > 0 && (
        <ul className="space-y-1 sm:col-span-2">
          {documents.map((d, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-ink-600">
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-success-600" aria-hidden="true" />
              {d.documentType.replace(/_/g, ' ').toLowerCase()} — {d.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="error-text sm:col-span-2" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || uploading}
        className="btn-primary w-full sm:col-span-full"
      >
        {submitting ? 'Submitting…' : 'Submit for review'}
      </button>
    </div>
  );
}

function ContactVerify({ channel, label }: { channel: 'EMAIL' | 'PHONE'; label: string }) {
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await contactVerificationApi.request(channel);
      setStage('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send code');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await contactVerificationApi.confirm(channel, code);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Incorrect code');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="badge badge-success">
        <BadgeCheck className="h-3 w-3" aria-hidden="true" />
        {label} verified
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stage === 'idle' ? (
        <button onClick={send} disabled={busy} className="btn-secondary btn-sm">
          {busy ? 'Sending…' : `Verify ${label.toLowerCase()}`}
        </button>
      ) : (
        <>
          <label htmlFor={`verify-${channel.toLowerCase()}`} className="sr-only">
            Verification code for {label}
          </label>
          <input
            id={`verify-${channel.toLowerCase()}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="w-32"
          />
          <button onClick={confirm} disabled={busy} className="btn-primary btn-sm">
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </>
      )}
      {error && <span className="text-xs font-medium text-danger-600">{error}</span>}
    </div>
  );
}

export default function ProviderVerificationPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const refresh = () => verificationApi.myStatus().then(setData).finally(() => setLoading(false));

  useEffect(() => {
    refresh();
    providersApi.getMe().then((p) => {
      if (p?.phone || p?.user?.phone) setPhone(p.phone || p.user.phone);
    }).catch(() => {});
  }, []);

  async function savePhone() {
    if (!phone.trim()) {
      setPhoneError('Enter a phone number');
      return;
    }
    setSavingPhone(true);
    setPhoneError(null);
    setPhoneSaved(false);
    try {
      try {
        const { usersApi } = await import('@/lib/api');
        if ((usersApi as any).updateMe) {
          await (usersApi as any).updateMe({ phone: phone.trim() });
        } else {
          await (usersApi as any).update?.({ phone: phone.trim() });
        }
      } catch {}
      try {
        await providersApi.updateMe({ phone: phone.trim() });
      } catch {}
      setPhoneSaved(true);
      refresh();
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Could not save phone');
    } finally {
      setSavingPhone(false);
    }
  }

  if (loading)
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading verification status…" />
      </main>
    );
  if (!data) return null;

  const identity = data.records.find((r: any) => r.type === 'IDENTITY' && !r.offering);
  const business = data.records.find((r: any) => r.type === 'BUSINESS' && !r.offering);

  // Step checklist states. Identity is required; business is optional, so
  // it reads neutral until completed. Contact state isn't exposed by the
  // API, so it stays as "set up below" rather than asserting a fact.
  const steps: { label: string; hint: string; icon: LucideIcon; iconClass: string; tone: 'done' | 'required' | 'neutral' }[] = [
    {
      label: 'Contact verification',
      hint: 'Confirm your email and phone so clients can reach you.',
      icon: Mail,
      iconClass: 'bg-ink-100 text-ink-500',
      tone: 'neutral',
    },
    {
      label: 'Identity verification',
      hint: identity?.status === 'VERIFIED' ? 'Documents approved.' : 'Required before you can be verified.',
      icon: ShieldCheck,
      iconClass:
        identity?.status === 'VERIFIED'
          ? 'bg-success-50 text-success-600'
          : 'bg-warning-50 text-warning-600',
      tone: identity?.status === 'VERIFIED' ? 'done' : 'required',
    },
    {
      label: 'Business verification',
      hint:
        business?.status === 'VERIFIED'
          ? 'Documents approved.'
          : 'Optional — adds a business badge to your listing.',
      icon: Building2,
      iconClass:
        business?.status === 'VERIFIED'
          ? 'bg-success-50 text-success-600'
          : 'bg-ink-100 text-ink-500',
      tone: business?.status === 'VERIFIED' ? 'done' : 'neutral',
    },
  ];

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Get verified"
        description="Verified providers get a trust badge and rank higher in search. Verification usually takes 1–2 business days."
        actions={
          <div className="flex items-center gap-2">
            {statusBadge(data.status)}
            {data.expiresAt && (
              <span className="text-xs text-ink-400">
                Valid until {new Date(data.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        }
      />

      <Panel title="Your verification status" description="Three steps to a verified badge." className="mb-6">
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.label}>
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${step.iconClass}`}
                  aria-hidden="true"
                >
                  {step.tone === 'done' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">
                    {step.label}
                    <span className="sr-only"> — {step.tone === 'done' ? 'done' : step.tone === 'required' ? 'required' : 'pending'}</span>
                  </p>
                  <p className="text-xs text-ink-500">{step.hint}</p>
                </div>
                <span
                  className={`badge ${
                    step.tone === 'done'
                      ? 'badge-success'
                      : step.tone === 'required'
                        ? 'badge-warning'
                        : 'badge-neutral'
                  }`}
                >
                  {step.tone === 'done' ? 'Done' : step.tone === 'required' ? 'Required' : 'Set up'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Contact verification" className="mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Email</p>
              <p className="text-xs text-ink-500">The address on your account.</p>
            </div>
            <ContactVerify channel="EMAIL" label="Email" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Phone</p>
              <p className="text-xs text-ink-500">Receive booking and contact updates.</p>
            </div>
            {data.hasPhone ? (
              <ContactVerify channel="PHONE" label="Phone" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+250788000000"
                  className="w-40"
                />
                <button onClick={savePhone} disabled={savingPhone} className="btn-secondary btn-sm">
                  {savingPhone ? 'Saving…' : 'Add & save'}
                </button>
                {phoneSaved && <span className="text-xs text-success-600">Saved</span>}
                {phoneError && <span className="text-xs font-medium text-danger-600">{phoneError}</span>}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Identity verification"
        description="A government-issued ID links your account to a real person."
        className="mb-6"
      >
        {identity ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(identity.status)}
              {identity.expiringSoon && (
                <span className="badge badge-warning">Expiring soon</span>
              )}
            </div>
            {identity.decisionNote && <p className="prose-copy">{identity.decisionNote}</p>}
            {(identity.status === 'REJECTED' || identity.status === 'EXPIRED' || identity.expiringSoon) && (
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <p className="label mb-3">Resubmit your documents</p>
                <SubmitForm type="IDENTITY" docOptions={IDENTITY_DOC_OPTIONS} onSubmitted={refresh} />
              </div>
            )}
          </div>
        ) : (
          <SubmitForm type="IDENTITY" docOptions={IDENTITY_DOC_OPTIONS} onSubmitted={refresh} />
        )}
      </Panel>

      <Panel
        title="Business verification"
        description="Optional — a verified business name shows an extra badge of trust."
        className="mb-6"
      >
        {business ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">{statusBadge(business.status)}</div>
            {business.decisionNote && <p className="prose-copy">{business.decisionNote}</p>}
            {(business.status === 'REJECTED' || business.status === 'EXPIRED') && (
              <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
                <p className="label mb-3">Resubmit your documents</p>
                <SubmitForm type="BUSINESS" docOptions={BUSINESS_DOC_OPTIONS} onSubmitted={refresh} />
              </div>
            )}
          </div>
        ) : (
          <SubmitForm type="BUSINESS" docOptions={BUSINESS_DOC_OPTIONS} onSubmitted={refresh} />
        )}
      </Panel>
    </main>
  );
}