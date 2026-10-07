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

test('a missing pitching split gives era null, not zero, and keeps avg', () => {
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(1, 4)], pitching: [] }), { avg: 0.25, era: null })
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(1, 4)] }), { avg: 0.25, era: null })
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
  assert.deepEqual(leagueAveragesOf({ hitting: [bat(0, 0)], pitching: [arm(30, '90.0')] }), { avg: null, era: 3 })
  assert.equal(leagueAveragesOf({}).avg, null)
})

// --- reader ---------------------------------------------------------------
const FILE = { lastSeason: 2025, seasons: { 1968: { avg: 0.237, era: 2.9 }, 1901: { avg: 0.267, era: null } } }
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
const { leagueAverage, lastCompleteSeason } = await import('../src/api/player/leagueAverages.js')

test('reader reads the file; a null figure stays null', async () => {
  assert.equal(await leagueAverage(1968, 'hitting'), 0.237)
  assert.equal(await leagueAverage(1968, 'pitching'), 2.9)
  assert.equal(await leagueAverage(1901, 'pitching'), null)
  assert.equal(await lastCompleteSeason(), 2025)
})

test('reader returns null for a season before the file and fetches nothing', async () => {
  assert.equal(await leagueAverage(1890, 'hitting'), null)
  assert.equal(liveCalls, 0)
})

test('the live season costs one request, cached for the session', async () => {
  assert.equal(await leagueAverage(2026, 'hitting'), 0.25)
  assert.equal(await leagueAverage(2026, 'pitching'), 3)
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
