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

// How many stamps a page holds. Ten is the brief ("about 8 to 10"), and it is
// also about what fits at STAMP_WIDTH without the page reading as a sheet of
// stickers — two columns of five, loosely, with room for the hand to wander.
export const PAGE_CAPACITY = 10

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
  if (!Number.isFinite(pk)) return 0
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
// compares against MIN_SEPARATION. The vertical leg is scaled by the aspect
// because a y-fraction covers less real distance than an x-fraction does.
function separation(a, b) {
  const dx = a.x - b.x
  const dy = (a.y - b.y) * PAGE_ASPECT
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
      const candidate = clampToPage(
        start.x + Math.cos(angle) * radius,
        start.y + (Math.sin(angle) * radius) / PAGE_ASPECT,
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
  return { page, x: spot.x, y: spot.y, tilt: tiltFor(gamePk) }
}

// Every live stamp already placed on a page, in a stable order.
export function stampsOnPage(stamps, page) {
  return (stamps ?? [])
    .filter((s) => s?.placement?.page === page)
    .sort((a, b) => a.placement.y - b.placement.y || a.placement.x - b.placement.x)
}

export function pageIsFull(stamps, page) {
  return stampsOnPage(stamps, page).length >= PAGE_CAPACITY
}

// The first page with room, or null when every page up to `pageCount` is full.
export function firstOpenPage(stamps, pageCount) {
  for (let page = 1; page <= Math.min(pageCount, MAX_PAGES); page += 1) {
    if (!pageIsFull(stamps, page)) return page
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
  const columns = 2
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
