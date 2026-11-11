import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { AppChrome } from '@/components/app-chrome';
import { AuthProvider } from '@/components/auth-provider';
import { LocaleProvider } from '@/components/locale-provider';
import { ThemeProvider } from '@/components/theme-provider';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '@/lib/seo';
import './globals.css';

/**
 * Two faces, two jobs.
 *
 * Inter carries every piece of text a user actually has to read — prices,
 * ratings, names, form labels — because at 12–15px across hundreds of
 * comparisons its legibility is hard to beat.
 *
 * Manrope is reserved for headings and the wordmark. It is slightly wider and
 * more geometric than Inter, so a page title reads as a deliberate heading
 * rather than as body copy that got scaled up.
 *
 * Both are variable fonts, self-hosted rather than pulled from Google at build
 * time. `next/font/google` fetches on every build, which makes the build
 * depend on a third party being reachable and fails closed when it isn't. The
 * files are committed, so builds are reproducible and work offline.
 */
const sans = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
});

const display = localFont({
  src: './fonts/Manrope-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
  fallback: ['var(--font-sans)', 'system-ui', 'sans-serif'],
});

const siteVerification: Metadata['verification'] = {
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : {}),
  ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
    ? { other: { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } }
    : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: 'BII Localfinder',
    statusBarStyle: 'default',
  },
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: 'Local services',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_URL,
    locale: 'en_RW',
    alternateLocale: ['rw_RW'],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  ...(Object.keys(siteVerification).length > 0 ? { verification: siteVerification } : {}),
};

const websiteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl('/icon1.png'),
      description: DEFAULT_DESCRIPTION,
      areaServed: { '@type': 'Country', name: 'Rwanda' },
      knowsLanguage: ['en', 'rw', 'fr'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: ['en', 'rw'],
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ],
};

export const viewport: Viewport = {
  // The media-pair below is the server-rendered baseline; ThemeProvider
  // appends its own unmediated tag after these once the real preference is
  // known (the browser uses the last match), so a light-theme user on a dark
  // OS still gets a light chrome. Never mutate or delete these tags from
  // client code — they are React-owned hoistables.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF8F2' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1712' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Theme bootstrap — must run before first paint, before React hydrates.
 *
 * Mirrors readStoredPreference/applyTheme in components/theme-provider.tsx
 * (localStorage `bii-theme`; "system" or anything invalid → OS preference).
 * The server always renders the light default, so this script is what prevents
 * a white flash on load for dark-theme users. It is deliberately inline rather
 * than a module: a `next/script` file would load too late, and this has no
 * dependencies to keep it under a hundred bytes. Keep in sync with the
 * provider — if one changes storage keys or class names, both must.
 */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var t = localStorage.getItem('bii-theme');
    var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

/**
 * `lang="en"` below is the server-rendered default, not a decision about the
 * user: the auth token lives in localStorage, so nothing on the server can know
 * which language the visitor signed in with. LocaleProvider corrects the
 * attribute once /users/me resolves. It is inside AuthProvider for that reason.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* suppressHydrationWarning on <html> covers the class/style this
            script writes during parsing. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink-900 antialiased">
        <AuthProvider>
          <LocaleProvider>
            <ThemeProvider>
              <AppChrome>{children}</AppChrome>
            </ThemeProvider>
          </LocaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
