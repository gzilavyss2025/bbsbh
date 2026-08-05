import { TallyWordmark } from '../chrome/TallyBrand.jsx'

// The ghost printing under a passport page's cancellations (ADR-0035, the
// passport-book redesign). A real passport page carries a pale security print
// beneath the stamps; this is the app's version of it — the Tally wordmark,
// printed so faintly it reads as paper texture rather than as a mark.
//
// Three properties this component must never lose:
//
//   1. DECORATIVE ONLY. `aria-hidden` on the wrapper, and the wordmark is
//      handed `title=""` + `aria-hidden` the same way TallyLockup mutes its
//      own mark — the page around it already names itself. Nothing here is
//      content.
//   2. IT MUST NOT EAT A TAP. The page is a tap-to-place surface: the user
//      points at the paper and a stamp lands there. This element covers the
//      whole page, so `pointer-events: none` (set in CSS, on the wrapper AND
//      inherited by the SVG) is load-bearing, not tidiness. A watermark that
//      swallowed a tap would make part of every page unstampable, and the bug
//      would look like "stamps won't land in the middle of the page".
//   3. IT SITS UNDER NAVY STAMP ART. The ink is graphite at a few percent —
//      low enough that the stamps' own rings and type win outright. It is
//      deliberately far BELOW any contrast threshold, because it is not
//      information; raising it until it "reads" is the wrong fix.
//
// `page` is the page number. Even and odd pages print the ghost at slightly
// different positions, sizes and angles, so a spread doesn't look like the
// same sheet photocopied twice — the same reason src/lib/passportLayout.js's
// autoLayout wobbles its slots. The variation is a pure function of the page
// number (no clock, no Math.random): a page must print identically on every
// render and on every one of the user's devices, exactly like a stamp's tilt.
export function PassportWatermark({ page }) {
  const n = Math.trunc(Number(page))
  const even = Number.isFinite(n) && Math.abs(n) % 2 === 0

  return (
    <span
      className={`passwatermark ${even ? 'passwatermark--even' : 'passwatermark--odd'}`}
      aria-hidden="true"
    >
      <TallyWordmark
        // The wordmark's paths are all `fill="currentColor"`, so the CSS below
        // sets the ink once on the wrapper and the whole mark follows — no
        // per-path colour, and no filter (ADR-0031).
        height={40}
        title=""
        aria-hidden="true"
        className="passwatermark__mark"
        tight
      />
    </span>
  )
}
