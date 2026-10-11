'use client';

import { useEffect, useState } from 'react';
import { Scale, Save, SlidersHorizontal } from 'lucide-react';
import { adminPersonalizationApi } from '@/lib/api';
import { PageHeader, Panel, StatCard, LoadingBlock } from '@/components/ui/page';

const LABELS: Record<string, string> = {
  searchRelevance: 'Search relevance',
  personalInterest: 'Personal interest',
  distance: 'Distance',
  rating: 'Rating',
  availability: 'Availability',
  providerQuality: 'Provider quality (verification, experience, response rate)',
};

export default function AdminPersonalizationPage() {
  const [weights, setWeights] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminPersonalizationApi.getWeights().then(setWeights);
  }, []);

  async function save() {
    if (!weights) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await adminPersonalizationApi.updateWeights(weights);
      setWeights(updated);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!weights) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading ranking weights…" />
      </main>
    );
  }

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const share = (value: number) => Math.round((value / sum) * 100);
  const dominant = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];
  const zeroed = Object.values(weights).filter((v) => v === 0).length;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Personalization"
        title="Ranking weights"
        description="Adjust how much each factor influences provider recommendations and search ranking. Values are normalized automatically, so they don't need to sum to exactly 1."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={SlidersHorizontal} label="Factors" value={String(Object.keys(weights).length)} sub="In the blend" />
        <StatCard icon={Scale} label="Raw total" value={sum.toFixed(2)} sub="Normalized on read" />
        <StatCard
          label="Dominant factor"
          tone="brand"
          value={dominant ? share(dominant[1]) + '%' : '—'}
          sub={dominant ? LABELS[dominant[0]] ?? dominant[0] : undefined}
        />
        <StatCard
          label="Zeroed factors"
          tone={zeroed > 0 ? 'warning' : 'neutral'}
          value={String(zeroed)}
          sub={zeroed > 0 ? 'Ignored until set above 0' : 'All factors active'}
        />
      </div>

      <Panel
        title="Blend"
        description="Percentages are the normalised share of each factor — moving one slider rescales the others."
      >
        <ul className="space-y-5">
          {Object.entries(weights).map(([key, value]) => (
            <li key={key} className="field">
              <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                <label className="label mb-0" htmlFor={`weight-${key}`}>
                  {LABELS[key] ?? key}
                </label>
                <span className="font-display text-sm font-extrabold tabular text-brand-700">
                  {share(value)}%
                  <span className="ml-1.5 text-xs font-medium text-ink-400">
                    raw {value.toFixed(2)}
                  </span>
                </span>
              </div>
              <input
                id={`weight-${key}`}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })}
              />
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
          <p className="text-xs text-ink-500" role="status">
            {saved ? 'Weights saved and live in ranking.' : 'Changes apply to search and recommendations as soon as you save.'}
          </p>
          <button type="button" onClick={save} disabled={saving} className="btn-primary btn-sm">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {saving ? 'Saving…' : 'Save weights'}
          </button>
        </div>
      </Panel>
    </main>
  );
}
