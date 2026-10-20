import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { AppChrome } from '@/components/app-chrome';
import { AuthProvider } from '@/components/auth-provider';
import { LocaleProvider } from '@/components/locale-provider';
import { ThemeProvider } from '@/components/theme-provider';
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

export const metadata: Metadata = {
  title: {
    default: 'Bii Localfinder — Find trusted local service providers',
    template: '%s · Bii Localfinder',
  },
  description:
    'Connect with verified plumbers, electricians, mechanics, developers, photographers and more, near you.',
  applicationName: 'Bii Localfinder',
  keywords: [
    'local services',
    'verified providers',
    'get a quote',
    'plumbers Rwanda',
    'electricians Kigali',
  ],
  openGraph: {
    type: 'website',
    title: 'Bii Localfinder — Find trusted local service providers',
    description:
      'Search verified local pros, compare structured quotes, and book with confidence.',
    siteName: 'Bii Localfinder',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bii Localfinder',
    description: 'Search verified local pros, compare structured quotes, and book with confidence.',
  },
  robots: { index: true, follow: true },
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
