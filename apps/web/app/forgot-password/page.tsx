'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT } from '@/components/auth-shell';
import { useI18n } from '@/components/locale-provider';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('forgot.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow={t('forgot.eyebrow')}
      heading={t('forgot.heading')}
      footer={
        <>
          {t('forgot.footer')}{' '}
          <Link href="/login" className="text-link">
            {t('forgot.footerAction')}
          </Link>
        </>
      }
      asideFooter={t('login.asideCities')}
      points={AUTH_POINTS_CLIENT}
    >
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-950">
        {t('forgot.title')}
      </h1>
      <p className="mt-2 text-sm text-ink-500">{t('forgot.description')}</p>

      {sent ? (
        <div className="mt-8 flex flex-col gap-4">
          <div className="alert alert-success" role="status">
            {t('forgot.sentCode')}
          </div>
          <Link href="/reset-password" className="btn-primary btn-lg w-full text-center">
            {t('forgot.enterCode')}
          </Link>
          <p className="text-sm text-ink-500">
            {t('forgot.nothing')}{' '}
            <button
              type="button"
              className="text-link"
              onClick={() => setSent(false)}
              disabled={loading}
            >
              {t('forgot.tryDifferent')}
            </button>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert alert-error py-3" role="alert">
              {error}
            </div>
          )}

          <button disabled={loading} className="btn-primary btn-lg mt-1 w-full">
            {loading ? t('forgot.sending') : t('forgot.submit')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}