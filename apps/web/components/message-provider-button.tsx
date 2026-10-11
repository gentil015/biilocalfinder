'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Send, X } from 'lucide-react';
import { messagingApi, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

/**
 * "Send a message" on a provider profile. Opens (or reuses) a direct
 * conversation thread with that provider — deliberately *not* a service
 * request, which is what the separate "Request service" button does.
 */
export function MessageProviderButton({
  providerId,
  providerName,
  className,
  label = 'Send a message',
  showIcon = true,
}: {
  providerId: string;
  providerName?: string;
  className?: string;
  label?: string;
  showIcon?: boolean;
}) {
  const router = useRouter();
  // Session from context, not localStorage: reading localStorage here caused
  // hydration mismatches on this button.
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const titleId = useId();

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Escape closes without losing a half-written message from view.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function launch() {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const conversation = await messagingApi.startConversation(providerId, body);
      setOpen(false);
      setBody('');
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not start the conversation — please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={launch} className={className ?? 'btn-secondary'}>
        {showIcon && <MessageCircle className="h-4 w-4" aria-hidden="true" />} {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 backdrop-blur-sm md:items-center md:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl md:rounded-2xl md:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow-muted">Direct message</p>
                <h2 id={titleId} className="card-title mt-1">
                  {providerName ? `Message ${providerName}` : 'Send a message'}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="icon-btn -mr-1.5 -mt-1">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="field">
                <label htmlFor={fieldId} className="label">
                  Your message
                </label>
                <textarea
                  id={fieldId}
                  ref={textareaRef}
                  rows={5}
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Ask a question, check availability, or describe what you need…"
                />
                <p className="hint">
                  This opens a chat thread. To compare prices and get a formal quote, use{' '}
                  <strong>Request service</strong> instead.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  className="btn-primary flex-1"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {submitting ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}