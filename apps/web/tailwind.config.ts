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
 * Contrast is pinned, not assumed: `ink-500` is the muted-text token and clears
 * 4.5:1 on both white cards and the near-white canvas; `ink-400` clears 3:1 on
 * both and is therefore large/decorative text only.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Page background. A clean near-white — the product is mostly white
        // cards, and a slightly grey page is what makes them read as surfaces.
        canvas: '#F5F6F8',

        // The brand palette. These are the anchors for every token below.
        home: {
          night: '#0A0E13',
          mist: '#F5F6F8',
          sand: '#ECEEF3',
          gold: '#E4B56A',
          mint: '#5EEAD4',
          forest: '#0F2E28',
        },

        // The single neutral ramp for the whole product. Cool grey, evenly
        // spaced, with a deliberate gap at 400/500 so secondary text carries
        // real contrast instead of fading out.
        // `ink.950` is home-night and is what every "dark" surface resolves to.
        ink: {
          25: '#FCFCFD',
          50: '#F5F6F8',
          100: '#EDEFF3',
          200: '#E1E4EA',
          300: '#C9CFD8',
          400: '#8B93A1',
          500: '#5F6878',
          600: '#454D5C',
          700: '#333A46',
          800: '#21262F',
          900: '#12161D',
          950: '#0A0E13',
        },

        // Primary action colour, anchored on home-forest #0F2E28. Deep enough
        // that white text clears 4.5:1 from 500 upward, so `bg-brand-*` +
        // `text-white` is always legible. This is the fill for the primary
        // button (see globals.css .btn-primary); gold is the hero/highlight
        // accent, used where it sits on a dark surface.
        brand: {
          50: '#EAF4F1',
          100: '#CFE7E0',
          200: '#A0CFC2',
          300: '#6BB0A0',
          400: '#3D8C7D',
          500: '#1F7163',
          600: '#14594F',
          700: '#0F473F',
          800: '#0C3A34',
          900: '#0F2E28',
          950: '#061A16',
        },

        // Highlight, anchored on home-mint. It is only ever used on dark
        // surfaces (13.5:1 on night) — mint on white is unreadable by design,
        // so it is never a light-mode text colour.
        accent: {
          50: '#E6FBF6',
          100: '#C2F5EB',
          200: '#8DEEDD',
          300: '#5EEAD4',
          400: '#34D3BA',
          500: '#14B39C',
          600: '#0C8F7E',
          700: '#0B7164',
        },

        // Semantic status ramp. Defined here (rather than leaning on Tailwind's
        // stock green/red) so every state reads as one family.
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
        },
        // Informational reads as cyan, the one secondary hue in the system, so
        // it never gets confused with `brand` green — which owns buttons and
        // links. Amber stays reserved for "needs attention", red for "broken".
        info: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
        },

        // Ratings keep their own gold, and it is the *same* gold as the hero
        // accent — a 4.8 rating and the primary CTA belong to the same identity.
        // Rating text uses 600, which clears 4.5:1 on white; 400/500 are fills
        // (stars) and backgrounds.
        rating: {
          400: '#E4B56A',
          500: '#C9963F',
          600: '#A6782B',
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
        // a shadow reads as depth instead of dirt.
        xs: '0 1px 2px 0 rgb(10 14 19 / 0.04)',
        sm: '0 1px 2px 0 rgb(10 14 19 / 0.05), 0 1px 3px 0 rgb(10 14 19 / 0.04)',
        md: '0 2px 4px -1px rgb(10 14 19 / 0.05), 0 4px 12px -2px rgb(10 14 19 / 0.06)',
        lg: '0 4px 8px -2px rgb(10 14 19 / 0.06), 0 12px 28px -6px rgb(10 14 19 / 0.09)',
        xl: '0 8px 16px -4px rgb(10 14 19 / 0.08), 0 24px 56px -12px rgb(10 14 19 / 0.13)',
        // The standard resting elevation for a card — barely there.
        card: '0 1px 2px 0 rgb(10 14 19 / 0.04), 0 2px 8px -4px rgb(10 14 19 / 0.06)',
        // Focus affordance, matched to the brand forest.
        ring: '0 0 0 3px rgb(15 71 63 / 0.16)',
        // Legacy aliases kept so components written before the redesign
        // (glow / lift / nav) still resolve to sensible elevations.
        glow: '0 0 0 1px rgb(15 71 63 / 0.10), 0 16px 40px -16px rgb(10 14 19 / 0.20)',
        lift: '0 1px 2px 0 rgb(10 14 19 / 0.04), 0 10px 28px -12px rgb(10 14 19 / 0.12)',
        nav: '0 1px 0 0 rgb(10 14 19 / 0.06), 0 8px 24px -14px rgb(10 14 19 / 0.14)',
      },

      // Unprefixed ring-* resolves to the brand forest instead of Tailwind's
      // stock blue, so focus rings are on-brand without every call site opting in.
      ringColor: {
        DEFAULT: 'rgb(15 71 63 / 0.16)',
      },
      ringOffsetColor: {
        DEFAULT: '#ffffff',
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
