// The passport book's geometry (src/lib/passportLayout.js, ADR-0035).
//
// This module is the single source of truth for WHERE a stamp sits and HOW
// MANY fit, so the cases below are the ones a JSX file must never be allowed
// to re-decide by eye: the tilt is a pure function of the gamePk (so a book
// reads the same on every device and never jitters between renders), the whole
// mark stays on the page in BOTH axes (the page is taller than it is wide, so
// the vertical bound is not the horizontal one), and a collision nudge always
// terminates and always lands on the page.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_PAGES,
  MAX_TILT,
  MIN_SEPARATION,
  PAGE_ASPECT,
  PAGE_CAPACITY,
  PAGE_MARGIN,
  STAMP_WIDTH,
  autoLayout,
  clampToPage,
  firstOpenPage,
  nudgeFromCollisions,
  otherPlacementsOn,
  pageCountFor,
  pageIsFull,
  pageIsFullFor,
  placementFor,
  stampHeightFraction,
  stampsOnPage,
  tiltFor,
} from '../src/lib/passportLayout.js'
import { MAX_PLACEMENT_PAGE, MAX_PLACEMENT_TILT } from '../src/lib/stamps.js'

// The bounds a centre must respect for the whole mark to stay on the page.
const HALF_W = STAMP_WIDTH / 2 + PAGE_MARGIN
const HALF_H = stampHeightFraction() / 2 + PAGE_MARGIN

const onPage = (p) =>
  p.x >= HALF_W - 1e-9 && p.x <= 1 - HALF_W + 1e-9 && p.y >= HALF_H - 1e-9 && p.y <= 1 - HALF_H + 1e-9

// Centre-to-centre distance in PAGE-WIDTH fractions, which is the unit
// MIN_SEPARATION is documented in. A y-fraction spans MORE real distance than
// an x-fraction does (the page is taller than it is wide), so converting a
// vertical leg to page-widths DIVIDES by the aspect.
const separationOf = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) / PAGE_ASPECT)

const placed = (page, x = 0.5, y = 0.5) => ({ placement: { page, x, y, tilt: 0 } })

// ---------------------------------------------------------------------------
// The constants, and the restatement in stamps.js that must not drift from them
// ---------------------------------------------------------------------------

test('the bounds restated in stamps.js still match the real geometry', () => {
  // stamps.js deliberately restates these rather than importing this module
  // (it is bundled into the serverless function). That is only safe if the two
  // copies are pinned against each other, exactly like finalHalfIndex is
  // pinned against select.js's halfIndex.
  assert.equal(MAX_PLACEMENT_PAGE, MAX_PAGES)
  assert.equal(MAX_PLACEMENT_TILT, MAX_TILT)
})

test('the stamp is a smaller fraction of the page vertically than horizontally', () => {
  // The stamp art is square and the page is not, so the same mark covers less
  // of the page's height than of its width. Everything vertical in this module
  // has to go through stampHeightFraction().
  assert.equal(stampHeightFraction(), STAMP_WIDTH * PAGE_ASPECT)
  assert.ok(stampHeightFraction() < STAMP_WIDTH)
})

// ---------------------------------------------------------------------------
// tiltFor — stable, small, and not a ramp
// ---------------------------------------------------------------------------

test('tiltFor is deterministic for a gamePk', () => {
  // The stamp must not rotate on re-render, and must sit at the same angle on
  // the phone and the laptop — which it does only because the angle is a pure
  // function of the gamePk.
  const first = tiltFor(776543)
  for (let i = 0; i < 5; i++) assert.equal(tiltFor(776543), first)
  // The string a URL or a Redis hash field hands back is the same game.
  assert.equal(tiltFor('776543'), first)
})

test('tiltFor never exceeds MAX_TILT', () => {
  // A real cancellation is stamped by a hand trying to be straight and failing
  // slightly. Nothing here may ever read as playful.
  for (let pk = 745000; pk < 745400; pk++) {
    const tilt = tiltFor(pk)
    assert.ok(Math.abs(tilt) <= MAX_TILT, `tiltFor(${pk}) = ${tilt}`)
  }
})

test('tiltFor answers 0 for something that is not a number at all', () => {
  assert.equal(tiltFor(undefined), 0)
  assert.equal(tiltFor(NaN), 0)
  assert.equal(tiltFor('not a game'), 0)
  assert.equal(tiltFor({}), 0)
  assert.equal(tiltFor(Infinity), 0)
})

test('consecutive gamePks do NOT get near-identical angles', () => {
  // The whole reason tiltFor hashes instead of using the pk's low digits:
  // games on the same day carry sequential gamePks, so a raw reading would
  // tilt an entire homestand the same way and the page would read as printed.
  for (const base of [776000, 745301, 812345]) {
    const run = Array.from({ length: 40 }, (_, i) => tiltFor(base + i))
    const gaps = run.slice(1).map((tilt, i) => Math.abs(tilt - run[i]))
    assert.ok(Math.min(...gaps) >= 1, `${base}: adjacent games only ${Math.min(...gaps)}° apart`)
    // And the run has to actually use the range, in both directions.
    assert.ok(Math.max(...run) > MAX_TILT * 0.6, `${base}: never tilts far right`)
    assert.ok(Math.min(...run) < -MAX_TILT * 0.6, `${base}: never tilts far left`)
    assert.equal(new Set(run).size, run.length, `${base}: repeated an angle inside one homestand`)
  }
})

// ---------------------------------------------------------------------------
// clampToPage — the whole mark on the page, in both axes
// ---------------------------------------------------------------------------

test('clampToPage pulls a corner tap far enough in for the whole stamp to clear', () => {
  const topLeft = clampToPage(0, 0)
  assert.equal(topLeft.x, HALF_W)
  assert.equal(topLeft.y, HALF_H)

  const bottomRight = clampToPage(1, 1)
  assert.equal(bottomRight.x, 1 - HALF_W)
  assert.equal(bottomRight.y, 1 - HALF_H)
})

test('the vertical clamp uses the stamp HEIGHT, not its width', () => {
  // The easiest bug in this module is reusing STAMP_WIDTH for the y bound,
  // which would push every stamp needlessly toward the middle of a page that
  // has plenty of room top and bottom. The two bounds are not the same number.
  assert.ok(HALF_H < HALF_W)
  // A y just inside the height bound but outside the width bound is the case
  // that tells the two apart: it must be left alone.
  const y = (HALF_H + HALF_W) / 2
  assert.equal(clampToPage(0.5, y).y, y)
  assert.equal(clampToPage(0.5, 1 - y).y, 1 - y)
})

test('clampToPage leaves a point that is already clear alone, and centres nonsense', () => {
  assert.deepEqual(clampToPage(0.42, 0.61), { x: 0.42, y: 0.61 })
  assert.deepEqual(clampToPage(undefined, undefined), { x: 0.5, y: 0.5 })
  assert.deepEqual(clampToPage(NaN, 'x'), { x: 0.5, y: 0.5 })
})

// ---------------------------------------------------------------------------
// nudgeFromCollisions — the tap is the instruction, this only resolves overlap
// ---------------------------------------------------------------------------

test('an unobstructed tap comes back exactly where the user put it', () => {
  assert.deepEqual(nudgeFromCollisions({ x: 0.42, y: 0.61 }, []), { x: 0.42, y: 0.61 })
  assert.deepEqual(nudgeFromCollisions({ x: 0.42, y: 0.61 }, null), { x: 0.42, y: 0.61 })
  assert.deepEqual(nudgeFromCollisions({ x: 0.42, y: 0.61 }, [null, undefined]), {
    x: 0.42,
    y: 0.61,
  })
  // A stamp on the far side of the page is not in the way.
  assert.deepEqual(nudgeFromCollisions({ x: 0.25, y: 0.2 }, [{ x: 0.75, y: 0.8 }]), {
    x: 0.25,
    y: 0.2,
  })
})

test('a tap on top of an existing stamp is pushed clear of it', () => {
  const taken = [{ x: 0.55, y: 0.5 }]
  const spot = nudgeFromCollisions({ x: 0.5, y: 0.5 }, taken)
  assert.notDeepEqual(spot, { x: 0.5, y: 0.5 })
  assert.ok(onPage(spot), `off page: ${JSON.stringify(spot)}`)
  assert.ok(
    separationOf(spot, taken[0]) >= MIN_SEPARATION,
    `still overlapping: ${separationOf(spot, taken[0])}`,
  )
})

test('a stamp a clear stamp-height below is not a collision', () => {
  // MIN_SEPARATION is documented centre-to-centre "as a fraction of page
  // width", so the SAME physical gap has to read the same whether it lies
  // across the page or down it. Two centres a full stamp height apart do not
  // overlap at all — neither tap should move.
  const gapDown = stampHeightFraction() + 0.02 // in page-height fractions
  const gapAcross = gapDown / PAGE_ASPECT // the identical distance, sideways
  assert.ok(gapAcross > MIN_SEPARATION)

  const sideways = nudgeFromCollisions({ x: 0.3, y: 0.5 }, [{ x: 0.3 + gapAcross, y: 0.5 }])
  assert.deepEqual(sideways, { x: 0.3, y: 0.5 })

  const down = nudgeFromCollisions({ x: 0.5, y: 0.3 }, [{ x: 0.5, y: 0.3 + gapDown }])
  assert.deepEqual(down, { x: 0.5, y: 0.3 })
})

test('a nudge always lands on the page, however far it had to walk', () => {
  const taken = [{ x: 0.25, y: 0.2 }, { x: 0.75, y: 0.2 }]
  for (const tap of [
    { x: 0.25, y: 0.2 },
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: -3, y: 12 },
  ]) {
    const spot = nudgeFromCollisions(tap, taken)
    assert.ok(onPage(spot), `${JSON.stringify(tap)} -> ${JSON.stringify(spot)}`)
  }
})

test('a crowded page still terminates and returns the roomiest spot it found', () => {
  // Deliberately far past PAGE_CAPACITY and blanketing the page, so no
  // candidate anywhere clears MIN_SEPARATION. The stamp must still land — on
  // the page, at the least-bad spot — rather than looping or being dropped.
  const crowd = []
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) crowd.push({ x: 0.21 + i * 0.083, y: 0.166 + j * 0.095 })
  }
  const spot = nudgeFromCollisions({ x: 0.5, y: 0.5 }, crowd)
  assert.ok(Number.isFinite(spot.x) && Number.isFinite(spot.y))
  assert.ok(onPage(spot), `off page: ${JSON.stringify(spot)}`)
  // "Roomiest it found" — not on top of a neighbour, even though nothing fits.
  const nearest = crowd.reduce((min, o) => Math.min(min, separationOf(spot, o)), Infinity)
  assert.ok(nearest > 0, `landed exactly on another stamp`)
})

// ---------------------------------------------------------------------------
// placementFor — the whole answer to "the user tapped here"
// ---------------------------------------------------------------------------

test('placementFor composes the clamp, the nudge and the gamePk tilt', () => {
  const clear = placementFor(776543, 2, { x: 0.42, y: 0.61 }, [])
  assert.deepEqual(clear, { page: 2, x: 0.42, y: 0.61, tilt: tiltFor(776543) })

  const taken = [{ x: 0.42, y: 0.61 }]
  const nudged = placementFor(776543, 2, { x: 0.42, y: 0.61 }, taken)
  assert.equal(nudged.page, 2)
  assert.equal(nudged.tilt, tiltFor(776543))
  assert.ok(onPage(nudged))
  assert.ok(separationOf(nudged, taken[0]) >= MIN_SEPARATION)
})

test('placementFor survives a tap it cannot read', () => {
  for (const tap of [undefined, null, {}, { x: 'a', y: 'b' }]) {
    const spot = placementFor(776543, 1, tap, [])
    assert.ok(onPage(spot), `${JSON.stringify(tap)} -> ${JSON.stringify(spot)}`)
    assert.ok(Math.abs(spot.tilt) <= MAX_TILT)
  }
})

// ---------------------------------------------------------------------------
// Pages — filtering, the capacity boundary, and how many the book must show
// ---------------------------------------------------------------------------

test('stampsOnPage takes only that page, and orders top-to-bottom', () => {
  const stamps = [
    placed(1, 0.7, 0.8),
    placed(2, 0.5, 0.5),
    placed(1, 0.3, 0.2),
    placed(1, 0.7, 0.5),
    placed(1, 0.3, 0.5),
    { placement: null }, // in the tray, not on any page
    {}, // no placement field at all
    null,
  ]
  assert.deepEqual(
    stampsOnPage(stamps, 1).map((s) => [s.placement.x, s.placement.y]),
    [
      [0.3, 0.2],
      [0.3, 0.5],
      [0.7, 0.5],
      [0.7, 0.8],
    ],
  )
  assert.equal(stampsOnPage(stamps, 2).length, 1)
  assert.equal(stampsOnPage(stamps, 3).length, 0)
  assert.deepEqual(stampsOnPage(null, 1), [])
})

test('a page is full at PAGE_CAPACITY exactly, not before', () => {
  const nearly = Array.from({ length: PAGE_CAPACITY - 1 }, () => placed(1))
  assert.equal(pageIsFull(nearly, 1), false)
  assert.equal(pageIsFull([...nearly, placed(1)], 1), true)
  // Stamps on another page do not fill this one.
  assert.equal(pageIsFull([...nearly, placed(2)], 1), false)
  assert.equal(pageIsFull([], 1), false)
})

test('firstOpenPage finds the first page with room, or admits there is none', () => {
  const fill = (page) => Array.from({ length: PAGE_CAPACITY }, () => placed(page))
  assert.equal(firstOpenPage([], 3), 1)
  assert.equal(firstOpenPage(fill(1), 3), 2)
  assert.equal(firstOpenPage([...fill(1), ...fill(2)], 3), 3)
  assert.equal(firstOpenPage([...fill(1), ...fill(2)], 2), null)
  // Never offers a page past the cap, however many the caller asks about.
  assert.equal(firstOpenPage([], MAX_PAGES + 40), 1)
  const everything = []
  for (let page = 1; page <= MAX_PAGES; page++) everything.push(...fill(page))
  assert.equal(firstOpenPage(everything, MAX_PAGES + 40), null)
})

// ---------------------------------------------------------------------------
// Moving a stamp that is already on a page
// ---------------------------------------------------------------------------
// A re-placement differs from a first placement in exactly one respect: the
// stamp must not be measured against its OWN current spot. Both halves of that
// are the `exceptGamePk` argument below, and getting either wrong is something
// the user feels on the first try — a small correction gets shoved a
// stamp-width away by the very stamp being corrected, or the page it already
// lives on refuses to take it back.

const owned = (gamePk, page, x = 0.5, y = 0.5) => ({ gamePk, placement: { page, x, y, tilt: 0 } })

test('otherPlacementsOn drops the stamp being moved, and only that one', () => {
  const stamps = [owned(11, 1, 0.3, 0.3), owned(22, 1, 0.7, 0.7), owned(33, 2, 0.5, 0.5)]
  assert.deepEqual(
    otherPlacementsOn(stamps, 1, 22).map((p) => p.x),
    [0.3],
  )
  // No stamp named: every placement on the page counts, which is the
  // first-placement case and must stay identical to what it always did.
  assert.deepEqual(otherPlacementsOn(stamps, 1).length, 2)
  assert.deepEqual(otherPlacementsOn(stamps, 1, null).length, 2)
  // A stamp on ANOTHER page is not on this one to begin with.
  assert.deepEqual(otherPlacementsOn(stamps, 1, 33).length, 2)
  // 0 is not a gamePk anywhere in this codebase (toGamePk rejects it), so it
  // means "nobody" rather than matching a stamp whose id read as falsy.
  assert.deepEqual(otherPlacementsOn(stamps, 1, 0).length, 2)
})

test('a move is not refused by the page it is already on', () => {
  const full = Array.from({ length: PAGE_CAPACITY }, (_, i) => owned(100 + i, 1))
  assert.equal(pageIsFull(full, 1), true)
  // Nine keepsakes on a page, one of them the one being moved: there is still
  // room for it to land somewhere else on that same page.
  assert.equal(pageIsFullFor(full, 1, 104), false)
  // A stamp that is NOT on the page gets the honest answer.
  assert.equal(pageIsFullFor(full, 1, 999), true)
  assert.equal(pageIsFullFor(full, 1), true)
})

test('firstOpenPage hands a moving stamp its own full page back', () => {
  const fill = (page, base) => Array.from({ length: PAGE_CAPACITY }, (_, i) => owned(base + i, page))
  const book = [...fill(1, 100), ...fill(2, 200)]
  assert.equal(firstOpenPage(book, 2), null)
  assert.equal(firstOpenPage(book, 2, 205), 2)
  // Page 1 comes first for a stamp that lives there — the search order is
  // unchanged, only what counts as full.
  assert.equal(firstOpenPage(book, 2, 103), 1)
})

test('a move lands where it was tapped, not nudged off by its own old spot', () => {
  const stamps = [owned(11, 1, 0.5, 0.5)]
  const tap = { x: 0.52, y: 0.52 }
  // Placing something NEW there is a collision: stamp 11 is sitting on it.
  const fresh = placementFor(22, 1, tap, otherPlacementsOn(stamps, 1, 22))
  assert.ok(separationOf(fresh, stamps[0].placement) >= MIN_SEPARATION)
  // MOVING stamp 11 itself there is not — it is the thing being moved, so the
  // tap is honoured to the pixel (clamped, never nudged).
  const moved = placementFor(11, 1, tap, otherPlacementsOn(stamps, 1, 11))
  assert.deepEqual({ x: moved.x, y: moved.y }, clampToPage(tap.x, tap.y))
})

test('pageCountFor shows enough pages for the placements AND for what was added', () => {
  assert.equal(pageCountFor([]), 1)
  assert.equal(pageCountFor(null), 1)
  assert.equal(pageCountFor([], 0), 1)
  // The highest page anything actually sits on.
  assert.equal(pageCountFor([placed(4), placed(1)]), 4)
  // ...or the caller's own count, whichever is larger.
  assert.equal(pageCountFor([placed(4)], 7), 7)
  assert.equal(pageCountFor([placed(9)], 2), 9)
  // Unplaced stamps and unreadable page numbers do not add pages.
  assert.equal(pageCountFor([{ placement: null }, { placement: { page: 2.5 } }, null]), 1)
  // A hand-edited value can never mint a 40,000-page book.
  assert.equal(pageCountFor([], 99999), MAX_PAGES)
  assert.equal(pageCountFor([placed(MAX_PAGES + 500)]), MAX_PAGES)
})

// ---------------------------------------------------------------------------
// autoLayout — "place them all for me"
// ---------------------------------------------------------------------------

test('autoLayout places every stamp, PAGE_CAPACITY to a page', () => {
  const stamps = Array.from({ length: PAGE_CAPACITY * 2 + 3 }, (_, i) => ({ gamePk: 776000 + i }))
  const laid = autoLayout(stamps)

  assert.equal(laid.length, stamps.length)
  laid.forEach((entry, i) => {
    assert.equal(entry.gamePk, stamps[i].gamePk)
    assert.ok(entry.placement, `stamp ${i} came back unplaced`)
  })

  const perPage = new Map()
  for (const { placement } of laid) {
    perPage.set(placement.page, (perPage.get(placement.page) ?? 0) + 1)
  }
  for (const [page, count] of perPage) {
    assert.ok(count <= PAGE_CAPACITY, `page ${page} holds ${count}`)
  }
  // The roll happens at the capacity boundary, not one either side of it.
  assert.equal(laid[PAGE_CAPACITY - 1].placement.page, 1)
  assert.equal(laid[PAGE_CAPACITY].placement.page, 2)
  assert.equal(laid[PAGE_CAPACITY * 2].placement.page, 3)
})

test('autoLayout keeps every stamp on the page and inside the tilt range', () => {
  const laid = autoLayout(Array.from({ length: 25 }, (_, i) => ({ gamePk: 745300 + i })))
  for (const { gamePk, placement } of laid) {
    assert.ok(onPage(placement), `${gamePk} -> ${JSON.stringify(placement)}`)
    assert.equal(placement.tilt, tiltFor(gamePk))
    assert.ok(Math.abs(placement.tilt) <= MAX_TILT)
  }
})

test('autoLayout honours startPage and still caps at MAX_PAGES', () => {
  const laid = autoLayout([{ gamePk: 776000 }, { gamePk: 776001 }], { startPage: 4 })
  assert.equal(laid[0].placement.page, 4)
  assert.equal(laid[1].placement.page, 4)
  const late = autoLayout([{ gamePk: 776000 }], { startPage: MAX_PAGES + 10 })
  assert.equal(late[0].placement.page, MAX_PAGES)
})

test('autoLayout is deterministic — the same collection lays out the same way', () => {
  const stamps = Array.from({ length: 14 }, (_, i) => ({ gamePk: 812345 + i }))
  assert.deepEqual(autoLayout(stamps), autoLayout(stamps))
  // Nothing here reads a clock or a random draw, so a second device laying out
  // the same collection arranges an identical book.
  assert.deepEqual(autoLayout(stamps), autoLayout(stamps.map((s) => ({ ...s }))))
})

test('autoLayout survives an empty or unreadable collection', () => {
  assert.deepEqual(autoLayout([]), [])
  assert.deepEqual(autoLayout(null), [])
  const junk = autoLayout([{}, { gamePk: 'nope' }])
  assert.equal(junk.length, 2)
  for (const entry of junk) assert.ok(onPage(entry.placement))
})

// The disagreement this pins: `autoLayout` and `nudgeFromCollisions` are two
// functions in one module with two different ideas of where a stamp may go, and
// nothing structural stops them drifting apart. At PAGE_CAPACITY 10 in two
// columns they genuinely did — auto-layout produced pages whose closest pair sat
// at 0.165 page-widths, well inside MIN_SEPARATION, so the tidy-up button laid
// out stamps that a hand placement would have been nudged off. Capacity and the
// column count are now derived from that constraint; this is the assertion that
// keeps them honest.
test('a full auto-laid page does not overlap by the module’s own definition', () => {
  const stamps = Array.from({ length: PAGE_CAPACITY }, (_, i) => ({ gamePk: 800000 + i * 7 }))
  const laid = autoLayout(stamps)
  assert.equal(laid.length, PAGE_CAPACITY)

  for (let i = 0; i < laid.length; i += 1) {
    for (let j = i + 1; j < laid.length; j += 1) {
      const a = laid[i].placement
      const b = laid[j].placement
      assert.ok(
        separationOf(a, b) >= MIN_SEPARATION,
        `auto-layout put ${i} and ${j} ${separationOf(a, b).toFixed(3)} apart, ` +
          `inside MIN_SEPARATION ${MIN_SEPARATION}`,
      )
    }
  }
})

// A gamePk is positive everywhere else in this codebase (`toGamePk` rejects 0),
// so a falsy one is an ABSENT one and must read as the neutral angle. It used to
// coerce to 0, hash to the extreme, and come back as a hard -7 degree tilt.
test('a falsy gamePk tilts by nothing, not by the maximum', () => {
  for (const absent of [0, null, undefined, '', NaN, 'abc', {}, -5]) {
    assert.equal(tiltFor(absent), 0, String(absent))
  }
})

// `removeStamp` keeps the placement on the tombstone it writes, so a raw
// collection would otherwise let an un-stamped game hold its slot.
test('a tombstoned stamp does not occupy a page slot', () => {
  const placed = (gamePk, page) => ({ gamePk, placement: { page, x: 0.5, y: 0.5, tilt: 0 } })
  const withDead = [placed(1, 1), { ...placed(2, 1), state: 'off' }, placed(3, 1)]
  assert.equal(stampsOnPage(withDead, 1).length, 2)
  assert.deepEqual(stampsOnPage(withDead, 1).map((s) => s.gamePk), [1, 3])
})

// The bound lives in normalizePlacement (src/lib/stamps.js); if it did not also
// live here, this function could hand back a page the store then refuses, and
// the stamp would vanish the moment it was confirmed.
test('placementFor clamps the page into the book', () => {
  assert.equal(placementFor(823035, 0, { x: 0.5, y: 0.5 }, []).page, 1)
  assert.equal(placementFor(823035, 9999, { x: 0.5, y: 0.5 }, []).page, MAX_PAGES)
  assert.equal(placementFor(823035, 4, { x: 0.5, y: 0.5 }, []).page, 4)
})
