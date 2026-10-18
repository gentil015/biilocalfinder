'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUp, Sparkles } from 'lucide-react';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';
import { ApiError, BookingAssistFields, bookingAssistApi } from '@/lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  questions?: string[];
  missing?: MessageKey[];
}

const MISSING_LABELS: Record<'service' | 'title' | 'description', MessageKey> = {
  service: 'reqAssist.field.service',
  title: 'reqAssist.field.title',
  description: 'reqAssist.field.description',
};

// Conversational front door to the existing request/booking form: the
// client describes the job in English, Kinyarwanda, or French, the
// assistant asks follow-ups until nothing required is missing, and every
// extracted field is handed to the parent form via onApply — never
// submitted from here. The client always reviews, edits, and sends the
// form themselves, and if the AI call fails the form stays fully usable
// (the error message says so explicitly).
export function BookingAssistant({
  serviceId,
  filledFields,
  onApply,
}: {
  serviceId?: string;
  filledFields: ('service' | 'title' | 'description')[];
  onApply: (fields: BookingAssistFields) => void;
}) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ suggestedCount: number; skippedCount: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.slice(-10).map((m) => ({ role: m.role, text: m.text }));
    setInput('');
    setError(null);
    setSummary(null);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const result = await bookingAssistApi.suggest({ message: text, history, serviceId, filledFields });
      onApply(result.fields);
      setSummary({ suggestedCount: result.suggestedCount, skippedCount: result.skippedCount });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.reply,
          questions: result.questions,
          missing: result.missingFields.map((f) => MISSING_LABELS[f]),
        },
      ]);
    } catch (err) {
      // Roll back the optimistic bubble and hand the text back — the
      // client can retry, or just fill the form manually below.
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
      setError(
        err instanceof ApiError
          ? `${err.message} — ${t('reqAssist.failedSuffix')}`
          : t('reqAssist.unavailable'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-300 bg-brand-50/40 p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white dark:text-home-night">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-semibold text-ink-900">{t('reqAssist.title')}</h2>
      </div>
      <p className="mb-3 text-xs text-ink-500">{t('reqAssist.description')}</p>

      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="mb-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-ink-100 bg-surface/90 p-3"
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-3 py-2 text-sm text-white dark:text-home-night'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm border border-ink-100 bg-surface px-3 py-2 text-sm text-ink-800'
                }
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.questions && m.questions.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-ink-100 pt-2 text-xs text-ink-600">
                    {m.questions.map((q, qi) => (
                      <li key={qi} className="flex gap-1.5">
                        <span aria-hidden="true">•</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.missing && m.missing.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-ink-500">{t('reqAssist.stillNeeded')}</span>
                    {m.missing.map((label) => (
                      <span
                        key={label}
                        className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-800"
                      >
                        {t(label)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-ink-100 bg-surface px-3 py-2 text-xs text-ink-400">
                {t('reqAssist.thinking')}
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSend} className="flex items-end gap-2">
        <textarea
          rows={2}
          placeholder={t('reqAssist.inputPlaceholder')}
          className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1500}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label={t('reqAssist.sendAria')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white dark:text-home-night hover:bg-brand-700 disabled:opacity-50"
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-danger-600" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {summary && !error && (
        <p className="mt-2 text-xs text-ink-500">
          {summary.suggestedCount === 1
            ? t('reqAssist.filled', { count: String(summary.suggestedCount) })
            : t('reqAssist.filledPlural', { count: String(summary.suggestedCount) })}
          {summary.skippedCount > 0
            ? summary.skippedCount === 1
              ? t('reqAssist.skipped', { count: String(summary.skippedCount) })
              : t('reqAssist.skippedPlural', { count: String(summary.skippedCount) })
            : '.'}
        </p>
      )}
    </div>
  );
}
