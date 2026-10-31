'use client';

import { useEffect, useId, useState } from 'react';
import { BadgeCheck, Pencil, ShieldCheck } from 'lucide-react';
import { contactVerificationApi, usersApi, ApiError } from '@/lib/api';
import { Panel } from '@/components/ui/page';

type ContactUser = Awaited<ReturnType<typeof usersApi.me>>;
type Channel = 'EMAIL' | 'PHONE';

function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="badge badge-success">
      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
      {label} verified
    </span>
  );
}

function VerifyControl({
  channel,
  target,
  label,
  onVerified,
}: {
  channel: Channel;
  target: string;
  label: string;
  onVerified: () => void;
}) {
  const [stage, setStage] = useState<'idle' | 'sent'>('idle');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await contactVerificationApi.request(channel);
      setStage('sent');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await contactVerificationApi.confirm(channel, code.trim());
      setCode('');
      setStage('idle');
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Incorrect code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {stage === 'idle' ? (
        <button type="button" onClick={() => void send()} disabled={busy} className="btn-secondary btn-sm">
          {busy ? 'Sending…' : `Verify ${label.toLowerCase()}`}
        </button>
      ) : (
        <>
          <p className="text-xs text-ink-500">
            Code sent to <span className="font-medium text-ink-700">{target}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              Verification code for {label}
            </label>
            <input
              id={inputId}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              className="w-32"
            />
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy || code.length !== 6}
              className="btn-primary btn-sm"
            >
              {busy ? 'Checking…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStage('idle');
                setCode('');
                setError(null);
              }}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="text-xs font-medium text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ContactVerificationPanel({
  className = '',
  description = 'Confirm ownership of the contact details on your account. Phone verification is required for a verified provider badge.',
  savePhone,
  onChanged,
}: {
  className?: string;
  description?: string;
  savePhone?: (phone: string) => Promise<unknown>;
  onChanged?: () => void;
}) {
  const [contact, setContact] = useState<ContactUser | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const phoneInputId = useId();

  async function load() {
    const user = await usersApi.me();
    setContact(user);
    setPhoneInput(user.phone ?? '');
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, []);

  async function saveNumber() {
    const phone = phoneInput.trim();
    if (!phone) {
      setPhoneError('Enter a phone number');
      return;
    }

    setSavingPhone(true);
    setPhoneError(null);
    try {
      await (savePhone ?? ((value: string) => usersApi.updateMe({ phone: value })))(phone);
      const user = await usersApi.me();
      setContact(user);
      setPhoneInput(user.phone ?? phone);
      setEditingPhone(false);
      onChanged?.();
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Could not save your phone number');
    } finally {
      setSavingPhone(false);
    }
  }

  if (!contact) {
    return (
      <Panel title="Contact verification" description={description} className={className}>
        <p className="text-sm text-ink-500">Loading your contact details…</p>
      </Panel>
    );
  }

  return (
    <Panel title="Contact verification" description={description} className={className}>
      <div className="divide-y divide-ink-100">
        <div className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Email</p>
            <p className="mt-0.5 break-all text-xs text-ink-500">{contact.email}</p>
          </div>
          {contact.emailVerified ? (
            <VerifiedBadge label="Email" />
          ) : (
            <VerifyControl
              channel="EMAIL"
              target={contact.email}
              label="Email"
              onVerified={() => {
                setContact((current) => (current ? { ...current, emailVerified: true } : current));
                onChanged?.();
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Phone</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {contact.phone || 'No phone number on your account yet.'}
            </p>
          </div>

          {editingPhone || !contact.phone ? (
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={phoneInputId} className="sr-only">
                  Phone number
                </label>
                <input
                  id={phoneInputId}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+250788000000"
                  autoComplete="tel"
                  className="w-44"
                />
                <button
                  type="button"
                  onClick={() => void saveNumber()}
                  disabled={savingPhone}
                  className="btn-primary btn-sm"
                >
                  {savingPhone ? 'Saving…' : contact.phone ? 'Save number' : 'Add number'}
                </button>
                {contact.phone && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPhone(false);
                      setPhoneInput(contact.phone ?? '');
                      setPhoneError(null);
                    }}
                    disabled={savingPhone}
                    className="btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {phoneError && (
                <p className="text-xs font-medium text-danger-600" role="alert">
                  {phoneError}
                </p>
              )}
            </div>
          ) : contact.phoneVerified ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <VerifiedBadge label="Phone" />
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
                className="btn-secondary btn-sm"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <VerifyControl
                channel="PHONE"
                target={contact.phone}
                label="Phone"
                onVerified={() => {
                  setContact((current) => (current ? { ...current, phoneVerified: true } : current));
                  onChanged?.();
                }}
              />
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
                className="btn-secondary btn-sm"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-xl bg-ink-50 px-3.5 py-3 text-xs leading-relaxed text-ink-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        Changing your phone number clears its verified status until the new number is confirmed. Codes
        expire after 10 minutes.
      </p>
    </Panel>
  );
}
