import assert from 'node:assert/strict'
import test from 'node:test'
import { MIN_POOL, countedRows, hotColdFlags, mergeRoles, percentileOf, seasonsBeyond, weightOf } from '../src/api/hotcold/rule.js'
import { foldSeason, pack } from '../src/api/hotcold/line.js'
import { EXTREME_SHARE, buildExtremes, buildTails, lastCompletedSeason, quantile } from '../scripts/lib/season-checkpoints/tails.mjs'

// The hot and cold callouts' rule (#1855, slice 1). The league tails here are synthetic:
// each stat's 101 quantiles are a straight line centred on the NORMAL line below, so a
// normal season sits at the 50th percentile of every stat and the tests can say exactly
// which tail a made-up line falls in.

const lin = (lo, hi) => Array.from({ length: 101 }, (_, k) => lo + ((hi - lo) * k) / 100)
// `zeros` quantiles at 0, then a line up to `hi`: the crowded floor of a count stat.
const floor = (zeros, hi) => Array.from({ length: 101 }, (_, k) => (k < zeros ? 0 : (hi * (k - zeros + 1)) / (101 - zeros)))

const HIT_Q = { ops: lin(0.3, 0.7), avg: lin(0.15, 0.35), hr: floor(30, 0.08), so: lin(0.1, 0.4), bb: floor(20, 0.15), sb: floor(60, 0.5) }
const PITCH_Q = { era: lin(2, 7), whip: lin(0.9, 1.8), so: lin(0.14, 0.34), bb: lin(0.03, 0.13), hr: lin(0.01, 0.07) }
const table = (q, n = 500) => Object.fromEntries([10, 20, 30, 40, 50, 60, 90, 100].map((c) => [c, { n, q }]))
const TAILS = { hitting: table(HIT_Q), pitching: table(PITCH_Q) }

const day = (i) => `2026-04-${String(i + 1).padStart(2, '0')}`
// One hitter game: four at-bats, one single, one strikeout (AVG .250, OPS .500, K% .250).
const hitGame = (i, over = {}) => ({
  date: day(i), gameType: 'R',
  stat: { gamesPlayed: 1, plateAppearances: 4, atBats: 4, hits: 1, strikeOuts: 1, ...over },
})
const hitter = (n, over) => Array.from({ length: n }, (_, i) => hitGame(i, over))
// One start: six innings, 25 batters, six hits, two walks, six strikeouts, three earned
// runs, one home run (ERA 4.50, WHIP 1.33, K% .24).
const start = (i, over = {}) => ({
  date: day(i * 5), gameType: 'R',
  stat: { gamesPlayed: 1, inningsPitched: '6.0', battersFaced: 25, hits: 6, baseOnBalls: 2, strikeOuts: 6, earnedRuns: 3, homeRuns: 1, ...over },
})
const flags = (rows, role = 'hitting', extra = {}) =>
  hotColdFlags({ role, sportId: 1, rows, cutoff: '2026-10-20', tails: TAILS, ...extra })

test('a normal season shows no callout', () => {
  assert.deepEqual(flags(hitter(40)), [])
  assert.deepEqual(flags(Array.from({ length: 6 }, (_, i) => start(i)), 'pitching'), [])
})

test('an early cold start flags once per group, weighted early', () => {
  // Twelve games without a hit: AVG and OPS both hit the floor, but they say one thing,
  // so only OPS (listed first) takes a place.
  const out = flags(hitter(12, { hits: 0 }))
  assert.equal(out.length, 1)
  assert.deepEqual(
    { key: out[0].key, tone: out[0].tone, checkpoint: out[0].checkpoint, sample: out[0].sample, weight: out[0].weight },
    { key: 'ops', tone: 'cold', checkpoint: 10, sample: 12, weight: 'early' },
  )
  assert.equal(out[0].percentile, 0)
})

test('a tie in how unusual two stats are goes to the stat listed first', () => {
  // Every hit a home run: OPS and the home-run rate both sit past the top quantile
  // (extremity 0). AVG stays normal.
  const out = flags(hitter(45, { homeRuns: 1 }))
  assert.deepEqual(out.map((f) => [f.key, f.tone]), [['ops', 'hot'], ['hr', 'hot']])
  assert.equal(out[0].checkpoint, 40)
  assert.equal(out[0].weight, 'firm')
})

test('at most two callouts, the most unusual first', () => {
  // Hot OPS and HR at the very top, plus a high K% that is unusual but less so.
  const rows = hitter(100, { homeRuns: 1, strikeOuts: 2 })
  const out = flags(rows)
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((f) => f.key), ['ops', 'hr'])
  assert.equal(out[0].weight, 'real')
})

test('a crowd at zero is never a tail: no steals and no walks do not flag', () => {
  // The bottom tail of home runs and steals is closed, and a value tied with the bottom
  // fifth of the league answers the middle of the tie.
  assert.equal(percentileOf(0, HIT_Q.bb), 9.5)
  assert.deepEqual(flags(hitter(40, { baseOnBalls: 0, stolenBases: 0 })), [])
})

test('a pitcher is sized by innings', () => {
  // Six scoreless starts: 36 innings, read at the 30-inning checkpoint.
  const out = flags(Array.from({ length: 6 }, (_, i) => start(i, { earnedRuns: 0 })), 'pitching')
  assert.deepEqual(out.map((f) => [f.key, f.tone, f.checkpoint, f.sample]), [['era', 'hot', 30, 36]])
  // Under ten innings there is no checkpoint yet.
  assert.deepEqual(flags([start(0, { earnedRuns: 0 })], 'pitching'), [])
})

test('a MiLB player shows no callout', () => {
  assert.deepEqual(flags(hitter(45, { homeRuns: 1 }), 'hitting', { sportId: 11 }), [])
})

test('a game still in progress today does not count', () => {
  // Ten normal games, then today's game, live, with four home runs so far. Counted, it
  // would flag; held back, the line is normal.
  const rows = [...hitter(10), { date: '2026-10-20', gameType: 'R', stat: { gamesPlayed: 1, plateAppearances: 4, atBats: 4, hits: 4, homeRuns: 4 } }]
  assert.equal(countedRows(rows, '2026-10-20').length, 10)
  assert.deepEqual(flags(rows), [])
  assert.notDeepEqual(flags(rows, 'hitting', { cutoff: '2026-10-21' }), [])
})

test('postseason rows do not count toward the regular-season line', () => {
  const rows = [...hitter(30), ...hitter(5, { homeRuns: 1 }).map((r) => ({ ...r, gameType: 'F' }))]
  assert.equal(countedRows(rows, '2026-10-20').length, 30)
})

test('a bench hitter (under 3 PA a game) shows no callout', () => {
  assert.deepEqual(flags(hitter(40, { plateAppearances: 1, atBats: 1, hits: 1, homeRuns: 1, strikeOuts: 0 })), [])
})

test('a thin checkpoint falls back to the deepest one the pool fills', () => {
  const tails = { hitting: { ...table(HIT_Q), 40: { n: MIN_POOL - 1, q: HIT_Q } } }
  const out = hotColdFlags({ role: 'hitting', sportId: 1, rows: hitter(45, { homeRuns: 1 }), cutoff: '2026-10-20', tails })
  assert.equal(out[0].checkpoint, 30)
})

test('percentileOf interpolates between quantiles and clamps outside them', () => {
  const q = lin(0, 1)
  assert.equal(percentileOf(0.255, q), 25.5)
  assert.equal(percentileOf(-1, q), 0)
  assert.equal(percentileOf(2, q), 100)
  assert.equal(percentileOf(null, q), null)
})

test('weightOf: early under 30, real from 90', () => {
  assert.deepEqual([10, 29, 30, 89, 90].map(weightOf), ['early', 'early', 'firm', 'firm', 'real'])
})

test('foldSeason fills every checkpoint a big start jumps over', () => {
  const rows = [start(0, { inningsPitched: '9.0' }), start(1, { inningsPitched: '12.0' })]
  const { final, checkpoints } = foldSeason('pitching', rows)
  assert.equal(final.outs, 63)
  assert.deepEqual(Object.keys(checkpoints), ['10', '20'])
  assert.deepEqual(checkpoints[10], checkpoints[20])
})

test('buildTails pools in-pool lines at each checkpoint', () => {
  const line = (pa, h) => pack('hitting', { g: 10, pa, ab: pa, h, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, sf: 0, so: 0, sb: 0 })
  // MIN_POOL lines at .250 and MIN_POOL at .500, plus one bench line (10 PA in 10 games)
  // that stays out of the pool. A second checkpoint with one line is too thin to keep.
  const hitting = {}
  for (let i = 0; i < MIN_POOL; i++) {
    hitting[i] = { c: [line(40, 10)] }
    hitting[MIN_POOL + i] = { c: [line(40, 20)] }
  }
  hitting.bench = { c: [line(10, 10)] }
  hitting.thin = { c: [line(40, 10), line(40, 10)] }
  const tails = buildTails({ 2025: { hitting, pitching: {} } })
  assert.equal(tails.hitting[10].n, 2 * MIN_POOL + 1)
  assert.equal(tails.hitting[10].q.avg[0], 0.25)
  assert.equal(tails.hitting[10].q.avg[100], 0.5)
  assert.equal(tails.hitting[20], undefined)
})

test('quantile and the season window', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
  const row = { seasonId: '2026', regularSeasonEndDate: '2026-09-27' }
  assert.equal(lastCompletedSeason('2026-10-20', row), 2026)
  assert.equal(lastCompletedSeason('2026-09-20', row), 2025)
  assert.equal(lastCompletedSeason('2026-09-20', null), 2025)
})

test('mergeRoles: a two-way player still gets two places, the most unusual first', () => {
  const f = (key, percentile) => ({ key, percentile, extremity: Math.min(percentile, 100 - percentile) })
  const out = mergeRoles({ hitting: [f('ops', 97), f('hr', 99.5)], pitching: [f('era', 0.2)] })
  assert.deepEqual(out.map((x) => [x.role, x.key]), [['pitching', 'era'], ['hitting', 'hr']])
  // A tie goes to the role listed first.
  assert.deepEqual(mergeRoles({ hitting: [f('ops', 99)], pitching: [f('era', 1)] }).map((x) => x.role), ['hitting', 'pitching'])
})

test('seasonsBeyond: strictly further out, on the flag side, never his own season', () => {
  const stats = { era: {
    low: [[1.5, 10, 2018, 'A', 'Mets'], [1.9, 11, 2022, 'B', null], [2.0, 7, 2026, 'Me', 'Braves'], [2.16, 12, 2019, 'Tie', 'Dodgers'], [2.3, 13, 2020, 'C', 'Rays']],
    high: [[7.1, 14, 2021, 'D', null], [6.0, 15, 2023, 'E', null]],
  } }
  const flag = { key: 'era', value: 2.16, percentile: 1.9 }
  // 2.16 ties "Tie" (not better), and his own 2026 line sits in the pool and is left out.
  assert.deepEqual(seasonsBeyond(flag, stats, { id: 7, season: 2026 }).map((b) => [b.name, b.team]), [['A', 'Mets'], ['B', null]])
  // Someone else's 2026 counts.
  assert.deepEqual(seasonsBeyond(flag, stats, { id: 99, season: 2026 }).map((b) => b.name), ['A', 'B', 'Me'])
  // A high percentile reads the high side.
  assert.deepEqual(seasonsBeyond({ key: 'era', value: 6.5, percentile: 99 }, stats, { id: 7, season: 2026 }).map((b) => b.name), ['D'])
  assert.deepEqual(seasonsBeyond(flag, {}, { id: 7, season: 2026 }), [])
})

test('buildExtremes keeps the outer share of each side, most extreme first', () => {
  const line = (h) => pack('hitting', { g: 10, pa: 40, ab: 40, h, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, sf: 0, so: 0, sb: 0 })
  const hitting = {}
  for (let i = 0; i < 2 * MIN_POOL; i++) hitting[i + 1] = { n: `P${i + 1}`, c: [line(i % 20)], f: line(i % 20), ct: [135] }
  const out = buildExtremes({ 2025: { teams: { 135: 'Padres' }, hitting, pitching: {} } })
  const keep = Math.ceil(2 * MIN_POOL * EXTREME_SHARE)
  const avg = out.hitting[10].avg
  assert.equal(avg.high.length, keep)
  assert.equal(avg.low.length, keep)
  assert.equal(avg.high[0][0], 19 / 40)
  assert.equal(avg.low[0][0], 0)
  // A row is [value, id, season, name, team], the team named as it was that season.
  assert.deepEqual(avg.high[0].slice(2), [2025, avg.high[0][3], 'Padres'])
  // Home runs flag on the high side only, so only that side is kept.
  assert.deepEqual(Object.keys(out.hitting[10].hr), ['high'])
  // No season here reached a full season, so there is no 'full' pool.
  assert.equal(out.hitting.full, undefined)
})

test('buildExtremes: the full pool is final lines of seasons that reached a full season', () => {
  const at = (g, h) => pack('hitting', { g, pa: 4 * g, ab: 4 * g, h, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, sf: 0, so: 0, sb: 0 })
  const hitting = {}
  // MIN_POOL full seasons (155 G), plus one short season (120 G) with the best average.
  for (let i = 0; i < MIN_POOL; i++) hitting[i + 1] = { n: `P${i + 1}`, c: [], f: at(155, 100 + i) }
  hitting.short = { n: 'Short', c: [], f: at(120, 400) }
  const full = buildExtremes({ 2024: { hitting, pitching: {} } }).hitting.full
  assert.equal(full.avg.high[0][3], `P${MIN_POOL}`)
  assert.ok(!full.avg.high.some((r) => r[3] === 'Short'))
})

test('foldSeason names the club he played the most games for, at each checkpoint too', () => {
  // Ten games for the Padres, then twelve for the Yankees (a trade).
  const rows = [
    ...Array.from({ length: 10 }, (_, i) => ({ date: `2022-04-${String(i + 1).padStart(2, '0')}`, team: { id: 135 }, stat: { gamesPlayed: 1, plateAppearances: 4, atBats: 4 } })),
    ...Array.from({ length: 12 }, (_, i) => ({ date: `2022-08-${String(i + 1).padStart(2, '0')}`, team: { id: 147 }, stat: { gamesPlayed: 1, plateAppearances: 4, atBats: 4 } })),
  ]
  const { team, teams } = foldSeason('hitting', rows)
  assert.equal(team, 147)
  assert.equal(teams[10], 135)
  // At 20 games it is 10 and 10: the later club wins the tie.
  assert.equal(teams[20], 147)
})

test('a small crowd at the floor never flags: a reliever with 10 scoreless innings', () => {
  // The real pitching tails at 10 IP: the 0th to 4th ERA quantiles are 0.00 (about 4% of
  // 6,305 lines). 0.00 is in a crowd bigger than the 2% tail, so it is no tail at all.
  const era = [0, 0, 0, 0, 0, ...lin(0.69, 12).slice(5)]
  const tails = { pitching: { 10: { n: 6305, q: { ...PITCH_Q, era } } } }
  // Ordinary walk, strikeout and home-run rates, so ERA is the only stat that could flag.
  const reliever = Array.from({ length: 10 }, (_, i) => ({
    date: day(i), gameType: 'R',
    stat: { gamesPlayed: 1, inningsPitched: '1.0', battersFaced: 4, hits: 1, baseOnBalls: i < 3 ? 1 : 0, strikeOuts: 1, earnedRuns: 0, homeRuns: i < 2 ? 1 : 0 },
  }))
  const out = hotColdFlags({ role: 'pitching', sportId: 1, rows: reliever, cutoff: '2026-10-20', tails })
  assert.ok(!out.some((f) => f.key === 'era'), JSON.stringify(out.map((f) => f.key)))
})

test('from a full season on, the flag is ranked among full seasons (the same pool it is counted in)', () => {
  // The 160-inning table says 2.16 is ordinary; the full-season table (final lines) says
  // it is a 2% tail. The rule reads the full table.
  const tails = { pitching: { ...table(PITCH_Q), 160: { n: 500, q: PITCH_Q }, full: { n: 600, q: { ...PITCH_Q, era: lin(2.17, 7) } } } }
  const starts = Array.from({ length: 27 }, (_, i) => start(i, { inningsPitched: '6.0', earnedRuns: i % 7 === 0 ? 2 : 1 }))
  const out = hotColdFlags({ role: 'pitching', sportId: 1, rows: starts, cutoff: '2026-12-31', tails })
  const era = out.find((f) => f.key === 'era')
  assert.ok(era, 'flags against the full-season pool')
  assert.equal(era.pool, 600)
  assert.equal(era.checkpoint, 160)
})

test('seasonsBeyond answers null when every kept row is past him (the count would be cut off)', () => {
  const stats = { era: { low: [[1.5, 10, 2018, 'A', null], [1.9, 11, 2022, 'B', null]] } }
  assert.equal(seasonsBeyond({ key: 'era', value: 2.0, percentile: 1 }, stats, { id: 7, season: 2026 }), null)
})

test('buildTails: a full-season table from final lines, and no checkpoint table from 150 on', () => {
  const at = (g, h) => pack('hitting', { g, pa: 4 * g, ab: 4 * g, h, d: 0, t: 0, hr: 0, bb: 0, hbp: 0, sf: 0, so: 0, sb: 0 })
  const hitting = {}
  // MIN_POOL seasons that reach 155 games; c holds a line at every 10 games up to 150.
  for (let i = 0; i < MIN_POOL; i++) {
    hitting[i + 1] = { n: `P${i + 1}`, c: Array.from({ length: 15 }, (_, k) => at((k + 1) * 10, (k + 1) * 10)), f: at(155, 200 + i) }
  }
  const tails = buildTails({ 2024: { hitting, pitching: {} } })
  assert.equal(tails.hitting[140].n, MIN_POOL)
  assert.equal(tails.hitting[150], undefined)
  assert.equal(tails.hitting.full.n, MIN_POOL)
  // The full table reads final lines (200+ hits in 620 AB), not the 150-game cut (.250).
  assert.equal(tails.hitting.full.q.avg[0], Math.round((200 / 620) * 1e4) / 1e4)
})
