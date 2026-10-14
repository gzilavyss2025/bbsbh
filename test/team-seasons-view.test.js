// teamSeasonsView: the per-season ledger behind the Team history card (#2006).
// Fixtures are real yearByYear rows (statsapi, 2026-10-14): Gasser 688107 and
// Turang 668930. Rows are [season, sportId, teamId, teamName, games, ip].
import assert from 'node:assert/strict'
import test from 'node:test'
import { teamSeasonsView } from '../src/api/person.js'

const rows = (list) =>
  list.map(([season, sid, id, name, g, ip]) => ({
    season: String(season), sport: { id: sid }, team: id ? { id, name } : {},
    stat: { gamesPlayed: g, ...(ip ? { inningsPitched: ip } : {}) },
  }))

const GASSER = rows([
  [2024, 1, 158, 'Milwaukee Brewers', 5, '28.0'], [2025, 1, 158, 'Milwaukee Brewers', 2, '5.2'],
  [2026, 1, 158, 'Milwaukee Brewers', 21, '109.1'],
  [2022, 11, 556, 'Nashville Sounds', 5, '26.1'], [2023, 11, 556, 'Nashville Sounds', 26, '135.1'],
  [2024, 11, 556, 'Nashville Sounds', 3, '12.0'], [2025, 11, 556, 'Nashville Sounds', 10, '32.0'],
  [2026, 11, 556, 'Nashville Sounds', 7, '26.2'],
  [2022, 12, 5015, 'Biloxi Shuckers', 4, '20.1'], [2022, 13, 584, 'Fort Wayne TinCaps', 18, '90.1'],
  [2025, 13, 572, 'Wisconsin Timber Rattlers', 3, '5.0'],
  [2021, 14, 103, 'Lake Elsinore Storm', 5, '14.0'], [2021, 16, 410, 'ACL Padres', 1, '1.0'],
  [2025, 16, 406, 'ACL Brewers', 1, '1.0'],
])
const TURANG = rows([
  [2023, 1, 158, 'Milwaukee Brewers', 137], [2024, 1, 158, 'Milwaukee Brewers', 155],
  [2025, 1, 158, 'Milwaukee Brewers', 156], [2026, 1, 158, 'Milwaukee Brewers', 151],
  [2021, 11, 556, 'Nashville Sounds', 44], [2022, 11, 556, 'Nashville Sounds', 131],
  [2023, 11, 556, 'Nashville Sounds', 15], [2021, 12, 5015, 'Biloxi Shuckers', 73],
  [2019, 13, 249, 'Carolina Mudcats', 47], [2019, 14, 572, 'Wisconsin Timber Rattlers', 82],
  [2018, 16, 406, 'AZL Brewers', 13], [2018, 16, 433, 'Helena Brewers', 29],
  [2018, 16, null, null, 42], // the team-less roll-up statsapi adds
])
// Padres farm clubs until the 2022 trade, Brewers after; MLB clubs are their own org.
const ORG = { 410: 135, 103: 135, 584: 135, 5015: 158, 556: 158, 572: 158, 406: 158, 249: 158, 433: 158 }
const orgOf = (id) => ORG[id] ?? null
const bySeason = (v) => Object.fromEntries(v.seasons.map((s) => [s.season, s]))

test('teamSeasonsView: Gasser — Padres affiliates flip to their parent, then Brewers', () => {
  const s = bySeason(teamSeasonsView(GASSER, 'pitching', 2024, orgOf))
  // 2021: 5 G at Elsinore clears the floor; the 1 G ACL Padres line does not.
  assert.deepEqual(s[2021].stints.map((x) => [x.teamId, x.orgId, x.level]), [[103, 135, 'A']])
  assert.deepEqual(s[2022].stints.map((x) => [x.teamId, x.orgId, x.level]), [
    [584, 135, 'A+'], [5015, 158, 'AA'], [556, 158, 'AAA'],
  ])
  assert.equal(s[2024].stints.length, 1, '3 G at Nashville in his debut year is under the floor')
  assert.deepEqual(s[2023].stints.map((x) => [x.teamId, x.orgId, x.level, x.rehab]), [[556, 158, 'AAA', false]])
  assert.deepEqual(s[2024].stints.map((x) => [x.teamId, x.orgId, x.rehab]), [[158, 158, false]])
})

test('teamSeasonsView: Gasser — post-debut stints under the rehab cap carry rehab, a real option-down does not', () => {
  const s = bySeason(teamSeasonsView(GASSER, 'pitching', 2024, orgOf))
  const rehab = (y) => s[y].stints.filter((x) => x.rehab).map((x) => x.teamId)
  assert.deepEqual(rehab(2025), [406, 572], 'ACL Brewers and Wisconsin are rehab, level order')
  assert.ok(s[2025].stints.some((x) => x.teamId === 556 && !x.rehab), '32 IP at Nashville is an option-down')
  assert.deepEqual(rehab(2026), [556], '26.2 IP is under the 30 IP cap')
  assert.equal(s[2025].stints.at(-1).teamId, 158, 'the MLB club closes the season')
})

test('teamSeasonsView: Turang — a pre-2020 climb, an explicit 2020 row, and a team-less roll-up ignored', () => {
  const v = teamSeasonsView(TURANG, 'hitting', 2023, orgOf)
  assert.deepEqual(v.seasons.map((x) => x.season), [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
  assert.deepEqual(v.seasons[2], { season: 2020, noSeason: true })
  const s = bySeason(v)
  assert.deepEqual(s[2018].stints.map((x) => x.teamId), [406, 433], 'no stint for the team-less row')
  assert.deepEqual(s[2021].stints.map((x) => x.level), ['AA', 'AAA'])
  assert.equal(teamSeasonsView(TURANG, 'hitting', 2023, orgOf).seasons.some((x) => x.rehab), false)
  // 2023 is his debut year: the 15 G sent down to Nashville is the ascent, not rehab.
  assert.deepEqual(s[2023].stints.map((x) => [x.teamId, x.rehab]), [[556, false], [158, false]])
})

test('teamSeasonsView: a player who played 2020 gets a normal row; nothing qualifying gives null', () => {
  const played = rows([[2019, 1, 158, 'Milwaukee Brewers', 20], [2020, 1, 158, 'Milwaukee Brewers', 20], [2021, 1, 158, 'Milwaukee Brewers', 20]])
  assert.equal(teamSeasonsView(played, 'hitting', 2019, orgOf).seasons[1].noSeason, undefined)
  assert.equal(teamSeasonsView([], 'hitting', null, orgOf), null)
  assert.equal(teamSeasonsView(rows([[2024, 11, 556, 'Nashville Sounds', 3]]), 'hitting', null, orgOf), null)
})

test('teamSeasonsView: an unresolved affiliate has orgId null; a 2020 gap needs seasons on both sides', () => {
  const only = rows([[2021, 11, 556, 'Nashville Sounds', 50]])
  assert.equal(teamSeasonsView(only, 'hitting', null).seasons[0].stints[0].orgId, null)
  assert.equal(teamSeasonsView(only, 'hitting', null).seasons.length, 1)
})

test('teamSeasonsView: no 2020 row for a big leaguer who sat 2020, and no row for a 0-game rehab split', () => {
  const mlbOnly = rows([[2019, 1, 158, 'Milwaukee Brewers', 20], [2021, 1, 158, 'Milwaukee Brewers', 20]])
  assert.deepEqual(teamSeasonsView(mlbOnly, 'hitting', 2019, orgOf).seasons.map((x) => x.season), [2019, 2021])
  const zero = rows([[2024, 1, 158, 'Milwaukee Brewers', 20], [2025, 11, 556, 'Nashville Sounds', 0]])
  assert.deepEqual(teamSeasonsView(zero, 'hitting', 2024, orgOf).seasons.map((x) => x.season), [2024])
})
