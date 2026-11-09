'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, FileText, Languages, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';
import { LOCALES, MESSAGES, type LocaleCode, type MessageKey } from '@/lib/locales';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';

const SECTIONS = Array.from({ length: 17 }, (_, index) => {
  const number = index + 1;
  return {
    number,
    titleKey: `legal.terms.section.${number}` as MessageKey,
    bodyKey: `legal.terms.body.${number}` as MessageKey,
  };
});

export default function TermsPage() {
  const { locale } = useI18n();
  const [termsLocale, setTermsLocale] = useState<LocaleCode>(locale);
  const messages = MESSAGES[termsLocale];

  useEffect(() => {
    setTermsLocale(locale);
  }, [locale]);

  const text = (key: MessageKey) => messages[key];

  return (
    <main className="page-shell py-8 md:py-12">
      <header className="overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-surface via-surface to-brand-50 p-6 shadow-sm sm:p-9">
        <div className="flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">{text('legal.terms.eyebrow')}</p>
            <h1 className="page-title mt-2">{text('legal.terms.title')}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-600 sm:text-base">
              {text('legal.terms.intro')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2" role="group" aria-label={text('legal.terms.language')}>
            <Languages className="h-4 w-4 text-ink-500" aria-hidden="true" />
            {LOCALES.map((option) => (
              <button
                key={option.code}
                type="button"
                aria-pressed={termsLocale === option.code}
                onClick={() => setTermsLocale(option.code)}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  termsLocale === option.code
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-ink-300 bg-surface text-ink-700 hover:border-brand-500'
                }`}
              >
                {option.nativeName}
              </button>
            ))}
          </div>
        </div>

        <dl className="mt-7 grid gap-3 border-t border-ink-200 pt-5 text-sm sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{text('legal.terms.version')}</dt>
              <dd className="mt-1 font-semibold text-ink-900">{CURRENT_TERMS_VERSION}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{text('legal.terms.effective')}</dt>
              <dd className="mt-1 font-semibold text-ink-900">{text('legal.terms.effectiveDate')}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{text('legal.terms.updated')}</dt>
              <dd className="mt-1 font-semibold text-ink-900">{text('legal.terms.updatedDate')}</dd>
            </div>
          </div>
        </dl>
      </header>

      <aside className="mt-5 rounded-2xl border border-warning-200 bg-warning-50 p-4 sm:p-5" aria-labelledby="terms-draft-title">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <h2 id="terms-draft-title" className="text-sm font-bold text-ink-900">
              {text('legal.terms.legalNoticeTitle')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-ink-700">{text('legal.terms.legalNotice')}</p>
          </div>
        </div>
      </aside>

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(230px,0.32fr)_minmax(0,1fr)]">
        <nav
          aria-label={text('legal.terms.contents')}
          className="rounded-2xl border border-ink-200 bg-surface p-5 lg:sticky lg:top-6"
        >
          <h2 className="text-sm font-bold text-ink-950">{text('legal.terms.contents')}</h2>
          <ol className="mt-3 grid max-h-[60vh] gap-1 overflow-y-auto pr-1 text-sm">
            {SECTIONS.map(({ number, titleKey }) => (
              <li key={number}>
                <a
                  href={`#terms-section-${number}`}
                  className="flex gap-2 rounded-lg px-2 py-2 leading-5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <span className="w-5 shrink-0 tabular-nums text-ink-400">{number}.</span>
                  <span>{text(titleKey)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {SECTIONS.map(({ number, titleKey, bodyKey }) => (
            <section
              key={number}
              id={`terms-section-${number}`}
              className="scroll-mt-6 rounded-2xl border border-ink-200 bg-surface p-5 sm:p-7"
              aria-labelledby={`terms-heading-${number}`}
            >
              <h2 id={`terms-heading-${number}`} className="font-display text-lg font-extrabold tracking-tight text-ink-950 sm:text-xl">
                <span className="mr-2 text-brand-700">{number}.</span>
                {text(titleKey)}
              </h2>
              <p className="mt-3 text-sm leading-7 text-ink-700 sm:text-[15px]">{text(bodyKey)}</p>
            </section>
          ))}

          <section className="rounded-2xl border border-ink-200 bg-ink-50 p-5 sm:p-6">
            <h2 className="text-sm font-bold text-ink-900">{text('legal.terms.privacyUnavailableTitle')}</h2>
            <p className="mt-1.5 text-sm leading-6 text-ink-600">{text('legal.terms.privacyUnavailable')}</p>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5 text-sm">
            <Link href="/account/reports" className="font-semibold text-brand-700 underline underline-offset-4">
              {text('legal.terms.reportLink')}
            </Link>
            <a href="#main-content" className="inline-flex items-center gap-1 text-ink-600 hover:text-brand-700">
              {text('legal.terms.backToTop')}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
