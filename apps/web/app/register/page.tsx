'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserRound, Wrench } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT, AUTH_POINTS_PROVIDER } from '@/components/auth-shell';
import { useAuth, homeForRole } from '@/components/auth-provider';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';

const ROLES = [
  { value: 'CLIENT' as const, labelKey: 'register.roleClient' as MessageKey, icon: UserRound },
  { value: 'PROVIDER' as const, labelKey: 'register.roleProvider' as MessageKey, icon: Wrench },
];

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading: sessionLoading, login: adoptSession } = useAuth();
  const [role, setRole] = useState<'CLIENT' | 'PROVIDER'>('CLIENT');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      const tokens = await authApi.register({ ...form, role });
      justRegistered.current = true;
      await adoptSession(tokens);
      router.push(role === 'PROVIDER' ? '/provider/onboarding' : '/');
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

      {/* Role switch. Two explicit options rather than a free-text choice —
          this is the single decision that shapes the whole onboarding. */}
      <div
        role="radiogroup"
        aria-label={t('register.accountType')}
        className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-ink-200 bg-ink-50 p-1.5"
      >
        {ROLES.map(({ value, labelKey, icon: Icon }) => {
          const active = role === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setRole(value)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-surface text-ink-950 shadow-sm ring-1 ring-ink-200'
                  : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
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
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="label">
            {t('auth.password')}
          </label>
          <input
            id="password"
            required
            type="password"
            autoComplete="new-password"
            minLength={8}
            placeholder={t('register.passwordHint')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

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
