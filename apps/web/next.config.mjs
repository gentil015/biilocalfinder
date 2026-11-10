/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// Next injects inline bootstrap scripts, so 'unsafe-inline' is required unless
// the app moves to a nonce-based middleware setup. 'unsafe-eval' is only
// needed by the dev server.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http://localhost:*",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:* ws: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Voice notes use getUserMedia, so the microphone must be allowed for this
  // origin. Camera stays blocked.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

// Host canonicalization (apex vs www vs old deployment hosts) is handled at
// the hosting layer. Redirecting hosts here as well can create an infinite
// redirect loop when the platform redirects in the opposite direction.

// Authenticated and account-specific surfaces should never be indexed, even
// if a crawler ignores robots.txt. The public marketplace routes are excluded.
const PRIVATE_ROUTES = [
  '/account',
  '/account/:path*',
  '/admin',
  '/admin/:path*',
  '/bookings',
  '/bookings/:path*',
  '/compare',
  '/dashboard',
  '/dashboard/:path*',
  '/disputes',
  '/disputes/:path*',
  '/forgot-password',
  '/invite/:path*',
  '/login',
  '/messages',
  '/messages/:path*',
  '/provider',
  '/provider/:path*',
  '/register',
  '/requests',
  '/requests/:path*',
  '/reset-password',
  '/saved-searches',
  '/settings',
  '/settings/:path*',
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      ...PRIVATE_ROUTES.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ];
  },
};
export default nextConfig;
