import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/search', '/providers', '/service-offerings', '/become-a-provider'],
        disallow: [
          '/account',
          '/admin',
          '/api',
          '/bookings',
          '/compare',
          '/dashboard',
          '/disputes',
          '/forgot-password',
          '/invite',
          '/login',
          '/messages',
          '/provider',
          '/register',
          '/requests',
          '/reset-password',
          '/saved-searches',
          '/settings',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
