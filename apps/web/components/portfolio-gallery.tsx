'use client';

import { useMemo, useState } from 'react';
import { Film, Images } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';

interface PortfolioImage {
  id: string;
  url: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  beforeAfterRole?: 'BEFORE' | 'AFTER' | null;
  beforeAfterGroup?: string | null;
}

interface PortfolioProject {
  id: string;
  title: string;
  service?: { id: string; name: string } | null;
  images: PortfolioImage[];
}

// Groups a project's images into: ordinary tiles, and before/after pairs
// (matched by beforeAfterGroup) rendered as a single side-by-side tile.
function groupMedia(images: PortfolioImage[]) {
  const pairs = new Map<string, { before?: PortfolioImage; after?: PortfolioImage }>();
  const singles: PortfolioImage[] = [];

  for (const img of images) {
    if (img.beforeAfterGroup && img.beforeAfterRole) {
      const entry = pairs.get(img.beforeAfterGroup) ?? {};
      entry[img.beforeAfterRole === 'BEFORE' ? 'before' : 'after'] = img;
      pairs.set(img.beforeAfterGroup, entry);
    } else {
      singles.push(img);
    }
  }

  return { pairs: [...pairs.values()].filter((p) => p.before && p.after), singles };
}

export function PortfolioGallery({ projects }: { projects: PortfolioProject[] }) {
  const [serviceFilter, setServiceFilter] = useState<string | null>(null);

  const services = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) if (p.service) map.set(p.service.id, p.service.name);
    return [...map.entries()];
  }, [projects]);

  const visibleProjects = serviceFilter ? projects.filter((p) => p.service?.id === serviceFilter) : projects;
  const hasAnyMedia = visibleProjects.some((p) => p.images?.length);
  const visibleCount = visibleProjects.reduce((total, p) => total + (p.images?.length ?? 0), 0);

  return (
    <div>
      {services.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter portfolio by service">
          <button
            type="button"
            onClick={() => setServiceFilter(null)}
            aria-pressed={serviceFilter === null}
            className={`chip-interactive ${serviceFilter === null ? 'chip-active' : ''}`}
          >
            All
          </button>
          {services.map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => setServiceFilter(id)}
              aria-pressed={serviceFilter === id}
              className={`chip-interactive ${serviceFilter === id ? 'chip-active' : ''}`}
            >
              {name}
            </button>
          ))}
          {hasAnyMedia && (
            <span className="tabular ml-auto text-xs font-medium text-ink-400">
              {visibleCount} {visibleCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      )}

      {hasAnyMedia ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {visibleProjects.flatMap((project) => {
            const { pairs, singles } = groupMedia(project.images ?? []);
            return [
              ...pairs.map((pair, i) => (
                <div
                  key={`${project.id}-pair-${i}`}
                  className="col-span-2 grid aspect-square grid-cols-2 overflow-hidden rounded-xl bg-ink-100 ring-1 ring-inset ring-ink-200 sm:col-span-1"
                >
                  <div className="relative min-w-0 border-r border-ink-950/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pair.before!.url}
                      alt={`${project.title} before`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink-950/70 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      Before
                    </span>
                  </div>
                  <div className="relative min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pair.after!.url}
                      alt={`${project.title} after`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink-950/70 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                      After
                    </span>
                  </div>
                </div>
              )),
              ...singles.map((img) =>
                img.mediaType === 'VIDEO' ? (
                  <div
                    key={img.id}
                    className="relative aspect-square overflow-hidden rounded-xl bg-ink-950 ring-1 ring-inset ring-ink-200"
                  >
                    <video
                      src={img.url}
                      className="h-full w-full object-cover"
                      muted
                      controls
                      preload="metadata"
                      aria-label={`${project.title} video`}
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-ink-950/70 p-1 text-white backdrop-blur-sm">
                      <Film className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={img.url}
                    alt={project.title}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-xl bg-ink-100 object-cover ring-1 ring-inset ring-ink-200"
                  />
                ),
              ),
            ];
          })}
        </div>
      ) : (
        <EmptyState icon={Images} title="No portfolio items yet." className="py-10" />
      )}
    </div>
  );
}
