'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Tracks how many navigations have happened *inside* the app in this tab.
 *
 * `<BackButton>` uses this to decide between `router.back()` (return to the
 * actual previous page) and an explicit fallback route — because on a page
 * that was opened directly (a shared link, a fresh tab, a hard refresh) there
 * is no in-app previous page, and `router.back()` would walk the user out of
 * the product entirely.
 *
 * The counter lives in a module singleton and therefore resets on a full page
 * load, which is exactly right: a reloaded tab starts with no in-app history.
 *
 * Rendered once by <AppChrome>.
 */
let navDepth = 0;
const listeners = new Set<() => void>();

function setDepth(next: number) {
  navDepth = next;
  listeners.forEach((listener) => listener());
}

export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    // Compare against the last pathname rather than "is this the first run":
    // React strict mode invokes this effect twice on mount, and a naive
    // first-run flag would count that as a navigation.
    if (previous.current !== null && previous.current !== pathname) {
      setDepth(navDepth + 1);
    }
    previous.current = pathname;
  }, [pathname]);

  return null;
}

/** True once the user has moved between at least two pages in this session. */
export function useCanGoBack() {
  const [can, setCan] = useState(navDepth > 0);

  useEffect(() => {
    const listener = () => setCan(navDepth > 0);
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return can;
}

/**
 * A single "go back" affordance for the whole product.
 *
 * Clicking returns the user to the page they came from (history), falling back
 * to `fallbackHref` when they arrived directly. Three shapes:
 *
 *  - `icon` — square icon button for headers and toolbars.
 *  - `pill` — frosted floating pill for content areas.
 *  - `link` — inline text link, matching the `.back-link` style used above
 *    page titles on detail pages.
 */
export function BackButton({
  fallbackHref = '/',
  label = 'Back',
  variant = 'icon',
  className = '',
}: {
  /** Where to go when there is no in-app page to return to. */
  fallbackHref?: string;
  /** Accessible label / link text. */
  label?: string;
  variant?: 'icon' | 'pill' | 'link';
  className?: string;
}) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  function goBack() {
    if (canGoBack) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  if (variant === 'link') {
    return (
      <button type="button" onClick={goBack} className={`back-link ${className}`}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={goBack}
        className={`inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-surface/90 px-3.5 py-2 text-sm font-semibold text-ink-700 shadow-card backdrop-blur transition hover:border-ink-300 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 ${className}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={label}
      title={label}
      className={`icon-btn shrink-0 ${className}`}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
