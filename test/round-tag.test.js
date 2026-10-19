// The one round-tag table (src/lib/postseason/roundTag.js, ADR-0115): NLWC, ALDS, NLCS, and WS.
// It names the league from the club and the season, which every postseason row carries, so a
// surface with no league on the row (a ledger, a schedule, a Savant pitch) can still say it.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { CLUB_LEAGUES, clubLeague, roundName, roundTag } from '../src/lib/postseason/roundTag.js'
import { seriesAbbr } from '../src/api/boxlines/rows.js'
import { entriesFrom, gameRowsFor } from '../src/api/postseason/records.js'
import { lastAppearanceHeading } from '../src/lib/pitcherCard/card.js'
import { gamesOf } from '../src/screens/scout/meetings/meetings.js'

test('every club in the table has the league public/data/teams.json gives it now', () => {
  const teams = JSON.parse(fs.readFileSync(new URL('../public/data/teams.json', import.meta.url), 'utf8')).bySportId['1']
  const now = new Map(teams.map((t) => [t.id, t.leagueId === 103 ? 'AL' : 'NL']))
  assert.equal(CLUB_LEAGUES.length, 30)
  assert.equal(now.size, 30)
  for (const [id, league] of CLUB_LEAGUES) assert.equal(now.get(id), league, `club ${id}`)
})

test('a round below the World Series names its league; the World Series stays WS', () => {
  assert.equal(roundTag('F', 121, 2026), 'NLWC')
  assert.equal(roundTag('D', 147, 2026), 'ALDS')
  assert.equal(roundTag('L', 158, 2026), 'NLCS')
  assert.equal(roundTag('L', 111, 2026), 'ALCS')
  assert.equal(roundTag('W', 119, 2026), 'WS')
  assert.equal(roundTag('R', 119, 2026), '', 'a regular-season game has no tag')
})

test('the Astros were an NL club through 2012 and an AL club from 2013', () => {
  assert.equal(roundTag('L', 117, 2005), 'NLCS')
  assert.equal(roundTag('D', 117, 2012), 'NLDS')
  assert.equal(roundTag('D', 117, 2013), 'ALDS')
  assert.equal(roundTag('L', 117, 2017), 'ALCS')
  assert.equal(clubLeague(117), 'AL', 'with no season it is the club now')
})

test('the Brewers were an AL club through 1997 and an NL club from 1998', () => {
  assert.equal(clubLeague(158, 1997), 'AL')
  assert.equal(clubLeague(158, 1998), 'NL')
  assert.equal(roundTag('L', 158, 2018), 'NLCS')
})

test('a club or a season it cannot place gives the plain round, never a guessed league', () => {
  assert.equal(roundTag('D', 999999, 2026), 'DS')
  assert.equal(roundTag('L', null, 2026), 'LCS')
  assert.equal(roundTag('F', undefined, undefined), 'WC')
  assert.equal(roundTag('D', 'ZZZ', 2026), 'DS')
})

test('a club may be asked by its abbreviation, in any of the spellings the feeds use', () => {
  assert.equal(roundTag('D', 'ATH', 2026), 'ALDS')
  assert.equal(roundTag('D', 'OAK', 2019), 'ALDS')
  assert.equal(roundTag('L', 'LAD', 2026), 'NLCS')
  assert.equal(roundTag('L', 'AZ', 2026), 'NLCS')
  assert.equal(roundTag('L', 'ARI', 2023), 'NLCS')
  assert.equal(roundTag('D', 'CHW', 2008), 'ALDS')
  assert.equal(roundTag('L', 'HOU', '2005-10-18'), 'NLCS', 'a date is read for its year')
})

test('seriesAbbr is this table, so the two cannot drift', () => {
  for (const t of ['F', 'D', 'L', 'W', 'R', 'P', undefined]) {
    for (const lg of ['', 'AL', 'NL']) assert.equal(seriesAbbr(t, lg), roundName(t, lg), `${t} ${lg}`)
  }
})

// ---- the sites that print a tag ----

const ledgerGame = (over) => ({ d: '2005-10-18', o: 138, r: 'W', rs: 4, ra: 2, hi: 9, ha: 7, pk: 1, gt: 'L', sf: 1, ...over })
const ledgerEntry = (teamId, season, games) =>
  entriesFrom([{ id: teamId, name: 'Club' }], [{ season, clubs: { [teamId]: { teamId, leagueId: 103, games } } }])[0]

test('the postseason ledger names the league: its rows carry none, so the club and the year do', () => {
  const astros05 = ledgerEntry(117, 2005, [ledgerGame({ d: '2005-10-18', gt: 'L' }), ledgerGame({ d: '2005-10-26', gt: 'W', pk: 2 })])
  assert.deepEqual(
    gameRowsFor(astros05, 'scored-first').map((r) => r.series),
    ['WS', 'NLCS'],
  )
  const astros17 = ledgerEntry(117, 2017, [ledgerGame({ d: '2017-10-14', gt: 'L' }), ledgerGame({ d: '2017-10-05', gt: 'D', pk: 3 })])
  assert.deepEqual(
    gameRowsFor(astros17, 'scored-first').map((r) => r.series),
    ['ALCS', 'ALDS'],
  )
})

test('the pitcher card names the round with its league: "NLDS Gm 2"', () => {
  const last = { date: '2026-10-07', team: 'SD', teamId: 135, opponent: 'HOU', gameType: 'D', seriesGameNumber: 2, home: true, gameNumber: 1 }
  assert.equal(lastAppearanceHeading(last, 2026).round, 'NLDS Gm 2')
  assert.equal(lastAppearanceHeading({ ...last, teamId: null }, 2026).round, 'DS Gm 2', 'no club, no league')
  assert.equal(lastAppearanceHeading({ ...last, gameType: 'R' }, 2026).round, '')
})

test('a Scout meeting carries the tag its first plate appearance was given', () => {
  const [g] = gamesOf([{ gamePk: 5, date: '2024-10-09', round: 'D', roundTag: 'NLDS', atBat: 2 }, { gamePk: 5, date: '2024-10-09', round: 'D', roundTag: 'NLDS', atBat: 1 }])
  assert.equal(g.tag, 'NLDS')
  assert.equal(gamesOf([{ gamePk: 6, date: '2024-06-09', round: 'R', atBat: 1 }])[0].tag, '', 'no tag falls through to the old table')
})

test('every other site that prints a round asks this table', () => {
  const read = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
  assert.match(read('api/scout/headToHead.js'), /roundTag: roundTag\(r\.game_type, r\.home_team, r\.game_date\)/)
  assert.match(read('screens/scout/meetings/MeetingsPanel.jsx'), /g\.tag \|\| g\.label/)
  assert.match(read('screens/UmpirePage.jsx'), /roundTag\(g\.gameType, g\.homeId, g\.date\)/)
  assert.match(read('api/seasonSeries.js'), /roundTag\(g\.gameType, viewingTeamId, g\.apiDate\)/)
  assert.match(read('screens/player/next/modules/mound/moundView.js'), /roundName\(a\.t, clubLeague\(a\.o, a\.d\)\)/)
  // No surface keeps a table of its own: that is how six of them drifted apart.
  for (const f of ['api/seasonSeries.js', 'lib/pitcherCard/card.js', 'screens/UmpirePage.jsx', 'api/boxlines/rows.js']) {
    assert.doesNotMatch(read(f), /\{ F: 'WC', D: 'DS', L: 'LCS', W: 'WS'/, f)
  }
})
