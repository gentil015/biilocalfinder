'use client';

import { useState } from 'react';
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
  Download,
  Flag,
  Sparkles,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useSession } from '@/components/auth-provider';
import { LoadingBlock } from '@/components/ui/page';
import { usersApi } from '@/lib/api';
import { localeMeta } from '@/lib/locales';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';

const ROLE_LABEL: Record<string, MessageKey> = {
  CLIENT: 'account.roleClient',
  PROVIDER: 'account.roleProvider',
  ADMIN: 'account.roleAdmin',
};

const ROLE_TONE: Record<string, string> = {
  CLIENT: 'from-[#15803D] to-[#166534]',
  PROVIDER: 'from-home-forest to-[#0B1712]',
  ADMIN: 'from-[#B45309] to-[#92400E]',
};

type AccountLink = { href: string; labelKey: MessageKey; descriptionKey: MessageKey; icon: LucideIcon };

// Client-only: the only surface that writes client_profiles.bio and the
// account's name/avatar. Providers edit their business on /provider/profile.
const CLIENT_PROFILE_LINK: AccountLink = {
  href: '/account/profile',
  labelKey: 'account.linkProfile',
  descriptionKey: 'account.linkProfileBody',
  icon: UserRound,
};

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
    href: '/account/reports',
    labelKey: 'account.linkReports',
    descriptionKey: 'account.linkReportsBody',
    icon: Flag,
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
    href: '/account/verification',
    labelKey: 'account.linkVerification',
    descriptionKey: 'account.linkVerificationBody',
    icon: ShieldCheck,
  },
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
  const { isProvider, isAdmin, isClient } = useSession();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    try {
      const data = await usersApi.exportMe();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bii-account-export.json';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await usersApi.deleteMe(deletePassword);
      await logout();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the account');
      setDeleting(false);
    }
  }

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
      <section className="overflow-hidden rounded-3xl border border-ink-900/10 bg-surface shadow-sm">
        <div className="relative h-24 overflow-hidden bg-home-forest sm:h-28">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -left-10 -top-16 h-48 w-48 rounded-full bg-home-mint/30 blur-3xl" aria-hidden="true" />
            <div className="absolute -right-8 bottom-0 h-40 w-40 rounded-full bg-brand-400/30 blur-3xl" aria-hidden="true" />
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
                className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${ROLE_TONE[user.role] ?? ROLE_TONE.CLIENT} font-display text-2xl font-extrabold text-white shadow-lg ring-4 ring-surface`}
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
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <section className="surface-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/10 px-5 py-4">
              <h2 className="card-title">{t('account.activity')}</h2>
              <span className="text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">{t('account.activityMeta')}</span>
            </div>
            <ul className="divide-y divide-ink-100 p-2">
              {isClient && (
                <li>
                  <AccountLinkRow link={CLIENT_PROFILE_LINK} />
                </li>
              )}
              {ACTIVITY_LINKS.map((link) => (
                <li key={link.href}>
                  <AccountLinkRow link={link} />
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/10 px-5 py-4">
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
        <div className="min-w-0 flex flex-col gap-5">
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
                  className="btn-secondary btn-sm w-full border-ink-200 text-ink-700 hover:border-danger-200 hover:bg-danger-50 hover:text-danger-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" /> {t('account.logOut')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="surface-card mt-6 border-danger-200/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/10 px-5 py-4">
          <h2 className="card-title">Privacy and data</h2>
          <span className="text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">Your rights</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-ink-900">Download your data</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Get a portable JSON copy of your profile, requests, bookings, reviews, messages and provider records.
            </p>
            <button
              type="button"
              onClick={() => void downloadExport()}
              disabled={exporting}
              className="btn-secondary btn-sm mt-3"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {exporting ? 'Preparing export…' : 'Download my data'}
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-900">Delete your account</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Your identity and personal content are removed and the account is deactivated. Records the other
              party needs (bookings, reviews, disputes) stay, with your details anonymised.
            </p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="btn-secondary btn-sm mt-3 border-danger-200 text-danger-700 hover:bg-danger-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete account
            </button>
          </div>
        </div>
        {deleteOpen && (
          <div className="border-t border-danger-200 bg-danger-50/40 p-5 sm:p-6">
            <label htmlFor="delete-password" className="text-sm font-semibold text-ink-900">
              Confirm with your password
            </label>
            <p className="mt-1 text-xs text-ink-500">This cannot be undone.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm outline-none focus:border-danger-400"
              />
              <button
                type="button"
                disabled={deleting || !deletePassword}
                onClick={() => void confirmDelete()}
                className="btn-primary btn-sm bg-danger-600 hover:bg-danger-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePassword('');
                  setDeleteError(null);
                }}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
            </div>
            {deleteError && (
              <p className="mt-2 text-xs font-medium text-danger-700" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}