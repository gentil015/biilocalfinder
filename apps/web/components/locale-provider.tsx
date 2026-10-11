'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { usersApi } from '@/lib/api';
import {
  DEFAULT_LOCALE,
  MESSAGES,
  createFormatters,
  interpolate,
  localeMeta,
  resolveLocale,
  type LocaleCode,
  type MessageKey,
} from '@/lib/locales';

/**
 * Holds the active display language and exposes `t()` for translated copy.
 *
 * The source of truth is the account's `locale` column, fetched by
 * AuthProvider through /users/me. Two things this deliberately does not do:
 *
 * - It does not re-render on route change to read the locale off a server
 *   component. The auth token lives in localStorage, so the server cannot see
 *   it and a layout that read the user's language would render English HTML
 *   and then flip to Kinyarwanda in the browser — a flash, and worse for
 *   anything a screen reader or crawler sees first.
 * - It does not persist to localStorage. A signed-in user's language is
 *   already durable server-side, and a second copy is a third thing to keep in
 *   sync when they disagree. Signed-out visitors keep the default, which is
 *   correct: there is nowhere to save a preference for them yet.
 */
interface LocaleContextValue {
  locale: LocaleCode;
  dir: 'ltr' | 'rtl';
  /** Translate a key, filling any `{placeholder}` tokens. */
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  /** Apply a language to the current account. Callers show their own status UI. */
  setLocale: (code: LocaleCode) => Promise<void>;
  formats: ReturnType<typeof createFormatters>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { user, refresh } = useAuth();
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Follow the account once /users/me resolves. Keyed on the string rather than
  // the user object so a background auth refresh that returns a new object with
  // an unchanged locale doesn't cause an extra render.
  const accountLocale = user?.locale;
  useEffect(() => {
    if (accountLocale) setLocaleState(resolveLocale(accountLocale));
  }, [accountLocale]);

  // <html lang> is rendered by the server layout and can't know the user's
  // language, so it is corrected here on the client. This is what screen
  // readers and the browser's own hyphenation and form-validation messages use.
  useEffect(() => {
    const meta = localeMeta(locale);
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
  }, [locale]);

  const setLocale = useCallback(
    async (code: LocaleCode) => {
      const next = resolveLocale(code);
      // Applied before the request so the interface switches immediately rather
      // than waiting on a round trip. Rejected updates roll back to the
      // account's real value, so a failed save can't leave the screen showing
      // a language the server never accepted.
      setLocaleState(next);
      try {
        await usersApi.updateLocale(next);
        await refresh();
      } catch (err) {
        setLocaleState(resolveLocale(accountLocale));
        throw err;
      }
    },
    [accountLocale, refresh],
  );

  const value = useMemo<LocaleContextValue>(() => {
    const catalog = MESSAGES[locale];
    return {
      locale,
      dir: localeMeta(locale).dir,
      t: (key, values) => interpolate(catalog[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key, values),
      setLocale,
      formats: createFormatters(locale),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useI18n must be used inside <LocaleProvider>');
  return ctx;
}
