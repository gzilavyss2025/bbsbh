import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATEGORIES, buildClubLeaders, leadersFrom } from '../scripts/lib/franchise/leaders.mjs'

// #2596: the pure half on small fixtures shaped like stats/leaders, then the reader on the real files.
const row = (rank, id, name, value, season) => ({ rank, value, person: { id, fullName: name }, ...(season ? { season } : {}) })

test('leadersFrom: rank, id, name and value, in the feed order', () => {
  const rows = leadersFrom([{ leaders: [row(1, 460075, 'Ryan Braun', '352'), row(2, 124721, 'Robin Yount', '251')] }])
  assert.deepEqual(rows, [
    { rank: 1, id: 460075, name: 'Ryan Braun', value: '352' },
    { rank: 2, id: 124721, name: 'Robin Yount', value: '251' },
  ])
})

test('leadersFrom: a single-season row carries its season as a number; ties are kept', () => {
  const rows = leadersFrom([{ leaders: [row(1, 1, 'A', '50', '2007'), row(3, 2, 'B', '45', '2003'), row(3, 2, 'B', '45', '2001'), row(3, 3, 'C', '45', '1979')] }])
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0], { rank: 1, id: 1, name: 'A', value: '50', season: 2007 })
  assert.deepEqual(rows.slice(1).map((r) => [r.rank, r.season]), [[3, 2003], [3, 2001], [3, 1979]])
})

test('leadersFrom: a missing or empty answer is an empty list; a rate keeps its string', () => {
  assert.deepEqual(leadersFrom(undefined), [])
  assert.deepEqual(leadersFrom([{ leaders: [] }]), [])
  assert.equal(leadersFrom([{ leaders: [row(1, 1, 'A', '.298')] }])[0].value, '.298')
  assert.equal(leadersFrom([{ leaders: [row(1, 1, 'A', 3.1)] }])[0].value, '3.1')
})

test('the 26 categories: 15 hitting and 11 pitching, unique keys, the pitcher strikeouts apart', () => {
  assert.equal(CATEGORIES.length, 26)
  assert.equal(CATEGORIES.filter((c) => c.group === 'hitting').length, 15)
  assert.equal(new Set(CATEGORIES.map((c) => c.key)).size, 26)
  assert.deepEqual(CATEGORIES.filter((c) => c.category === 'strikeouts').map((c) => [c.group, c.key]), [['hitting', 'strikeouts'], ['pitching', 'pitchingStrikeouts']])
})

test('buildClubLeaders: sorted into career and season by category order, whatever order the answers came', () => {
  const a = (type, key, rows) => ({ type, key, leagueLeaders: [{ leaders: rows }] })
  const answers = [
    a('season', 'wins', [row(1, 9, 'Z', '20', '1978')]),
    a('career', 'wins', [row(1, 8, 'Y', '100')]),
    a('career', 'homeRuns', [row(1, 7, 'X', '300')]),
  ]
  const shard = buildClubLeaders({ teamId: 158, through: 2025, answers })
  assert.deepEqual(Object.keys(shard.career), ['homeRuns', 'wins'])
  assert.equal(shard.season.wins[0].season, 1978)
  assert.equal(JSON.stringify(shard), JSON.stringify(buildClubLeaders({ teamId: 158, through: 2025, answers: [...answers].reverse() })))
})

// The reader and the real files. A fetch stub serves /data/ from public/data.
globalThis.fetch = async (url) => {
  try {
    const body = readFileSync(new URL(`../public${url}`, import.meta.url), 'utf8')
    return { ok: true, status: 200, headers: new Headers(), json: async () => JSON.parse(body), text: async () => body }
  } catch {
    return { ok: false, status: 404, headers: new Headers(), json: async () => ({}), text: async () => '' }
  }
}
const { franchiseLeaders } = await import('../src/api/history/franchiseLeaders.js')
const { ALL_MLB_TEAM_IDS } = await import('../src/lib/teams.js')

test('franchiseLeaders(158): career home runs lead with Ryan Braun, 352', async () => {
  const { career } = await franchiseLeaders(158)
  assert.deepEqual([career.homeRuns[0].name, career.homeRuns[0].value], ['Ryan Braun', '352'])
})

test('franchiseLeaders(158): season home runs lead with Prince Fielder, 50, 2007; stolen bases with Tommy Harper, 73, 1969', async () => {
  const { season } = await franchiseLeaders(158)
  assert.deepEqual([season.homeRuns[0].name, season.homeRuns[0].value, season.homeRuns[0].season], ['Prince Fielder', '50', 2007])
  assert.deepEqual([season.stolenBases[0].name, season.stolenBases[0].value, season.stolenBases[0].season], ['Tommy Harper', '73', 1969])
  // ties are kept: Sexson (2003), Sexson (2001) and Thomas (1979) share third with 45
  assert.equal(season.homeRuns.filter((r) => r.rank === 3).length, 3)
})

test('every list of every club carries id, name and value; a single-season row carries its season', async () => {
  for (const teamId of ALL_MLB_TEAM_IDS) {
    const d = await franchiseLeaders(teamId)
    assert.equal(Object.keys(d.career).length, 26, `club ${teamId} career`)
    assert.equal(Object.keys(d.season).length, 26, `club ${teamId} season`)
    for (const [type, lists] of [['career', d.career], ['season', d.season]]) {
      for (const [key, rows] of Object.entries(lists)) {
        // a qualified rate list can run short: Tampa Bay and Toronto have 8 in a few career rate lists
        assert.ok(rows.length >= 8, `club ${teamId} ${type} ${key}`)
        for (const r of rows) {
          assert.ok(r.id > 0 && r.name && r.value !== '', `club ${teamId} ${type} ${key}`)
          assert.equal(type === 'season', Number.isInteger(r.season), `club ${teamId} ${type} ${key}`)
        }
      }
    }
  }
})

test('the batter and the pitcher strikeout lists are different lists', async () => {
  const { career } = await franchiseLeaders(158)
  assert.notEqual(career.strikeouts[0].id, career.pitchingStrikeouts[0].id)
})

test('franchiseLeaders is empty, not an error, for a club with no file', async () => {
  assert.deepEqual(await franchiseLeaders(999999), { through: null, career: {}, season: {} })
})
