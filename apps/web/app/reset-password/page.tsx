'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT } from '@/components/auth-shell';
import { useI18n } from '@/components/locale-provider';

// Mirrors RegisterDto's rule (min 8). The API enforces it too; this is only
// so the user finds out before a round trip.
const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [code, setCode] = useState(token);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError(t('reset.noCode'));
      return;
    }
    if (form.password !== form.confirm) {
      setError(t('reset.mismatch'));
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setError(t('reset.minChars', { min: MIN_PASSWORD_LENGTH }));
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(code.trim(), form.password);
      router.replace('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('reset.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow={t('reset.eyebrow')}
      heading={t('reset.heading')}
      footer={
        <>
          {t('reset.footer')}{' '}
          <Link href="/login" className="text-link">
            {t('reset.footerAction')}
          </Link>
        </>
      }
      asideFooter={t('login.asideCities')}
      points={AUTH_POINTS_CLIENT}
    >
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-950">
        {t('reset.title')}
      </h1>
      <p className="mt-2 text-sm text-ink-500">{t('reset.descriptionCode')}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="field">
          <label htmlFor="code" className="label">
            {t('reset.code')}
          </label>
          <input
            id="code"
            required
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="label">
            {t('reset.newPassword')}
          </label>
          <input
            id="password"
            required
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={MIN_PASSWORD_LENGTH}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <p className="mt-1 text-xs text-ink-500">{t('reset.minChars', { min: MIN_PASSWORD_LENGTH })}</p>
        </div>

        <div className="field">
          <label htmlFor="confirm" className="label">
            {t('reset.confirmPassword')}
          </label>
          <input
            id="confirm"
            required
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            minLength={MIN_PASSWORD_LENGTH}
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
        </div>

        {error && (
          <div className="alert alert-error py-3" role="alert">
            {error}
          </div>
        )}

        <button disabled={loading} className="btn-primary btn-lg mt-1 w-full">
          {loading ? t('reset.updating') : t('reset.submit')}
        </button>
        <Link href="/forgot-password" className="btn-ghost w-full text-center">
          {t('reset.requestNewCode')}
        </Link>
      </form>
    </AuthShell>
  );
}

// useSearchParams needs a Suspense boundary during static prerendering.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}