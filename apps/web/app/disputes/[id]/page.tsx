'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Paperclip, Send, Upload } from 'lucide-react';
import { disputesApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';

// Disputes carry their own lifecycle (see apps/api/src/disputes/dispute-status.ts)
// that doesn't line up 1:1 with the marketplace status map, so the tones live
// here rather than growing the shared badge.
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-warning-50 text-warning-700',
  RESPONDED: 'bg-info-50 text-info-700',
  UNDER_REVIEW: 'bg-brand-50 text-brand-700',
  RESOLVED: 'bg-success-50 text-success-700',
  REJECTED: 'bg-ink-100 text-ink-500',
};

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () =>
    disputesApi
      .getOne(id)
      .then(setDispute)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this dispute'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [id]);

  async function sendMessage() {
    if (!messageBody.trim()) return;
    setSending(true);
    setError(null);
    try {
      await disputesApi.addMessage(id, messageBody.trim());
      setMessageBody('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your message');
    } finally {
      setSending(false);
    }
  }

  async function uploadEvidence(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await disputesApi.addEvidence(id, file);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading this dispute…" />
      </main>
    );
  }
  if (!dispute) return null;

  const closed = dispute.status === 'RESOLVED' || dispute.status === 'REJECTED';

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Dispute"
        title={dispute.reason}
        description={dispute.details}
        actions={
          <span
            className={`badge ${STATUS_STYLES[dispute.status] ?? 'bg-ink-100 text-ink-600'}`}
          >
            {dispute.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        }
      />

      <p className="mb-5 text-xs text-ink-500">
        {dispute.category.replace(/_/g, ' ').toLowerCase()} · opened{' '}
        {new Date(dispute.createdAt).toLocaleDateString()}
      </p>

      {closed && (
        <div className="surface-panel mb-6 p-4">
          <p className="eyebrow-muted mb-1.5">
            {dispute.resolutionType?.replace(/_/g, ' ').toLowerCase() ?? 'closed'}
            {dispute.resolvedBy?.firstName && ` — resolved by ${dispute.resolvedBy.firstName}`}
          </p>
          {dispute.resolution ? (
            <p className="text-sm leading-relaxed text-ink-700">{dispute.resolution}</p>
          ) : (
            <p className="text-sm text-ink-500">No written resolution was recorded.</p>
          )}
        </div>
      )}

      <Panel
        title="Evidence"
        description={closed ? undefined : 'A photo or PDF per file, up to 8 MB.'}
        className="mb-6"
      >
        {dispute.evidence.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="No evidence uploaded yet"
            body="Either side can attach photos or PDFs while the dispute is open."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {dispute.evidence.map((e: any) => (
              <a
                key={e.id}
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="chip-interactive"
              >
                <Paperclip className="h-3 w-3" aria-hidden="true" /> {e.description || 'Evidence'} (
                {(e.sizeBytes / 1024).toFixed(0)} KB)
              </a>
            ))}
          </div>
        )}
        {!closed && (
          <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-300 px-3.5 py-2 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {uploading ? 'Uploading…' : '+ Add evidence (photo or PDF)'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              hidden
              onChange={(e) => uploadEvidence(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </Panel>

      <Panel title="Conversation" description="Kept in order so both sides can see how it unfolded.">
        {dispute.messages.length === 0 ? (
          <EmptyState
            icon={Send}
            title="No messages yet"
            body="Start the thread — a clear written account is what a reviewer reads first."
          />
        ) : (
          <ul className="space-y-3">
            {dispute.messages.map((m: any) => (
              <li key={m.id} className="surface-panel p-3.5">
                <p className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-700">
                    {m.author.firstName} {m.author.lastName}
                  </span>
                  <span className="text-2xs tabular text-ink-400">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{m.body}</p>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="error-text mt-4" role="alert">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {!closed ? (
          <div className="mt-5 flex gap-2 border-t border-ink-100 pt-5">
            <input
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Write a message…"
              aria-label="Write a message"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={sending}
              className="btn-primary shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{sending ? 'Sending…' : 'Send'}</span>
            </button>
          </div>
        ) : (
          <p className="hint mt-5 border-t border-ink-100 pt-5">
            This dispute is closed. Everything above stays readable, but no new messages or evidence can be
            added.
          </p>
        )}
      </Panel>
    </main>
  );
}
