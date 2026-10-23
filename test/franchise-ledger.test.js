import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLedger, managersFor, postseasonFor, SEASON_NOTES, standingsFor } from '../scripts/lib/franchise/ledger.mjs'

// #2595: the ledger's pure half, on small fixtures shaped like the feeds.
const rec = (id, w, l, extra = {}) => ({ team: { id }, wins: w, losses: l, gamesBack: '-', divisionRank: '1', leagueRank: '1', runsScored: 700, runsAllowed: 600, ...extra })

test('standingsFor: wins, losses, games back as a number, ranks as numbers, runs', () => {
  const m = standingsFor([{ teamRecords: [rec(158, 64, 98, { gamesBack: '33.0', divisionRank: '6', leagueRank: '12', runsScored: 639, runsAllowed: 799 })] }])
  assert.deepEqual(m.get(158), { w: 64, l: 98, gb: 33, divisionRank: 6, leagueRank: 12, rs: 639, ra: 799 })
})

test('standingsFor: "-" is 0 games back, and no divisions (before 1969) leave divisionRank null', () => {
  const m = standingsFor([{ teamRecords: [rec(145, 83, 53, { divisionRank: null })] }])
  assert.equal(m.get(145).gb, 0)
  assert.equal(m.get(145).divisionRank, null)
  assert.equal(standingsFor(undefined).size, 0)
})

const game = (type, desc, away, home, awayWon, state = 'F') => ({
  gameType: type,
  seriesDescription: desc,
  status: { codedGameState: state },
  teams: { away: { team: { id: away }, isWinner: awayWon }, home: { team: { id: home }, isWinner: !awayWon } },
})

test('postseasonFor: the highest round a club reached and whether it won that series', () => {
  // 158 swept the LCS from 116, then lost the World Series to 138, 3-4.
  const lcs = [0, 1, 2].map(() => game('L', 'AL Championship Series', 158, 116, true))
  const ws = [
    ...[0, 1, 2].map(() => game('W', 'World Series', 158, 138, true)),
    ...[0, 1, 2, 3].map(() => game('W', 'World Series', 158, 138, false)),
  ]
  const m = postseasonFor([{ games: [...lcs, ...ws] }])
  assert.deepEqual(m.get(158), { round: 'World Series', won: false })
  assert.deepEqual(m.get(138), { round: 'World Series', won: true })
  assert.deepEqual(m.get(116), { round: 'AL Championship Series', won: false })
})

test('postseasonFor: a club that lost an earlier round reports that round; unfinished games do not count', () => {
  const dates = [{ games: [game('D', 'NL Division Series', 1, 2, true), game('D', 'NL Division Series', 1, 2, true), game('D', 'NL Division Series', 2, 1, true, 'S')] }]
  const m = postseasonFor(dates)
  assert.deepEqual(m.get(1), { round: 'NL Division Series', won: true })
  assert.deepEqual(m.get(2), { round: 'NL Division Series', won: false })
  assert.equal(postseasonFor(undefined).size, 0)
})

test('managersFor: managers and interims only, once per club-season, most games first', () => {
  const shards = [
    {
      byPersonId: {
        10: [{ teamId: 158, season: 1982, jobId: 'MNGR', record: { w: 95, l: 67 } }, { teamId: 158, season: 1982, jobId: 'MNGR', record: { w: 95, l: 67 } }],
        11: [{ teamId: 158, season: 1982, jobId: 'COAT' }, { teamId: 158, season: 1983, jobId: 'NTRM', sharedSeason: true }],
        9: [{ teamId: 158, season: 1982, jobId: 'NTRM', record: { w: 2, l: 1 } }],
      },
    },
  ]
  const m = managersFor(shards)
  assert.deepEqual(m.get('158-1982'), [{ id: 10, w: 95, l: 67 }, { id: 9, w: 2, l: 1 }])
  assert.deepEqual(m.get('158-1983'), [{ id: 11 }])
})

const spans = [
  { from: 1969, to: 1969, name: 'Seattle Pilots', league: 'American League' },
  { from: 1970, to: 1971, name: 'Milwaukee Brewers', league: 'American League' },
]
const standings = new Map([
  [1969, new Map([[158, { w: 64, l: 98, gb: 33, divisionRank: 6, leagueRank: 12, rs: 639, ra: 799 }]])],
  [1970, new Map([[158, { w: 65, l: 97, gb: 33, divisionRank: 4, leagueRank: 10, rs: 613, ra: 751 }]])],
  [1971, new Map([[158, { w: 69, l: 92, gb: 32, divisionRank: 6, leagueRank: 11, rs: 534, ra: 609 }]])],
])

test('buildLedger: a row per season, the span name and league, oldest first', () => {
  const rows = buildLedger({ teamId: 158, spans: [...spans].reverse(), through: 2025, standings, postseason: new Map(), managers: new Map(), names: new Map() })
  assert.deepEqual(rows.map((r) => [r.season, r.name, r.league, r.w, r.l]), [
    [1969, 'Seattle Pilots', 'American League', 64, 98],
    [1970, 'Milwaukee Brewers', 'American League', 65, 97],
    [1971, 'Milwaukee Brewers', 'American League', 69, 92],
  ])
  assert.equal(rows[0].gb, 33)
  assert.equal(rows[0].postseason, null)
})

test('buildLedger: managers carry names; a postseason result and a season note ride along', () => {
  const post = new Map([[1970, new Map([[158, { round: 'World Series', won: false }]])]])
  const notes = { 1970: 'a note' }
  const mgr = new Map([['158-1970', [{ id: 1, w: 65, l: 97 }]]])
  const rows = buildLedger({ teamId: 158, spans, through: 1971, standings, postseason: post, managers: mgr, names: new Map([[1, 'Dave Bristol']]), notes })
  assert.deepEqual(rows[1].managers, [{ id: 1, w: 65, l: 97, name: 'Dave Bristol' }])
  assert.deepEqual(rows[1].postseason, { round: 'World Series', won: false })
  assert.equal(rows[1].note, 'a note')
  assert.equal(rows[2].note, null)
})

test('buildLedger stops at `through`, and a season with no standings row throws', () => {
  assert.equal(buildLedger({ teamId: 158, spans, through: 1970, standings, postseason: new Map(), managers: new Map(), names: new Map() }).length, 2)
  assert.throws(() => buildLedger({ teamId: 158, spans, through: 1971, standings: new Map([[1969, standings.get(1969)]]), postseason: new Map(), managers: new Map(), names: new Map() }), /no standings row for club 158 in 1970/)
})

test('the odd seasons carry a note by default: 1981 split, 1994 strike, 2020 60 games', () => {
  assert.deepEqual(SEASON_NOTES, { 1981: 'split season', 1994: 'strike', 2020: '60-game season' })
})

// The reader and the real files (#2595). A fetch stub serves /data/ from public/data, so the test
// reads exactly what the app would.
const { readFileSync } = await import('node:fs')
const dataUrl = (p) => new URL(`../public${p}`, import.meta.url)
globalThis.fetch = async (url) => {
  const u = String(url)
  try {
    const body = readFileSync(dataUrl(u), 'utf8')
    return { ok: true, status: 200, headers: new Headers(), json: async () => JSON.parse(body), text: async () => body }
  } catch {
    return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' }
  }
}
const { franchiseLedger } = await import('../src/api/history/franchiseLedger.js')
const { ALL_MLB_TEAM_IDS } = await import('../src/lib/teams.js')

test('franchiseLedger(158): a row for every season 1969 to 2025; the 1969 and 2020 rows', async () => {
  const { through, rows } = await franchiseLedger(158)
  assert.equal(through, 2025)
  assert.deepEqual(rows.map((r) => r.season), Array.from({ length: 57 }, (_, i) => 1969 + i))
  const r69 = rows[0]
  assert.deepEqual([r69.name, r69.league, r69.w, r69.l, r69.gb, r69.rs, r69.ra], ['Seattle Pilots', 'American League', 64, 98, 33, 639, 799])
  const r20 = rows.find((r) => r.season === 2020)
  assert.deepEqual([r20.w, r20.l], [29, 31])
})

test('franchiseLedger(120): the 2000 row is the Expos, the 2005 row the Nationals', async () => {
  const { rows } = await franchiseLedger(120)
  assert.equal(rows.find((r) => r.season === 2000).name, 'Montreal Expos')
  assert.equal(rows.find((r) => r.season === 2005).name, 'Washington Nationals')
})

test('franchiseLedger(145): the first row is 1901, 83-53, American League', async () => {
  const [first] = (await franchiseLedger(145)).rows
  assert.deepEqual([first.season, first.w, first.l, first.league], [1901, 83, 53, 'American League'])
})

test('the 1982 Brewers lost the World Series; the 1994 rows have no postseason and a note', async () => {
  const { rows } = await franchiseLedger(158)
  assert.deepEqual(rows.find((r) => r.season === 1982).postseason, { round: 'World Series', won: false })
  const r94 = rows.find((r) => r.season === 1994)
  assert.equal(r94.postseason, null)
  assert.equal(r94.note, 'strike')
  for (const id of ALL_MLB_TEAM_IDS) {
    const row = (await franchiseLedger(id)).rows.find((r) => r.season === 1994)
    if (row) assert.deepEqual([row.postseason, row.note], [null, 'strike'], `club ${id}`)
  }
})

test('every row of every club agrees with franchise-history on name and league', async () => {
  for (const id of ALL_MLB_TEAM_IDS) {
    const { spans } = JSON.parse(readFileSync(dataUrl(`/data/franchise-history/${id}.json`), 'utf8'))
    const { rows } = await franchiseLedger(id)
    assert.ok(rows.length > 0, `club ${id}`)
    for (const r of rows) {
      const span = spans.find((s) => s.from <= r.season && r.season <= s.to)
      assert.deepEqual([r.name, r.league], [span.name, span.league], `club ${id} ${r.season}`)
    }
  }
})

test('franchiseLedger is empty, not an error, for a club with no file', async () => {
  assert.deepEqual(await franchiseLedger(999999), { through: null, rows: [] })
})
