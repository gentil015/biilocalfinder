'use client';

import { useEffect, useState } from 'react';
import { personalizationApi } from '@/lib/api';
import { InterestSection } from '@/components/interest-section';
import { useI18n } from '@/components/locale-provider';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

export default function PersonalizationSettingsPage() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<any>(null);
  const [interests, setInterests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([personalizationApi.getPreferences(), personalizationApi.interests()])
      .then(([p, i]) => {
        setPrefs(p);
        setInterests(i);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: string, value: boolean) {
    setPrefs((prev: any) => ({ ...prev, [key]: value }));
    setSaving(true);
    try {
      await personalizationApi.updatePreferences({ [key]: value });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label={t('personalization.loading')} />
      </main>
    );
  }

  const toggles = [
    {
      key: 'personalizationEnabled',
      label: t('personalization.recommendationsEnabled'),
      description: t('personalization.recommendationsEnabledDescription'),
    },
    {
      key: 'locationBasedEnabled',
      label: t('personalization.locationEnabled'),
      description: t('personalization.locationEnabledDescription'),
    },
    {
      key: 'recentlyViewedEnabled',
      label: t('personalization.recentlyViewed'),
      description: t('personalization.recentlyViewedDescription'),
    },
  ];

  const onCount = toggles.filter((tg) => prefs?.[tg.key]).length;

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow={t('common.settings')}
        title={t('personalization.title')}
        description={t('personalization.description')}
      />

      <Panel
        title={t('personalization.recommendations')}
        description={t('personalization.activeCount', { on: onCount, total: toggles.length })}
        className="mb-6"
        actions={
          <span className="text-xs text-ink-500" role="status">
            {saving ? t('common.saving') : t('personalization.autoSave')}
          </span>
        }
      >
        <div className="space-y-1">
          {toggles.map((tg) => (
            <label key={tg.key} className="check-row" htmlFor={`pref-${tg.key}`}>
              <input
                id={`pref-${tg.key}`}
                type="checkbox"
                checked={!!prefs?.[tg.key]}
                disabled={saving}
                onChange={(e) => toggle(tg.key, e.target.checked)}
              />
              <span>
                <span className="block font-semibold text-ink-900">{tg.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{tg.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel
        title={t('personalization.interests')}
        description={t('personalization.interestsDescription')}
      >
        {/* Interest names come from the API's category and service tables, so
            they render in the language they were entered in — English in every
            seeded row. Translating them is a data task, not a UI one. */}
        <InterestSection interests={interests} />
      </Panel>
    </main>
  );
}
