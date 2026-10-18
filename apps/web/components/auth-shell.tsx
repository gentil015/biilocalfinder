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
    <main className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-home-night text-white lg:flex">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="bg-mesh pointer-events-none absolute inset-0 opacity-90" aria-hidden="true" />

        <div className="relative z-10 flex w-full max-w-lg flex-col justify-between p-10 xl:p-14">
          <BrandMark inverted />

          <div className="py-10">
            <p className="text-2xs font-bold uppercase tracking-[0.14em] text-accent-400">{eyebrow}</p>
            <h2 className="mt-3 font-display text-[34px] font-extrabold leading-[1.12] tracking-[-0.025em] xl:text-4xl">
              {heading}
            </h2>

            <ul className="mt-9 space-y-4">
              {points.map(({ icon: Icon, titleKey, bodyKey }) => (
                <li key={titleKey} className="flex gap-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-accent-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{t(titleKey)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/60">{t(bodyKey)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40">{asideFooter}</p>
        </div>
      </aside>

      {/* AppChrome hides the site header on auth routes, so the theme switch
          lives in the corner of the form column — a signed-out visitor has no
          other chrome to reach it from. */}
      <section className="relative flex flex-col justify-center px-5 py-12 sm:px-8">
        <ThemeToggle className="absolute right-4 top-4 sm:right-7 sm:top-7" />
        <div className="mx-auto w-full max-w-sm">
          {canGoBack && (
            <div className="mb-6">
              <BackButton variant="link" label="Back" fallbackHref="/" />
            </div>
          )}
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
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
