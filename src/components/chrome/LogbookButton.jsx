import { useNav } from '../../lib/nav.js'

// A persistent entry point, sibling to SiteSearchButton and SiteMenuButton,
// linking straight to the Game Log (ADR-0035/0036) — otherwise reachable only
// by opening the "More" sheet or scrolling to the slate footer's page list.
// The Game Log just absorbed a dozen-plus PRs of investment as a recurring,
// personal collection feature, so it earns a direct entry point rather than
// staying buried a level deeper than search and menu. Lives in the slate's
// own topbar only for now (see GameSelect.jsx) — SiteHeader can pick it up
// too if the same gap turns out to matter on other screens.
//
// Alone among the topbar's controls it carries a WORD as well as a mark. Search
// and menu are glyphs the whole web already taught everyone to read; a bound
// book is not — nothing outside this app says that rectangle means "the games
// you've kept". Labelling it is also what makes it findable: the destination is
// the one page here that is yours rather than the league's, and an unlabelled
// icon is only ever found by the people who already know it's there.
//
// The label is title-case in the DOM and uppercased in CSS, so screen readers
// and find-in-page get "Game Log" while the row reads in the same small caps as
// the level pills beside it. Visible text also means no aria-label: with one,
// the accessible name would silently shadow the word actually on screen.
//
// NOTE: the code layer still says "logbook" throughout — route (`/logbook`),
// class names, modules, storage keys. "Game Log" is the user-facing name only;
// renaming the route would break every stamped game's shared deep link and its
// cached Open Graph card.
export function LogbookButton({ className = '' }) {
  const navigate = useNav()
  return (
    <button
      type="button"
      className={`logbook-btn logbook-btn--labeled ${className}`}
      onClick={() => navigate('/logbook')}
    >
      <LogbookGlyph />
      <span className="logbook-btn__label">Game Log</span>
    </button>
  )
}

// The Game Log's own object, in miniature: the closed passport book — board,
// spine, and one emblem foil-stamped on the cover (PassportCover.jsx, ADR-0035
// /0036's passport-book redesign). Deliberately the BOOK and not a stamp: this
// is a generic nav glyph, so it must not reproduce the gated cancellation art,
// and "your collection" is the thing the destination actually is.
//
// Three reasons it is drawn this way rather than as a ring:
//
//   1. SILHOUETTE, not detail. This glyph's immediate neighbour is
//      SiteSearchButton's magnifier — a bare circle of almost exactly this
//      size. Any ring-shaped Game Log mark lands as a second circle two pixels
//      away and the pair has to be read rather than recognised. A portrait
//      rectangle separates at a glance from both the magnifier and the
//      hamburger, which is the only comparison that matters in an icon row.
//   2. Three elements, because that is the row's budget. The magnifier is two
//      strokes, the hamburger three; 18px does not hold more. The spine rule
//      is the element that buys the most — a plain rounded rectangle reads as
//      a card or a note, and one vertical line at the left turns it into a
//      bound book. It is what the glyph cannot afford to lose.
//   3. The emblem is the app's diamond — the game stamp's separator diamond
//      (diamondPath, src/lib/stampArt.js) and a baseball diamond at once.
//      Solid, because at 18px an outlined emblem this small greys out; the
//      filled mass is what survives, and it is the only fill in the row.
//
// Geometry is centred on the COVER PANEL, not on the viewBox: the spine sits
// at x=5.7 and the board's inner edge at x=14.5, so the emblem centres on 10.1
// — a diamond centred on 9 like the frame is visibly crowded against the fore
// edge. Strokes are 1.8/1.5 rather than the siblings' 2.0 because this glyph
// carries more line; matching their weight literally reads heavier than they do.
function LogbookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect
        x="2.6"
        y="1.8"
        width="12.8"
        height="14.4"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <line x1="5.7" y1="2.7" x2="5.7" y2="15.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.1 5.6 L13.5 9 L10.1 12.4 L6.7 9 Z" fill="currentColor" />
    </svg>
  )
}
