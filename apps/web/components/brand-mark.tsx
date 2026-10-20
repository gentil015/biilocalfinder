import Link from 'next/link';

/**
 * The wordmark. Two states:
 *  - `inverted` sits on a dark surface (hero, dark app shell)
 *  - default sits on a light surface
 *
 * The glyph is a map-pin cut out of a rounded square, which reads as both
 * "location" and "app icon" at 28px. The pin's head is the counter of a
 * single custom path rather than a circle + triangle so it stays crisp at
 * small sizes.
 */
export function BrandMark({
  inverted = false,
  compact = false,
}: {
  inverted?: boolean;
  compact?: boolean;
}) {
  return (
    <Link href="/" className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl" aria-label="Bii Localfinder home">
      <span
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] shadow-xs transition group-hover:shadow-sm
          /* inverted sits on always-dark bands, so its glyph stays night-in-white;
             the default tile follows the brand ramp and inverts with the theme. */
          ${inverted ? 'bg-white text-home-night' : 'bg-brand-700 text-white dark:text-home-night'}`}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
          <path
            d="M12 21s7-5.372 7-11a7 7 0 1 0-14 0c0 5.628 7 11 7 11Z"
            fill="currentColor"
          />
          {/* The pin's head is the *tile's* background colour, not the glyph's —
              using currentColor here would fill the hole and flatten the pin into
              a solid blob. --mark-hole (globals.css) tracks bg-brand-700 in each
              theme; the inverted tile is always white, so its hole is always deep
              forest. */}
          <circle cx="12" cy="10" r="2.6" fill={inverted ? '#0B1712' : 'var(--mark-hole)'} />
        </svg>
      </span>
      {!compact && (
        <span className="flex items-baseline gap-1 leading-none">
          <span className={`font-display text-[17px] font-extrabold tracking-tight ${inverted ? 'text-white' : 'text-ink-950'}`}>
            Bii
          </span>
          <span
            className={`text-[13px] font-semibold tracking-tight ${inverted ? 'text-white/50' : 'text-ink-400'}`}
          >
            Localfinder
          </span>
        </span>
      )}
    </Link>
  );
}
