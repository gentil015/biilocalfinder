'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Theme state for the whole app: Light, Dark, or System (follow the OS).
 *
 * The preference is stored in localStorage under `bii-theme` and applied as
 * a `dark` class on <html> — the class strategy Tailwind is configured with
 * (see tailwind.config.ts). An inline bootstrap script in app/layout.tsx
 * reads the same key and applies the class *before first paint*, so there is
 * no flash of the wrong theme and no hydration mismatch: the server always
 * renders the light default and the client corrects it synchronously during
 * HTML parsing, before React hydrates.
 *
 * When the preference is "system" the app tracks
 * `(prefers-color-scheme: dark)` live, so flipping the OS theme while the
 * tab is open updates the UI immediately — no reload.
 *
 * This is intentionally a client-only, localStorage-backed preference, not
 * an account setting: signed-out visitors get it too, and nothing about the
 * preference ever needs to reach the API.
 */

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'bii-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  /** The user's stored choice: light, dark, or follow-the-system. */
  theme: ThemePreference;
  /** What is actually applied right now, after resolving "system". */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Private-browsing modes can throw on localStorage access; treating the
    // preference as "system" is the correct fallback.
    return 'system';
  }
}

function systemTheme(): ResolvedTheme {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

/** Matches the inline bootstrap script in app/layout.tsx — keep in sync. */
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  // The viewport theme-color (browser chrome on mobile) follows the applied
  // theme, not just the OS preference, so a user on the light theme with a
  // dark OS still gets a light address bar. The server renders a media-pair
  // as the pre-hydration baseline (OS is the best guess then). Those tags are
  // React-owned hoistables from the Next metadata API — removing or mutating
  // them crashes head reconciliation on the next client navigation
  // ("Cannot read properties of null (reading 'removeChild')" in
  // unmountHoistable). So instead we append an app-owned unmediated tag
  // after them; the browser uses the last matching theme-color, which makes
  // the explicit choice win over the OS pair without touching React's nodes.
  const color = resolved === 'dark' ? '#202321' : '#F5F6F8';
  let meta = document.head.querySelector<HTMLMetaElement>('meta[data-bii-theme-color]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('data-bii-theme-color', '');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Adopt the stored preference once on mount. Starting from 'system'/
  // 'light' in state (never the stored value) is what keeps SSR and the
  // first client render identical — no hydration warning.
  useEffect(() => {
    const preference = readStoredPreference();
    const resolved = resolve(preference);
    setThemeState(preference);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const resolved = systemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    const resolved = resolve(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Preference still applies for this session even if storage is blocked.
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
