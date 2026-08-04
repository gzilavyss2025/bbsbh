// The Logbook stamp's geometry, as pure math (ADR-0035, PR #502).
//
// The art is Concept 1, "The Cancellation" — a national-park-passport
// cancellation stamp with the two club marks as the central emblem pair and the
// run totals stacked beneath. It is **LOCKED**: every constant below is
// transcribed from `.scratch/game-stamps/designs/stamp-concept-1-v2.svg` and the
// parameterized `makeC1` in its companion preview page, not chosen here. Read
// `designs/stamp-concepts.md`'s "Round 2 — Concept 1 locked" section before
// changing one of them; several are the settled end of an iteration that
// rejected the obvious alternative (the ring text is fixed-width mono BECAUSE
// the `textLength` force-fit read as rubbery, the winner gets no underscore
// BECAUSE both totals sharing one size is what keeps the pair matched).
//
// React-free and dependency-free on purpose: GameStamp.jsx is then a thin JSX
// tracing of these numbers with no math of its own, and every number the art
// depends on can be pinned by the unit suite (test/stamp-art.test.js) rather
// than only by looking at it.

// The canvas. viewBox-only in the component — nothing here sets width/height, so
// CSS sizes a stamp in a grid and nothing fights its container.
export const STAMP_SIZE = 300
export const STAMP_CENTER = 150

// The double bounding ring, and the inner circle the club marks clip to.
export const OUTER_RING_R = 140
export const INNER_RING_R = 118
export const CLIP_R = 117

// Ring text sits between the two circles: the venue on an r=122 arc, the date
// (or a postseason series line) on an r=135 one. The larger bottom radius is
// deliberate — sweep 0 keeps those glyphs upright, and the bigger radius makes
// their caps grow INWARD, so both arcs share the same 22px annulus.
export const ARC_TOP_R = 122
export const ARC_BOTTOM_R = 135
export const DIAMOND_R = 129

// Each club mark is letterboxed into a 150x150 slot and clipped to the inner
// circle, so it bleeds off that circle's left/right edge instead of sitting in a
// small fixed box. y 44-194 is ~64% of the inner circle's vertical space.
export const MARK_BOX = { size: 150, y: 44, awayX: -18, homeX: 162 }

// The run totals, and the footer label under them.
export const RUN_BASELINE = 243
export const RUN_X = { away: 108, home: 192 }
export const LABEL_BASELINE = 258

// Ring text metrics, used ONLY to estimate how much of the ring each string
// wants (see `ringLayout`). 16px at ~0.6em advance plus 2.4px tracking is
// ~12px per character in IBM Plex Mono. This is a character-count estimate, not
// a real glyph-advance measurement — the design notes call that out as an
// accepted approximation, and it is only ever used to place two separators.
export const RING_FONT_SIZE = 16
export const RING_TRACKING = 2.4
const RING_CHAR_ADVANCE = RING_FONT_SIZE * 0.6 + RING_TRACKING

// How far the diamonds may swing. Without a clamp a very long venue name would
// push them past the vertical, folding one arc's text back on itself.
const MIN_SHARE = 0.32
const MAX_SHARE = 0.68

// A point on the ring at `angleDeg` clockwise from straight up, `r` from center.
export function polar(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: STAMP_CENTER + r * Math.sin(rad),
    y: STAMP_CENTER - r * Math.cos(rad),
  }
}

const round = (n) => Number(n.toFixed(2))

// One 12px separator diamond, centered on a ring point.
export function diamondPath(point) {
  return `M ${round(point.x)},${round(point.y - 6)} l 6,6 -6,6 -6,-6 z`
}

// Where the two text arcs start and end, and where the separator diamonds sit.
//
// The diamonds are NOT fixed at 9 and 3 o'clock. Each stamp splits the ring in
// proportion to how much of the two strings' combined estimated width belongs to
// the venue vs. the date/series line, then swings both diamonds together
// (mirrored left/right) to that angle. A long venue name gets more of the ring;
// a long series line gets more of the other side. What this buys is that the
// leftover white space inside each arc stays roughly even, instead of a long
// venue crowding a fixed 180 degrees while the date sits with room to spare.
//
// Two empty strings would divide by zero, so they split the ring evenly — a
// stamp for a game whose venue the feed never posted still draws.
export function ringLayout(venueText = '', bottomText = '') {
  const venueLen = String(venueText).length * RING_CHAR_ADVANCE
  const bottomLen = String(bottomText).length * RING_CHAR_ADVANCE
  const total = venueLen + bottomLen
  const rawShare = total > 0 ? venueLen / total : 0.5
  const venueShare = Math.min(MAX_SHARE, Math.max(MIN_SHARE, rawShare))
  const theta = venueShare * 180

  const topStart = polar(-theta, ARC_TOP_R)
  const topEnd = polar(theta, ARC_TOP_R)
  // The venue arc is the one the diamonds bound, so it spans 2*theta.
  const topLarge = 2 * theta > 180 ? 1 : 0

  const bottomStart = polar(-theta, ARC_BOTTOM_R)
  const bottomEnd = polar(theta, ARC_BOTTOM_R)
  // The date arc is the REST of the circle, drawn the other way round (sweep 0),
  // so its large-arc flag tests the complement.
  const bottomLarge = 360 - 2 * theta > 180 ? 1 : 0

  return {
    venueShare,
    theta,
    arcTop: `M ${round(topStart.x)},${round(topStart.y)} A ${ARC_TOP_R},${ARC_TOP_R} 0 ${topLarge} 1 ${round(topEnd.x)},${round(topEnd.y)}`,
    arcBottom: `M ${round(bottomStart.x)},${round(bottomStart.y)} A ${ARC_BOTTOM_R},${ARC_BOTTOM_R} 0 ${bottomLarge} 0 ${round(bottomEnd.x)},${round(bottomEnd.y)}`,
    diamondLeft: diamondPath(polar(-theta, DIAMOND_R)),
    diamondRight: diamondPath(polar(theta, DIAMOND_R)),
  }
}

// Both totals share one size so the pair stays visually matched — the winner is
// carried by which numeral is larger, which is to say it is NOT: the design
// deliberately dropped the winner's underscore and the heavier weight. Either
// club reaching double digits drops BOTH to 48px, which keeps a two-digit
// total's outer edge clear of the inner ring rather than reading as clipping
// into the venue/date band above it.
export function runFontSize(awayRuns, homeRuns) {
  const away = Number(awayRuns)
  const home = Number(homeRuns)
  return away >= 10 || home >= 10 ? 48 : 62
}

// The footer label inside the bottom lens: the game state, in the one slot the
// stamp has for it. Extra innings and a doubleheader's game number both fold in
// here rather than claiming a line of their own.
export function stampLabel({ innings, gameNumber } = {}) {
  const extras = Number.isInteger(innings) && innings > 9 ? ` / ${innings}` : ''
  const gm = Number.isInteger(gameNumber) && gameNumber > 1 ? ` — GM ${gameNumber}` : ''
  return `Final${extras}${gm}`
}

// The label band is ~95px wide at the inner ring at y=258; 90 leaves the wobble
// filter's displacement somewhere to go.
const LABEL_MAX_WIDTH = 90
// Tried in order, first fit wins. The last is the floor — a label longer than
// that simply runs wide rather than shrinking to illegibility.
const LABEL_STEPS = [
  { size: 9, tracking: 2.5 },
  { size: 8, tracking: 1.5 },
  { size: 7, tracking: 1 },
]

// Which type size the footer label gets. Same per-character estimate the ring
// uses, for the same reason: this only picks between three sizes.
export function labelType(label = '') {
  const chars = String(label).length
  for (const step of LABEL_STEPS) {
    if (chars * (step.size * 0.6 + step.tracking) <= LABEL_MAX_WIDTH) return step
  }
  return LABEL_STEPS[LABEL_STEPS.length - 1]
}

const RING_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

// The bottom arc's date, spelled out — "Sunday, August 2, 2026". Built from the
// parts rather than `new Date(isoString)` so it is the calendar day the game was
// played, never that day shifted by the reader's own time zone. Rendered
// mixed-case: the app's global ALL-CAPS invariant (src/index.css) shouts it,
// same as every other live value on every other surface.
export function stampDateText(date) {
  const [year, month, day] = String(date ?? '').split('-').map(Number)
  if (!year || !month || !day) return ''
  return RING_DATE.format(new Date(year, month - 1, day))
}

// Every id inside one stamp's <defs> — masks, the clip path, the wear filter,
// the two text arcs — has to be unique across a whole page, because a Logbook
// grid renders many stamps into one document and SVG ids are global. Suffixed
// per stamp instance (the gamePk by default).
export function stampIds(instanceId) {
  const suffix = String(instanceId ?? 'stamp')
  return {
    ink: `stamp-ink-${suffix}`,
    clip: `stamp-clip-${suffix}`,
    awayMask: `stamp-away-${suffix}`,
    homeMask: `stamp-home-${suffix}`,
    arcTop: `stamp-arctop-${suffix}`,
    arcBottom: `stamp-arcbot-${suffix}`,
  }
}

// The wear filter's turbulence seed. Derived from the gamePk so the same game
// gets the identical chew forever — a stamp that re-roughened on every render
// would not be a keepsake.
export function stampSeed(gamePk) {
  const pk = Number(gamePk)
  return Number.isFinite(pk) ? Math.abs(Math.trunc(pk)) % 1000 : 3
}
