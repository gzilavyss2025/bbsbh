// The Team history module's pure view (src/screens/player/next/modules/teams/teamsView.js, #2019).
import test from 'node:test'
import assert from 'node:assert/strict'
import { teamSeasonsView } from '../src/api/person.js'
import { relativeLine, shortName, teamsView } from '../src/screens/player/next/modules/teams/teamsView.js'

const row = (season, id, name, sportId, g, ip) => ({
  season: String(season),
  team: { id, name },
  sport: { id: sportId },
  stat: { gamesPlayed: g, ...(ip ? { inningsPitched: ip } : {}) },
})

// Robert Gasser's year-by-year splits, live 2026-10-14 (pitching; debut 2024).
const gasser = [
  row(2024, 158, 'Milwaukee Brewers', 1, 5, '28.0'),
  row(2025, 158, 'Milwaukee Brewers', 1, 2, '5.2'),
  row(2026, 158, 'Milwaukee Brewers', 1, 21, '109.1'),
  row(2022, 556, 'Nashville Sounds', 11, 5, '26.1'),
  row(2023, 556, 'Nashville Sounds', 11, 26, '135.1'),
  row(2024, 556, 'Nashville Sounds', 11, 3, '12.0'),
  row(2025, 556, 'Nashville Sounds', 11, 10, '32.0'),
  row(2026, 556, 'Nashville Sounds', 11, 7, '26.2'),
  row(2022, 5015, 'Biloxi Shuckers', 12, 4, '20.1'),
  row(2022, 584, 'Fort Wayne TinCaps', 13, 18, '90.1'),
  row(2025, 572, 'Wisconsin Timber Rattlers', 13, 3, '5.0'),
  row(2021, 103, 'Lake Elsinore Storm', 14, 5, '14.0'),
  row(2021, 410, 'ACL Padres', 16, 1, '1.0'),
  row(2025, 406, 'ACL Brewers', 16, 1, '1.0'),
]
const padres = new Set([103, 584, 410])
const gasserOrg = (id, season) => (padres.has(id) || (id === 5015 && season < 2022) ? 135 : 158)
const NICK = { 158: 'Brewers', 135: 'Padres', 556: 'Sounds', 5015: 'Shuckers', 584: 'TinCaps', 572: 'Timber Rattlers', 103: 'Storm', 406: 'ACL Brewers' }
const trade = { typeCode: 'TR', date: '2022-08-01', fromTeam: { id: 135 }, toTeam: { id: 158 } }

const gasserView = (over = {}) =>
  teamsView({
    ledger: teamSeasonsView(gasser, 'pitching', 2024, gasserOrg),
    splits: gasser,
    trades: [trade],
    nick: (id) => NICK[id],
    currentTeamId: 158,
    season: 2026,
    ...over,
  })

// Brice Turang (hitting; debut 2023): 2024-26 fold into one row.
const turang = [
  row(2023, 158, 'Milwaukee Brewers', 1, 137),
  row(2024, 158, 'Milwaukee Brewers', 1, 155),
  row(2025, 158, 'Milwaukee Brewers', 1, 156),
  row(2026, 158, 'Milwaukee Brewers', 1, 151),
  row(2021, 556, 'Nashville Sounds', 11, 44),
  row(2022, 556, 'Nashville Sounds', 11, 131),
  row(2023, 556, 'Nashville Sounds', 11, 15),
  row(2021, 5015, 'Biloxi Shuckers', 12, 73),
  row(2019, 249, 'Carolina Mudcats', 13, 47),
  row(2019, 572, 'Wisconsin Timber Rattlers', 14, 82),
  row(2018, 406, 'AZL Brewers', 16, 13),
  row(2018, 433, 'Helena Brewers', 16, 29),
  { season: '2018', sport: { id: 16 }, stat: { gamesPlayed: 42 } },
]
const turangView = (over = {}) =>
  teamsView({
    ledger: teamSeasonsView(turang, 'hitting', 2023, () => 158),
    splits: turang,
    trades: [],
    nick: (id) => ({ ...NICK, 433: 'Brewers', 249: 'Mudcats' })[id],
    currentTeamId: 158,
    season: 2026,
    ...over,
  })

const years = (v) => v.rows.map((r) => r.years)
const badges = (r) => r.items.filter((x) => x.kind === 'badge')

test('one row per season, earliest first; a run of identical big-league seasons folds', () => {
  const v = turangView()
  assert.deepEqual(years(v), ['2018', '2019', '2020', '2021', '2022', '2023', '2024–26'])
  const last = v.rows.at(-1)
  assert.deepEqual(badges(last).map((b) => [b.name, b.sub]), [['Brewers', 'MLB · 462 G']])
  assert.equal(v.count, '7 clubs')
})

test('2020 is a hatched row with a sentence, and has no badges', () => {
  const r = turangView().rows.find((x) => x.years === '2020')
  assert.equal(r.noSeason, true)
  assert.equal(r.items.length, 0)
  assert.match(r.text, /No minor league season/)
})

test('a badge reads the short club name and "level · N G"; a farm club flips to its parent', () => {
  const r2018 = turangView().rows[0]
  assert.deepEqual(badges(r2018).map((b) => [b.name, b.sub]), [['AZL Brewers', 'ROK · 13 G'], ['Helena', 'ROK · 29 G']])
  const fw = badges(gasserView().rows.find((x) => x.years === '2022'))[0]
  assert.equal(fw.name, 'Fort Wayne')
  assert.deepEqual(fw.flip, { teamId: 135, name: 'Padres', sub: 'A+ affiliate' })
  const mlb = badges(turangView().rows.at(-1))[0]
  assert.equal(mlb.flip, null)
})

test('a trade inside a season is a chip between the old org and the new one', () => {
  const r = gasserView().rows.find((x) => x.years === '2022')
  assert.deepEqual(
    r.items.map((x) => (x.kind === 'trade' ? `trade ${x.to} ${x.date}` : x.name)),
    ['Fort Wayne', 'trade 158 8/1/22', 'Biloxi', 'Nashville'],
  )
})

test('rehab stints are a note under the season, not badges (the app floors)', () => {
  const v = gasserView()
  const r25 = v.rows.find((x) => x.years === '2025')
  assert.deepEqual(badges(r25).map((b) => b.name), ['Nashville', 'Brewers'])
  assert.equal(r25.note, 'Rehab stints: ACL Brewers and Wisconsin, 4 G.')
  const r26 = v.rows.find((x) => x.years === '2026')
  assert.deepEqual(badges(r26).map((b) => b.name), ['Brewers'])
  assert.equal(r26.note, 'Rehab stint: Nashville, 7 G.')
  assert.equal(v.count, '5 clubs')
})

test('a season with a rehab note never folds into a run', () => {
  assert.deepEqual(years(gasserView()), ['2021', '2022', '2023', '2024', '2025', '2026'])
})

test('here now: the current club in the latest row is inked; none on a dated page or a stale club', () => {
  const v = gasserView()
  const last = v.rows.at(-1)
  assert.equal(last.here, true)
  assert.deepEqual(badges(last).map((b) => b.cur), [true])
  assert.equal(v.rows.filter((r) => r.here).length, 1)
  assert.equal(gasserView({ currentTeamId: null }).rows.some((r) => r.here), false)
  assert.equal(gasserView({ season: 2029 }).rows.some((r) => r.here), false)
})

test('a dated page drops the seasons after its year', () => {
  const v = gasserView({ asOfSeason: 2023, currentTeamId: null })
  assert.deepEqual(years(v), ['2021', '2022', '2023'])
  assert.equal(v.count, '4 clubs')
})

test('a missing game count prints a dash with no unit', () => {
  const s = [row(2024, 158, 'Milwaukee Brewers', 1, 0, '0.1')]
  const v = teamsView({ ledger: teamSeasonsView(s, 'pitching', 2024), splits: s, nick: () => 'Brewers', season: 2024 })
  assert.equal(badges(v.rows[0])[0].sub, 'MLB · —')
  assert.equal(v.count, '1 club')
})

test('no ledger is no view', () => {
  assert.equal(teamsView({ ledger: null, splits: [] }), null)
  assert.equal(gasserView({ asOfSeason: 2019 }), null)
})

test('shortName drops the nickname from a farm club, keeps it for a big-league club', () => {
  assert.equal(shortName('Nashville Sounds', 'Sounds', false), 'Nashville')
  assert.equal(shortName('Milwaukee Brewers', 'Brewers', true), 'Brewers')
  assert.equal(shortName('AZL Brewers', 'ACL Brewers', false), 'AZL Brewers')
  assert.equal(shortName('Nashville Sounds', undefined, false), 'Nashville Sounds')
})

test('relativeLine: position, his most-games club, the span and the games', () => {
  const brian = [row(1993, 136, 'Seattle Mariners', 1, 40), row(1994, 136, 'Seattle Mariners', 1, 38)]
  assert.equal(relativeLine('LF', brian, () => 'Mariners'), 'LF · Mariners · 1993–94 · 78 G')
  assert.equal(relativeLine('P', [], () => ''), 'P')
  assert.equal(relativeLine('', [], () => ''), '')
})
