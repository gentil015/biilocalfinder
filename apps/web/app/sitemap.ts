import type { MetadataRoute } from 'next';
import { API_URL } from '@/lib/api';
import { absoluteUrl } from '@/lib/seo';

export const revalidate = 3600;

const LAST_MODIFIED = new Date();

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  {
    url: absoluteUrl('/'),
    lastModified: LAST_MODIFIED,
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    url: absoluteUrl('/search'),
    lastModified: LAST_MODIFIED,
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    url: absoluteUrl('/become-a-provider'),
    lastModified: LAST_MODIFIED,
    changeFrequency: 'weekly',
    priority: 0.7,
  },
  {
    url: absoluteUrl('/terms'),
    lastModified: LAST_MODIFIED,
    changeFrequency: 'yearly',
    priority: 0.3,
  },
];

async function loadProviderIds() {
  const ids = new Set<string>();
  const pageSize = 50;
  const maxPages = 40;

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(`${API_URL}/api/search/providers?page=${page}&limit=${pageSize}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) break;

    const result = (await response.json()) as { items?: { id: string }[]; total?: number };
    const items = result.items ?? [];
    for (const item of items) ids.add(item.id);
    if (items.length < pageSize || page * pageSize >= (result.total ?? 0)) break;
  }

  return Array.from(ids);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let providerRoutes: MetadataRoute.Sitemap = [];

  try {
    const ids = await loadProviderIds();
    providerRoutes = ids.map((id) => ({
      url: absoluteUrl(`/providers/${id}`),
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    providerRoutes = [];
  }

  return [...STATIC_ROUTES, ...providerRoutes];
}
