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
 * DIRECTION — "clean light SaaS": a near-white canvas, crisp white cards,
 * generous spacing and one confident brand green. The neutral ramp is a cool
 * grey so the white surfaces read as *surfaces* rather than melting into the
 * page, which is what the old warm-parchment palette struggled with once the
 * product grew dense dashboards.
 *
 * PALETTE — the marketing identity is preserved and remains the anchor for the
 * whole product; there is no second set of colours for "app" vs "marketing":
 *
 *   home/night  #0A0E13   every "dark" surface: footer, dark shells, hero
 *   home/forest #0F2E28   deep green — the anchor for `brand` and the trust
 *                         bands, so every green in the product is one green
 *   home/mist   #F5F6F8   page background (`canvas`) — clean, near-white
 *   home/gold   #E4B56A   the highlight/accent colour for dark surfaces and
 *                         hero CTAs (always paired with night text)
 *   home/mint   #5EEAD4   highlights and badges on dark surfaces only
 *
 * Semantic status colours (success/warning/danger/info) stay stock on purpose:
 * they carry status meaning, not surface meaning, and a "red" that drifts warm
 * stops reading as an error.
 *
 * DARK MODE — every surface, text, border, brand and status ramp step is
 * backed by a CSS custom property (RGB triplets in globals.css) that is
 * re-defined under `.dark` on <html>. Class names never change between
 * themes: `text-ink-900` is near-black on light cards and soft ivory on
 * dark ones, `bg-surface` is white in light and warm charcoal (#2C322E) in
 * dark. The dark theme is its own hand-tuned ladder in a warm-charcoal /
 * ivory family — not a blue-black inversion — with a restrained sage-teal
 * accent (brand-700 #8FC9B5) replacing the old neon mint. Marketing bands
 * (hero, footer, trust sections) stay their static dark in both themes and
 * gain warmth from softened aurora washes under .dark.
 *
 * Deliberately NOT variable-backed (they must look the same in both themes):
 *   - home/night, home/forest, home/mint, home/gold — the marketing identity.
 *     Dark bands (hero, footer, trust sections) stay dark in dark mode; that
 *     is what gives the dark theme depth instead of a flat grey wash.
 *   - `white` itself — `text-white` on brand fills must stay white. Card
 *     surfaces use the separate `surface` token instead.
 *
 * PRIMARY BUTTON polarity flips in dark mode: light = brand-700 fill + white
 * text; dark = brand-700 (sage-teal accent #8FC9B5) fill + ink-night text,
 * hovering to brand-800 (#A6D9C7). That keeps the primary action the most
 * present element on a charcoal screen — the same deep green that reads as
 * confident on white reads as a black hole on warm charcoal.
 *
 * Contrast is pinned, not assumed: `ink-500` is the muted-text token and clears
 * 4.5:1 on both white cards and the near-white canvas (and its dark flip
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
        // night/forest/mint/gold are static: the marketing identity must not
        // shift between themes. mist/sand are page-band fills and flip.
        home: {
          night: '#0A0E13',
          mist: 'rgb(var(--home-mist) / <alpha-value>)',
          sand: 'rgb(var(--home-sand) / <alpha-value>)',
          gold: '#E4B56A',
          mint: '#5EEAD4',
          forest: '#0F2E28',
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
          950: '#061A16',
        },

        // Highlight, anchored on home-mint but deliberately softened: this
        // ramp only ever sits on the static dark marketing bands (auth aside
        // eyebrow, selected provider-type chip), so it is a restrained
        // sage-teal rather than the neon mint it once was — the same family
        // as the dark-mode brand accent (#8FC9B5). Mint on white is
        // unreadable by design, so it is never a light-mode text colour.
        accent: {
          50: '#E6FBF6',
          100: '#C2F5EB',
          200: '#A5E5D4',
          300: '#8FD4C0',
          400: '#7FC4B0',
          500: '#5AAE98',
          600: '#0C8F7E',
          700: '#0B7164',
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
        // Shadows are tinted with the cool night ink rather than pure black, so
        // a shadow reads as depth instead of dirt. In dark mode the borders do
        // the separating and the (barely visible) shadows just deepen the page.
        xs: '0 1px 2px 0 rgb(10 14 19 / 0.04)',
        sm: '0 1px 2px 0 rgb(10 14 19 / 0.05), 0 1px 3px 0 rgb(10 14 19 / 0.04)',
        md: '0 2px 4px -1px rgb(10 14 19 / 0.05), 0 4px 12px -2px rgb(10 14 19 / 0.06)',
        lg: '0 4px 8px -2px rgb(10 14 19 / 0.06), 0 12px 28px -6px rgb(10 14 19 / 0.09)',
        xl: '0 8px 16px -4px rgb(10 14 19 / 0.08), 0 24px 56px -12px rgb(10 14 19 / 0.13)',
        // The standard resting elevation for a card — barely there.
        card: '0 1px 2px 0 rgb(10 14 19 / 0.04), 0 2px 8px -4px rgb(10 14 19 / 0.06)',
        // Focus affordance, matched to the brand forest.
        ring: '0 0 0 3px rgb(var(--ring) / 0.16)',
        // Legacy aliases kept so components written before the redesign
        // (glow / lift / nav) still resolve to sensible elevations.
        glow: '0 0 0 1px rgb(15 71 63 / 0.10), 0 16px 40px -16px rgb(10 14 19 / 0.20)',
        lift: '0 1px 2px 0 rgb(10 14 19 / 0.04), 0 10px 28px -12px rgb(10 14 19 / 0.12)',
        nav: '0 1px 0 0 rgb(10 14 19 / 0.06), 0 8px 24px -14px rgb(10 14 19 / 0.14)',
      },

      // Unprefixed ring-* resolves to the brand forest instead of Tailwind's
      // stock blue, so focus rings are on-brand without every call site opting
      // in. The ring colour flips with the theme (bright mint-teal on dark).
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
          'radial-gradient(ellipse 80% 70% at 8% -20%, rgb(94 234 212 / 0.20), transparent 52%), radial-gradient(ellipse 55% 50% at 100% 0%, rgb(228 181 106 / 0.22), transparent 48%), radial-gradient(ellipse 70% 55% at 70% 110%, rgb(15 46 40 / 0.95), transparent 58%)',
        'home-aurora':
          'radial-gradient(ellipse 80% 70% at 8% -20%, rgb(94 234 212 / 0.22), transparent 52%), radial-gradient(ellipse 55% 50% at 100% 0%, rgb(228 181 106 / 0.28), transparent 48%), radial-gradient(ellipse 70% 55% at 70% 110%, rgb(15 46 40 / 0.95), transparent 58%)',
        'brand-gradient': 'linear-gradient(135deg, #1F7163 0%, #14594F 55%, #0F2E28 100%)',
        hairline: 'linear-gradient(to right, transparent, rgb(10 14 19 / 0.08), transparent)',
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
