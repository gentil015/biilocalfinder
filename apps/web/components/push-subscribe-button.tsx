'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Bell, BellOff } from 'lucide-react';
import { notificationsApi, ApiError } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function PushSubscribeButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setSupported(true);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => undefined);
  }, []);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const { publicKey } = await notificationsApi.getPushPublicKey();
      if (!publicKey) {
        setError('Push notifications are not configured on this server yet.');
        return;
      }
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await notificationsApi.registerPush({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
        userAgent: navigator.userAgent,
      });
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not enable push notifications');
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await notificationsApi.removePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not disable push notifications');
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={busy}
        aria-busy={busy}
        className={`btn w-full ${subscribed ? 'btn-secondary' : 'btn-primary'}`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600"
          />
        ) : subscribed ? (
          <BellOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Bell className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? 'Working…' : subscribed ? 'Disable push notifications' : 'Enable push notifications on this device'}
      </button>

      {error && (
        <div className="alert alert-error mt-3" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <p className="hint">
        {subscribed
          ? 'This browser will get a system notification for each update.'
          : 'Your browser will ask you once before anything is sent.'}
      </p>
    </div>
  );
}
