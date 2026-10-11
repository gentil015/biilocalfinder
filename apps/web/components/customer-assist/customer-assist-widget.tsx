'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  ChevronRight,
  MapPin,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { customerAssistApi, type CustomerAssistResult } from '@/lib/api';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  result?: CustomerAssistResult;
}

const QUICK_STARTS = [
  'Ni nde nakoresha mu gutunganya laptop yanjye?',
  'I need someone to clean my house tomorrow.',
  'Ndashaka isuku ejo mu rugo.',
  'Find a DJ for my wedding.',
];

/** Fanned out on chat prompts to test routing. */
const WELCOME =
  "Bite? I'm BII Assistant, your guide around the marketplace. Tell me in English or Kinyarwanda what you need to do, hire, or find — I'll point you to the right service and providers.";

export function CustomerAssistWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, turns, busy, scrollToBottom]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    const history = turns.map((t) => ({
      role: t.role as 'user' | 'assistant',
      text: t.text,
    }));

    setTurns((prev) => [...prev, { role: 'user', text: message }]);
    setInput('');
    setError(null);
    setBusy(true);
    scrollToBottom();

    try {
      const result = await customerAssistApi.chat(message, { history: history.slice(-8) });
      setTurns((prev) => [...prev, { role: 'assistant', text: result.reply, result }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: `Sorry — ${msg}. Try again in a moment.` },
      ]);
      setError(msg);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function go(href: string) {
    router.push(href);
    // Navigate inside the same tab; keep the conversation open so the client
    // can come back and keep asking.
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="group fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-brand-gradient p-3 pl-4 font-semibold text-white shadow-lg shadow-brand-900/25 transition hover:shadow-brand-900/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/25 sm:bottom-6 md:right-6"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span className="hidden text-sm sm:inline">Ask BII Assistant</span>
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-gold ring-2 ring-white" aria-hidden="true" />
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="BII Assistant"
          className="fixed inset-x-0 bottom-0 z-[60] flex h-[min(660px, 92dvh)] flex-col overflow-hidden border-t border-ink-200 bg-white shadow-2xl shadow-ink-950/20 animate-slide-up-sheet sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-2xl sm:border"
        >
          {/* Header */}
          <header className="relative flex items-center gap-3 bg-brand-gradient px-4 py-3.5 text-white">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success-400 ring-2 ring-white" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-bold tracking-tight">BII Assistant</p>
              <p className="truncate text-xs text-white/80">
                Marketplace guide · replies in English, Kinyarwanda &amp; Français
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4"
          >
            {turns.length === 0 && (
              <>
                <AssistantBubble text={WELCOME} avatar={<Sparkles className="h-4 w-4" aria-hidden="true" />} />
                <div className="flex flex-wrap gap-2">
                  {QUICK_STARTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-full border border-brand-200 bg-brand-50/70 px-3.5 py-2 text-left text-xs font-semibold text-brand-800 transition hover:border-brand-300 hover:bg-brand-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {turns.map((turn, i) =>
              turn.role === 'user' ? (
                <UserBubble key={i} text={turn.text} />
              ) : (
                <AssistantTurn key={i} text={turn.text} result={turn.result} onGo={go} />
              ),
            )}

            {busy && (
              <div className="flex items-end gap-2">
                <AssistantAvatar />
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-4 py-3 shadow-sm">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-brand-500 [animation-delay:240ms]" />
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-danger-600" role="alert">
                Couldn’t reach the assistant. Check your connection and try again.
              </p>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-ink-200 bg-white px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English or Kinyarwanda…"
              aria-label="Message BII Assistant"
              className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-ink-50/50 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-40"
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}

function AssistantAvatar() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

function AssistantBubble({ text, avatar }: { text: string; avatar?: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2">
      {avatar ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          {avatar}
        </span>
      ) : (
        <AssistantAvatar />
      )}
      <div className="min-w-0 max-w-[85%]">
        <p className="whitespace-pre-line rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink-800 shadow-sm">
          {text}
        </p>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-brand-700 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
        {text}
      </p>
    </div>
  );
}

function AssistantTurn({
  text,
  result,
  onGo,
}: {
  text: string;
  result?: CustomerAssistResult;
  onGo: (href: string) => void;
}) {
  const services = result?.suggestions.services ?? [];
  const providers = result?.suggestions.providers ?? [];
  const questions = result?.questions ?? [];

  return (
    <div className="space-y-2">
      <AssistantBubble text={text} />

      {services.length > 0 && (
        <div className="pl-9">
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wider text-ink-400">
            Services
          </p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onGo(`/requests/new?serviceId=${s.id}`)}
                className="rounded-full border border-brand-200 bg-brand-50/70 px-3 py-1.5 text-left text-xs font-semibold text-brand-800 transition hover:border-brand-300 hover:bg-brand-50"
              >
                {s.name}
                {s.providerCount > 0 ? (
                  <span className="ml-1.5 text-brand-500">
                    {s.providerCount} {s.providerCount === 1 ? 'provider' : 'providers'}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {providers.length > 0 && (
        <div className="pl-9">
          <p className="mb-1.5 text-2xs font-bold uppercase tracking-wider text-ink-400">
            Providers
          </p>
          <div className="space-y-1.5">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onGo(`/providers/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white p-2.5 text-left shadow-sm transition hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20"
              >
                {p.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatarUrl}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {p.businessName.charAt(0)?.toUpperCase() ?? 'P'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                    <span className="truncate">{p.businessName}</span>
                    {p.verified && (
                      <span className="rounded-full bg-success-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-success-700">
                        Verified
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
                    <Star className="h-3 w-3 fill-rating-400 text-rating-400" aria-hidden="true" />
                    <span className="font-semibold tabular text-ink-700">{p.rating}</span>
                    <span>({p.reviewCount})</span>
                    {p.city && (
                      <>
                        <span aria-hidden="true">·</span>
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span className="truncate">{p.city}</span>
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div className="pl-9">
          {questions.map((q, i) => (
            <AssistantBubble key={i} text={q} />
          ))}
        </div>
      )}
    </div>
  );
}