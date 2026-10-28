'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT } from '@/components/auth-shell';
import { useAuth, useSession, homeForRole } from '@/components/auth-provider';
import { useI18n } from '@/components/locale-provider';

// useSearchParams needs a Suspense boundary during static prerendering.
function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sent here by /reset-password after a successful change, so the user knows
  // the sign-out they're seeing is expected and not a bug.
  const justReset = searchParams.get('reset') === '1';
  const requestedNext = searchParams.get('next');
  const next = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null;
  const { login: adoptSession } = useAuth();
  // `session` re-renders once adoptSession has resolved the user, so
  // homeForRole below always reads the real role rather than the null it was
  // before login.
  const session = useSession();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.login(form);
      // Store the tokens AND resolve the session, so the header/guards know
      // the role immediately instead of flashing the logged-out UI.
      await adoptSession(tokens);
      // Route by role. Sending everyone to '/' is what dropped a signed-in
      // admin into the provider onboarding wizard.
      router.push(next ?? homeForRole(session.user?.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow={t('login.eyebrow')}
      heading={t('login.heading')}
      footer={
        <>
          {t('login.footer')}{' '}
          <Link href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'} className="text-link">
            {t('login.footerAction')}
          </Link>
        </>
      }
      asideFooter={t('login.asideCities')}
      points={AUTH_POINTS_CLIENT}
    >
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ink-950">{t('login.title')}</h1>
      <p className="mt-2 text-sm text-ink-500">{t('login.description')}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        {justReset && (
          <div className="alert alert-success py-3" role="status">
            {t('login.passwordUpdated')}
          </div>
        )}

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
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="password" className="label">
              {t('auth.password')}
            </label>
            <Link href="/forgot-password" className="text-link text-xs">
              {t('auth.forgotPassword')}
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-400 transition hover:text-ink-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error py-3" role="alert">
            {error}
          </div>
        )}

        <button disabled={loading} className="btn-primary btn-lg mt-1 w-full">
          {loading ? t('login.submitting') : t('login.submit')}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
