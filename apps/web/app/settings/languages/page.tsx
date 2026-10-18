'use client';

import { useState } from 'react';
import { AlertCircle, Check, Languages } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/components/locale-provider';
import { LOCALES, type LocaleCode } from '@/lib/locales';
import { PageHeader, Panel } from '@/components/ui/page';

export default function LanguageSettingsPage() {
  const { t, locale, setLocale, formats } = useI18n();
  const [saving, setSaving] = useState<LocaleCode | null>(null);
  const [saved, setSaved] = useState<LocaleCode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(code: LocaleCode) {
    if (code === locale || saving) return;
    setSaving(code);
    setSaved(null);
    setError(null);
    try {
      await setLocale(code);
      setSaved(code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('languages.error'));
    } finally {
      setSaving(null);
    }
  }

  // Announced, not just shown: the radio switch itself is silent, so this slot
  // is the only signal that a save landed. Errors are excluded — they get their
  // own role="alert" block above, and repeating them here reads as a
  // contradiction next to the list.
  const status = saving ? t('languages.saving') : saved ? t('languages.saved') : null;

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow={t('languages.eyebrow')}
        title={t('languages.title')}
        description={t('languages.description')}
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <Panel
        title={t('languages.panelTitle')}
        description={t('languages.panelDescription')}
        className="mb-6"
        actions={
          <span className="text-xs text-ink-500" role="status">
            {status ?? `${t('languages.current')}: ${nativeNameOf(locale)}`}
          </span>
        }
      >
        {/* Radio group rather than a <select>: two options fit side by side,
            each one shows its own name in that language, and a select hides the
            non-active option behind a click — which is exactly what someone
            who can't read the current language needs to see. */}
        <fieldset className="space-y-2">
          <legend className="sr-only">{t('languages.selectedLabel')}</legend>
          {LOCALES.map((option) => {
            const active = option.code === locale;
            const busy = saving === option.code;
            return (
              <label
                key={option.code}
                className={`check-row items-center gap-3 rounded-2xl border p-4 transition ${
                  active ? 'border-brand-500 bg-brand-50' : 'border-ink-900/10 hover:border-ink-300'
                } ${busy ? 'opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name="app-language"
                  value={option.code}
                  checked={active}
                  disabled={!!saving}
                  onChange={() => void choose(option.code)}
                  className="sr-only"
                />
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-brand-600 text-white dark:text-home-night' : 'bg-ink-100 text-ink-500'
                  }`}
                  aria-hidden="true"
                >
                  {active ? <Check className="h-4 w-4" /> : <Languages className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  {/* Endonym first — the reader should see the language in the
                      language itself, with the English name as the fallback
                      gloss for anyone who can't tell them apart. */}
                  <span className="block text-sm font-bold text-ink-900">{option.nativeName}</span>
                  {option.englishName !== option.nativeName && (
                    <span className="mt-0.5 block text-xs text-ink-500">{option.englishName}</span>
                  )}
                  <span className="mt-0.5 block text-2xs text-ink-400">
                    {t('languages.formatsIn')} {formats.date(SAMPLE_DATE)}
                  </span>
                </span>
                <span className="sr-only">{t('languages.useLanguage', { name: option.nativeName })}</span>
              </label>
            );
          })}
        </fieldset>

        {/* Stated plainly because "change the language" invites the wrong
            expectation: this does not translate provider-written content, which
            is the thing people most often hope it does. */}
        <p className="hint mt-4">{t('languages.regionNote')}</p>
      </Panel>
    </main>
  );
}

/** A fixed date so the preview shows the shape of the formatting, not today. */
const SAMPLE_DATE = new Date(2026, 0, 15);

function nativeNameOf(code: LocaleCode): string {
  return LOCALES.find((l) => l.code === code)?.nativeName ?? code;
}
