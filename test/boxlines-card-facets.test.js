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
import { CARD_FACETS, cardFacetsFor, SECTIONS } from '../src/api/boxlines/cardFacets.js'
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
    // The eight months (#999). A door keyed m4 must keep an April game and
    // drop a May one, which is also what catches an entry whose `sitCode` and
    // `facet.month` drifted apart -- the one way a table-built family can go
    // wrong that a hand-written entry cannot.
    m3: [{ date: '2024-03-28' }, { date: '2024-04-01' }],
    m4: [{ date: '2024-04-30' }, { date: '2024-05-01' }],
    m5: [{ date: '2024-05-01' }, { date: '2024-04-30' }],
    m6: [{ date: '2024-06-15' }, { date: '2024-07-15' }],
    m7: [{ date: '2024-07-04' }, { date: '2024-08-04' }],
    m8: [{ date: '2024-08-04' }, { date: '2024-07-04' }],
    m9: [{ date: '2024-09-15' }, { date: '2024-10-01' }],
    m10: [{ date: '2024-10-01' }, { date: '2024-09-30' }],
    // The seven weekdays (#1001). 2026-09-02 is a Wednesday and 2026-08-30 a
    // Sunday, in every timezone the suite may run in: the helpers read the
    // string rather than building a local-midnight Date.
    w0: [{ date: '2026-08-30' }, { date: '2026-09-02' }],
    w1: [{ date: '2026-08-31' }, { date: '2026-09-02' }],
    w2: [{ date: '2026-09-01' }, { date: '2026-09-02' }],
    w3: [{ date: '2026-09-02' }, { date: '2026-09-03' }],
    w4: [{ date: '2026-09-03' }, { date: '2026-09-02' }],
    w5: [{ date: '2026-09-04' }, { date: '2026-09-02' }],
    w6: [{ date: '2026-09-05' }, { date: '2026-09-02' }],
    // Off the bench (#1002): the positions he played, in the order he played
    // them. A start that later moved to left field is not a pinch-hit game.
    pinchHit: [{ positions: ['PH'] }, { positions: ['DH', 'LF'] }],
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
  // every hitter row and the facet would open an empty sheet. A hitter's
  // started/entered reads the schedule's lineups instead, and is #1003's other
  // half, not shipped here.
  const hitting = cardFacetsFor('hitting')
  assert.equal(
    hitting.some((r) => r.facet.kind === 'started'),
    false,
  )
  const CALENDAR = ['m3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6']
  assert.deepEqual(
    hitting.map((r) => r.key),
    ['home', 'road', 'day', 'night', ...CALENDAR, 'pinchHit', 'postseason'],
  )
  assert.deepEqual(
    cardFacetsFor('pitching').map((r) => r.key),
    ['home', 'road', 'day', 'night', ...CALENDAR, 'started', 'relief', 'postseason'],
  )
  assert.deepEqual(cardFacetsFor('fielding'), [])
})

test('a pitcher is offered no pinch-hitting door', () => {
  // `positions` is null on a pitcher's rows -- the hitting game log is the only
  // one that carries positionsPlayed -- so the facet would keep nothing.
  assert.equal(
    cardFacetsFor('pitching').some((r) => r.facet.kind === 'pinchHit'),
    false,
  )
})

test('every door files under a heading the card draws', () => {
  // The card groups by SECTIONS, not by the registry's order, so a door with an
  // unknown section would simply never render -- silently, the way an unknown
  // facet kind would open an empty sheet.
  const known = new Set(SECTIONS.map((s) => s.key))
  for (const entry of CARD_FACETS) {
    assert.ok(known.has(entry.section), `${entry.key} files under "${entry.section}"`)
  }
  // And every heading earns its place: a section with no door would draw a rule
  // and a word over nothing.
  for (const section of SECTIONS) {
    assert.ok(
      CARD_FACETS.some((r) => r.section === section.key),
      `the "${section.title}" heading has no doors`,
    )
    assert.ok(section.title, `${section.key} needs a title`)
  }
})

test('a chip names itself short, and only the weekdays are chips', () => {
  // A chip's visible text is `short`; `label` stops being visible and goes on
  // being the sheet's headline. One without a `short` would render an empty
  // chip rather than fail.
  for (const entry of CARD_FACETS) {
    if (!entry.chip) {
      assert.equal(entry.short, undefined, `${entry.key} is not a chip but names a short form`)
      continue
    }
    assert.ok(entry.short, `${entry.key} is a chip and needs a short name`)
    assert.ok(entry.short.length <= 4, `${entry.key} short name "${entry.short}" will not fit a chip`)
    assert.equal(entry.facet.kind, 'weekday', `${entry.key} is a chip but is not a weekday`)
  }
  assert.equal(CARD_FACETS.filter((r) => r.chip).length, 7)
})

test('the month and weekday doors are a complete set, each numbered once', () => {
  // Built from a table rather than written out fifteen times, so the thing to
  // pin is that the table is whole: March through October, Sunday through
  // Saturday, no number twice and none missing.
  const months = CARD_FACETS.filter((r) => r.facet.kind === 'month').map((r) => r.facet.month)
  assert.deepEqual(months, [3, 4, 5, 6, 7, 8, 9, 10])
  const days = CARD_FACETS.filter((r) => r.facet.kind === 'weekday').map((r) => r.facet.day)
  assert.deepEqual(days, [0, 1, 2, 3, 4, 5, 6])
  // The situation code and the facet must name the SAME month. They come from
  // one table row, and this is what says the row was read in the right order.
  for (const entry of CARD_FACETS.filter((r) => r.facet.kind === 'month')) {
    assert.equal(entry.sitCode, String(entry.facet.month), `${entry.key} asks MLB for a different month`)
  }
})

// A gated row as boxLineRows builds it, trimmed to what a facet reads.
function anyRow(over = {}) {
  return {
    date: '2024-07-04',
    gamePk: 1,
    home: true,
    started: true,
    dayNight: 'day',
    positions: ['LF'],
    ...over,
  }
}
