'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Check, ChevronDown, LogOut, Menu, X, ArrowLeft, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { WorkspaceMembershipSummary } from '@/lib/api';
import { WORKSPACE_TYPE_LABEL } from '@/lib/workspace-nav';
import { BrandMark } from '@/components/brand-mark';
import { BackButton, useCanGoBack } from '@/components/back-button';
import { useAuth } from '@/components/auth-provider';

// spec §1: "A user may own or belong to multiple workspaces and switch
// between them without creating multiple login accounts." Today that's
// usually a list of one (see docs/WORKSPACES.md — owning a second,
// independent workspace is Phase 3), but this renders correctly the
// moment a user has more, and already handles being a MEMBER/MANAGER of
// a workspace they don't own.
export function WorkspaceSwitcher({
  memberships,
  activeWorkspaceId,
  inverted = false,
}: {
  memberships: WorkspaceMembershipSummary[];
  activeWorkspaceId: string;
  inverted?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = memberships.find((m) => m.workspace.id === activeWorkspaceId);
  const switchable = memberships.filter((m) => m.status === 'ACTIVE');

  // Close on outside click / Escape so the menu behaves like a menu.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!active) return null;

  const identity = (
    <>
      <WorkspaceAvatar name={active.workspace.name} />
      <div className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm font-bold ${inverted ? 'text-white' : 'text-ink-950'}`}>
          {active.workspace.name}
        </p>
        <p className={`truncate text-2xs font-medium ${inverted ? 'text-white/45' : 'text-ink-500'}`}>
          {WORKSPACE_TYPE_LABEL[active.workspace.type]}
        </p>
      </div>
    </>
  );

  if (switchable.length <= 1) {
    return <div className="flex min-w-0 items-center gap-2.5">{identity}</div>;
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition ${
          inverted ? 'hover:bg-white/10' : 'hover:bg-ink-100'
        }`}
      >
        {identity}
        <ChevronDown
          className={`h-4 w-4 shrink-0 ${inverted ? 'text-white/40' : 'text-ink-400'}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch workspace"
          className="animate-scale-in absolute left-0 z-50 mt-1.5 w-72 origin-top-left overflow-hidden rounded-xl border border-ink-200 bg-white p-1.5 shadow-xl"
        >
          <p className="eyebrow-muted px-2.5 py-2">Switch workspace</p>
          {switchable.map((m) => (
            <button
              key={m.workspace.id}
              type="button"
              role="option"
              aria-selected={m.workspace.id === activeWorkspaceId}
              onClick={() => {
                setOpen(false);
                router.push(`/dashboard/${m.workspace.id}`);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-ink-50 ${
                m.workspace.id === activeWorkspaceId ? 'bg-brand-50' : ''
              }`}
            >
              <WorkspaceAvatar name={m.workspace.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{m.workspace.name}</p>
                <p className="text-2xs text-ink-500">
                  {WORKSPACE_TYPE_LABEL[m.workspace.type]} · {m.role.toLowerCase()}
                </p>
              </div>
              {m.workspace.id === activeWorkspaceId && (
                <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 font-display text-sm font-extrabold text-white">
      {initial}
    </span>
  );
}

export interface ShellNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Workspace/app shell.
 *
 * Desktop gets a persistent light sidebar — with up to ten destinations a
 * horizontal pill strip runs out of room and forces scrolling. Below `lg` the
 * same nav collapses into a slide-over sheet behind a hamburger, so nothing
 * is hidden behind a horizontally scrolling track.
 *
 * The sidebar also replaces the site header for these routes (AppChrome treats
 * /dashboard, /provider/onboarding and /admin as app-shell paths), so it
 * carries the only sign-out affordance a provider sees all session.
 */
export function WorkspaceShell({
  nav,
  navLabel,
  identity,
  children,
}: {
  nav: ShellNavItem[];
  navLabel: string;
  /** Workspace switcher / provider identity, rendered in the sidebar. */
  identity: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const canGoBack = useCanGoBack();

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const navList = (
    <nav aria-label={navLabel} className="space-y-0.5">
      {nav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-brand-50 text-brand-800'
                : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-950'
            }`}
          >
            <item.icon
              className={`h-4 w-4 shrink-0 ${active ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600'}`}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const shellFooter = (
    <div className="space-y-0.5 border-t border-ink-200 pt-3">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100/70 hover:text-ink-950"
      >
        <ArrowLeft className="h-4 w-4 text-ink-400" aria-hidden="true" />
        Back to marketplace
      </Link>
      <button
        type="button"
        onClick={() => void logout()}
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100/70 hover:text-ink-950"
      >
        <LogOut className="h-4 w-4 text-ink-400" aria-hidden="true" />
        Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-200/80 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        {canGoBack && <BackButton variant="icon" label="Go back" className="-ml-1" />}
        <div className="min-w-0 flex-1">{identity}</div>
        <Link
          href="/account"
          className="btn-secondary btn-sm shrink-0"
        >
          Account
        </Link>
      </header>

      {/* Mobile nav sheet */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
          <div className="animate-fade-in absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-white p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <BrandMark />
              <button
                type="button"
                onClick={() => setNavOpen(false)}
                aria-label="Close navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div className="rounded-xl bg-ink-50 px-2.5 py-2">{identity}</div>
              {navList}
            </div>
            {shellFooter}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white p-4 lg:flex">
          <div className="mb-5">
            <BrandMark />
          </div>

          {canGoBack && (
            <div className="mb-3">
              <BackButton variant="pill" label="Back" className="w-full justify-start" />
            </div>
          )}

          <div className="mb-5 min-w-0 rounded-xl bg-ink-50 px-2.5 py-2">{identity}</div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">{navList}</div>

          {shellFooter}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
        </div>
      </div>
    </div>
  );
}
