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
import { POSTSEASON } from '../src/api/boxlines/rows.js'

const GROUPS = ['hitting', 'pitching']

test('no door narrows the game log or pins an opponent', () => {
  // Either of those is the club facet's shape, and the club facet costs a fetch
  // of its own. A door on this card must be answerable from a join the other
  // doors are already paying for.
  for (const entry of CARD_FACETS) {
    const plan = facetPlan(entry.facet)
    assert.equal(plan.narrowsSplits, false, `${entry.key} must not narrow the game log`)
    assert.equal(plan.opponentId, null, `${entry.key} must not pin an opponent`)
  }
})

test('a door either filters rows or moves the game types — never neither', () => {
  // Two shapes, and a door must resolve to exactly one of them. A typo in a
  // `kind` resolves to a keep-nothing predicate, which reads as the first shape
  // here and is caught by the discrimination test below instead.
  for (const entry of CARD_FACETS) {
    const plan = facetPlan(entry.facet)
    const filters = typeof plan.keep === 'function'
    const moves = Array.isArray(plan.gameTypes)
    assert.notEqual(filters, moves, `${entry.key} must do one of the two, not both or neither`)
  }
})

test('each row-filtering door keeps a matching row and drops its opposite', () => {
  // The real check that a kind is understood: it must actually discriminate.
  const cases = {
    home: [{ home: true }, { home: false }],
    road: [{ home: false }, { home: true }],
    day: [{ dayNight: 'day' }, { dayNight: 'night' }],
    night: [{ dayNight: 'night' }, { dayNight: 'day' }],
    started: [{ started: true }, { started: false }],
    relief: [{ started: false }, { started: true }],
  }
  for (const entry of CARD_FACETS) {
    const { keep } = facetPlan(entry.facet)
    if (!keep) continue
    const pair = cases[entry.key]
    assert.ok(pair, `${entry.key} filters rows but this test has no case for it`)
    assert.equal(keep(anyRow(pair[0])), true, `${entry.key} should keep its own row`)
    assert.equal(keep(anyRow(pair[1])), false, `${entry.key} should drop the other`)
  }
})

test('the postseason door asks for the four rounds, and never the umbrella P', () => {
  // The one door whose rows are not regular season. It discriminates in the
  // game types rather than in a predicate, so this is its discrimination test.
  // 'P' selects the same games but comes back as every PITCHING row's type,
  // which the type filter then drops — see rows.js.
  const post = CARD_FACETS.find((r) => r.key === 'postseason')
  assert.ok(post, 'the postseason door is missing')
  const plan = facetPlan(post.facet)
  assert.deepEqual(plan.gameTypes, POSTSEASON)
  assert.equal(plan.gameTypes.includes('P'), false)
  assert.equal(plan.gameTypes.includes('R'), false)
})

test('a key appears once: it is the React key and the label key both', () => {
  const keys = CARD_FACETS.map((r) => r.key)
  assert.ok(keys.every(Boolean), 'every door needs a key')
  assert.equal(new Set(keys).size, keys.length)
})

test('every door names exactly one source for its label', () => {
  // careerSplits.js reads one of two: a situation code (all of them share one
  // call) or a career under a game type (one call each). A door naming neither
  // renders no label and so never renders at all; one naming both would take
  // whichever the reader happened to write first.
  for (const entry of CARD_FACETS) {
    const sources = [entry.sitCode, entry.careerGameType].filter(Boolean)
    assert.equal(sources.length, 1, `${entry.key} names ${sources.length} label sources`)
  }
})

test('every door is drawable: a label, a kicker, and a title of the player', () => {
  for (const entry of CARD_FACETS) {
    assert.ok(entry.label, `${entry.key} needs a label`)
    assert.ok(entry.kicker.startsWith('Game lines · '), `${entry.key} kicker: ${entry.kicker}`)
    assert.equal(typeof entry.title, 'function', `${entry.key} needs a title`)
    assert.ok(entry.title('Yelich').includes('Yelich'))
    assert.ok(entry.groups.length && entry.groups.every((g) => GROUPS.includes(g)))
  }
})

test('"Box Lines" is the internal name and never reaches a reader', () => {
  // A user-visible string saying "box lines" stops the review (ADR-0069).
  for (const entry of CARD_FACETS) {
    for (const text of [entry.label, entry.kicker, entry.title('Yelich'), entry.footNote ?? '']) {
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
    hitting.map((r) => r.key),
    ['home', 'road', 'day', 'night', 'postseason'],
  )
  assert.deepEqual(
    cardFacetsFor('pitching').map((r) => r.key),
    ['home', 'road', 'day', 'night', 'started', 'relief', 'postseason'],
  )
  assert.deepEqual(cardFacetsFor('fielding'), [])
})

// A gated row as boxLineRows builds it, trimmed to what a facet reads.
function anyRow(over = {}) {
  return { date: '2024-07-04', gamePk: 1, home: true, started: true, dayNight: 'day', ...over }
}
