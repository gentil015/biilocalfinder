'use client';

import { Quote, BadgeCheck, Wallet, MessageCircle, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { BackButton, useCanGoBack } from '@/components/back-button';
import { useI18n } from '@/components/locale-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import type { MessageKey } from '@/lib/locales';

/**
 * Split-screen shell shared by /login and /register.
 *
 * The form column is deliberately narrow (max-w-sm) — sign-in forms that span
 * the full viewport are measurably harder to scan. The aside carries the
 * pitch and is hidden below `lg`, where the brand mark moves into the form.
 */
export function AuthShell({
  eyebrow,
  heading,
  asideFooter,
  points,
  footer,
  children,
}: {
  eyebrow: string;
  heading: string;
  asideFooter: string;
  points: { icon: LucideIcon; titleKey: MessageKey; bodyKey: MessageKey }[];
  /** Rendered under the form — the "already have an account?" switch. */
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const canGoBack = useCanGoBack();

  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-home-night text-white lg:flex">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="bg-mesh pointer-events-none absolute inset-0 opacity-90" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex w-full max-w-lg flex-col justify-between p-10 xl:p-14">
          <BrandMark inverted />

          <div className="py-10">
            <p className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-bold uppercase tracking-[0.14em] text-accent-300">
              {eyebrow}
            </p>
            <h2 className="mt-4 font-display text-[34px] font-extrabold leading-[1.12] tracking-[-0.025em] text-white xl:text-[40px]">
              {heading}
            </h2>

            <ul className="mt-9 space-y-4">
              {points.map(({ icon: Icon, titleKey, bodyKey }) => (
                <li
                  key={titleKey}
                  className="flex gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-300 ring-1 ring-white/10">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white">{t(titleKey)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/65">{t(bodyKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/45">{asideFooter}</p>
        </div>
      </aside>

      {/* AppChrome hides the site header on auth routes, so the theme switch
          lives in the corner of the form column — a signed-out visitor has no
          other chrome to reach it from.

          On phones the form no longer centres vertically: back, brand and
          theme share one top bar, and the form flows down from it. Centring
          the whole column is what used to drop the back button into the
          middle of the screen. */}
      <section className="relative flex min-h-dvh flex-col overflow-hidden px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:justify-center lg:px-10 lg:py-12">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(34,197,94,0.10),transparent),radial-gradient(ellipse_50%_40%_at_100%_100%,rgba(250,204,21,0.08),transparent)]"
          aria-hidden="true"
        />
        <div className="relative mb-8 flex items-center justify-between gap-2 lg:hidden">
          {canGoBack ? (
            <BackButton variant="icon" label="Back" fallbackHref="/" />
          ) : (
            <span className="h-10 w-10" aria-hidden="true" />
          )}
          <BrandMark responsive />
          <ThemeToggle />
        </div>

        <ThemeToggle className="absolute right-4 top-4 hidden sm:right-7 sm:top-7 lg:block" />

        <div className="relative mx-auto w-full max-w-md">
          {canGoBack && (
            <div className="mb-5 hidden lg:block">
              <BackButton variant="link" label="Back" fallbackHref="/" />
            </div>
          )}
          {children}
          <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
        </div>
      </section>
    </main>
  );
}

export const AUTH_POINTS_CLIENT = [
  {
    icon: BadgeCheck,
    titleKey: 'auth.pointVerifiedTitle' as MessageKey,
    bodyKey: 'auth.pointVerifiedBody' as MessageKey,
  },
  {
    icon: Quote,
    titleKey: 'auth.pointCompareTitle' as MessageKey,
    bodyKey: 'auth.pointCompareBody' as MessageKey,
  },
  {
    icon: Wallet,
    titleKey: 'auth.pointPayTitle' as MessageKey,
    bodyKey: 'auth.pointPayBody' as MessageKey,
  },
];

export const AUTH_POINTS_PROVIDER = [
  {
    icon: BadgeCheck,
    titleKey: 'auth.pointNearbyTitle' as MessageKey,
    bodyKey: 'auth.pointNearbyBody' as MessageKey,
  },
  {
    icon: MessageCircle,
    titleKey: 'auth.pointPipelineTitle' as MessageKey,
    bodyKey: 'auth.pointPipelineBody' as MessageKey,
  },
  {
    icon: Quote,
    titleKey: 'auth.pointPriceTitle' as MessageKey,
    bodyKey: 'auth.pointPriceBody' as MessageKey,
  },
];
