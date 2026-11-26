'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from 'lucide-react';
import { authApi, ApiError } from '@/lib/api';
import { AuthShell, AUTH_POINTS_CLIENT } from '@/components/auth-shell';
import { useAuth, homeForRole } from '@/components/auth-provider';
import { GoogleAuthButton } from '@/components/google-auth-button';
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
      // the role immediately instead of flashing the logged-out UI. The
      // resolved user is returned so routing below uses the real role rather
      // than a stale closure value (which was always null on first login).
      // A null here means login succeeded but the session did not stick —
      // usually a cookie policy/origin problem. Say so instead of bouncing
      // silently.
      const me = await adoptSession(tokens).catch(() => null);
      if (!me) {
        setError(t('login.failed'));
        return;
      }
      // Route by role. Sending everyone to '/' is what dropped a signed-in
      // admin into the provider onboarding wizard.
      router.push(next ?? homeForRole(me.role));
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
      <div className="relative overflow-hidden rounded-3xl border border-ink-200/70 bg-surface/95 p-6 shadow-[0_24px_80px_-32px_rgba(11,23,18,0.35)] ring-1 ring-black/[0.02] backdrop-blur-sm sm:p-8">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-accent-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200/70 bg-brand-50/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            {t('login.eyebrow')}
          </div>

          <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-ink-950 sm:text-[34px]">
            {t('login.title')}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">{t('login.description')}</p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-5">
            {justReset && (
              <div
                className="flex items-start gap-3 rounded-2xl border border-success-200/70 bg-success-50/80 px-4 py-3 text-sm text-success-800"
                role="status"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('login.passwordUpdated')}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="field gap-2">
                <label htmlFor="email" className="label text-ink-700">
                  {t('auth.email')}
                </label>
                <div className="group relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-600"
                    aria-hidden="true"
                  />
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
                    className="h-12 rounded-xl border-ink-200 bg-canvas/40 pl-10 pr-4 shadow-sm transition focus:border-brand-500 focus:bg-surface focus:ring-4 focus:ring-brand-500/10"
                  />
                </div>
              </div>

              <div className="field gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="password" className="label text-ink-700">
                    {t('auth.password')}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-brand-700 transition hover:text-brand-800 hover:underline underline-offset-4"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="group relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-colors group-focus-within:text-brand-600"
                    aria-hidden="true"
                  />
                  <input
                    id="password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-12 rounded-xl border-ink-200 bg-canvas/40 pl-10 pr-12 shadow-sm transition focus:border-brand-500 focus:bg-surface focus:ring-4 focus:ring-brand-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-400 transition hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-error rounded-2xl border-danger-200/70 bg-danger-50/80 py-3" role="alert">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="btn-primary group mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold shadow-lg shadow-brand-900/20 transition hover:shadow-xl hover:shadow-brand-900/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('login.submitting')}
                </>
              ) : (
                <>
                  {t('login.submit')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <GoogleAuthButton mode="login" next={next} onError={setError} />
        </div>
      </div>
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
