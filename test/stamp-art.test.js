// The Logbook stamp's pure layer: the locked art's geometry (src/lib/stampArt.js)
// and the two producers of the game-facts blob it draws from
// (revealStampFacts in src/api/linescore.js, stampGameFacts in src/api/logbook.js).
//
// Two things here are worth more than the rest:
//
//   1. `revealStampFacts` must derive the SAME `innings`/`homeBattedLast` the
//      server derives, because those two fields are what the reveal gate turns
//      on (finalHalfIndex, src/lib/stamps.js). If the client says nine innings
//      and the server says six, the affordance and the gate disagree about
//      whether a legitimate stamp is mintable. The live feed pads its linescore
//      out to `scheduledInnings` with empty rows and the schedule feed does not,
//      which is the exact trap those cases pin.
//   2. The art's constants are LOCKED (PR #502). Pinning the handful that carry
//      design intent — the double-digit size drop, the diamond clamp — means a
//      "cleanup" that changes one fails here instead of silently reshaping a
//      keepsake that is supposed to look the same forever.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MARK_BOX,
  MARK_PLACEMENT_DEFAULT,
  MARK_PLACEMENT_LIMITS,
  MARK_SIDES,
  diamondPath,
  labelType,
  markBoxX,
  markPlacement,
  markTransform,
  polar,
  resolveMarkPlacement,
  ringLayout,
  runFontSize,
  stampDateText,
  stampIds,
  stampLabel,
  stampSeed,
} from '../src/lib/stampArt.js'
import { stampLogoTuning, stampLogoTuningRecord } from '../src/lib/stampLogoTuning.js'
import STAMP_LOGO_TUNING from '../src/lib/data/stamp-logo-tuning.json' with { type: 'json' }
import { revealStampFacts } from '../src/api/linescore.js'
import { stampGameFacts } from '../src/api/logbook.js'
import { finalHalfIndex, meetsRevealGate } from '../src/lib/stamps.js'
import { halfIndex } from '../src/api/select.js'

// --------------------------------------------------------------------------
// Geometry
// --------------------------------------------------------------------------

test('polar walks clockwise from top dead centre', () => {
  const top = polar(0, 100)
  assert.equal(Math.round(top.x), 150)
  assert.equal(Math.round(top.y), 50)

  const right = polar(90, 100)
  assert.equal(Math.round(right.x), 250)
  assert.equal(Math.round(right.y), 150)

  const bottom = polar(180, 100)
  assert.equal(Math.round(bottom.x), 150)
  assert.equal(Math.round(bottom.y), 250)
})

test('two equal-length ring strings put the diamonds at 9 and 3 o’clock', () => {
  // The locked sample's venue and date are both 21-22 characters, which is why
  // that file's hardcoded coordinates land exactly on the horizontal — the
  // generator has to reproduce that, not just approximate it.
  const ring = ringLayout('AMERICAN FAMILY FIELD', 'SUNDAY, AUGUST 2, 2026')
  assert.ok(Math.abs(ring.theta - 90) < 4, `theta ${ring.theta} should be about 90`)
  assert.match(ring.arcTop, /^M 2[89]\.\d+,1[45]\d\.\d+ A 122,122 0 0 1 27[12]\.\d+,/)
  assert.match(ring.arcBottom, /A 135,135 0 1 0 /)
})

test('a long venue name claims more of the ring, up to the clamp', () => {
  const balanced = ringLayout('WRIGLEY FIELD', 'FRIDAY, MAY 1, 2026')
  const lopsided = ringLayout('OAKLAND–ALAMEDA COUNTY COLISEUM', 'MAY 1')
  assert.ok(lopsided.venueShare > balanced.venueShare)
  // Clamped, so one arc's text can never fold back on itself.
  assert.ok(lopsided.venueShare <= 0.68 + 1e-9)

  const tiny = ringLayout('X', '2026 NATIONAL LEAGUE DIVISION SERIES GAME 3')
  assert.ok(tiny.venueShare >= 0.32 - 1e-9)
})

test('empty ring text splits the circle evenly instead of dividing by zero', () => {
  const ring = ringLayout('', '')
  assert.equal(ring.venueShare, 0.5)
  assert.ok(Number.isFinite(ring.theta))
  assert.ok(!ring.arcTop.includes('NaN'))
  assert.ok(!ring.arcBottom.includes('NaN'))
})

test('a separator diamond is a 12px rotated square centred on its ring point', () => {
  assert.equal(diamondPath({ x: 21, y: 150 }), 'M 21,144 l 6,6 -6,6 -6,-6 z')
})

test('the club mark slots are the locked design’s, asymmetry included', () => {
  // Transcribed from stamp-concept-1-v2.svg, not derived — and deliberately NOT
  // mirrored about the 150 centre line: away spans -18..132 and home 162..312,
  // so the gap between them is centred on 147 while the '@' sits at 150. That
  // 3px offset is in the locked art; pinning it here is what stops a later
  // "obviously these should be symmetric" cleanup from quietly moving both
  // marks under every stamp anyone has already minted.
  assert.deepEqual(MARK_BOX, { size: 150, y: 44, awayX: -18, homeX: 162 })
  // Each slot is wider than the gap to the inner circle, which is the point:
  // the marks bleed off its left/right edge rather than fitting inside it.
  assert.ok(MARK_BOX.size > 2 * 117 - MARK_BOX.size)
})

// --------------------------------------------------------------------------
// Per-club mark placement
// --------------------------------------------------------------------------
// The one tunable part of the locked art (src/lib/data/stamp-logo-tuning.json).
// Every stamp is redrawn from these numbers on every render, including ones
// already minted and placed in someone's Logbook, so the two properties that
// matter get pinned here: an untuned club produces NO transform at all (its
// markup is what it was the day the design was locked), and a tuned one can
// only ever move its mark within the clamps.

test('an untuned club gets no transform, so its markup is unchanged', () => {
  assert.equal(markTransform('away', null), null)
  assert.equal(markTransform('home', undefined), null)
  assert.equal(markTransform('away', {}), null)
  // Values that ARE the defaults are the same thing written out.
  assert.equal(markTransform('home', { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 }), null)
  // And so is junk, which resolves back to the defaults rather than to NaN.
  assert.equal(markTransform('away', { scale: 'wide', offsetY: null }), null)
})

test('a placement resolves to the defaults for anything missing or non-finite, and clamps the rest', () => {
  assert.deepEqual(resolveMarkPlacement(undefined), MARK_PLACEMENT_DEFAULT)
  assert.deepEqual(resolveMarkPlacement({ scale: Number.NaN, rotation: Infinity }), MARK_PLACEMENT_DEFAULT)
  // Out of range clamps rather than falling back — a 5x scale was still an
  // instruction to make it bigger.
  assert.equal(resolveMarkPlacement({ scale: 5 }).scale, MARK_PLACEMENT_LIMITS.scale.max)
  assert.equal(resolveMarkPlacement({ offsetX: -900 }).offsetX, MARK_PLACEMENT_LIMITS.offsetX.min)
  assert.equal(resolveMarkPlacement({ rotation: 270 }).rotation, MARK_PLACEMENT_LIMITS.rotation.max)
  // A partial record keeps the fields it does carry.
  assert.deepEqual(resolveMarkPlacement({ offsetY: -8 }), { ...MARK_PLACEMENT_DEFAULT, offsetY: -8 })
})

test('scale and rotation turn about the slot’s own centre, not the stamp’s origin', () => {
  // away slot -18..132 → centre 57; home slot 162..312 → centre 237. Both share
  // the same y centre, 44 + 75 = 119.
  assert.match(markTransform('away', { scale: 1.2 }), /translate\(57 119\) scale\(1\.2\) translate\(-57 -119\)/)
  assert.match(markTransform('home', { scale: 1.2 }), /translate\(237 119\) scale\(1\.2\) translate\(-237 -119\)/)
  assert.match(markTransform('home', { rotation: -6 }), /rotate\(-6 237 119\)/)
  // The offsets lead, so they read as "and now nudge it this far" in stamp
  // units whatever the scale and rotation are doing.
  assert.match(markTransform('away', { offsetX: 4, offsetY: -3, scale: 0.9 }), /^translate\(4 -3\) /)
})

test('a placement carries the slot along with the transform', () => {
  const away = markPlacement('away', { scale: 1.1 })
  assert.equal(away.x, MARK_BOX.awayX)
  assert.equal(away.y, MARK_BOX.y)
  assert.equal(away.size, MARK_BOX.size)
  assert.ok(away.transform)
  assert.equal(markPlacement('home', null).transform, null)
  // An unknown side is the away slot — those two are the whole vocabulary.
  assert.equal(markBoxX('nonsense'), MARK_BOX.awayX)
  assert.equal(markBoxX('home'), MARK_BOX.homeX)
})

test('every entry in the placement store is a side the art knows, inside the clamps', () => {
  for (const [teamId, entry] of Object.entries(STAMP_LOGO_TUNING)) {
    for (const [side, fields] of Object.entries(entry.treatments ?? {})) {
      assert.ok(MARK_SIDES.includes(side), `${teamId} has a stamp side "${side}"`)
      for (const [field, value] of Object.entries(fields)) {
        if (field === 'note') continue
        const limits = MARK_PLACEMENT_LIMITS[field]
        assert.ok(limits, `${teamId}.${side} carries an unknown field "${field}"`)
        assert.ok(Number.isFinite(value), `${teamId}.${side}.${field} is ${value}`)
        assert.ok(
          value >= limits.min && value <= limits.max,
          `${teamId}.${side}.${field} (${value}) is outside its clamp`,
        )
      }
    }
  }
})

test('the store’s landed values are what the art actually draws with', () => {
  // The reader and the geometry are separate modules; this is the seam between
  // them, and it is the seam a stamp in someone's Logbook depends on.
  assert.deepEqual(stampLogoTuning(158, 'away'), resolveMarkPlacement(stampLogoTuningRecord(158, 'away')))
  // A club with no entry at all still gets an answer rather than a null.
  assert.deepEqual(stampLogoTuning(999999, 'home'), MARK_PLACEMENT_DEFAULT)
})

// --------------------------------------------------------------------------
// Type
// --------------------------------------------------------------------------

test('both run totals drop together the moment either club reaches double digits', () => {
  assert.equal(runFontSize(3, 5), 62)
  assert.equal(runFontSize(9, 9), 62)
  // The point of dropping BOTH is that the pair stays matched — a 14 next to a
  // full-size 3 would read as the winner shouting, which the design rejected.
  assert.equal(runFontSize(3, 14), 48)
  assert.equal(runFontSize(12, 0), 48)
})

test('the footer label folds extras and a doubleheader game number into one line', () => {
  assert.equal(stampLabel({ innings: 9, gameNumber: 1 }), 'Final')
  assert.equal(stampLabel({ innings: 11, gameNumber: 1 }), 'Final / 11')
  assert.equal(stampLabel({ innings: 9, gameNumber: 2 }), 'Final — GM 2')
  assert.equal(stampLabel({ innings: 11, gameNumber: 2 }), 'Final / 11 — GM 2')
  // A rain-shortened game is still nine-or-fewer, so it reads plainly.
  assert.equal(stampLabel({ innings: 6, gameNumber: 1 }), 'Final')
  assert.equal(stampLabel({}), 'Final')
})

test('the label steps down only as far as it has to', () => {
  assert.deepEqual(labelType('Final'), { size: 9, tracking: 2.5 })
  assert.deepEqual(labelType('Final / 11'), { size: 9, tracking: 2.5 })
  assert.deepEqual(labelType('Final — GM 2'), { size: 8, tracking: 1.5 })
  assert.deepEqual(labelType('Final / 11 — GM 2'), { size: 7, tracking: 1 })
})

test('the ring date is the calendar day, not the reader’s time zone', () => {
  // Built from the parts rather than parsed as an instant — `new Date('2026-08-02')`
  // is UTC midnight, which is August 1 for anyone west of Greenwich.
  assert.equal(stampDateText('2026-08-02'), 'Sunday, August 2, 2026')
  assert.equal(stampDateText('2026-01-01'), 'Thursday, January 1, 2026')
  assert.equal(stampDateText(''), '')
  assert.equal(stampDateText(null), '')
})

// --------------------------------------------------------------------------
// Instance identity + determinism
// --------------------------------------------------------------------------

test('every defs id is suffixed per instance, so a grid never collides', () => {
  const a = stampIds(824807)
  const b = stampIds(824891)
  const values = Object.values(a)
  assert.equal(new Set(values).size, values.length, 'ids within one stamp are distinct')
  for (const key of Object.keys(a)) {
    assert.notEqual(a[key], b[key], `${key} must differ between instances`)
  }
})

test('the wear seed is derived from the gamePk, so one game chews the same forever', () => {
  assert.equal(stampSeed(824807), stampSeed(824807))
  assert.notEqual(stampSeed(824807), stampSeed(824891))
  // Never NaN — feTurbulence would render nothing at all.
  assert.ok(Number.isInteger(stampSeed(undefined)))
  assert.ok(Number.isInteger(stampSeed('nope')))
})

// --------------------------------------------------------------------------
// The facts blob — the spoiler-critical half
// --------------------------------------------------------------------------

function feedFixture({ innings, status = 'Final', awayRuns = 5, homeRuns = 3, scheduled = 9 }) {
  return {
    gamePk: 778241,
    gameData: {
      game: { pk: 778241, type: 'R', gameNumber: 1 },
      datetime: { officialDate: '2026-08-02' },
      venue: { name: 'American Family Field' },
      status: { abstractGameState: status },
      teams: {
        away: { id: 112, abbreviation: 'CHC', name: 'Chicago Cubs', sport: { id: 1 } },
        home: { id: 158, abbreviation: 'MIL', name: 'Milwaukee Brewers', sport: { id: 1 } },
      },
    },
    liveData: {
      linescore: {
        scheduledInnings: scheduled,
        innings,
        teams: {
          away: { runs: awayRuns, hits: 9, errors: 0 },
          home: { runs: homeRuns, hits: 7, errors: 1 },
        },
      },
    },
  }
}

// A normal nine-inning game the home club batted out.
const NINE = Array.from({ length: 9 }, (_, i) => ({
  num: i + 1,
  away: { runs: 0 },
  home: { runs: 0 },
}))

test('revealStampFacts reads the whole facts blob off a live feed', () => {
  const facts = revealStampFacts(feedFixture({ innings: NINE }))
  assert.equal(facts.gamePk, 778241)
  assert.equal(facts.date, '2026-08-02')
  assert.equal(facts.venue, 'American Family Field')
  assert.equal(facts.status, 'Final')
  assert.equal(facts.innings, 9)
  assert.equal(facts.homeBattedLast, true)
  assert.equal(facts.away.abbreviation, 'CHC')
  assert.equal(facts.away.runs, 5)
  assert.equal(facts.home.runs, 3)
  assert.equal(facts.winnerId, 112)
})

test('a home club that never batted in the last inning is not claimed to have', () => {
  // Home team leads entering the top of the ninth and wins — the bottom half
  // never happens. The gate has to demand the TOP of the ninth, or it could
  // never be satisfied for this (very common) game shape.
  const innings = NINE.map((row, i) => (i === 8 ? { num: 9, away: { runs: 0 } } : row))
  const facts = revealStampFacts(feedFixture({ innings, awayRuns: 2, homeRuns: 4 }))
  assert.equal(facts.innings, 9)
  assert.equal(facts.homeBattedLast, false)
  assert.equal(finalHalfIndex(facts), halfIndex(9, 'top'))
})

test('a rain-shortened game is not padded out to its scheduled length', () => {
  // The live feed pads `innings` to scheduledInnings with rows carrying no
  // `runs` at all. Verified against gamePk 824807 (2026-08-02 PHI@BAL,
  // "Completed Early: Rain"): a 9-long array whose last four rows are empty and
  // whose sixth has only a top half. Reading the array's LENGTH would claim
  // nine innings and demand a bottom half nobody played, and the stamp would
  // never be mintable for a game the user watched to its actual end.
  const innings = [
    ...Array.from({ length: 5 }, (_, i) => ({ num: i + 1, away: { runs: 0 }, home: { runs: 0 } })),
    { num: 6, away: { runs: 3 }, home: { hits: 0, errors: 0, leftOnBase: 0 } },
    { num: 7, away: { hits: 0 }, home: { hits: 0 } },
    { num: 8, away: { hits: 0 }, home: { hits: 0 } },
    { num: 9, away: { hits: 0 }, home: { hits: 0 } },
  ]
  const facts = revealStampFacts(feedFixture({ innings, awayRuns: 8, homeRuns: 0 }))
  assert.equal(facts.innings, 6)
  assert.equal(facts.homeBattedLast, false)
  assert.equal(finalHalfIndex(facts), halfIndex(6, 'top'))

  // And the gate agrees: reaching the top of the sixth is enough, and stopping
  // one half short is not.
  assert.equal(meetsRevealGate({ game: facts, revealedThrough: halfIndex(6, 'top') }), true)
  assert.equal(meetsRevealGate({ game: facts, revealedThrough: halfIndex(5, 'bottom') }), false)
})

test('extra innings are counted from the innings actually played', () => {
  const innings = [
    ...NINE,
    { num: 10, away: { runs: 1 }, home: { runs: 0 } },
    { num: 11, away: { runs: 0 }, home: { runs: 2 } },
  ]
  const facts = revealStampFacts(feedFixture({ innings, awayRuns: 4, homeRuns: 6 }))
  assert.equal(facts.innings, 11)
  assert.equal(facts.homeBattedLast, true)
  assert.equal(stampLabel(facts), 'Final / 11')
  // A user who revealed only through regulation has NOT seen the innings that
  // decided it, and cannot stamp.
  assert.equal(meetsRevealGate({ game: facts, revealedThrough: halfIndex(9, 'bottom') }), false)
  assert.equal(meetsRevealGate({ game: facts, revealedThrough: halfIndex(11, 'bottom') }), true)
})

test('a tie carries no winner rather than inventing one', () => {
  const facts = revealStampFacts(feedFixture({ innings: NINE, awayRuns: 3, homeRuns: 3 }))
  assert.equal(facts.winnerId, null)
})

test('revealStampFacts degrades rather than throwing on an empty feed', () => {
  assert.equal(revealStampFacts(null), null)
  assert.equal(revealStampFacts(undefined), null)
  const bare = revealStampFacts({ gameData: {} })
  assert.equal(bare.innings, 0)
  assert.equal(bare.status, '')
  assert.equal(bare.away.runs, null)
  // Nothing about an empty blob may pass the gate.
  assert.equal(meetsRevealGate({ game: bare, revealedThrough: 999 }), false)
})

test('both producers of the facts blob agree on the same game', () => {
  // stampGameFacts reads a schedule row (what the Logbook page and the server
  // both see); revealStampFacts reads the live feed (what the box score sees).
  // One shape, two sources — a stamp must look the same whichever resolved it.
  const scheduleRow = {
    gamePk: 778241,
    officialDate: '2026-08-02',
    gameNumber: 1,
    gameType: 'R',
    venue: { name: 'American Family Field' },
    status: { abstractGameState: 'Final' },
    teams: {
      away: { team: { id: 112, abbreviation: 'CHC', name: 'Chicago Cubs' }, isWinner: true },
      home: {
        team: { id: 158, abbreviation: 'MIL', name: 'Milwaukee Brewers', sport: { id: 1 } },
        isWinner: false,
      },
    },
    linescore: {
      innings: NINE,
      teams: { away: { runs: 5, hits: 9, errors: 0 }, home: { runs: 3, hits: 7, errors: 1 } },
    },
  }
  const fromSchedule = stampGameFacts(scheduleRow)
  const fromFeed = revealStampFacts(feedFixture({ innings: NINE }))

  for (const key of ['gamePk', 'date', 'gameNumber', 'venue', 'innings', 'homeBattedLast', 'status', 'winnerId', 'sportId']) {
    assert.deepEqual(fromSchedule[key], fromFeed[key], `${key} must agree`)
  }
  assert.deepEqual(fromSchedule.away, fromFeed.away)
  assert.deepEqual(fromSchedule.home, fromFeed.home)
})

test('stampGameFacts drops a row with no gamePk instead of keying on undefined', () => {
  assert.equal(stampGameFacts(null), null)
  assert.equal(stampGameFacts({}), null)
})
