'use client';

import { useState } from 'react';
import { useI18n } from '@/components/locale-provider';
import { ApiError, requestAssistApi } from '@/lib/api';

export interface AssistSuggestion {
  title?: string;
  description?: string;
  attributeValues: Record<string, unknown>;
}

// Lets a client describe a job in plain language (and/or attach a photo)
// and pre-fill the category's dynamic attribute form + title/description.
// This never submits anything itself — it only hands suggestions to the
// parent form via onApply, so the client always sees and can edit every
// field before sending the request (spec pattern: an AI suggestion is a
// starting point, never a silent write).
export function AiRequestAssist({
  serviceId,
  onApply,
}: {
  serviceId: string;
  onApply: (suggestion: AssistSuggestion) => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ suggestedCount: number; skippedCount: number } | null>(null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSuggest() {
    if (!text.trim() && !imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let imageKey: string | undefined;
      if (imageFile) {
        const uploaded = await requestAssistApi.uploadImage(imageFile);
        imageKey = uploaded.key;
      }
      const suggestion = await requestAssistApi.suggest({
        serviceId,
        description: text.trim() || undefined,
        imageKey,
      });
      onApply(suggestion);
      setResult({ suggestedCount: suggestion.suggestedCount, skippedCount: suggestion.skippedCount });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('aiAssist.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-4">
      <h2 className="mb-1 text-sm font-semibold text-ink-900">{t('aiAssist.title')}</h2>
      <p className="mb-3 text-xs text-ink-500">{t('aiAssist.description')}</p>

      <textarea
        rows={3}
        placeholder={t('aiAssist.placeholder')}
        className="mb-2 w-full rounded-xl border border-ink-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1500}
      />

      <div className="flex items-center gap-3">
        <label className="cursor-pointer text-xs font-medium text-brand-700 underline-offset-2 hover:underline">
          {imageFile ? t('aiAssist.changePhoto') : t('aiAssist.attachPhoto')}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickImage} />
        </label>
        {imagePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt={t('aiAssist.photoAlt')} className="h-10 w-10 rounded-lg object-cover" />
        )}

        <button
          type="button"
          disabled={loading || (!text.trim() && !imageFile)}
          onClick={onSuggest}
          className="ml-auto rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white dark:text-home-night hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? t('aiAssist.thinking') : t('aiAssist.suggest')}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
      {result && !error && (
        <p className="mt-2 text-xs text-ink-500">
          {result.suggestedCount === 1
            ? t('aiAssist.filled', { count: String(result.suggestedCount) })
            : t('aiAssist.filledPlural', { count: String(result.suggestedCount) })}
          {result.skippedCount > 0
            ? result.skippedCount === 1
              ? t('aiAssist.skipped', { count: String(result.skippedCount) })
              : t('aiAssist.skippedPlural', { count: String(result.skippedCount) })
            : '.'}
        </p>
      )}
    </div>
  );
}
