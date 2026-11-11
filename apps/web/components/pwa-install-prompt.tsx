'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'bii-install-dismissed-at';
const DISMISS_DAYS = 14;
const SHOW_DELAY_MS = 3000;

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    isIosDevice() ||
    /android|mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent))
  );
}

function wasRecentlyDismissed() {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Asks phone users to install the marketplace as an app. Chromium fires
 * `beforeinstallprompt`, which we defer until the visitor taps our own button;
 * iOS Safari has no such event, so it gets the Share → Add to Home Screen
 * instructions instead. Dismissals are remembered for two weeks.
 */
export function PwaInstallPrompt() {
  const { translateMessage: tr } = useI18n();
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }

    if (isStandalone() || wasRecentlyDismissed() || !isMobileDevice()) return;

    const timers: number[] = [];
    const scheduleShow = () => {
      timers.push(
        window.setTimeout(() => {
          if (!isStandalone() && !wasRecentlyDismissed()) {
            setIos(isIosDevice());
            setVisible(true);
          }
        }, SHOW_DELAY_MS),
      );
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredRef.current = event as BeforeInstallPromptEvent;
      scheduleShow();
    };

    const onInstalled = () => {
      deferredRef.current = null;
      setVisible(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        // Storage can be unavailable in private mode; hiding is enough.
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so offer manual instructions.
    if (isIosDevice()) scheduleShow();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore unavailable storage.
    }
  }

  async function install() {
    const prompt = deferredRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    deferredRef.current = null;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    } else {
      dismiss();
    }
  }

  if (!visible) return null;

  const canInstall = Boolean(deferredRef.current);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-home-night/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-app-title"
        className="w-full max-w-sm rounded-2xl border border-ink-200 bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="install-app-title" className="card-title">
              {tr('Install BII on your phone')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-500">
              {ios
                ? tr('Add BII to your home screen for one-tap access.')
                : tr('Get the app for faster access and notifications.')}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label={tr('Not now')}
            className="icon-btn -mr-1 -mt-1 h-8 w-8"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {ios && (
          <div className="mt-4 space-y-2 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
            <p className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface text-brand-700 shadow-xs">
                <Share className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {tr('Tap the Share button in Safari.')}
            </p>
            <p className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface text-brand-700 shadow-xs">
                <PlusSquare className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {tr('Choose “Add to Home Screen”.')}
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {canInstall && (
            <button onClick={install} className="btn-primary flex-1">
              <Download className="h-4 w-4" aria-hidden="true" />
              {tr('Install app')}
            </button>
          )}
          <button
            onClick={dismiss}
            className={canInstall ? 'btn-secondary flex-1' : 'btn-primary w-full'}
          >
            {ios ? tr('Got it') : tr('Not now')}
          </button>
        </div>
      </div>
    </div>
  );
}
