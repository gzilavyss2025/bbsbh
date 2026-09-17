// The Box Lines facet layer (src/api/boxlines/facets.js, ADR-0069/#997). One
// tagged object says which of a player's career games a sheet is about. This
// pins the two properties the rest of the feature rests on:
//   • a facet produces a `keep` PREDICATE, never a cutoff or a fetch of its
//     own, so it can only narrow what boxLineRows already approved;
//   • an unknown facet keeps NOTHING. A typo in a future facet issue must show
//     as an empty sheet, never as a full one — the sheet's rows carry scores.
import assert from 'node:assert/strict'
import test from 'node:test'
import { facetPlan, monthOf, weekdayOf } from '../src/api/boxlines/facets.js'

// A finished row as boxLineRows builds it, trimmed to the fields a facet reads.
function row(over = {}) {
  return {
    date: '2024-07-04',
    gamePk: 1,
    home: true,
    started: true,
    venueId: 32,
    dayNight: 'night',
    surface: 'grass',
    lineupStart: true,
    positions: ['LF'],
    ...over,
  }
}

test('no facet asks nothing: every row, regular season, no club narrowing', () => {
  const plan = facetPlan(null)
  assert.equal(plan.keep, null)
  assert.equal(plan.opponentId, null)
  assert.equal(plan.gameTypes, null)
  assert.equal(plan.narrowsSplits, false)
})

test('the club facet is the only one that narrows the game log', () => {
  const plan = facetPlan({ kind: 'club', opponentId: 158 })
  assert.equal(plan.opponentId, 158)
  assert.equal(plan.narrowsSplits, true)
  // It filters splits by opponent, so it needs no row predicate on top.
  assert.equal(plan.keep, null)
  for (const kind of [
    'venue',
    'month',
    'dayNight',
    'weekday',
    'side',
    'started',
    'pinchHit',
    'surface',
    'lineupStart',
    'lineupSpot',
  ]) {
    assert.equal(facetPlan({ kind }).narrowsSplits, false, `${kind} must not narrow the log`)
  }
})

test('each facet keeps the rows it names and drops the rest', () => {
  const cases = [
    [{ kind: 'venue', venueId: 32 }, row({ venueId: 32 }), row({ venueId: 15 })],
    [{ kind: 'month', month: 7 }, row({ date: '2024-07-04' }), row({ date: '2024-08-04' })],
    [{ kind: 'dayNight', value: 'night' }, row({ dayNight: 'night' }), row({ dayNight: 'day' })],
    // 2024-07-04 was a Thursday (4).
    [{ kind: 'weekday', day: 4 }, row({ date: '2024-07-04' }), row({ date: '2024-07-05' })],
    [{ kind: 'side', home: true }, row({ home: true }), row({ home: false })],
    [{ kind: 'started', value: true }, row({ started: true }), row({ started: false })],
    [{ kind: 'pinchHit' }, row({ positions: ['PH'] }), row({ positions: ['LF'] })],
  ]
  for (const [facet, hit, miss] of cases) {
    const { keep } = facetPlan(facet)
    assert.equal(keep(hit), true, `${facet.kind} should keep its own row`)
    assert.equal(keep(miss), false, `${facet.kind} should drop the other row`)
  }
})

test('the gameTypes facet moves the game types, and adds no predicate', () => {
  const plan = facetPlan({ kind: 'gameTypes', types: ['F', 'D', 'L', 'W'] })
  // No keep: the types are applied in matchingSplits, so a non-postseason row
  // is never built rather than built and filtered.
  assert.equal(plan.keep, null)
  assert.deepEqual(plan.gameTypes, ['F', 'D', 'L', 'W'])
  // An empty list is not "every type": it falls back to the default.
  assert.equal(facetPlan({ kind: 'gameTypes', types: [] }).gameTypes, null)
})

test('an unknown facet keeps NOTHING, so a typo empties a sheet rather than filling it', () => {
  const { keep } = facetPlan({ kind: 'ballpark', venueId: 32 })
  assert.equal(typeof keep, 'function')
  assert.equal(keep(row()), false)
})

test("a hitter's null `started` is not a start, and not a crash", () => {
  const { keep } = facetPlan({ kind: 'started', value: true })
  assert.equal(keep(row({ started: null })), false)
})

test('a pinch hitter is how he ENTERED, not what he played later', () => {
  // The hitting game log's `positionsPlayed` is ordered by when he played each
  // position, so the FIRST entry is the answer. ['PH', 'LF'] pinch hit and
  // stayed in the field; ['LF', 'PH'] cannot happen, and if MLB ever emits it
  // this reads it as the start it was rather than as a pinch-hit game.
  const { keep } = facetPlan({ kind: 'pinchHit' })
  assert.equal(keep(row({ positions: ['PH'] })), true)
  assert.equal(keep(row({ positions: ['PH', 'LF'] })), true)
  assert.equal(keep(row({ positions: ['LF', 'PH'] })), false)
  // A pinch RUNNER who later batted is not a pinch hitter, and MLB's own pH
  // split does not count him either.
  assert.equal(keep(row({ positions: ['PR', 'LF'] })), false)
  // A pitcher's row carries no positions at all. Not a start, and not a crash.
  assert.equal(keep(row({ positions: null })), false)
  assert.equal(keep(row({ positions: [] })), false)
})

test('a month reads the date, not a Date: the last day of April is April', () => {
  // #999's own case. April 30 and May 1 are one day apart and must not land in
  // the same month, which a UTC-vs-local slip is exactly what would do.
  const april = facetPlan({ kind: 'month', month: 4 }).keep
  assert.equal(april(row({ date: '2024-04-30' })), true)
  assert.equal(april(row({ date: '2024-05-01' })), false)
  const may = facetPlan({ kind: 'month', month: 5 }).keep
  assert.equal(may(row({ date: '2024-05-01' })), true)
  assert.equal(may(row({ date: '2024-04-30' })), false)
})

test('the date helpers read the string, so no timezone can move a game a day', () => {
  // A local-midnight Date would put a west-coast night game on the day before.
  assert.equal(weekdayOf('2024-07-04'), 4)
  assert.equal(weekdayOf('2024-07-07'), 0)
  assert.equal(monthOf('2024-07-04'), 7)
  assert.equal(monthOf('2024-10-31'), 10)
  // #1001's own case: 2026-09-02 is a Wednesday wherever the suite runs.
  assert.equal(weekdayOf('2026-09-02'), 3)
  assert.equal(weekdayOf('2026-08-30'), 0)
  // March 1 and October 31 bracket the season, and both sit at a DST edge in
  // one hemisphere or the other.
  assert.equal(monthOf('2024-03-01'), 3)
  assert.equal(weekdayOf('2024-03-10'), 0)
  assert.equal(weekdayOf('2024-11-03'), 0)
})

test('the surface facet reads the park as it was THAT season', () => {
  // The row's `surface` comes off the schedule record's own fieldInfo, which
  // is season-correct — Chase Field is grass through 2018 and turf from 2019.
  // A facet that matched on a park id against a table of today's surfaces
  // would put eighty-one 2016 games on the wrong side.
  const grass = facetPlan({ kind: 'surface', value: 'grass' }).keep
  const turf = facetPlan({ kind: 'surface', value: 'turf' }).keep
  assert.equal(grass(row({ surface: 'grass' })), true)
  assert.equal(grass(row({ surface: 'turf' })), false)
  assert.equal(turf(row({ surface: 'turf' })), true)
  assert.equal(turf(row({ surface: 'grass' })), false)
  // A record with no surface on it is on neither side, the same as a game with
  // no lineup: '' is missing information, not a third kind of field.
  assert.equal(grass(row({ surface: '' })), false)
  assert.equal(turf(row({ surface: '' })), false)
})

test('the lineup facet asks for a second pass, and only it does', () => {
  // `needsLineups` is what sends fetch.js back for the schedule's lineups. It
  // is the one flag that costs a request, so no other facet may set it.
  assert.equal(facetPlan({ kind: 'lineupStart', value: true }).needsLineups, true)
  assert.equal(facetPlan({ kind: 'lineupStart', value: false }).needsLineups, true)
  for (const facet of [
    null,
    { kind: 'club', opponentId: 158 },
    { kind: 'venue', venueId: 32 },
    { kind: 'month', month: 7 },
    { kind: 'weekday', day: 3 },
    { kind: 'dayNight', value: 'day' },
    { kind: 'side', home: true },
    { kind: 'started', value: true },
    { kind: 'pinchHit' },
    { kind: 'surface', value: 'grass' },
  ]) {
    assert.equal(facetPlan(facet).needsLineups, false, `${facet?.kind ?? 'null'} must not cost a pass`)
  }
})

test('a game with no lineup is on neither side of the lineup facet', () => {
  // null is "nobody posted a card", not "he came off the bench". Counting it
  // as a bench game is the one wrong answer this facet could give quietly.
  const started = facetPlan({ kind: 'lineupStart', value: true }).keep
  const bench = facetPlan({ kind: 'lineupStart', value: false }).keep
  assert.equal(started(row({ lineupStart: true })), true)
  assert.equal(started(row({ lineupStart: false })), false)
  assert.equal(bench(row({ lineupStart: false })), true)
  assert.equal(bench(row({ lineupStart: true })), false)
  assert.equal(started(row({ lineupStart: null })), false)
  assert.equal(bench(row({ lineupStart: null })), false)
  // A pitcher's row never carries one at all — the same shape as unknown.
  assert.equal(started(row({ lineupStart: undefined })), false)
  assert.equal(bench(row({ lineupStart: undefined })), false)
})

test('a slot facet keeps that spot in the order and no other', () => {
  // #1048. The nine slots are a LIST behind one door, not nine doors, because
  // MLB's own `bN` aggregate counts something else — see ADR-0069 — so the
  // figures come from the rows and the rows come from here.
  const third = facetPlan({ kind: 'lineupSpot', spot: 3 }).keep
  assert.equal(third(row({ lineupSpot: 3 })), true)
  assert.equal(third(row({ lineupSpot: 4 })), false)
  assert.equal(third(row({ lineupSpot: 1 })), false)
  // A game he did not start, and a game with no card posted, both read null —
  // and null belongs to no slot. Counting either as a slot would put a bench
  // appearance under "batting third".
  assert.equal(third(row({ lineupSpot: null })), false)
  assert.equal(third(row({ lineupSpot: undefined })), false)
  // The nine each keep their own and drop the one below.
  for (let spot = 1; spot <= 9; spot++) {
    const keep = facetPlan({ kind: 'lineupSpot', spot }).keep
    assert.equal(keep(row({ lineupSpot: spot })), true, `spot ${spot} dropped its own row`)
    assert.equal(keep(row({ lineupSpot: spot === 1 ? 9 : spot - 1 })), false, `spot ${spot} kept another`)
  }
})

test('a slot facet with NO slot is the list itself: every row that has one', () => {
  // The sheet in list mode asks this. It must not narrow to a slot (there is
  // none yet) and it must still cost the lineups pass, or every row comes back
  // with a null slot and the list folds to nothing.
  const plan = facetPlan({ kind: 'lineupSpot', spot: null })
  assert.equal(plan.needsLineups, true)
  assert.equal(plan.keep(row({ lineupSpot: 1 })), true)
  assert.equal(plan.keep(row({ lineupSpot: 9 })), true)
  // It is not "every row": a bench game has no slot to list him under.
  assert.equal(plan.keep(row({ lineupSpot: null })), false)
})

test('the slot facet costs the same second pass the lineup doors do', () => {
  // It reads the same nine names a side. Sharing `needsLineups` is what lets
  // the list and the two lineup doors share ONE pass over a card.
  assert.equal(facetPlan({ kind: 'lineupSpot', spot: 5 }).needsLineups, true)
  assert.equal(facetPlan({ kind: 'lineupSpot', spot: 5 }).narrowsSplits, false)
  assert.equal(facetPlan({ kind: 'lineupSpot', spot: 5 }).gameTypes, null)
})

test('a venue facet with NO park is the ballpark list itself', () => {
  // #998's listing pass, the same shape the slot facet's is. It must keep every
  // row that HAS a park — not none, which empties the list, and not all, which
  // would put a row with no venue under some park.
  const plan = facetPlan({ kind: 'venue', venueId: null })
  assert.equal(plan.keep(row({ venueId: 32 })), true)
  assert.equal(plan.keep(row({ venueId: 15 })), true)
  assert.equal(plan.keep(row({ venueId: null })), false)
  // And naming a park still narrows to it alone.
  const one = facetPlan({ kind: 'venue', venueId: 32 }).keep
  assert.equal(one(row({ venueId: 32 })), true)
  assert.equal(one(row({ venueId: 15 })), false)
  assert.equal(one(row({ venueId: null })), false)
  // It costs no second pass: a park is on the schedule record the join already
  // holds, unlike a slot in the order.
  assert.equal(plan.needsLineups, false)
})

test('a list facet marked postseason asks the log for October too', () => {
  // The rule ADR-0069 set for the calendar doors, applied to the two lists: a
  // park does not stop being Dodger Stadium because the game was a division
  // series. Measured 2026-09-17 — Betts at Globe Life Field is 9 regular-season
  // games and 16 postseason ones, so the regular season alone states 9 of 25.
  for (const facet of [
    { kind: 'venue', venueId: 32, postseason: true },
    { kind: 'venue', venueId: null, postseason: true },
    { kind: 'lineupSpot', spot: 3, postseason: true },
    { kind: 'lineupSpot', spot: null, postseason: true },
  ]) {
    const { gameTypes } = facetPlan(facet)
    assert.deepEqual(gameTypes, ['R', 'F', 'D', 'L', 'W'], `${facet.kind} asks for the wrong types`)
    // NEVER the umbrella 'P': a pitching log answers it as every row's type and
    // the type filter then drops all of them (rows.js's POSTSEASON).
    assert.equal(gameTypes.includes('P'), false)
  }
})

test('a list facet without the flag still reads the regular season alone', () => {
  // The widening is opt-in per facet, so a future list that should not span
  // October simply does not say so — and the single-park sheet the lineup page
  // could open keeps its own answer.
  for (const facet of [
    { kind: 'venue', venueId: 32 },
    { kind: 'lineupSpot', spot: 3 },
  ]) {
    assert.equal(facetPlan(facet).gameTypes, null, `${facet.kind} widened without asking`)
  }
})
