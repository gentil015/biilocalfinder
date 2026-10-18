'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/components/theme-provider';

/**
 * Theme switcher, Light / Dark / System.
 *
 * Two shapes from one option list:
 *  - `ThemeToggle`: an icon button + popover, for dense headers (marketplace
 *    site header, admin bar, workspace shell). The icon reflects the theme
 *    that is actually applied (a monitor glyph while following the OS).
 *  - `ThemeSegmentedControl`: all three options visible at once, for the
 *    mobile nav sheet where a popover would fight the sheet's own stacking.
 *
 * Semantics: the trigger is `aria-haspopup="menu"`; options are
 * `menuitemradio`s with `aria-checked`, so a screen-reader user hears which
 * mode is active without relying on the checkmark icon. The current mode is
 * also in the trigger's accessible name.
 */

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on any click outside the trigger/menu pair, and on Escape (with
  // focus returning to the trigger, per the menu-button pattern).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrapRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const ActiveIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const activeLabel = OPTIONS.find((o) => o.value === theme)?.label ?? 'System';

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${activeLabel}. Change theme`}
        title="Change theme"
        className="icon-btn"
      >
        <ActiveIcon className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme"
          className="animate-scale-in absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-ink-200 bg-surface p-1 shadow-lg"
        >
          <p className="px-2.5 pb-1 pt-2 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">
            Theme
          </p>
          {OPTIONS.map((option) => {
            const active = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-700 hover:bg-ink-50 hover:text-ink-950'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {option.label}
                {active && <Check className="ml-auto h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            );
          })}
          <p className="border-t border-ink-100 px-2.5 pb-2 pt-2 text-2xs leading-relaxed text-ink-400">
            System follows your device setting.
          </p>
        </div>
      )}
    </div>
  );
}

/** All-three-at-once variant for mobile sheets. */
export function ThemeSegmentedControl({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={className} role="radiogroup" aria-label="Theme">
      <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-ink-50/70 p-1">
        {OPTIONS.map((option) => {
          const active = theme === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(option.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'bg-surface text-ink-950 shadow-xs'
                  : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
