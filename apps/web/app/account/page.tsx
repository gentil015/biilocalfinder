'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Heart,
  Languages,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useSession } from '@/components/auth-provider';
import { LoadingBlock } from '@/components/ui/page';
import { localeMeta } from '@/lib/locales';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';

const ROLE_LABEL: Record<string, MessageKey> = {
  CLIENT: 'account.roleClient',
  PROVIDER: 'account.roleProvider',
  ADMIN: 'account.roleAdmin',
};

const ROLE_TONE: Record<string, string> = {
  CLIENT: 'from-brand-500 to-brand-700',
  PROVIDER: 'from-home-forest to-emerald-900',
  ADMIN: 'from-home-gold to-amber-700',
};

type AccountLink = { href: string; labelKey: MessageKey; descriptionKey: MessageKey; icon: LucideIcon };

const ACTIVITY_LINKS: AccountLink[] = [
  {
    href: '/requests',
    labelKey: 'account.linkRequests',
    descriptionKey: 'account.linkRequestsBody',
    icon: ClipboardList,
  },
  {
    href: '/bookings',
    labelKey: 'account.linkBookings',
    descriptionKey: 'account.linkBookingsBody',
    icon: CalendarClock,
  },
  {
    href: '/messages',
    labelKey: 'account.linkMessages',
    descriptionKey: 'account.linkMessagesBody',
    icon: MessagesSquare,
  },
  {
    href: '/search',
    labelKey: 'account.linkSaved',
    descriptionKey: 'account.linkSavedBody',
    icon: Heart,
  },
];

const PREFERENCE_LINKS: AccountLink[] = [
  {
    href: '/settings/notifications',
    labelKey: 'account.linkNotifications',
    descriptionKey: 'account.linkNotificationsBody',
    icon: Bell,
  },
  {
    href: '/settings/personalization',
    labelKey: 'account.linkPersonalization',
    descriptionKey: 'account.linkPersonalizationBody',
    icon: Sparkles,
  },
  {
    href: '/settings/languages',
    labelKey: 'account.linkLanguage',
    descriptionKey: 'account.linkLanguageBody',
    icon: Languages,
  },
];

/** Aligned link row used by every section so cards line up with one rhythm. */
function AccountLinkRow({ link }: { link: AccountLink }) {
  const { t } = useI18n();
  const Icon = link.icon;
  return (
    <Link href={link.href} className="group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition hover:bg-ink-50">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600 transition group-hover:bg-brand-50 group-hover:text-brand-600">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900 transition group-hover:text-brand-700">
          {t(link.labelKey)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-500">{t(link.descriptionKey)}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden="true" />
    </Link>
  );
}

export default function AccountPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { isProvider, isAdmin } = useSession();

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label={t('account.loading')} />
      </main>
    );
  }

  // The header hides the account link until /users/me resolves, so reaching
  // this state means the session went away (expired/cleared). Send them to
  // login rather than rendering an empty shell.
  if (!user) {
    return (
      <main className="page-workspace py-16">
        <div className="empty-state">
          <p className="text-sm font-bold text-ink-900">{t('account.signedOut')}</p>
          <p className="mt-1.5 text-sm text-ink-500">{t('account.signedOutBody')}</p>
          <Link href="/login" className="btn-primary btn-sm mt-5">
            {t('account.logIn')}
          </Link>
        </div>
      </main>
    );
  }

  const initials = `${user.firstName?.[0] ?? '?'}${user.lastName?.[0] ?? ''}`.toUpperCase();
  const language = localeMeta(user.locale ?? 'en').nativeName;

  return (
    <main className="page-workspace py-6 md:py-10">
      {/* Profile hero */}
      <section className="overflow-hidden rounded-3xl border border-ink-900/10 bg-white shadow-sm">
        <div className="relative h-24 overflow-hidden bg-home-forest sm:h-28">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-home-mint/30 blur-3xl" aria-hidden="true" />
            <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-home-gold/30 blur-3xl" aria-hidden="true" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
              maskImage: 'radial-gradient(ellipse 80% 90% at 20% 0%, #000 25%, transparent 75%)',
            }}
          />
          <p className="relative z-10 px-5 pt-5 font-display text-sm font-bold uppercase tracking-[0.18em] text-home-mint sm:px-6 sm:pt-6">
            {t('account.eyebrow')}
          </p>
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${ROLE_TONE[user.role] ?? ROLE_TONE.CLIENT} font-display text-2xl font-extrabold text-white shadow-lg ring-4 ring-white`}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </span>
              <div className="min-w-0 pb-0.5">
                <p className="truncate text-lg font-bold tracking-tight text-ink-950 sm:text-xl">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-sm text-ink-500">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="inline-flex items-center gap-2 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
                </span>
                {t('account.activeSession')}
              </span>
              <span className="badge badge-success">{t('account.goodStanding')}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-600">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                {language}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-ink-900/10 pt-4">
            <span className={`badge ${isAdmin ? 'badge-warning' : 'badge-brand'} shrink-0`}>
              {t(ROLE_LABEL[user.role] ?? 'account.roleClient')}
            </span>
            <span className="text-2xs uppercase tracking-[0.16em] text-ink-400">{t('account.signedInOn')}</span>
          </div>
        </div>
      </section>

      {/* Sections */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* Left: two aligned link sections */}
        <div className="space-y-5 lg:col-span-2">
          <section className="surface-card">
            <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
              <h2 className="card-title">{t('account.activity')}</h2>
              <span className="text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">{t('account.activityMeta')}</span>
            </div>
            <ul className="divide-y divide-ink-100 p-2">
              {ACTIVITY_LINKS.map((link) => (
                <li key={link.href}>
                  <AccountLinkRow link={link} />
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card">
            <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
              <h2 className="card-title">{t('account.preferences')}</h2>
              <span className="text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">{t('account.preferencesMeta')}</span>
            </div>
            <ul className="divide-y divide-ink-100 p-2">
              {PREFERENCE_LINKS.map((link) => (
                <li key={link.href}>
                  <AccountLinkRow link={link} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right: workspace + session, aligned to the left column height */}
        <div className="flex flex-col gap-5">
          <section className="surface-card flex flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-900/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-home-forest text-home-mint">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                </span>
                <h2 className="card-title">{isAdmin ? t('account.adminConsole') : t('account.providerWorkspace')}</h2>
              </div>
              {isProvider && <span className="badge badge-brand">{t('account.activeWorkspace')}</span>}
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-ink-600">
                {isProvider
                  ? t('account.providerDesc')
                  : isAdmin
                    ? t('account.adminDesc')
                    : t('account.clientDesc')}
              </p>
              <div className="mt-auto pt-4">
                {isProvider ? (
                  <Link
                    href="/dashboard"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push('/dashboard');
                    }}
                    className="btn-primary btn-sm w-full"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> {t('account.openDashboard')}
                  </Link>
                ) : isAdmin ? (
                  <Link
                    href="/admin"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push('/admin');
                    }}
                    className="btn-primary btn-sm w-full"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t('account.openAdmin')}
                  </Link>
                ) : (
                  // Not /register: that form creates a SECOND user, which would
                  // strand this account's requests, bookings and messages on the
                  // client login. Applying upgrades the account you already have.
                  <Link href="/become-a-provider" className="btn-secondary btn-sm w-full">
                    {t('account.becomeProvider')}
                  </Link>
                )}
              </div>
              {!isProvider && !isAdmin && (
                <p className="mt-3 text-2xs leading-relaxed text-ink-400">
                  {t('account.becomeProviderHint')}
                </p>
              )}
            </div>
          </section>

          <section className="surface-card flex flex-1 flex-col">
            <div className="flex items-center gap-2.5 border-b border-ink-900/10 px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="card-title">{t('account.session')}</h2>
            </div>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-ink-600">{t('account.sessionDesc')}</p>
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="btn-secondary btn-sm w-full border-ink-200 text-ink-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> {t('account.logOut')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}