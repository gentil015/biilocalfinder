'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mic, Paperclip, Send, Square, X } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { ReportButton } from '@/components/report-button';
import { messagingApi, type UploadedMessageAttachment } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/components/auth-provider';

/** Same calendar day as `d`, ignoring time of day. */
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function senderName(m: any, mine: boolean) {
  if (mine) return 'You';
  const s = m?.sender;
  if (!s) return 'Them';
  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  return name || 'Them';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function AttachmentMedia({ attachment }: { attachment: any }) {
  if (attachment.mimeType?.startsWith('video/')) {
    return (
      <video
        src={attachment.url}
        controls
        preload="metadata"
        className="max-h-72 w-full rounded-xl bg-home-night object-contain"
      />
    );
  }
  if (attachment.mimeType?.startsWith('audio/')) {
    return (
      <audio
        src={attachment.url}
        controls
        preload="metadata"
        className="w-64 max-w-full rounded-xl bg-home-night/5"
      />
    );
  }
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={attachment.url}
        alt=""
        loading="lazy"
        decoding="async"
        className="max-h-72 w-full rounded-xl object-cover"
      />
    </a>
  );
}

export default function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [body, setBody] = useState('');
  const [othersTyping, setOthersTyping] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedMessageAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRecordingRef = useRef(false);

  useEffect(() => {
    messagingApi.messages(id).then(setMessages);
    // Participants are the source of truth for the header: a brand-new thread
    // contains only the client's own opening message, so deriving the
    // counterpart from incoming messages alone would render a blank title.
    messagingApi.conversation(id).then(setConversation).catch(() => {});
    messagingApi.markRead(id).catch(() => {});

    const socket = getSocket();
    if (!socket) return;

    socket.emit('conversation:join', id);

    const onNewMessage = (message: any) => {
      if (message.conversationId !== id) return;
      setMessages((prev) => [...prev, message]);
    };
    const onTyping = (payload: { isTyping: boolean }) => setOthersTyping(payload.isTyping);

    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function onTypingChange(value: string) {
    setBody(value);
    getSocket()?.emit('typing', { conversationId: id, isTyping: value.length > 0 });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = 5 - pendingAttachments.length;
    if (remaining <= 0) {
      setUploadError('You can attach up to 5 files to a message.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded: UploadedMessageAttachment[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        uploaded.push(await messagingApi.uploadAttachment(id, file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload that file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removePending(storageKey: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.storageKey !== storageKey));
  }

  function clearRecordingTimers() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordLimitRef.current) {
      clearTimeout(recordLimitRef.current);
      recordLimitRef.current = null;
    }
  }

  function stopRecordingTracks() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  async function uploadVoiceNote(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await messagingApi.uploadAttachment(id, file);
      setPendingAttachments((prev) => (prev.length >= 5 ? prev : [...prev, uploaded]));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload that voice note.');
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    if (recording || uploading) return;
    if (pendingAttachments.length >= 5) {
      setUploadError('You can attach up to 5 files to a message.');
      return;
    }
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setUploadError('Voice recording is not supported in this browser.');
      return;
    }

    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        // Opus at 32kbps is plenty for speech and keeps a 2-minute clip well
        // under the serverless request-body limit.
        audioBitsPerSecond: 32_000,
      });

      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      cancelRecordingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearRecordingTimers();
        stopRecordingTracks();
        setRecording(false);
        recorderRef.current = null;
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];
        const cancelled = cancelRecordingRef.current;
        cancelRecordingRef.current = false;
        if (cancelled || chunks.length === 0) return;

        const type = recorder.mimeType || mimeType || 'audio/webm';
        const extension = type.includes('mp4')
          ? 'm4a'
          : type.includes('ogg')
            ? 'ogg'
            : type.includes('mpeg')
              ? 'mp3'
              : type.includes('wav')
                ? 'wav'
                : 'webm';
        const blob = new Blob(chunks, { type });
        void uploadVoiceNote(
          new File([blob], `voice-note-${Date.now()}.${extension}`, { type }),
        );
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((seconds) => seconds + 1);
      }, 1000);
      // Keep clips short enough to stay under the upload limit.
      recordLimitRef.current = setTimeout(() => {
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      }, 120_000);
    } catch {
      stopRecordingTracks();
      setUploadError('Microphone access was blocked. Allow it and try again.');
    }
  }

  function stopRecording(cancel = false) {
    cancelRecordingRef.current = cancel;
    clearRecordingTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopRecordingTracks();
      setRecording(false);
    }
  }

  useEffect(
    () => () => {
      cancelRecordingRef.current = true;
      clearRecordingTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function send() {
    if (recording) return;
    const text = body.trim();
    if (!text && pendingAttachments.length === 0) return;
    const socket = getSocket();
    const attachments = pendingAttachments.map((a) => ({ storageKey: a.storageKey }));
    const previousBody = body;
    const previousAttachments = pendingAttachments;
    setBody('');
    setPendingAttachments([]);
    setUploadError(null);
    try {
      if (socket?.connected) {
        socket.emit('message:send', { conversationId: id, body: text, attachments });
      } else {
        const message = await messagingApi.send(id, text, attachments);
        setMessages((prev) => [...prev, message]);
      }
    } catch (err) {
      // Put the draft back so a failed send never silently loses the text or
      // the already-uploaded media.
      setBody(previousBody);
      setPendingAttachments(previousAttachments);
      setUploadError(err instanceof Error ? err.message : 'Could not send that message.');
    }
  }

  // Group into day blocks so long threads stay readable, and keep the
  // header label without a second network call — the counterpart is simply
  // whoever on the other side has sent a message.
  const days = useMemo(() => {
    const out: { label: string; items: any[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const last = out[out.length - 1];
      if (last && sameDay(new Date(last.items[0].createdAt), d)) last.items.push(m);
      else out.push({ label: dayLabel(d), items: [m] });
    }
    return out;
  }, [messages]);

  const counterpart = useMemo(() => {
    // Prefer the participant record: it is correct even before the other side
    // has replied. Fall back to message senders for older threads.
    const participants = conversation?.participants ?? [];
    const otherParticipant =
      participants.find((p: any) => p?.provider?.user?.id && p.provider.user.id !== user?.id)?.provider ??
      participants.find((p: any) => p?.client?.user?.id && p.client.user.id !== user?.id)?.client;

    if (otherParticipant) {
      const profile = otherParticipant.user ?? {};
      const name =
        otherParticipant.businessName ??
        `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
      return { name: name || 'Conversation', avatarUrl: profile.avatarUrl };
    }

    const other = messages.find((m) => m?.sender?.id && m.sender.id !== user?.id)?.sender;
    if (!other) return null;
    const name = `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim();
    return { name: name || 'Conversation', avatarUrl: other.avatarUrl };
  }, [conversation, messages, user?.id]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-3xl flex-col px-4 py-4 md:h-[calc(100dvh-4rem)]">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <BackButton variant="icon" label="Back to conversations" fallbackHref="/messages" />
        {counterpart && (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-200">
              {counterpart.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={counterpart.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-ink-500" aria-hidden="true">
                  {counterpart.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <h1 className="truncate font-display text-base font-bold text-ink-950">
              {counterpart.name}
            </h1>
          </>
        )}
      </header>

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">
            No messages yet. Say hello to get started.
          </p>
        ) : (
          days.map((day) => (
            <div key={day.label}>
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-ink-200" />
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-400">
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-ink-200" />
              </div>

              <ul className="space-y-2.5">
                {day.items.map((m) => {
                  const mine = !!m?.sender?.id && m.sender.id === user?.id;
                  return (
                    <li
                      key={m.id}
                      className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!mine && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-200 text-2xs font-bold text-ink-500">
                          {m?.sender?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.sender.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (m?.sender?.firstName ?? '?').charAt(0).toUpperCase()
                          )}
                        </span>
                      )}

                      <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!mine && (
                          <span className="mb-1 px-1 text-2xs font-semibold text-ink-400">
                            {senderName(m, mine)}
                          </span>
                        )}
                        <div
                          className={`overflow-hidden rounded-2xl text-sm leading-relaxed ${
                            m.attachments?.length > 0 ? 'p-1.5' : 'px-3.5 py-2'
                          } ${
                            mine
                              ? 'rounded-br-md bg-brand-600 text-white dark:text-home-night'
                              : 'rounded-bl-md bg-ink-100 text-ink-900'
                          }`}
                        >
                          {m.attachments?.length > 0 && (
                            <div className={`flex flex-col gap-1.5 ${m.body?.trim() ? 'mb-1.5' : ''}`}>
                              {m.attachments.map((a: any) => (
                                <AttachmentMedia key={a.id} attachment={a} />
                              ))}
                            </div>
                          )}
                          {m.body?.trim() && (
                            <p className={m.attachments?.length > 0 ? 'px-2 pb-1' : undefined}>{m.body}</p>
                          )}
                        </div>
                        <time
                          dateTime={m.createdAt}
                          className="mt-1 px-1 text-2xs text-ink-400"
                        >
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        {!mine && (
                          <ReportButton
                            targetType="MESSAGE"
                            targetId={m.id}
                            label="Report"
                            className="mt-0.5 px-1 text-2xs text-ink-400 transition hover:text-danger-600"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        {othersTyping && (
          <div className="flex items-end gap-2" role="status">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-200" aria-hidden="true" />
            <span className="rounded-2xl rounded-bl-md bg-ink-100 px-4 py-3">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </span>
            <span className="sr-only">Contact is typing</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 shrink-0 border-t border-ink-200 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {(pendingAttachments.length > 0 || uploadError || recording) && (
          <div className="mb-2">
            {recording && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger-600" aria-hidden="true" />
                <span className="font-medium">
                  Recording voice note… <span className="tabular">{formatDuration(recordSeconds)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => stopRecording(true)}
                  className="ml-auto text-xs font-semibold underline"
                >
                  Cancel
                </button>
              </div>
            )}
            {pendingAttachments.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {pendingAttachments.map((a) => (
                  <li
                    key={a.storageKey}
                    className="relative h-16 w-16 overflow-hidden rounded-lg bg-ink-100 ring-1 ring-inset ring-ink-200"
                  >
                    {a.mimeType.startsWith('audio/') ? (
                      <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-ink-500">
                        <Mic className="h-4 w-4" aria-hidden="true" />
                        <span className="text-2xs font-semibold">Voice</span>
                      </span>
                    ) : a.mimeType.startsWith('video/') ? (
                      <video src={a.url} className="h-full w-full object-cover" muted preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removePending(a.storageKey)}
                      aria-label="Remove attachment"
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-home-night/70 text-white"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {uploadError && (
              <p className="error-text mt-1.5" role="alert">
                {uploadError}
              </p>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
            multiple
            hidden
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || recording || pendingAttachments.length >= 5}
            className="btn-secondary h-11 w-11 shrink-0 !px-0"
            aria-label="Attach an image or video"
            title="Attach an image or video"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={uploading || (!recording && pendingAttachments.length >= 5)}
            className={`${recording ? 'btn-danger' : 'btn-secondary'} h-11 w-11 shrink-0 !px-0`}
            aria-label={recording ? 'Stop recording voice note' : 'Record a voice note'}
            title={recording ? 'Stop recording voice note' : 'Record a voice note'}
          >
            {recording ? (
              <Square className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Mic className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <label htmlFor="message-body" className="sr-only">
            Message
          </label>
          <textarea
            id="message-body"
            rows={1}
            placeholder={recording ? 'Recording voice note…' : uploading ? 'Uploading…' : 'Type a message…'}
            className="max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5"
            value={body}
            onChange={(e) => onTypingChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="submit"
            disabled={(!body.trim() && pendingAttachments.length === 0) || uploading || recording}
            className="btn-primary h-11 w-11 shrink-0 !px-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
