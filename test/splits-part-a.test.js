// Splits, part a (#1910): the season and career loaders, the All-scope merge, the reads
// helper beside splitsView, and the wide door cells. Live checks: Robert Gasser 688107
// (463 batters faced in the vs L/R baseline), Brice Turang 668930.
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCareerSplits, loadSeasonSplits } from '../src/api/boxlines/splitsLoad.js'
import { DOOR_COLUMNS, DOOR_COLUMNS_WIDE, doorCells, mergeCareerSplits } from '../src/api/boxlines/careerSplits.js'
import { SITUATIONAL_SIT_CODES, situationalSplitsView, splitReads, splitsView } from '../src/api/person.js'
import { pctOf } from '../src/lib/math/number.js'

// Gasser's vs L/R, as MLB returns them (2026, pitching): 139 + 324 = 463 batters faced.
const SIDE = {
  vl: { battersFaced: 139, atBats: 120, hits: 25, totalBases: 36, strikeOuts: 36, baseOnBalls: 12, hitByPitch: 3, sacFlies: 1, avg: '.208', obp: '.294', slg: '.300', ops: '.594' },
  vr: { battersFaced: 324, atBats: 290, hits: 80, totalBases: 120, strikeOuts: 75, baseOnBalls: 20, hitByPitch: 4, sacFlies: 2, avg: '.276', obp: '.329', slg: '.414', ops: '.743' },
}
const statFor = (code) => SIDE[code] ?? { battersFaced: 100, atBats: 90, hits: 20, totalBases: 30, avg: '.222', obp: '.300', slg: '.333', ops: '.633' }

// Every request the loaders make, answered with one row per sit code asked for.
function stubStatsApi(t, statOf = statFor) {
  const asked = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    asked.push(String(url))
    const codes = String(url).match(/sitCodes=([\w,]+)/)?.[1].split(',') ?? []
    const gameType = String(url).match(/gameType=(\w)/)?.[1]
    const splits = codes.map((code) => ({ split: { code }, stat: statOf(code, gameType) }))
    return { ok: true, status: 200, json: async () => ({ stats: [{ splits }] }) }
  })
  return asked
}

test('loadSeasonSplits: one request gives vl,vr and the situational set for the season asked', async (t) => {
  const asked = stubStatsApi(t)
  const splits = await loadSeasonSplits(688107, 'pitching', 2025)
  assert.equal(asked.length, 1)
  assert.match(asked[0], /stats=statSplits/)
  assert.match(asked[0], /season=2025/)
  for (const code of ['vl', 'vr', ...SITUATIONAL_SIT_CODES.split(',')]) assert.ok(asked[0].includes(code), code)
  assert.equal(splitsView(splits, 'pitching').all.count, 463)
  assert.equal(situationalSplitsView(splits, 'pitching').rows.length, 6)
})

test('loadCareerSplits: one career request feeds splitsView unchanged', async (t) => {
  const asked = stubStatsApi(t)
  const splits = await loadCareerSplits(688107, 'pitching')
  assert.equal(asked.length, 1)
  assert.match(asked[0], /stats=careerStatSplits/)
  assert.match(asked[0], /gameType=R/)
  for (const field of ['obp', 'slg', 'battersFaced', 'doubles', 'triples', 'rbi']) assert.ok(asked[0].includes(field), field)
  const view = splitsView(splits, 'pitching')
  assert.equal(view.all.count, 463)
  assert.equal(view.left.soPct, '26%')
  assert.equal(situationalSplitsView(splits, 'pitching').rows.length, 6)
})

test('loadCareerSplits, scope All: the postseason is a second request, merged per sit code', async (t) => {
  const asked = stubStatsApi(t, (code, gameType) => (gameType === 'P' ? { ...statFor(code), battersFaced: 10, atBats: 9, hits: 1, totalBases: 1, strikeOuts: 4 } : statFor(code)))
  const splits = await loadCareerSplits(688107, 'pitching', 'A')
  assert.deepEqual(asked.map((u) => u.match(/gameType=(\w)/)[1]).sort(), ['P', 'R'])
  assert.equal(splitsView(splits, 'pitching').all.count, 483)
  assert.equal(splitsView(splits, 'pitching').left.count, 149)
})

test('loadCareerSplits: a failed request is no rows, not a throw', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 500, json: async () => ({}) }))
  assert.deepEqual(await loadCareerSplits(688107, 'pitching'), [])
})

// Yelich's October, as MLB returns it, with the strikeouts MLB also sends.
const REG = { gamesPlayed: 16, plateAppearances: 68, atBats: 54, hits: 24, homeRuns: 2, baseOnBalls: 13, strikeOuts: 9, hitByPitch: 1, sacFlies: 0, totalBases: 34, doubles: 5, triples: 0, rbi: 12 }
const POST = { gamesPlayed: 26, plateAppearances: 116, atBats: 96, hits: 20, homeRuns: 2, baseOnBalls: 20, strikeOuts: 31, hitByPitch: 0, sacFlies: 0, totalBases: 29, doubles: 4, triples: 1, rbi: 9 }

test('the All merge also gives OBP, SLG, SO, BB, HR and PA, with the rates rebuilt from the parts', () => {
  const bat = mergeCareerSplits(REG, POST, 'hitting')
  assert.equal(bat.obp, '.424') // (44 hits + 33 BB + 1 HBP) / 184
  assert.equal(bat.slg, '.420') // 63 TB / 150 AB
  assert.equal(bat.ops, '.844')
  assert.deepEqual([bat.strikeOuts, bat.baseOnBalls, bat.homeRuns, bat.plateAppearances], [40, 33, 4, 184])
  assert.deepEqual([bat.doubles, bat.triples, bat.rbi], [9, 1, 21])
})

test('the All merge for a pitcher keeps the opponent line and the batters faced', () => {
  const arm = mergeCareerSplits({ ...REG, outs: 71, earnedRuns: 9, battersFaced: 90 }, { ...POST, outs: 459, earnedRuns: 65, battersFaced: 600 }, 'pitching')
  assert.equal(arm.battersFaced, 690)
  assert.equal(arm.obp, '.424')
  assert.equal(arm.inningsPitched, '176.2')
  assert.equal(arm.era, '3.77')
})

test('pctOf rounds half up and says null for an empty denominator', () => {
  assert.equal(pctOf(1, 8), 13) // 12.5
  assert.equal(pctOf(29, 200), 15) // 14.5, where (29 / 200) * 100 is 14.499999999999998
  assert.equal(pctOf(3, 0), null)
})

test('doors: a wide cell row adds OBP, SLG, K% and BB% after the five the card draws today', () => {
  const stat = { gamesPlayed: 80, plateAppearances: 8, avg: '.250', homeRuns: 2, ops: '.700', obp: '.300', slg: '.400', strikeOuts: 1, baseOnBalls: 1 }
  assert.deepEqual(doorCells(null, stat, 'hitting'), ['80', '8', '.250', '2', '.700'])
  assert.deepEqual(doorCells(null, stat, 'hitting', { wide: true }), ['80', '8', '.250', '2', '.700', '.300', '.400', '13%', '13%'])
  assert.deepEqual(DOOR_COLUMNS_WIDE.hitting, [...DOOR_COLUMNS.hitting, 'OBP', 'SLG', 'K%', 'BB%'])
  assert.deepEqual(DOOR_COLUMNS_WIDE.pitching, [...DOOR_COLUMNS.pitching, 'OBP', 'SLG', 'K%', 'BB%'])
})

test('doors: a pitcher\'s K% and BB% divide by batters faced; a games-only door stays empty', () => {
  const arm = { gamesPlayed: 30, inningsPitched: '50.0', era: '3.00', strikeOuts: 20, baseOnBalls: 5, battersFaced: 200, obp: '.290', slg: '.350' }
  assert.deepEqual(doorCells(null, arm, 'pitching', { wide: true }).slice(5), ['.290', '.350', '10%', '3%'])
  assert.deepEqual(doorCells({ lineKind: 'games' }, { gamesPlayed: 12 }, 'hitting', { wide: true }), ['12', ...Array(8).fill(null)])
  assert.equal(doorCells(null, { gamesPlayed: 3 }, 'hitting', { wide: true })[7], null, 'no plate appearances, no K%')
})

// The reads helper. Rows are { label, side } as the views build them; `all` is the baseline row.
const side = (opsNum, count) => ({ ops: opsNum.toFixed(3).replace(/^0/, ''), opsNum, count })
const base = side(0.8, 650)

test('reads: OPS delta against the baseline, best and weak flags, one line each (a hitter: higher is better)', () => {
  const [l, r] = splitReads([{ label: 'vs LHP', side: side(0.7, 250) }, { label: 'vs RHP', side: side(0.85, 400) }], { opsNum: 0.8, ops: '.800', count: 650 }, 'hitting')
  assert.deepEqual([l.delta, l.flag, l.thin], ['−.100', 'weak', false])
  assert.deepEqual([r.delta, r.flag, r.thin], ['+.050', 'best', false])
  assert.equal(r.read, 'vs RHP: .850 OPS, +.050 against .800 overall')
})

test('reads: for a pitcher the lower OPS against is the best', () => {
  const [l, r] = splitReads([{ label: 'vs LHB', side: side(0.594, 139) }, { label: 'vs RHB', side: side(0.743, 324) }], { opsNum: 0.7, ops: '.700', count: 463 }, 'pitching')
  assert.equal(l.flag, 'best')
  assert.equal(r.flag, 'weak')
  assert.equal(l.delta, '−.106')
})

test('reads: under 100 PA is thin, carries no flag and says so; a lone sound row has nothing to be best of', () => {
  const [thin, sound, other] = splitReads(
    [{ label: 'RISP', side: side(1.1, 99) }, { label: 'Empty', side: side(0.75, 300) }, { label: 'On', side: side(0.8, 100) }],
    base,
    'hitting',
  )
  assert.deepEqual([thin.thin, thin.flag], [true, null])
  assert.match(thin.read, /under 100 PA/)
  assert.deepEqual([sound.flag, other.flag], ['weak', 'best'], '100 PA is the first sound sample')
  const [lone] = splitReads([{ label: 'RISP', side: side(0.9, 150) }], base, 'hitting')
  assert.equal(lone.flag, null)
})

test('reads: a row with no line is missing, not thin', () => {
  const [gone] = splitReads([{ label: 'RISP', side: { ops: '—', opsNum: null, count: '—' } }], base, 'hitting')
  assert.deepEqual([gone.thin, gone.flag, gone.delta], [false, null, ''])
})

test('loadCareerSplits, scope All: a failed regular-season request is no rows, not the postseason alone', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) =>
    String(url).includes('gameType=R')
      ? { ok: false, status: 500, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ stats: [{ splits: [{ split: { code: 'vl' }, stat: statFor('vl') }] }] }) })
  assert.deepEqual(await loadCareerSplits(688107, 'pitching', 'A'), [])
})

test('reads: no baseline row gives no delta, and an equal gap carries no sign', () => {
  const [a] = splitReads([{ label: 'vs LHP', side: side(0.7, 250) }], null, 'hitting')
  assert.equal(a.delta, '')
  assert.equal(a.read, 'vs LHP: .700 OPS')
  const [b] = splitReads([{ label: 'vs LHP', side: side(0.8, 250) }], base, 'hitting')
  assert.equal(b.delta, '.000')
})
