'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, BellRing, MessageSquare, Mail } from 'lucide-react';
import { notificationsApi, ApiError } from '@/lib/api';
import { PushSubscribeButton } from '@/components/push-subscribe-button';
import { useI18n } from '@/components/locale-provider';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

// Column headings. These stay English in both locales for now: they are three
// single words used as column labels, and translating them would widen the
// columns without telling the reader anything the switches below don't.
const CHANNELS = [
  { key: 'inApp', label: 'In-app', icon: MessageSquare },
  { key: 'push', label: 'Push', icon: BellRing },
  { key: 'email', label: 'Email', icon: Mail },
] as const;

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationsApi
      .getPreferences()
      .then(setPrefs)
      .finally(() => setLoading(false));
  }, []);

  async function toggle(category: string, channel: 'inApp' | 'push' | 'email') {
    const current = prefs.find((p) => p.category === category);
    if (!current) return;
    const next = { ...current, [channel]: !current[channel] };
    setPrefs((prev) => prev.map((p) => (p.category === category ? next : p)));
    setSavingKey(`${category}:${channel}`);
    setError(null);
    try {
      await notificationsApi.updatePreference({ category, inApp: next.inApp, push: next.push, email: next.email });
    } catch (err) {
      setPrefs((prev) => prev.map((p) => (p.category === category ? current : p))); // revert
      setError(err instanceof ApiError ? err.message : t('notifications.error'));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label={t('notifications.loading')} />
      </main>
    );
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow={t('common.settings')}
        title={t('notifications.title')}
        description={t('notifications.description')}
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      <Panel
        title={t('notifications.thisDevice')}
        description={t('notifications.thisDeviceDescription')}
        className="mb-6"
      >
        <PushSubscribeButton />
        <p className="hint">{t('notifications.smsUnavailable')}</p>
      </Panel>

      <Panel
        title={t('notifications.deliveryChannels')}
        description={t('notifications.deliveryChannelsDescription')}
        bodyClassName="p-0"
      >
        <div className="table-wrap">
          <div className="min-w-[24rem]">
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,6rem)] items-center gap-2 border-b border-ink-200 bg-ink-50/60 px-5 py-3">
              <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                {t('notifications.updateType')}
              </span>
              {CHANNELS.map((c) => (
                <span
                  key={c.key}
                  className="flex items-center justify-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ink-500"
                >
                  <c.icon className="h-3 w-3" aria-hidden="true" />
                  {c.label}
                </span>
              ))}
            </div>
            {prefs.map((p) => (
              <div
                key={p.category}
                className="grid grid-cols-[minmax(0,1fr)_repeat(3,6rem)] items-center gap-2 border-b border-ink-100 px-5 py-4 last:border-0"
              >
                <div className="min-w-0">
                  {/* Category labels and descriptions are English-only: they
                      come from CATEGORY_LABELS in
                      apps/api/src/notifications/notification-categories.ts, so
                      translating them here would need the API to carry both
                      catalogs. Noted rather than half-done. */}
                  <p className="text-sm font-semibold text-ink-900">{p.label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{p.description}</p>
                </div>
                {CHANNELS.map(({ key, label }) => (
                  <div key={key} className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!p[key]}
                      aria-label={`${label} for ${p.label}`}
                      onClick={() => toggle(p.category, key)}
                      disabled={savingKey === `${p.category}:${key}`}
                      className={`h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                        p[key] ? 'bg-brand-600' : 'bg-ink-200'
                      }`}
                    >
                      <span
                        /* The knob stays solid white in both themes — a switch
                           knob has to read as *raised* against its track, and
                           the dark surface token would sink into the off-track
                           grey. White works on both the grey off-track and the
                           green on-track. */
                        className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform ${
                          p[key] ? 'translate-x-[22px]' : ''
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </main>
  );
}
