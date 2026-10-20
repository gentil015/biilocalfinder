import type { Config } from 'tailwindcss';

/**
 * Bii Localfinder — design tokens.
 *
 * The product is a marketplace, so the visual system has to carry a lot of
 * dense, comparative information (ratings, distance, price, verification)
 * without ever looking noisy. The rules that follow from that:
 *
 *   1. Borders lead, shadows follow. Surfaces are separated by a single hairline
 *      rather than a drop shadow, so long scrolling pages don't turn into a
 *      stack of floating islands.
 *   2. One accent, used sparingly. `brand` marks the single most important
 *      action on a screen. Everything else is neutral.
 *   3. The neutral ramp is cool and evenly spaced. 300/400/500 are the
 *      workhorses for secondary text, dividers and disabled states, so they
 *      carry deliberate contrast rather than being a generated scale.
 *
 * DIRECTION — "forest green + warm ivory": a warm-ivory canvas, crisp white
 * cards, generous spacing and one confident forest green. The neutral ramp is
 * a warm, green-leaning grey so the ivory page and the white surfaces read as
 * *surfaces* rather than melting into each other, and so every neutral stays
 * inside the brand family.
 *
 * PALETTE — one identity for the whole product; there is no second set of
 * colours for "app" vs "marketing":
 *
 *   home/night  #0B1712   every static dark band: footer, dark shells, hero
 *   home/forest #0F2E28   deepest forest — layered dark surfaces
 *   brand-700   #166534   THE primary forest green (light mode action fill)
 *   home/mist   #F1F5EC   secondary page band (`home-mist`)
 *   canvas      #FAF8F2   page background — warm ivory
 *
 * Semantic status colours (success/warning/danger/info) stay recognisable on
 * purpose: they carry status meaning, not surface meaning, and a "red" that
 * drifts warm stops reading as an error.
 *
 * DARK MODE — every surface, text, border, brand and status ramp step is
 * backed by a CSS custom property (RGB triplets in globals.css) that is
 * re-defined under `.dark` on <html>. Class names never change between
 * themes: `text-ink-900` is deep-forest on light ivory and soft ivory on deep
 * forest, `bg-surface` is white in light and #122019 in dark. The dark theme
 * is forest green at night — deep green-tinted surfaces, ivory text, and a
 * *lighter* green accent (brand-700 #86EFAC) for actions. Marketing bands
 * (hero, footer, dark sections) are the static deep forest #0B1712 in both
 * themes and gain warmth from softened aurora washes under .dark.
 *
 * Deliberately NOT variable-backed (they must look the same in both themes):
 *   - home/night, home/forest, home/mint — the static marketing identity.
 *     Dark bands (hero, footer, dark sections) stay their deep forest in dark
 *     mode; that is what gives the dark theme depth instead of a flat wash.
 *   - `white` itself — `text-white` on brand fills must stay white. Card
 *     surfaces use the separate `surface` token instead.
 *
 * PRIMARY BUTTON polarity flips in dark mode: light = brand-700 (#166534
 * forest) fill + white text; dark = brand-700 (light green #86EFAC) fill +
 * deep-forest text, hovering to brand-800 (#BBF7D0). That keeps the primary
 * action the most present element on a deep-forest screen.
 *
 * Contrast is pinned, not assumed: `ink-500` is the muted-text token and clears
 * 4.5:1 on both white cards and the warm-ivory canvas (and its dark flip
 * clears 4.5:1 on dark surfaces); `ink-400` clears 3:1 on both and is
 * therefore large/decorative text only.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page background. A clean near-white in light; home-night in dark.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',

        // Cards, panels, dropdowns and every "raised" surface. White in light,
        // deep charcoal in dark. Never use raw `bg-white` for a surface —
        // `text-white` (on brand fills) stays literal white in both themes.
        surface: 'rgb(var(--surface) / <alpha-value>)',

        // The brand palette. These are the anchors for every token below.
        // night/forest are the static deep-forest marketing bands (hero,
        // footer, dark CTA sections) — the forest identity at night. gold is
        // retired as a UI accent (ratings own their own ramp) and kept only as
        // a legacy alias so a stray call site degrades to the forest family.
        // mist/sand are page-band fills and flip with the theme.
        home: {
          night: '#0B1712', // deep forest — every static dark band
          mist: 'rgb(var(--home-mist) / <alpha-value>)',
          sand: 'rgb(var(--home-sand) / <alpha-value>)',
          gold: '#166534', // legacy alias retired to forest
          mint: '#86EFAC', // light green highlight on dark bands
          forest: '#0F2E28', // deepest forest, for layered dark surfaces
        },

        // The single neutral ramp for the whole product. Cool grey, evenly
        // spaced, with a deliberate gap at 400/500 so secondary text carries
        // real contrast instead of fading out.
        // Variable-backed: the ramp flips in dark mode (see header comment).
        ink: {
          25: 'rgb(var(--ink-25) / <alpha-value>)',
          50: 'rgb(var(--ink-50) / <alpha-value>)',
          100: 'rgb(var(--ink-100) / <alpha-value>)',
          200: 'rgb(var(--ink-200) / <alpha-value>)',
          300: 'rgb(var(--ink-300) / <alpha-value>)',
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },

        // Primary action colour, anchored on home-forest #0F2E28. Deep enough
        // that white text clears 4.5:1 from 500 upward in light mode, so
        // `bg-brand-*` + `text-white` is always legible. In dark mode the ramp
        // flips to bright mint-teal and buttons invert to night text (see the
        // dark-mode note in the file header). Gold is the hero/highlight
        // accent, used where it sits on a dark surface.
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: '#0B1712',
        },

        // Highlight, anchored on the light-green marketing accent. This ramp
        // only ever sits on the static dark forest bands (auth aside eyebrow,
        // selected provider-type chip), so it is a light green rather than the
        // neon mint it once was — the same family as the dark-mode brand accent
        // (#86EFAC). Light green on white is unreadable by design, so it is
        // never a light-mode text colour.
        accent: {
          50: '#E8FCEF',
          100: '#D1FADF',
          200: '#A7F3C2',
          300: '#86EFAC',
          400: '#6EE7A0',
          500: '#4ADE80',
          600: '#22C55E',
          700: '#15803D',
        },

        // Semantic status ramp. Defined here (rather than leaning on Tailwind's
        // stock green/red) so every state reads as one family. The soft 50-200
        // steps (badge and alert backgrounds) become deep status tints in dark
        // mode; the 600-800 text steps become bright enough to clear AA on
        // those dark tints.
        success: {
          50: 'rgb(var(--success-50) / <alpha-value>)',
          100: 'rgb(var(--success-100) / <alpha-value>)',
          200: 'rgb(var(--success-200) / <alpha-value>)',
          300: '#86EFAC',
          400: '#4ADE80',
          500: 'rgb(var(--success-500) / <alpha-value>)',
          600: 'rgb(var(--success-600) / <alpha-value>)',
          700: 'rgb(var(--success-700) / <alpha-value>)',
          800: 'rgb(var(--success-800) / <alpha-value>)',
        },
        warning: {
          50: 'rgb(var(--warning-50) / <alpha-value>)',
          100: 'rgb(var(--warning-100) / <alpha-value>)',
          200: 'rgb(var(--warning-200) / <alpha-value>)',
          300: '#FCD34D',
          400: '#FBBF24',
          500: 'rgb(var(--warning-500) / <alpha-value>)',
          600: 'rgb(var(--warning-600) / <alpha-value>)',
          700: 'rgb(var(--warning-700) / <alpha-value>)',
          800: 'rgb(var(--warning-800) / <alpha-value>)',
        },
        danger: {
          50: 'rgb(var(--danger-50) / <alpha-value>)',
          100: 'rgb(var(--danger-100) / <alpha-value>)',
          200: 'rgb(var(--danger-200) / <alpha-value>)',
          300: '#FCA5A5',
          400: '#F87171',
          500: 'rgb(var(--danger-500) / <alpha-value>)',
          600: 'rgb(var(--danger-600) / <alpha-value>)',
          700: 'rgb(var(--danger-700) / <alpha-value>)',
          800: 'rgb(var(--danger-800) / <alpha-value>)',
        },
        // Informational reads as cyan, the one secondary hue in the system, so
        // it never gets confused with `brand` green — which owns buttons and
        // links. Amber stays reserved for "needs attention", red for "broken".
        info: {
          50: 'rgb(var(--info-50) / <alpha-value>)',
          100: 'rgb(var(--info-100) / <alpha-value>)',
          200: 'rgb(var(--info-200) / <alpha-value>)',
          300: '#67E8F9',
          400: '#22D3EE',
          500: 'rgb(var(--info-500) / <alpha-value>)',
          600: 'rgb(var(--info-600) / <alpha-value>)',
          700: 'rgb(var(--info-700) / <alpha-value>)',
          800: 'rgb(var(--info-800) / <alpha-value>)',
        },

        // Ratings keep their own gold, and it is the *same* gold as the hero
        // accent — a 4.8 rating and the primary CTA belong to the same identity.
        // Rating text uses 600, which clears 4.5:1 on white and (flipped) on
        // dark surfaces; 400/500 are fills (stars) and backgrounds.
        rating: {
          400: 'rgb(var(--rating-400) / <alpha-value>)',
          500: 'rgb(var(--rating-500) / <alpha-value>)',
          600: 'rgb(var(--rating-600) / <alpha-value>)',
        },
      },

      fontFamily: {
        // Inter for everything that is read: at 13–15px across dozens of
        // badges and prices, its x-height and open apertures win.
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        // Manrope for headings and the wordmark. Geometric, slightly wider than
        // Inter, so display type reads as deliberate rather than as UI text
        // that got bigger.
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        // Prices, ratings, counts and any column of figures that has to line up.
        numeric: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },

      boxShadow: {
        // Deliberately shallow. `xs`/`sm` are the everyday card elevations and
        // should be felt more than seen; `lg`/`xl` are reserved for overlays.
        // Shadows are tinted with the deep-forest night ink rather than pure
        // black, so a shadow reads as depth instead of dirt. In dark mode the
        // borders do the separating and the (barely visible) shadows just
        // deepen the page.
        xs: '0 1px 2px 0 rgb(11 23 18 / 0.04)',
        sm: '0 1px 2px 0 rgb(11 23 18 / 0.05), 0 1px 3px 0 rgb(11 23 18 / 0.04)',
        md: '0 2px 4px -1px rgb(11 23 18 / 0.05), 0 4px 12px -2px rgb(11 23 18 / 0.06)',
        lg: '0 4px 8px -2px rgb(11 23 18 / 0.06), 0 12px 28px -6px rgb(11 23 18 / 0.09)',
        xl: '0 8px 16px -4px rgb(11 23 18 / 0.08), 0 24px 56px -12px rgb(11 23 18 / 0.13)',
        // The standard resting elevation for a card — barely there.
        card: '0 1px 2px 0 rgb(11 23 18 / 0.04), 0 2px 8px -4px rgb(11 23 18 / 0.06)',
        // Focus affordance, matched to the brand forest.
        ring: '0 0 0 3px rgb(var(--ring) / 0.16)',
        // Legacy aliases kept so components written before the redesign
        // (glow / lift / nav) still resolve to sensible elevations. Shadows are
        // tinted with the deep-forest night ink rather than pure black.
        glow: '0 0 0 1px rgb(22 101 52 / 0.10), 0 16px 40px -16px rgb(11 23 18 / 0.20)',
        lift: '0 1px 2px 0 rgb(11 23 18 / 0.04), 0 10px 28px -12px rgb(11 23 18 / 0.12)',
        nav: '0 1px 0 0 rgb(11 23 18 / 0.06), 0 8px 24px -14px rgb(11 23 18 / 0.14)',
      },

      // Unprefixed ring-* resolves to the brand forest instead of Tailwind's
      // stock blue, so focus rings are on-brand without every call site opting
      // in. The ring colour flips with the theme (light green on dark).
      ringColor: {
        DEFAULT: 'rgb(var(--ring) / 0.16)',
      },
      // The offset behind a ring is the surrounding surface — white cards in
      // light, dark cards in dark — never a white halo on a dark screen.
      ringOffsetColor: {
        DEFAULT: 'rgb(var(--ring-offset))',
      },

      backgroundImage: {
        // Aurora wash for dark surfaces (auth aside, dark app shells). Same
        // shape as the landing hero so every dark band is lit by the same light.
        mesh:
          'radial-gradient(ellipse 80% 70% at 8% -20%, rgb(134 239 172 / 0.20), transparent 52%), radial-gradient(ellipse 55% 50% at 100% 0%, rgb(228 181 106 / 0.18), transparent 48%), radial-gradient(ellipse 70% 55% at 70% 110%, rgb(11 23 18 / 0.95), transparent 58%)',
        'home-aurora':
          'radial-gradient(ellipse 80% 70% at 8% -20%, rgb(134 239 172 / 0.22), transparent 52%), radial-gradient(ellipse 55% 50% at 100% 0%, rgb(228 181 106 / 0.20), transparent 48%), radial-gradient(ellipse 70% 55% at 70% 110%, rgb(11 23 18 / 0.95), transparent 58%)',
        'brand-gradient': 'linear-gradient(135deg, #15803D 0%, #166534 55%, #0B1712 100%)',
        hairline: 'linear-gradient(to right, transparent, rgb(11 23 18 / 0.08), transparent)',
      },

      borderRadius: {
        // Tightened one step from Tailwind's defaults for a crisper SaaS feel —
        // 24px cards on a dense page read as "bubbly", 20px reads as modern.
        '3xl': '1.25rem',
        '4xl': '2rem',
      },

      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up-sheet': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        marquee: 'marquee 42s linear infinite',
        float: 'float 7s ease-in-out infinite',
        'slide-up-sheet': 'slide-up-sheet 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
      },

      transitionTimingFunction: {
        // One easing curve for the whole product, so motion feels like a
        // single system instead of a collection of one-off transitions.
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
export default config;
