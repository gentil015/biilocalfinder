'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { NavigationHistoryTracker } from '@/components/back-button';
import { CustomerAssistWidget } from '@/components/customer-assist/customer-assist-widget';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';

function isAuthPath(pathname: string) {
  return pathname === '/login' || pathname === '/register';
}

function isAppShellPath(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname === '/provider' ||
    pathname.startsWith('/provider/') ||
    pathname.startsWith('/admin')
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = isAuthPath(pathname);
  const appShell = isAppShellPath(pathname);
  const mainRef = useRef<HTMLDivElement>(null);

  // A route change should start the user at the top of the new page. Next
  // preserves scroll position on client navigation, which is wrong for
  // full-page routes like /providers/[id] and /requests/[id].
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div className={appShell || auth ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'}>
      {/* First focusable element on the page — before the header, so a
          keyboard user skips the nav instead of tabbing through it. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Records in-app navigations so <BackButton> knows whether there is a
          previous page inside the app to return to. Renders nothing. */}
      <NavigationHistoryTracker />

      {/* Chrome rule, and it is deliberately blunt: every page that is not an
          auth screen or a self-contained app shell gets the same dark header
          bookended by the same dark footer. That consistency is what makes
          /search feel like the landing page instead of a separate product. */}
      {!auth && !appShell && <SiteHeader />}

      <div id="main-content" ref={mainRef} tabIndex={-1} className="focus:outline-none">
        {children}
      </div>

      {!auth && !appShell && <SiteFooter />}
      {!auth && !appShell && <MobileTabBar />}

      {/* "Ask BII Assistant" — marketplace guide and task helper. It appears
          everywhere, including the app shells and auth screens: the API is
          public, and a valid session is picked up automatically so the same
          widget can answer account/provider questions and offer confirmed
          write actions. */}
      <CustomerAssistWidget />
      <PwaInstallPrompt />
    </div>
  );
}
