'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Eye, EyeOff, UserRound, Wrench } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT, AUTH_POINTS_PROVIDER } from '@/components/auth-shell';
import { useAuth, homeForRole } from '@/components/auth-provider';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';

const ROLES = [
  {
    value: 'CLIENT' as const,
    labelKey: 'register.roleClient' as MessageKey,
    hintKey: 'register.roleClientHint' as MessageKey,
    icon: UserRound,
  },
  {
    value: 'PROVIDER' as const,
    labelKey: 'register.roleProvider' as MessageKey,
    hintKey: 'register.roleProviderHint' as MessageKey,
    icon: Wrench,
  },
];

function RegisterForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: sessionLoading, login: adoptSession } = useAuth();
  // Provider CTAs link here with ?role=provider so the "I'm offering" option is
  // already selected instead of defaulting to the hiring (client) form.
  const [role, setRole] = useState<'CLIENT' | 'PROVIDER'>(
    searchParams.get('role') === 'provider' ? 'PROVIDER' : 'CLIENT',
  );
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Set while we are creating an account on this very page. `adoptSession`
  // populates `user`, which would otherwise trip the redirect below and
  // bounce a brand-new provider to their (empty) workspace dashboard instead
  // of onboarding.
  const justRegistered = useRef(false);

  // A signed-in visitor has no business on the signup form — it would
  // create a second account. Send them where they actually belong.
  useEffect(() => {
    if (sessionLoading || !user) return;
    if (justRegistered.current) {
      justRegistered.current = false;
      return;
    }
    router.replace(homeForRole(user.role));
  }, [user, sessionLoading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.register({
        ...form,
        role,
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      justRegistered.current = true;
      await adoptSession(tokens);
      const requestedNext = new URLSearchParams(window.location.search).get('next');
      const next =
        requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;
      router.push(next ?? (role === 'PROVIDER' ? '/provider/onboarding' : '/'));
    } catch (err) {
      justRegistered.current = false;
      setError(err instanceof ApiError ? err.message : t('register.failed'));
    } finally {
      setLoading(false);
    }
  }

  const isProvider = role === 'PROVIDER';

  return (
    <AuthShell
      eyebrow={isProvider ? t('register.forProviders') : t('register.forClients')}
      heading={isProvider ? t('register.headingProvider') : t('register.headingClient')}
      footer={
        <>
          {t('register.footer')}{' '}
          <Link href="/login" className="text-link">
            {t('register.footerAction')}
          </Link>
        </>
      }
      asideFooter={t('register.asideFooter')}
      points={isProvider ? AUTH_POINTS_PROVIDER : AUTH_POINTS_CLIENT}
    >
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-950">
        {t('register.title')}
      </h1>
      <p className="mt-2 text-sm text-ink-500">{t('register.subtitle')}</p>

      {/* Role switch. Two explicit cards rather than a free-text choice —
          this is the single decision that shapes the whole onboarding, so the
          title, icon and one-line hint all restate who each option is for. */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-ink-800">{t('register.roleQuestion')}</p>
        <div
          role="radiogroup"
          aria-label={t('register.accountType')}
          className="mt-2.5 grid grid-cols-1 gap-2.5"
        >
          {ROLES.map(({ value, labelKey, hintKey, icon: Icon }) => {
            const active = role === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setRole(value)}
                className={`group flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                  active
                    ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-600'
                    : 'border-ink-200 bg-surface hover:border-ink-300 hover:bg-ink-25'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${
                    active ? 'bg-brand-700 text-white' : 'bg-ink-100 text-ink-600 group-hover:text-ink-800'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink-950">{t(labelKey)}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{t(hintKey)}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                    active ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-300'
                  }`}
                >
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
          <div className="field">
            <label htmlFor="firstName" className="label">
              {t('register.firstName')}
            </label>
            <input
              id="firstName"
              required
              autoComplete="given-name"
              placeholder={t('register.firstNamePlaceholder')}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="lastName" className="label">
              {t('register.lastName')}
            </label>
            <input
              id="lastName"
              required
              autoComplete="family-name"
              placeholder={t('register.lastNamePlaceholder')}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="email" className="label">
            {t('auth.email')}
          </label>
          <input
            id="email"
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="label">
            {t('auth.password')}
          </label>
          <div className="relative">
            <input
              id="password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={8}
              placeholder={t('register.passwordHint')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-400 transition hover:text-ink-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-600">
          <input
            type="checkbox"
            required
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-ink-300 accent-brand-600"
          />
          <span>
            {t('register.termsPrefix')}{' '}
            <Link href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline underline-offset-2">
              {t('register.termsLink')}
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="alert alert-error py-3" role="alert">
            {error}
          </div>
        )}

        <button disabled={loading} className="btn-primary btn-lg mt-1 w-full">
          {loading
            ? t('register.creating')
            : isProvider
              ? t('register.submitProvider')
              : t('register.submitClient')}
        </button>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
