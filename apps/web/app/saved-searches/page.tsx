'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Bookmark, Search, Trash2 } from 'lucide-react';
import { savedSearchesApi, ApiError } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function SavedSearchesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    savedSearchesApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your saved searches'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    try {
      await savedSearchesApi.remove(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that search');
    }
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Search"
        title="Saved searches"
        description="We'll notify you when a new provider matches. Save one from the search page and it turns up here."
        actions={
          <Link href="/search" className="btn-secondary">
            <Search className="h-4 w-4" aria-hidden="true" /> Browse providers
          </Link>
        }
      />

      {loading && <LoadingBlock label="Loading your saved searches…" />}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="No saved searches yet"
          body="Run a search, then save it — you'll get a message the next time a new provider matches what you were looking for."
          action={
            <Link href="/search" className="btn-primary btn-sm">
              <Search className="h-4 w-4" aria-hidden="true" /> Browse providers
            </Link>
          }
        />
      )}

      <ul className="space-y-3">
        {items.map((s) => {
          const facets = [s.category?.name, s.service?.name, s.city, s.verifiedOnly ? 'Verified only' : null].filter(Boolean);
          // The search screen only reads `q` from the URL, so a re-run has to
          // come back as a text query — the facets above are what we saved.
          const rerun = s.service?.name ?? s.category?.name ?? s.city;

          return (
            <li key={s.id} className="surface-card flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Search className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-950">{s.name}</p>
                <p className="mt-1 truncate text-xs text-ink-500">{facets.join(' · ')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {rerun && (
                  <Link
                    href={`/search?q=${encodeURIComponent(rerun)}`}
                    className="btn-secondary btn-sm"
                    aria-label={`Run ${s.name} again`}
                  >
                    Re-run
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="icon-btn h-8 w-8 hover:bg-danger-50 hover:text-danger-600"
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
