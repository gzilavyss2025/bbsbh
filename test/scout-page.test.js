// The Matchup Scout page's pure parts (#1410): its address, the pickers' role
// filter, the switch hitter's stance, the pitcher board, and the head-to-head
// labels. The region geometry is test/scout-regions.test.js; the Savant
// request and its cutoff are test/scout-head-to-head.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRoute } from '../src/lib/route.js'
import { scoutPath } from '../src/lib/scout/path.js'
import { canHit, canPitch, stanceFor } from '../src/lib/scout/roles.js'
import { ROUND_TAG, resultShort } from '../src/lib/scout/format.js'
import { MAX_TYPES, USAGE_FLOOR, boardRow, mapOf, pitcherBoard } from '../src/screens/scout/board.js'
import { MIN_COMMAND_PITCHES } from '../src/api/commandMap.js'
import { expectedAll, expectedOn, hitterMap, hitterSide, metricsFor, sumCounters } from '../src/screens/scout/hitterBoard.js'

const skubal = { id: 669373, name: 'Tarik Skubal' }
const judge = { id: 592450, name: 'Aaron Judge' }

test('a Scout address round-trips through scoutPath and parseRoute', () => {
  const path = scoutPath({ pitcher: skubal, hitter: judge, view: 'hitter', scope: 'post', pitch: 'SL', hand: 'L', metric: 'whiff', d: '2026-09-01' })
  assert.equal(path, '/scout/tarik-skubal-669373/aaron-judge-592450?view=hitter&scope=post&pitch=SL&hand=L&metric=whiff&d=2026-09-01')
  assert.deepEqual(parseRoute(path), {
    name: 'scout', pitcherId: '669373', hitterId: '592450', asOf: '2026-09-01', view: 'hitter', scope: 'post', pitch: 'SL', hand: 'L', metric: 'whiff',
  })
})

test('defaults are never written, and an unknown value falls back', () => {
  assert.equal(scoutPath({ pitcher: skubal, hitter: judge, view: 'pitcher', scope: 'all' }), '/scout/tarik-skubal-669373/aaron-judge-592450')
  assert.equal(scoutPath({ pitcher: skubal }), '/scout')
  const r = parseRoute('/scout/a-1/b-2?view=sideways&scope=spring&pitch=slider&hand=S&metric=ops&d=2026-02-30')
  assert.deepEqual([r.view, r.scope, r.pitch, r.hand, r.metric, r.asOf], [null, 'all', null, null, null, null])
  assert.equal(parseRoute('/scout').name, 'scout')
  assert.notEqual(parseRoute('/scout/only-one-1').name, 'scout')
})

test('the pitcher box lists pitchers, the hitter box everyone else, and a two-way player is in both', () => {
  const pitcher = { posCode: '1' }
  const fielder = { posCode: '9' }
  const twoWay = { posCode: 'Y' }
  assert.deepEqual([pitcher, fielder, twoWay].map(canPitch), [true, false, true])
  assert.deepEqual([pitcher, fielder, twoWay].map(canHit), [false, true, true])
})

test('a switch hitter stands opposite the pitcher’s hand; a one-sided hitter keeps his side', () => {
  assert.equal(stanceFor('S', 'R'), 'L')
  assert.equal(stanceFor('S', 'L'), 'R')
  assert.equal(stanceFor('L', 'R'), 'L')
  assert.equal(stanceFor('R', 'L'), 'R')
  assert.equal(stanceFor('S', ''), null)
  assert.equal(stanceFor('', 'R'), null)
})

// A pitch-arsenal shard and a pitch-command shard for one invented arm (id 1),
// shaped like public/data/pitch-arsenal and pitch-command: `vs` pairs and
// 25-cell counters by batter side, the regular season under `pit` and, when
// `post` is given, the postseason under `post` (ADR-0094).
function stores(pitchesByCode, post = null) {
  const cells = (n) => Array.from({ length: 25 }, (_, i) => (i === 12 ? n : 0))
  const part = (byCode, velo) => ({
    arsenal: { 1: { mlb: Object.entries(byCode).map(([code, n]) => ({ code, pitches: n, avgVelo: velo, vs: { R: [n, velo] } })) } },
    command: { 1: { mlb: Object.fromEntries(Object.entries(byCode).map(([code, n]) => [code, { R: { cells: cells(n) } }])) } },
  })
  const reg = part(pitchesByCode, 90)
  const pst = post && part(post, 96)
  return {
    arsenal: { pit: reg.arsenal, ...(pst && { post: pst.arsenal }) },
    command: { pit: reg.command, ...(pst && { post: pst.command }) },
  }
}

test('a type under the usage floor gets no pill but still counts in All; at most MAX_TYPES pills', () => {
  const { arsenal, command } = stores({ FF: 500, SL: 300, CH: 150, CU: 40, SI: 10 })
  const b = pitcherBoard({ arsenal, command, pitcherId: 1, stance: 'R' })
  assert.ok(b.types.every((t) => Number(t.pct) >= USAGE_FLOOR))
  assert.deepEqual(b.types.map((t) => t.code), ['FF', 'SL', 'CH'])
  assert.equal(b.all.n, 1000, 'All pools every type, pill or not')
  assert.equal(b.byType.SL.n, 300)
  const many = stores(Object.fromEntries(['FF', 'SI', 'SL', 'CH', 'CU', 'FC', 'ST', 'KC'].map((c) => [c, 100])))
  assert.equal(pitcherBoard({ ...many, pitcherId: 1, stance: 'R' }).types.length, MAX_TYPES)
})

test('no stores for this stance is "Not posted", never an empty map', () => {
  const { arsenal, command } = stores({ FF: 500 })
  assert.equal(pitcherBoard({ arsenal, command, pitcherId: 1, stance: 'L' }), null)
  assert.equal(pitcherBoard({ arsenal: null, command, pitcherId: 1, stance: 'R' }), null)
})

test('Scope picks the maps’ pitches; a pitcher with no postseason pitches has no postseason map', () => {
  const both = stores({ FF: 300, SL: 100 }, { FF: 20, SL: 20 })
  const at = (scope) => pitcherBoard({ ...both, pitcherId: 1, stance: 'R', scope })
  assert.equal(at('reg').all.n, 400)
  assert.equal(at('post').all.n, 40)
  assert.equal(at('all').all.n, 440)
  // Velocity across the two parts weighs each by its pitches: (300*90 + 20*96) / 320.
  assert.equal(at('all').types.find((t) => t.code === 'FF').mph, '90.4')
  // The sweep writes `post` into a bucket only when one of its pitchers threw
  // in the postseason (bucketsOf), so a bucket with no `post` is a real empty
  // postseason, never an old shard: Postseason is "Not posted", All is regular.
  const regOnly = stores({ FF: 300, SL: 100 })
  assert.equal(pitcherBoard({ ...regOnly, pitcherId: 1, stance: 'R', scope: 'post' }), null)
  assert.equal(pitcherBoard({ ...regOnly, pitcherId: 1, stance: 'R', scope: 'all' }).all.n, 400)
})

test('a map under the pitch floor prints counts only, never a share', () => {
  const thin = mapOf([Array.from({ length: 25 }, (_, i) => (i === 12 ? MIN_COMMAND_PITCHES - 1 : 0))])
  assert.equal(thin.thin, true)
  assert.ok(Object.values(thin.cells).every((c) => c.tone === 'gray' && c.value === undefined))
  assert.equal(thin.cells.r2c2.count, MIN_COMMAND_PITCHES - 1)
  const full = mapOf([Array.from({ length: 25 }, (_, i) => (i === 12 ? 60 : i === 0 ? 40 : 0))])
  assert.deepEqual([full.cells.r2c2.value, full.cells.high.value, full.cells.r2c2.tone], ['60', '40', 's4'])
})

test('the head-to-head labels: round tags and scorebook shorthand, an out read from its batted ball', () => {
  assert.deepEqual(['R', 'F', 'D', 'L', 'W'].map((g) => ROUND_TAG[g]), ['REG', 'WC', 'DS', 'LCS', 'WS'])
  assert.equal(resultShort({ event: 'strikeout' }), 'K')
  assert.equal(resultShort({ event: 'field_out', bbType: 'ground_ball' }), 'GO')
  assert.equal(resultShort({ event: 'field_out', bbType: 'popup' }), 'PO')
  assert.equal(resultShort({ event: 'force_out' }), 'Out')
})

test('a knuckle curve or slow curve reads the hitter’s curveball row, and says so', () => {
  const line = { CU: { pa: 50 }, FF: { pa: 90 } }
  assert.deepEqual(boardRow(line, 'KC'), { row: { pa: 50 }, as: 'CU' })
  assert.deepEqual(boardRow(line, 'CS'), { row: { pa: 50 }, as: 'CU' })
  assert.deepEqual(boardRow(line, 'FF'), { row: { pa: 90 }, as: null })
  assert.deepEqual(boardRow(line, 'SL'), { row: null, as: null })
  assert.deepEqual(boardRow(null, 'KC'), { row: null, as: 'CU' })
})

// --- the hitter board (#1411, phase 2), on the hitter-grid store (ADR-0096) ---

const at12 = (n) => Array.from({ length: 25 }, (_, i) => (i === 12 ? n : 0))
// One region's counters: the heart (r2c2) only, in the store's fields.
const counters = ({ pitches, swings, whiffs, paEnd }) => ({
  pitches: at12(pitches), swings: at12(swings), whiffs: at12(whiffs), paEnd: at12(paEnd), wobaFixed: at12(0),
})
// A store entry: { mlb: { [code]: { [pitcherHand]: { [stand]: counters } } } }.
const entry = (byCode) => ({ mlb: byCode })

test('sumCounters adds the parts, and keeps wobaSum only when every part has it', () => {
  const a = { ...counters({ pitches: 10, swings: 5, whiffs: 2, paEnd: 3 }), wobaSum: at12(1.2) }
  const b = { ...counters({ pitches: 20, swings: 8, whiffs: 4, paEnd: 6 }), wobaSum: null }
  const both = sumCounters([a, b])
  assert.equal(both.pitches[12], 30)
  assert.equal(both.wobaSum, null)
  assert.ok(Math.abs(sumCounters([a, a]).wobaSum[12] - 2.4) < 1e-9)
  assert.equal(sumCounters([]), null)
})

test('the xwOBA (est.) metric is off while the store carries no estimate', () => {
  const grid = { season: 2026, reg: entry({ FF: { R: { R: counters({ pitches: 1, swings: 1, whiffs: 0, paEnd: 1 }) } } }), post: null }
  assert.deepEqual(metricsFor(grid), ['whiff', 'swing'])
  assert.deepEqual(metricsFor(null), ['whiff', 'swing'])
})

test('the hitter map pools the asked hand and scope, hatches under the floor, and bands against the league for his stance', () => {
  const grid = {
    season: 2026,
    reg: entry({ SL: { R: { R: counters({ pitches: 40, swings: 20, whiffs: 10, paEnd: 8 }) }, L: { R: counters({ pitches: 10, swings: 4, whiffs: 0, paEnd: 2 }) } } }),
    post: entry({ SL: { R: { R: counters({ pitches: 5, swings: 3, whiffs: 3, paEnd: 1 }) } } }),
  }
  // The league's left-handed hitters whiff far more: a right-handed hitter is
  // read against right-handed hitters only.
  const league = {
    season: 2026,
    reg: entry({ SL: {
      R: { R: counters({ pitches: 1000, swings: 500, whiffs: 150, paEnd: 270 }), L: counters({ pitches: 1000, swings: 500, whiffs: 400, paEnd: 270 }) },
      L: { R: counters({ pitches: 500, swings: 250, whiffs: 75, paEnd: 135 }) },
    } }),
    post: null,
  }
  const reg = hitterMap({ grid, league, codes: ['SL'], hand: null, stand: 'R', scope: 'reg', metric: 'whiff' })
  assert.equal(reg.seen, 50)
  assert.ok(Math.abs(reg.hit.r2c2.value - 10 / 24) < 1e-9)
  // 41.7% against the right-handed league's 30% in the same region: more than 10 points above.
  assert.equal(reg.cells.r2c2.tone, 'hi2')
  assert.equal(reg.cells.r2c2.value, '42')
  assert.ok(Math.abs(reg.leagueFlat - 0.3) < 1e-9, 'the flat league rate is its whole-type sum, for his stance')
  // A region with no swings is under the floor: hatched, count only.
  assert.deepEqual(reg.cells.r1c1, { tone: 'gray', count: 0 })
  // vs R only, regular season plus postseason: 23 swings, 13 whiffs.
  const rAll = hitterMap({ grid, league, codes: ['SL'], hand: 'R', stand: 'R', scope: 'all', metric: 'whiff' })
  assert.equal(rAll.hit.r2c2.n, 23)
  // Postseason alone: 3 swings, under the floor of 10.
  const post = hitterMap({ grid, league, codes: ['SL'], hand: 'R', stand: 'R', scope: 'post', metric: 'whiff' })
  assert.equal(post.hit.r2c2.value, null)
  assert.equal(post.typeVal, null)
  // The store has no xwOBA estimate yet: no xwOBA map at all.
  assert.equal(hitterMap({ grid, league, codes: ['SL'], hand: 'R', stand: 'R', scope: 'reg', metric: 'xwoba' }), null)
  // A pitch type he never saw: no map.
  assert.equal(hitterMap({ grid, league, codes: ['CH'], hand: null, stand: 'R', scope: 'reg', metric: 'whiff' }), null)
})

test('the expected value joins the two maps, and the overall line weighs each pitch by its usage', () => {
  const hitter = { hit: { ...Object.fromEntries(['high', 'r2c2'].map((r) => [r, { value: null }])) }, typeVal: 0.3 }
  hitter.hit.r2c2 = { value: 0.5 }
  const share = { r2c2: 0.6, high: 0.4 }
  const full = Object.fromEntries(['high', 'low', 'side3b', 'side1b', 'r1c1', 'r1c2', 'r1c3', 'r2c1', 'r2c2', 'r2c3', 'r3c1', 'r3c2', 'r3c3']
    .map((r) => [r, share[r] ?? 0]))
  const hit = Object.fromEntries(Object.keys(full).map((r) => [r, hitter.hit[r] ?? { value: null }]))
  assert.ok(Math.abs(expectedOn({ thin: false, share: full }, { hit, typeVal: 0.3 }) - (0.6 * 0.5 + 0.4 * 0.3)) < 1e-9)
  assert.equal(expectedOn({ thin: true, share: full }, { hit, typeVal: 0.3 }), null, 'a thin pitcher map gives no expected value')
  const types = [{ code: 'FF', pct: '60' }, { code: 'SL', pct: '30' }, { code: 'CH', pct: '10' }]
  const all = expectedAll(types, { FF: { exp: 0.4, league: 0.32 }, SL: { exp: 0.25, league: 0.3 }, CH: null })
  assert.ok(Math.abs(all.value - (60 * 0.4 + 30 * 0.25) / 90) < 1e-9)
  assert.ok(Math.abs(all.covered - 0.9) < 1e-9)
})

test('the hitter side joins each pill and All to the pitcher board, and the overall line covers what it can score', () => {
  const board = pitcherBoard({ ...stores({ FF: 600, SL: 400 }), pitcherId: 1, stance: 'R' })
  assert.deepEqual(board.codes.sort(), ['FF', 'SL'], 'All pools every type the command store holds')
  const ff = counters({ pitches: 100, swings: 50, whiffs: 10, paEnd: 20 })
  const sl = counters({ pitches: 80, swings: 40, whiffs: 20, paEnd: 15 })
  const grid = { season: 2026, reg: entry({ FF: { R: { R: ff } }, SL: { R: { R: sl } } }), post: null }
  const league = { season: 2026, reg: entry({ FF: { R: { R: counters({ pitches: 1000, swings: 500, whiffs: 100, paEnd: 250 }) } } }), post: null }
  const side = hitterSide({ board, grid, league, hand: 'R', stand: 'R', scope: 'reg', metric: 'whiff' })
  // Every pitch sits in the heart, so each expected value is the heart's rate.
  assert.ok(Math.abs(side.byType.FF.exp - 0.2) < 1e-9)
  assert.ok(Math.abs(side.byType.SL.exp - 0.5) < 1e-9)
  assert.ok(Math.abs(side.all.exp - 30 / 90) < 1e-9, 'All pools the hitter’s swings on both types')
  assert.ok(Math.abs(side.byType.FF.league - 0.2) < 1e-9)
  assert.equal(side.byType.SL.league, null, 'no league row for the type: no league figure')
  // 60% fastballs at .200, 40% sliders at .500.
  assert.ok(Math.abs(side.overall.value - (60 * 0.2 + 40 * 0.5) / 100) < 1e-9)
  assert.equal(side.overall.covered, 1)
  assert.equal(side.overall.league, null, 'one type with no league figure: no overall league figure')
  // No grid: no hitter side, and the page keeps its Phase 1 line.
  assert.equal(hitterSide({ board, grid: null, league, hand: 'R', stand: 'R', scope: 'reg', metric: 'whiff' }), null)
  // A type the hitter never saw: no map for it, and the overall line covers the rest.
  const fastOnly = hitterSide({ board, grid: { ...grid, reg: entry({ FF: { R: { R: ff } } }) }, league, hand: 'R', stand: 'R', scope: 'reg', metric: 'whiff' })
  assert.equal(fastOnly.byType.SL, null)
  assert.ok(Math.abs(fastOnly.overall.covered - 0.6) < 1e-9)
  assert.ok(Math.abs(fastOnly.overall.value - 0.2) < 1e-9)
})
