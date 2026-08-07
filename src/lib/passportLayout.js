// Where a stamp lands on a passport page — the Logbook book's geometry
// (ADR-0035, the passport-book redesign).
//
// PURE, React-free, dependency-free, and the single source of truth for the
// book's numbers. Every component under src/components/passport/ is a tracing
// of this module: if a number describes WHERE something sits or HOW MANY fit,
// it belongs here and is pinned by test/passport-layout.test.js, not tuned by
// eye inside a JSX file.
//
// ===========================================================================
// The coordinate system: fractions, never pixels
// ===========================================================================
// A placement is `{ page, x, y, tilt }` where x and y are FRACTIONS of the
// page box (0 = left/top edge, 1 = right/bottom edge) marking the stamp's
// CENTRE, and tilt is degrees. Fractions are what make the same book render
// correctly on a 390px phone page and a 520px desktop spread — and, more to
// the point, what let a placement sync between those two devices and mean the
// same thing (src/lib/stamps.js carries the field; api/stamps.js round-trips
// it). Store a pixel here and the book is wrong on every screen but the one it
// was placed on.
//
// The stamp art itself is a 300x300 user-space square (STAMP_SIZE in
// stampArt.js) rendered at whatever CSS box it is given, so this module only
// ever reasons about its size as a fraction of the page too.

// The grid a page is ruled into: TWO columns by FOUR rows, so a page holds
// EIGHT stamps and every one of them has a box of its own. The book draws that
// grid as a faint guide (PassportPage.jsx) — a page that says where a stamp
// goes is far easier to fill by hand than a blank sheet — and `pageSlots()`
// below is the single place its geometry is stated.
//
// Two by four rather than any other pair of factors, and the reasoning is
// arithmetic rather than taste. A cell is (1 - 2 * PAGE_MARGIN) split over the
// columns across and over the rows down, and the STAMP HAS TO FIT INSIDE ITS
// CELL — otherwise the guide is a lie the moment anything lands on it:
//
//   2 x 4 -> cell 0.475 x 0.238 of the page, stamp 0.3 x 0.211
//            (stampHeightFraction). Fits comfortably, with 0.175 to spare
//            across and 0.026 down — a tighter margin only WIDENS every cell,
//            so shrinking PAGE_MARGIN never puts this fit at risk. Adjacent
//            centres sit 0.475 apart across and 0.337 apart down IN
//            WIDTH-UNITS, both clear of MIN_SEPARATION — so `autoLayout` and
//            `nudgeFromCollisions` still agree about what overlaps.
//   3 x 3 -> cell 0.317 wide: at this margin that is technically wider than
//            the 0.3 stamp, but only by 0.017 — under a tenth of 2x4's own
//            spare, not the comfortable working room `nudgeFromCollisions`
//            needs to walk a stamp clear of a neighbour.
//   2 x 5 -> cell 0.19 tall: still shorter than the 0.211 stamp, so the mark
//            would not fit its box at all, even though the rows are now 0.27
//            apart IN WIDTH-UNITS — just clear of MIN_SEPARATION, where the
//            old 0.06 margin left them at 0.25, inside it (the disagreement
//            the last test in test/passport-layout.test.js exists to catch).
//
// Capacity is therefore DERIVED, never typed: it is the number of boxes the
// page is ruled into, and so it cannot drift from the guide the user is
// looking at. One fewer than the ungridded 3x3 this replaces — a page of an
// older book that already holds nine keeps all nine (a capacity change never
// un-places anything; `pageIsFull` simply answers true for that page until one
// is moved off it).
export const PAGE_COLUMNS = 2
export const PAGE_ROWS = 4
export const PAGE_CAPACITY = PAGE_COLUMNS * PAGE_ROWS

// Bounds the page count so a hostile or hand-edited client can't mint a book
// with 40,000 pages in it. 60 pages of 8 boxes is 480 — and PAGE_CAPACITY is a
// guide rather than a refusal (a full page says so and still takes the stamp),
// so this comfortably covers the 500 stamps a season is capped at
// (MAX_STAMPS_PER_SEASON).
export const MAX_PAGES = 60

// The stamp's width as a fraction of the page's width. The page is roughly
// passport-shaped (see PAGE_ASPECT), so the same stamp is a different fraction
// of the page's HEIGHT — `stampHeightFraction` below is the one to use for
// anything vertical, and forgetting that is the easiest bug to write here.
export const STAMP_WIDTH = 0.3

// Page aspect (width / height). A real passport page is about 88x125mm; this
// is that, rounded, which is what makes the spread read as a book rather than
// two squares.
export const PAGE_ASPECT = 88 / 125

// The margin no stamp may cross, as a fraction of the page. Keeps the art off
// the spine and off the page number in the corner — tight enough that the
// ruled grid reads as close to the page edges as a real passport's does; see
// the arithmetic above for why 0.025 still leaves every cell room to spare.
export const PAGE_MARGIN = 0.025

// How far a stamp may tilt, in degrees. Small on purpose: a real cancellation
// is stamped by a hand that is trying to be straight and failing slightly, not
// by someone being playful.
export const MAX_TILT = 7

// Two stamps closer than this (centre to centre, as a fraction of page width)
// are treated as overlapping and the newcomer is nudged off. Slightly under a
// full stamp width, so stamps may kiss — a passport's do — but not stack.
export const MIN_SEPARATION = 0.26

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n)

// The stamp's height as a fraction of the PAGE's height. The stamp is square,
// so its height in page-fractions is its width scaled by the page's aspect.
export function stampHeightFraction() {
  return STAMP_WIDTH * PAGE_ASPECT
}

// A stable, deterministic tilt for a game. Deterministic matters twice: the
// stamp must not jitter on every render, and it must sit at the same angle on
// every one of the user's devices — which it does because the angle is a
// function of the gamePk, not of a clock or a random draw. (It is still stored
// on the placement, so a future change to this function can't rotate a book
// somebody already arranged.)
export function tiltFor(gamePk) {
  const pk = Number(gamePk)
  // `> 0`, not `Number.isFinite` — `Number(null)` and `Number(0)` are finite
  // zeros, and zero hashes to the extreme end of the range, so a missing gamePk
  // would come back as a hard -7° tilt rather than the neutral 0 the caller
  // expects. Zero is not a valid gamePk anywhere in this codebase (`toGamePk`
  // rejects it), so treating it as absent is the honest reading.
  if (!Number.isFinite(pk) || pk <= 0) return 0
  // A cheap integer hash — the low digits of a gamePk run in sequence for
  // games on the same day, and using them raw would tilt a whole homestand the
  // same way.
  const hash = (Math.abs(Math.trunc(pk)) * 2654435761) % 2147483647
  const unit = (hash % 2001) / 1000 - 1 // -1 .. 1
  return Math.round(unit * MAX_TILT * 100) / 100
}

// Keep a stamp's centre far enough from every edge that the whole mark stays
// on the page.
export function clampToPage(x, y) {
  const halfW = STAMP_WIDTH / 2 + PAGE_MARGIN
  const halfH = stampHeightFraction() / 2 + PAGE_MARGIN
  return {
    x: clamp(Number.isFinite(x) ? x : 0.5, halfW, 1 - halfW),
    y: clamp(Number.isFinite(y) ? y : 0.5, halfH, 1 - halfH),
  }
}

// The eight boxes a page is ruled into, in reading order (across, then down).
// One entry per slot:
//
//   { index, column, row, left, top, width, height, x, y }
//
// `left`/`top`/`width`/`height` are the CELL as fractions of the page box —
// what PassportPage.jsx draws the faint guide from, so the rules on screen and
// the arithmetic behind PAGE_CAPACITY are one thing rather than two. `x`/`y`
// are that cell's centre, in the same fractions a placement uses, so
// `autoLayout` can drop a stamp in the middle of a box without converting
// anything.
//
// The grid is inset by PAGE_MARGIN, which is not decoration: a cell centre
// outside `clampToPage`'s bounds would be a box no stamp could ever sit in the
// middle of, and the guide would be pointing at a spot the module refuses.
// Recomputed on each call rather than frozen at module scope — it is a handful
// of multiplications, and a shared mutable array handed to a React render is a
// bug waiting for its first mutation.
export function pageSlots() {
  const span = 1 - PAGE_MARGIN * 2
  const width = span / PAGE_COLUMNS
  const height = span / PAGE_ROWS
  const slots = []
  for (let row = 0; row < PAGE_ROWS; row += 1) {
    for (let column = 0; column < PAGE_COLUMNS; column += 1) {
      const left = PAGE_MARGIN + column * width
      const top = PAGE_MARGIN + row * height
      slots.push({
        index: row * PAGE_COLUMNS + column,
        column,
        row,
        left,
        top,
        width,
        height,
        x: left + width / 2,
        y: top + height / 2,
      })
    }
  }
  return slots
}

// Keep a stamp's centre inside ONE box of that grid — the same job clampToPage
// does for the page, one scale down, and the reason a wobbled auto-layout can
// never push a stamp across the rule the user is looking at. A cell is only a
// little taller than the stamp is (0.238 against 0.211), so this leaves real
// room across and not much down; that asymmetry is the grid working as
// intended, not a bug to tune away.
//
// Falls back to the plain page clamp for a slot it can't read, so a caller that
// loses one still lands a stamp on the paper.
export function clampToSlot(x, y, slot) {
  if (!slot) return clampToPage(x, y)
  const halfW = STAMP_WIDTH / 2
  const halfH = stampHeightFraction() / 2
  // A cell that somehow can't hold the mark centres it rather than inverting
  // the bounds (`clamp` with lo > hi would answer `hi` and read as a sudden
  // jump to the wrong edge).
  const lowX = slot.left + halfW
  const highX = slot.left + slot.width - halfW
  const lowY = slot.top + halfH
  const highY = slot.top + slot.height - halfH
  const spot = {
    x: lowX > highX ? slot.x : clamp(Number.isFinite(x) ? x : slot.x, lowX, highX),
    y: lowY > highY ? slot.y : clamp(Number.isFinite(y) ? y : slot.y, lowY, highY),
  }
  // The grid is inset by PAGE_MARGIN, so this is already on the page — belt
  // and braces against a future change to either inset.
  return clampToPage(spot.x, spot.y)
}

// Distance between two centres, measured in PAGE-WIDTH fractions so one number
// compares against MIN_SEPARATION.
//
// The vertical leg is DIVIDED by the aspect, and the direction of that is the
// easiest thing in this file to get backwards (it was, once — the test
// "a stamp a clear stamp-height below is not a collision" is what caught it).
// The page is taller than it is wide, so a y-fraction covers MORE real distance
// than the same x-fraction: 0.1 of the height is `0.1 * height`, which in
// width-units is `0.1 * height / width` = `0.1 / PAGE_ASPECT`. Multiplying
// instead understates every vertical gap, and stamps stacked down the page get
// shoved apart when they were never touching.
//
// (Contrast `stampHeightFraction`, which genuinely multiplies: there the
// conversion runs the other way, from a width-fraction to a height-fraction.)
function separation(a, b) {
  const dx = a.x - b.x
  const dy = (a.y - b.y) / PAGE_ASPECT
  return Math.sqrt(dx * dx + dy * dy)
}

// Push a landing spot off anything it would badly cover. Walks outward from
// the tap in a spiral rather than jumping to "the nearest free slot", so the
// stamp still lands as close as it can to where the user actually pointed —
// the tap is the instruction, this only resolves a collision.
//
// Returns the tapped point unchanged when nothing is in the way, and gives up
// (returning the best it found) rather than looping forever on a full page.
export function nudgeFromCollisions(point, taken) {
  const others = (taken ?? []).filter(Boolean)
  const fits = (p) => others.every((o) => separation(p, o) >= MIN_SEPARATION)

  const start = clampToPage(point.x, point.y)
  if (fits(start)) return start

  let best = start
  let bestScore = -Infinity
  // 24 rings x 12 headings out to a full page away. Fine enough that the
  // result reads as "just beside where I tapped".
  for (let ring = 1; ring <= 24; ring += 1) {
    const radius = (MIN_SEPARATION / 4) * ring
    for (let step = 0; step < 12; step += 1) {
      const angle = (step / 12) * Math.PI * 2 + ring * 0.4
      // `radius` is in width-units (the same units MIN_SEPARATION is in), so
      // the vertical leg converts back the other way from `separation`'s:
      // width-units -> y-fraction MULTIPLIES by the aspect. Getting this
      // backwards doesn't break the search — it still terminates on a valid
      // spot — it just stretches the spiral into an ellipse, so a nudged stamp
      // drifts further down the page than it needed to.
      const candidate = clampToPage(
        start.x + Math.cos(angle) * radius,
        start.y + Math.sin(angle) * radius * PAGE_ASPECT,
      )
      if (fits(candidate)) return candidate
      // Track the roomiest spot seen, so a genuinely full page still returns
      // the least-bad answer instead of dropping the stamp on top of another.
      const score = others.reduce((min, o) => Math.min(min, separation(candidate, o)), Infinity)
      if (score > bestScore) {
        bestScore = score
        best = candidate
      }
    }
  }
  return best
}

// The whole answer to "the user tapped here — where does the stamp go?".
// `taken` is the placements already on that page.
export function placementFor(gamePk, page, tap, taken) {
  const spot = nudgeFromCollisions({ x: tap?.x, y: tap?.y }, taken)
  // Clamped here as well as in normalizePlacement. The bound existing in only
  // one of the two would mean this function could hand back a placement the
  // store then silently refuses, and the stamp would vanish on confirm.
  const onBook = clamp(Math.trunc(page) || 1, 1, MAX_PAGES)
  return { page: onBook, x: spot.x, y: spot.y, tilt: tiltFor(gamePk) }
}

// Every LIVE stamp already placed on a page, in a stable order. The state
// filter is not decoration: `removeStamp` keeps the placement on the 'off'
// tombstone it writes, so a raw collection passed in here would let an
// un-stamped game go on occupying a slot and counting toward `pageIsFull`.
// No caller does that today; this makes it impossible rather than lucky.
export function stampsOnPage(stamps, page) {
  return (stamps ?? [])
    .filter((s) => s?.state !== 'off' && s?.placement?.page === page)
    .sort((a, b) => a.placement.y - b.placement.y || a.placement.x - b.placement.x)
}

// The placements a landing spot has to clear on a page. `exceptGamePk` names
// the stamp being MOVED, and leaving that one out is the whole difference
// between re-placing a stamp and placing it the first time: a move collides
// with everything on the page EXCEPT its own current spot, or
// `nudgeFromCollisions` would shove every small correction a stamp-width off
// the tap — which is precisely the nudge the user was trying to undo.
export function otherPlacementsOn(stamps, page, exceptGamePk = null) {
  const except = Number(exceptGamePk)
  const skipSelf = Number.isFinite(except) && except > 0
  return stampsOnPage(stamps, page)
    .filter((s) => !(skipSelf && Number(s.gamePk) === except))
    .map((s) => s.placement)
}

// Whether a page has no room left, from the point of view of the stamp about
// to land on it. `exceptGamePk` again names the stamp being moved: a full page
// is NOT full for a keepsake already sitting on it, so nudging one of eight
// stamps an inch to the left must never be refused with "this page holds 8".
export function pageIsFullFor(stamps, page, exceptGamePk = null) {
  return otherPlacementsOn(stamps, page, exceptGamePk).length >= PAGE_CAPACITY
}

export function pageIsFull(stamps, page) {
  return pageIsFullFor(stamps, page, null)
}

// The first page with room, or null when every page up to `pageCount` is full.
// `exceptGamePk` is passed through for the same reason as above — a stamp
// looking for somewhere to go must not be told its own page is out of room.
export function firstOpenPage(stamps, pageCount, exceptGamePk = null) {
  for (let page = 1; page <= Math.min(pageCount, MAX_PAGES); page += 1) {
    if (!pageIsFullFor(stamps, page, exceptGamePk)) return page
  }
  return null
}

// How many pages the book must show: enough for every placement it holds, at
// least one, and at least whatever the user has explicitly added.
export function pageCountFor(stamps, added = 1) {
  let highest = 1
  for (const stamp of stamps ?? []) {
    const page = stamp?.placement?.page
    if (Number.isInteger(page) && page > highest) highest = page
  }
  return clamp(Math.max(highest, Math.trunc(added) || 1), 1, MAX_PAGES)
}

// A tidy fill for stamps the user hasn't placed by hand — the "place them all
// for me" path, and what an upgrading collection needs so nobody is made to
// re-place forty keepsakes one at a time.
//
// One stamp per box, in the boxes `pageSlots()` rules the page into, so the
// button lays out exactly what the guide promises. It is still not a PRINTED
// grid: each stamp keeps its own deterministic tilt and takes a seeded offset
// off its box's centre — clamped inside that box by `clampToSlot`, which is
// what stops the wobble from crossing a rule. There is room to wander across a
// cell and almost none down it, so an auto-filled page reads as eight stamps
// pressed by a careful hand rather than as a table. Order is the caller's, so
// "oldest game first" fills page 1 first.
export function autoLayout(stamps, { startPage = 1 } = {}) {
  const out = []
  const slots = pageSlots()

  ;(stamps ?? []).forEach((stamp, i) => {
    const page = clamp(startPage + Math.floor(i / PAGE_CAPACITY), 1, MAX_PAGES)
    const slot = slots[i % PAGE_CAPACITY]

    // -1..1, already stable per game (see tiltFor) — no clock, no random draw,
    // so two devices lay out the same collection identically.
    const seed = tiltFor(stamp?.gamePk) / MAX_TILT
    const spot = clampToSlot(slot.x + seed * 0.045, slot.y - seed * 0.03, slot)
    out.push({
      gamePk: stamp?.gamePk,
      placement: { page, x: spot.x, y: spot.y, tilt: tiltFor(stamp?.gamePk) },
    })
  })
  return out
}
