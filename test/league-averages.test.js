// League averages: the pure half (src/lib/math/leagueAverages.js), the reader
// (src/api/player/leagueAverages.js) and the file the generator ships.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { leagueAveragesOf } from '../src/lib/math/leagueAverages.js'

const bat = (hits, atBats) => ({ stat: { hits, atBats } })
const arm = (earnedRuns, inningsPitched, runs = earnedRuns) => ({ stat: { earnedRuns, inningsPitched, runs } })

test('avg is sum(H) / sum(AB), never a mean of team averages', () => {
  // Team averages .250 and .300 would average to .275; the weighted answer is .286.
  const { avg } = leagueAveragesOf({ hitting: [bat(100, 400), bat(300, 1000)], pitching: [] })
  assert.equal(avg, 0.286)
})

test('era is 9 * sum(ER) / sum(IP) with IP in thirds', () => {
  // 100.1 IP = 301 outs, 200.2 IP = 602 outs. 27 * 150 / 903 = 4.485.
  assert.equal(leagueAveragesOf({ hitting: [], pitching: [arm(50, '100.1'), arm(100, '200.2')] }).era, 4.49)
  // "9.2" is 29 outs, not 9.2 innings: 27 * 3 / 29 = 2.793.
  assert.equal(leagueAveragesOf({ hitting: [], pitching: [arm(3, '9.2')] }).era, 2.79)
})

// The extra rates of the Advanced card (#2003); all null when the feed has no source.
const NO_RATES = { k: null, bb: null, kbb: null, bbk: null, iso: null, babip: null, ppa: null, ops: null }

test('a missing pitching split gives era null, not zero, and keeps avg', () => {
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(1, 4)], pitching: [] }), { avg: 0.25, era: null, ...NO_RATES })
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(1, 4)] }), { avg: 0.25, era: null, ...NO_RATES })
})

test('a season with no earned runs recorded (1901 feed) is null, not 0.00', () => {
  assert.equal(leagueAveragesOf({ hitting: [], pitching: [arm(0, '1158.0'), arm(0, '1100.0')] }).era, null)
})

test('earned runs far below runs (1925 feed: 4,789 ER of 18,659 R) is null, not 1.37', () => {
  assert.equal(leagueAveragesOf({ pitching: [arm(4789, '13000.0', 18659)] }).era, null)
  // A normal season: ER about 88% of R.
  assert.equal(leagueAveragesOf({ pitching: [arm(880, '2640.0', 1000)] }).era, 3)
})

test('a missing hitting split gives avg null', () => {
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(0, 0)], pitching: [arm(30, '90.0')] }), { avg: null, era: 3, ...NO_RATES })
  assert.equal(leagueAveragesOf({}).avg, null)
})

// Two clubs, summed by hand. Hitting: PA 1000, SO 220, BB 90, H 230, TB 380, AB 900,
// HR 30, SF 10, pitches 3800. Pitching (the opponents): AB 900, H 220, BB 95, HBP 8, SF 9, TB 350.
const club = (stat) => ({ stat })
const hit = [
  club({ plateAppearances: 400, strikeOuts: 100, baseOnBalls: 40, hits: 90, totalBases: 150, atBats: 360, homeRuns: 10, sacFlies: 4, numberOfPitches: 1500 }),
  club({ plateAppearances: 600, strikeOuts: 120, baseOnBalls: 50, hits: 140, totalBases: 230, atBats: 540, homeRuns: 20, sacFlies: 6, numberOfPitches: 2300 }),
]
const pit = [
  club({ atBats: 500, hits: 120, baseOnBalls: 50, hitByPitch: 4, sacFlies: 5, totalBases: 190, inningsPitched: '100.0', earnedRuns: 40, runs: 45 }),
  club({ atBats: 400, hits: 100, baseOnBalls: 45, hitByPitch: 4, sacFlies: 4, totalBases: 160, inningsPitched: '80.0', earnedRuns: 35, runs: 40 }),
]

test('the Advanced card rates are weighted league sums, rounded at the end', () => {
  const r = leagueAveragesOf({ hitting: hit, pitching: pit })
  assert.equal(r.k, 0.22) // 220 / 1000
  assert.equal(r.bb, 0.09) // 90 / 1000
  assert.equal(r.kbb, 0.13) // K% - BB%
  assert.equal(r.bbk, 0.41) // 90 / 220 = 0.409
  assert.equal(r.iso, 0.167) // (380 - 230) / 900
  assert.equal(r.babip, 0.303) // (230 - 30) / (900 - 220 - 30 + 10) = 0.303
  assert.equal(r.ppa, 3.8) // 3800 / 1000
  // OBP (220+95+8)/(900+95+8+9) = 0.3191, SLG 350/900 = 0.3889 -> 0.708
  assert.equal(r.ops, 0.708)
})

test('a rate with no source is null: no PA, no pitch count, no total bases', () => {
  const r = leagueAveragesOf({ hitting: [club({ hits: 90, atBats: 360 })], pitching: [] })
  for (const key of Object.keys(NO_RATES)) assert.equal(r[key], null, key)
  // Pitches missing leaves the other rates alone.
  const noPitches = leagueAveragesOf({ hitting: [club({ ...hit[0].stat, numberOfPitches: undefined })] })
  assert.equal(noPitches.ppa, null)
  assert.ok(noPitches.k > 0)
})

test('pitch counts on part of the clubs: P/PA divides by the PA of those clubs only', () => {
  const r = leagueAveragesOf({ hitting: [club({ plateAppearances: 400, numberOfPitches: 1500 }), club({ plateAppearances: 600 }), club({ plateAppearances: 500, numberOfPitches: 1 })] })
  assert.equal(r.ppa, 3.75)
})

test('opponent OPS skips clubs whose total bases are missing or stray (a 1959 club has 12 TB on 1,384 H)', () => {
  const stray = club({ atBats: 5000, hits: 1300, baseOnBalls: 400, hitByPitch: 30, sacFlies: 30, totalBases: 12 })
  assert.equal(leagueAveragesOf({ pitching: [...pit, stray, club({ atBats: 5000, hits: 1300 })] }).ops, leagueAveragesOf({ pitching: pit }).ops)
})

test('a club counting under 3 pitches a PA is left out of P/PA (1975-79 count about 1.5)', () => {
  assert.equal(leagueAveragesOf({ hitting: [club({ plateAppearances: 400, numberOfPitches: 1500 }), club({ plateAppearances: 600, numberOfPitches: 900 })] }).ppa, 3.75)
  assert.equal(leagueAveragesOf({ hitting: [club({ plateAppearances: 600, numberOfPitches: 900 })] }).ppa, null)
})

test('K-BB% goes negative when walks outnumber strikeouts', () => {
  const r = leagueAveragesOf({ hitting: [club({ plateAppearances: 1000, strikeOuts: 90, baseOnBalls: 100 })] })
  assert.equal(r.kbb, -0.01)
})

// --- reader ---------------------------------------------------------------
const FILE = { lastSeason: 2025, seasons: { 1968: { avg: 0.237, era: 2.9, k: 0.158 }, 1901: { avg: 0.267, era: null } } }
const live = {
  stats: [
    { group: { displayName: 'hitting' }, splits: [bat(50, 200)] },
    { group: { displayName: 'pitching' }, splits: [arm(30, '90.0')] },
  ],
}
let liveCalls = 0
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/data/league-averages.json')) return { ok: true, json: async () => FILE }
  liveCalls += 1
  return { ok: true, json: async () => live }
}
const { leagueAverage, leagueRates, lastCompleteSeason } = await import('../src/api/player/leagueAverages.js')

test('reader reads the file; a null figure stays null', async () => {
  assert.equal(await leagueAverage(1968, 'hitting'), 0.237)
  assert.equal(await leagueAverage(1968, 'pitching'), 2.9)
  assert.equal(await leagueAverage(1901, 'pitching'), null)
  assert.equal(await lastCompleteSeason(), 2025)
})

test('leagueRates hands back the whole row, or null', async () => {
  assert.equal((await leagueRates(1968)).k, 0.158)
  assert.equal(await leagueRates(1890), null)
})

test('reader returns null for a season before the file and fetches nothing', async () => {
  assert.equal(await leagueAverage(1890, 'hitting'), null)
  assert.equal(liveCalls, 0)
})

test('the live season costs one request, cached for the session', async () => {
  assert.equal(await leagueAverage(2026, 'hitting'), 0.25)
  assert.equal(await leagueAverage(2026, 'pitching'), 3)
  assert.equal(liveCalls, 1)
  assert.equal((await leagueRates(2026)).avg, 0.25)
  assert.equal(liveCalls, 1)
})

// --- shipped file ---------------------------------------------------------
test('the shipped file has no clock, starts in 1901 and stays small', () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'league-averages.json')
  const text = readFileSync(path, 'utf8')
  const file = JSON.parse(text)
  assert.ok(!('generatedAt' in file))
  assert.ok(file.seasons['1901'])
  assert.ok(file.seasons[file.lastSeason])
  assert.ok(text.length < 20_000)
  // Every rate that is set is a real league figure (a partial feed once shipped OPS .32 and P/PA 2.2).
  const range = { k: [0.03, 0.3], bb: [0.05, 0.15], bbk: [0.2, 2], iso: [0.05, 0.25], babip: [0.24, 0.34], ppa: [3, 4.5], ops: [0.55, 0.95] }
  for (const [year, row] of Object.entries(file.seasons)) {
    for (const [key, [lo, hi]] of Object.entries(range)) {
      assert.ok(row[key] === null || (row[key] >= lo && row[key] <= hi), `${year} ${key} ${row[key]}`)
    }
  }
})

// --- the table cell -------------------------------------------------------
const { vsLeague } = await import('../src/api/player/leagueAverages.js')

test('vsLeague prints a signed gap: .000 for AVG, 0.00 for ERA, a dash when either side is missing', () => {
  assert.equal(vsLeague('.282', 0.248, 'hitting'), '+.034')
  assert.equal(vsLeague('.236', 0.248, 'hitting'), '-.012')
  assert.equal(vsLeague('3.48', 3.9, 'pitching'), '-0.42')
  assert.equal(vsLeague('4.31', 3.9, 'pitching'), '+0.41')
  assert.equal(vsLeague('.248', 0.248, 'hitting'), '.000')
  assert.equal(vsLeague('—', 0.248, 'hitting'), '—')
  assert.equal(vsLeague('.282', null, 'hitting'), '—')
  assert.equal(vsLeague('-.--', 3.9, 'pitching'), '—')
})
