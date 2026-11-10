'use client';

import { useI18n } from '@/components/locale-provider';
import { useId, useState } from 'react';
import { AlertCircle, Paperclip, Plus, X } from 'lucide-react';
import { ApiError, quotesApi } from '@/lib/api';

function ListEditor({
  label,
  placeholder,
  items,
  setItems,
}: {
  label: string;
  placeholder: string;
  items: string[];
  setItems: (items: string[]) => void;
}) {
  const { translateMessage: tr, t } = useI18n();
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || items.length >= 20) return;
    setItems([...items, trimmed]);
    setDraft('');
  }

  return (
    <div className="field">
      <label htmlFor={inputId} className="label">
        {label}
      </label>

      <div className="flex items-start gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-describedby={hintId}
        />
        <button type="button" onClick={add} disabled={items.length >= 20} className="btn-secondary shrink-0">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {tr('Add')}
        </button>
      </div>

      <p id={hintId} className="hint">
        {items.length > 0
          ? t('provider.quote.addedCount', { count: items.length })
          : tr('Type an item and press Enter. Up to 20 per list.')}
      </p>

      {items.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="chip max-w-full py-1 pl-2.5 pr-1">
              <span className="min-w-0 truncate">{item}</span>
              <button
                type="button"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                aria-label={`${tr('Remove')} ${item}`}
                className="-mr-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-200 hover:text-ink-700"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SendQuoteForm({ requestId, onSent }: { requestId: string; onSent: () => void }) {
  const { translateMessage: tr } = useI18n();
  const [price, setPrice] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [includedItems, setIncludedItems] = useState<string[]>([]);
  const [excludedItems, setExcludedItems] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ storageKey: string; fileName: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceId = useId();
  const durationId = useId();
  const proposedDateId = useId();
  const expiresAtId = useId();
  const descriptionId = useId();
  const materialsId = useId();
  const fileId = useId();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const remaining = 5 - attachments.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const uploaded = await Promise.all(toUpload.map((f) => quotesApi.uploadAttachment(f)));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload attachment');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await quotesApi.create({
        requestId,
        price: Number(price),
        estimatedDuration: estimatedDuration || undefined,
        proposedDate: proposedDate || undefined,
        expiresAt: expiresAt || undefined,
        description: description || undefined,
        materials: materials || undefined,
        includedItems: includedItems.length ? includedItems : undefined,
        excludedItems: excludedItems.length ? excludedItems : undefined,
        attachments: attachments.map((a) => ({ storageKey: a.storageKey, fileName: a.fileName })),
      });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send quote');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-card space-y-5 p-5 sm:p-6">
      <div>
        <p className="eyebrow-muted">{tr('Quote')}</p>
        <h3 className="card-title mt-1">{tr('Send a quote')}</h3>
        <p className="hint">{tr('Dates are optional — leave them blank if you want the client to decide.')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={priceId} className="label">
            {tr('Price (RWF)')}
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide text-ink-400"
            >
              RWF
            </span>
            <input
              id={priceId}
              required
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="0"
              className="tabular pl-14 font-bold"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor={durationId} className="label">
            {tr('Estimated duration')}
          </label>
          <input
            id={durationId}
            placeholder={tr('e.g. 2 days')}
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="field">
          <label htmlFor={proposedDateId} className="label">
            {tr('Proposed date')}
          </label>
          <input
            id={proposedDateId}
            type="date"
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor={expiresAtId} className="label">
            {tr('Quote expires')}
          </label>
          <input id={expiresAtId} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor={descriptionId} className="label">
          {tr('Notes for the client')} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
        </label>
        <textarea
          id={descriptionId}
          rows={2}
          placeholder={tr('Anything the client should know before accepting')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor={materialsId} className="label">
          {tr('Materials')}
        </label>
        <input
          id={materialsId}
          placeholder={tr('e.g. Paint and brushes included')}
          value={materials}
          onChange={(e) => setMaterials(e.target.value)}
        />
      </div>

      <div className="section-divider" />

      <ListEditor
        label={tr("What's included")}
        placeholder={tr('e.g. 2 hours of coverage')}
        items={includedItems}
        setItems={setIncludedItems}
      />
      <ListEditor
        label={tr("What's NOT included")}
        placeholder={tr('e.g. Travel outside Kigali')}
        items={excludedItems}
        setItems={setExcludedItems}
      />

      <div className="field">
        <label htmlFor={fileId} className="label">
          {tr('Attachments')} <span className="font-normal text-ink-400">{tr("(optional)")}</span>
        </label>
        <label
          htmlFor={fileId}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/60 px-4 py-4 text-sm font-semibold text-ink-600 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10"
        >
          {uploading ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
            />
          ) : (
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? tr('Uploading…') : tr('Add a photo or PDF')}
          <input
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
        <p className="hint">{tr('JPEG, PNG, WebP or PDF. Up to 5 files.')}</p>

        {attachments.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {attachments.map((a) => (
              <li key={a.storageKey} className="chip w-full justify-between py-1 pl-3 pr-1">
                <span className="min-w-0 truncate">{a.fileName}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((x) => x.storageKey !== a.storageKey))}
                  aria-label={`${tr('Remove')} ${a.fileName}`}
                  className="-mr-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-200 hover:text-ink-700"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{tr(error)}</span>
        </div>
      )}

      <div className="section-divider" />

      <button disabled={busy || uploading} aria-busy={busy} className="btn-primary btn-lg w-full">
        {busy ? tr('Sending…') : tr('Send a quote')}
      </button>
    </form>
  );
}
