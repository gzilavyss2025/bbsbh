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

// How many stamps a page holds. NINE, laid out three across and three down,
// and the number is arithmetic rather than taste: at STAMP_WIDTH a page has
// about 0.67 of its height free for stamp CENTRES once the margins are taken,
// so five rows would sit 0.24 page-widths apart — inside MIN_SEPARATION, i.e.
// overlapping by this module's own definition. Ten in two columns therefore
// produced auto-layouts that `nudgeFromCollisions` would have refused, which
// is the kind of disagreement between two functions in one file that only a
// test catches. Three by three clears it with room: 0.29 across, 0.47 down.
// Still inside the brief's "about 8 to 10".
export const PAGE_CAPACITY = 9

// Bounds the page count so a hostile or hand-edited client can't mint a book
// with 40,000 pages in it. 60 pages x 10 is 600, comfortably past the 500
// stamps a season is capped at (MAX_STAMPS_PER_SEASON).
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
// the spine and off the page number in the corner.
export const PAGE_MARGIN = 0.06

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
// is NOT full for a keepsake already sitting on it, so nudging one of nine
// stamps an inch to the left must never be refused with "this page holds 9".
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

// A tidy scatter for stamps the user hasn't placed by hand — the "place them
// all for me" path, and what an upgrading collection needs so nobody is made
// to re-place forty keepsakes one at a time.
//
// Deliberately NOT a grid: it lays out on a two-column rhythm and then lets
// each stamp's own deterministic tilt and a seeded offset break the alignment,
// so an auto-filled page still reads as stamped rather than as printed. Order
// is the caller's order, so "oldest game first" fills page 1 first.
export function autoLayout(stamps, { startPage = 1 } = {}) {
  const out = []
  const perPage = PAGE_CAPACITY
  // Three across, matching the geometry PAGE_CAPACITY is derived from — a
  // two-column rhythm at this capacity overlaps (see that constant's note).
  const columns = 3
  const rows = Math.ceil(perPage / columns)

  ;(stamps ?? []).forEach((stamp, i) => {
    const page = clamp(startPage + Math.floor(i / perPage), 1, MAX_PAGES)
    const slot = i % perPage
    const column = slot % columns
    const row = Math.floor(slot / columns)

    // The nominal centre of this slot, then a seeded wobble of up to a third
    // of the gap so two auto-filled pages don't look identical.
    const seed = tiltFor(stamp?.gamePk) / MAX_TILT // -1 .. 1, already stable
    const nominalX = (column + 0.5) / columns
    const nominalY = (row + 0.5) / rows
    const spot = clampToPage(
      nominalX + seed * 0.045,
      nominalY - seed * 0.03,
    )
    out.push({
      gamePk: stamp?.gamePk,
      placement: { page, x: spot.x, y: spot.y, tilt: tiltFor(stamp?.gamePk) },
    })
  })
  return out
}
