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
  for (const kind of ['venue', 'month', 'dayNight', 'weekday', 'side', 'started']) {
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

test('the date helpers read the string, so no timezone can move a game a day', () => {
  // A local-midnight Date would put a west-coast night game on the day before.
  assert.equal(weekdayOf('2024-07-04'), 4)
  assert.equal(weekdayOf('2024-07-07'), 0)
  assert.equal(monthOf('2024-07-04'), 7)
  assert.equal(monthOf('2024-10-31'), 10)
})
