import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildHof, inducteesFrom, seasonsByTeam } from '../scripts/lib/franchise/hof.mjs'

// #2597: the pure half on small fixtures shaped like the feeds, then the reader on the real files.
const award = (id, name, season, team) => ({ season: String(season), player: { id, nameFirstLast: name }, ...(team ? { team: { id: team } } : {}) })
const split = (season, team, sport = 1) => ({ season: String(season), team: team ? { id: team } : undefined, sport: { id: sport } })
const person = (...splits) => ({ stats: [{ group: { displayName: 'pitching' }, splits }] })

test('inducteesFrom: id, name, induction year and club, oldest first; a missing team stays null', () => {
  const rows = inducteesFrom([award(2, 'B Two', 2004, 158), award(1, 'A One', 1999, 158), award(3, 'C Exec', 2011), { season: '2000', player: {} }])
  assert.deepEqual(rows, [
    { id: 1, name: 'A One', year: 1999, teamId: 158 },
    { id: 2, name: 'B Two', year: 2004, teamId: 158 },
    { id: 3, name: 'C Exec', year: 2011, teamId: null },
  ])
  assert.deepEqual(inducteesFrom(undefined), [])
})

test('seasonsByTeam: major-league seasons per club, sorted, once, skipping a split with no team', () => {
  const p = {
    stats: [
      { splits: [split(1981, 158), split(1982, 158), split(1980, 135), split(1982, undefined)] },
      { splits: [split(1982, 158), split(1984, 158), split(1979, 999, 11)] },
    ],
  }
  const m = seasonsByTeam(p)
  assert.deepEqual(m.get(158), [1981, 1982, 1984])
  assert.deepEqual(m.get(135), [1980])
  assert.equal(m.has(999), false)
  assert.equal(seasonsByTeam(undefined).size, 0)
})

test('buildHof: inducted as one club, also played for others, and not repeated under his own', () => {
  const recipients = inducteesFrom([award(10, 'Fingers', 1992, 133)])
  const careers = new Map([[10, person(split(1968, 133), split(1977, 135), split(1981, 158), split(1982, 158), split(1984, 158))]])
  const hof = buildHof({ recipients, careers, clubIds: [133, 135, 158] })
  assert.deepEqual(hof.get(133).inductedAs, [{ id: 10, name: 'Fingers', year: 1992 }])
  assert.deepEqual(hof.get(133).alsoPlayed, [])
  assert.deepEqual(hof.get(158).alsoPlayed, [{ id: 10, name: 'Fingers', year: 1992, seasons: [1981, 1982, 1984] }])
  assert.deepEqual(hof.get(158).inductedAs, [])
  assert.deepEqual(hof.get(135).alsoPlayed[0].seasons, [1977])
})

test('buildHof: a recipient with no team or no stats does not stop the run, and plays nowhere he did not', () => {
  const recipients = inducteesFrom([award(1, 'Exec', 2011), award(2, 'Old Timer', 1977, 14), award(3, 'Player', 2000, 158)])
  const careers = new Map([[2, person(split(1920, 14), split(1925, 112))], [3, person(split(1990, 158))]])
  const hof = buildHof({ recipients, careers, clubIds: [112, 158] })
  assert.deepEqual(hof.get(158).inductedAs.map((r) => r.id), [3])
  assert.deepEqual(hof.get(112).alsoPlayed.map((r) => r.id), [2]) // inducted as club 14 (not written), played for 112
  assert.deepEqual(hof.get(158).alsoPlayed, [])
})

test('buildHof: alsoPlayed runs by first season with the club, then name', () => {
  const recipients = inducteesFrom([award(1, 'Zed', 2000, 1), award(2, 'Abe', 2001, 1), award(3, 'Moe', 2002, 1)])
  const careers = new Map([[1, person(split(1950, 158))], [2, person(split(1950, 158))], [3, person(split(1940, 158))]])
  const list = buildHof({ recipients, careers, clubIds: [158] }).get(158).alsoPlayed.map((r) => r.name)
  assert.deepEqual(list, ['Moe', 'Abe', 'Zed'])
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
const { hallOfFamersFor } = await import('../src/api/history/franchiseHof.js')
const { ALL_MLB_TEAM_IDS } = await import('../src/lib/teams.js')

test('hallOfFamersFor(158).inductedAs is exactly Robin Yount (1999) and Paul Molitor (2004)', async () => {
  const { inductedAs } = await hallOfFamersFor(158)
  assert.deepEqual(inductedAs.map((r) => [r.name, r.year]), [['Robin Yount', 1999], ['Paul Molitor', 2004]])
})

test('hallOfFamersFor(158).alsoPlayed lists Rollie Fingers with his Brewers years, not Yount or Molitor', async () => {
  const { alsoPlayed } = await hallOfFamersFor(158)
  const fingers = alsoPlayed.find((r) => r.name === 'Rollie Fingers')
  assert.equal(fingers.id, 114129)
  assert.deepEqual(fingers.seasons.filter((y) => y >= 1981), fingers.seasons)
  assert.ok(fingers.seasons.includes(1981) && fingers.seasons.includes(1985))
  assert.equal(alsoPlayed.some((r) => ['Robin Yount', 'Paul Molitor'].includes(r.name)), false)
})

test('no player is in a club\'s inductedAs and its alsoPlayed; seasons are sorted years', async () => {
  for (const id of ALL_MLB_TEAM_IDS) {
    const { inductedAs, alsoPlayed } = await hallOfFamersFor(id)
    const as = new Set(inductedAs.map((r) => r.id))
    for (const r of alsoPlayed) {
      assert.equal(as.has(r.id), false, `club ${id} ${r.name}`)
      assert.ok(r.seasons.length > 0 && r.seasons.every((y, i) => y >= 1871 && (i === 0 || y > r.seasons[i - 1])), `club ${id} ${r.name}`)
    }
  }
})

test('hallOfFamersFor is empty, not an error, for a club with no file', async () => {
  assert.deepEqual(await hallOfFamersFor(999999), { inductedAs: [], alsoPlayed: [] })
})
