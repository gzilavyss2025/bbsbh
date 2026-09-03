// The Game lines card's registry (src/api/boxlines/cardFacets.js, ADR-0069).
// The card itself is a .jsx file the suite cannot import, which is why the
// registry is pure data: the failure this pins is SILENT otherwise.
//
// facets.js is deliberate about an unknown `kind` — it keeps NOTHING, so a
// sheet shows nothing rather than showing every game with a score in it. That
// is the right call for a spoiler surface and the wrong thing to discover in
// production: a door with a typo in its facet opens, loads, and renders an
// empty ledger, and nothing anywhere says why. So every entry is checked here
// against the same facetPlan the sheet will call.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CARD_FACETS, cardFacetsFor } from '../src/api/boxlines/cardFacets.js'
import { facetPlan } from '../src/api/boxlines/facets.js'

const GROUPS = ['hitting', 'pitching']

test('every door asks its question as a row predicate, and nothing more', () => {
  for (const entry of CARD_FACETS) {
    const plan = facetPlan(entry.facet)
    // A predicate is the only thing these six may produce. Narrowing the game
    // log (the club facet) or moving the game types (the postseason facet)
    // would each give this card a second fetch, and the whole point of the
    // registry is that all its doors share ONE join.
    assert.equal(typeof plan.keep, 'function', `${entry.sitCode} needs a row predicate`)
    assert.equal(plan.narrowsSplits, false, `${entry.sitCode} must not narrow the game log`)
    assert.equal(plan.opponentId, null, `${entry.sitCode} must not pin an opponent`)
    assert.equal(plan.gameTypes, null, `${entry.sitCode} must stay on the regular season`)
  }
})

test('each door keeps a matching row and drops its opposite', () => {
  // The real check that a kind is understood: it must actually discriminate.
  const cases = {
    h: [{ home: true }, { home: false }],
    a: [{ home: false }, { home: true }],
    d: [{ dayNight: 'day' }, { dayNight: 'night' }],
    n: [{ dayNight: 'night' }, { dayNight: 'day' }],
    sp: [{ started: true }, { started: false }],
    rp: [{ started: false }, { started: true }],
  }
  for (const entry of CARD_FACETS) {
    const [hit, miss] = cases[entry.sitCode]
    const { keep } = facetPlan(entry.facet)
    assert.equal(keep(anyRow(hit)), true, `${entry.sitCode} should keep its own row`)
    assert.equal(keep(anyRow(miss)), false, `${entry.sitCode} should drop the other`)
  }
})

test('a sitCode appears once: it is the React key and the fetch key both', () => {
  const codes = CARD_FACETS.map((r) => r.sitCode)
  assert.equal(new Set(codes).size, codes.length)
})

test('every door is drawable: a label, a kicker, and a title of the player', () => {
  for (const entry of CARD_FACETS) {
    assert.ok(entry.label, `${entry.sitCode} needs a label`)
    assert.ok(entry.kicker.startsWith('Game lines · '), `${entry.sitCode} kicker: ${entry.kicker}`)
    assert.equal(typeof entry.title, 'function', `${entry.sitCode} needs a title`)
    assert.ok(entry.title('Yelich').includes('Yelich'))
    assert.ok(entry.groups.length && entry.groups.every((g) => GROUPS.includes(g)))
  }
})

test('"Box Lines" is the internal name and never reaches a reader', () => {
  // A user-visible string saying "box lines" stops the review (ADR-0069).
  for (const entry of CARD_FACETS) {
    for (const text of [entry.label, entry.kicker, entry.title('Yelich')]) {
      assert.doesNotMatch(text, /box\s*lines/i, `"${text}" says the internal name`)
    }
  }
})

test('a hitter is offered no started/relief door, which would keep nothing', () => {
  // The hitting game log carries no gamesStarted, so `started` is null on
  // every hitter row and the facet would open an empty sheet.
  const hitting = cardFacetsFor('hitting')
  assert.equal(
    hitting.some((r) => r.facet.kind === 'started'),
    false,
  )
  assert.deepEqual(
    hitting.map((r) => r.sitCode),
    ['h', 'a', 'd', 'n'],
  )
  assert.deepEqual(
    cardFacetsFor('pitching').map((r) => r.sitCode),
    ['h', 'a', 'd', 'n', 'sp', 'rp'],
  )
  assert.deepEqual(cardFacetsFor('fielding'), [])
})

// A gated row as boxLineRows builds it, trimmed to what a facet reads.
function anyRow(over = {}) {
  return { date: '2024-07-04', gamePk: 1, home: true, started: true, dayNight: 'day', ...over }
}
