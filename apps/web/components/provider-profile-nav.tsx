'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  GraduationCap,
  UserCog,
  type LucideIcon,
} from 'lucide-react';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/provider/profile', label: 'Profile', icon: UserCog },
  { href: '/provider/experience', label: 'Experience', icon: BriefcaseBusiness },
  { href: '/provider/education', label: 'Education', icon: GraduationCap },
  { href: '/provider/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/provider/verification', label: 'Verified', icon: BadgeCheck },
];

/**
 * The provider's professional-account tabs. Horizontally scrollable on
 * phones so all five destinations stay reachable without wrapping into a
 * tall block; the active tab is also exposed via aria-current.
 */
export function ProviderProfileNav({ className = '' }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Professional profile sections" className={className}>
      <div className="scroll-x -mx-1 flex gap-1 rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:flex-1 sm:justify-center sm:text-sm ${
                active
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-950'
              }`}
            >
              <tab.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
