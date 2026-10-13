// The new player page's Season statistics module (#1885): the scope switch, the rows and
// tiles each scope shows, the subtotal and gap rows, and the WAR-vs-league read.
import test from 'node:test'
import assert from 'node:assert/strict'
import { careerRegisterView } from '../src/api/person/careerRegister.js'
import { compareView, linesOf, scopesOf, starYears, tableFor, tilesFor, withStars, withTeams } from '../src/screens/player/next/modules/season/seasonView.js'

const bat = (g, ab, h, hr = 0, rbi = 0) => ({
  gamesPlayed: g, atBats: ab, hits: h, homeRuns: hr, rbi, totalBases: h + hr * 3, strikeOuts: 20, baseOnBalls: 5,
  plateAppearances: ab + 5, avg: (h / ab).toFixed(3).replace(/^0/, ''),
})
const split = (season, sportId, teamId, stat) => ({ season: String(season), sport: { id: sportId }, team: { id: teamId }, stat })

// Debut 2023. Minors 2018, 2019, 2021, 2022 (2020 had no minor-league season). Traded in 2023 (two
// MLB clubs). A year off in 2025. The current season is 2026.
function register(over = {}) {
  return careerRegisterView({
    mlbSplits: [
      split(2023, 1, 10, bat(40, 100, 25, 4, 12)),
      split(2023, 1, 20, bat(60, 200, 50, 6, 20)),
      split(2024, 1, 20, bat(150, 500, 130, 15, 70)),
      split(2026, 1, 20, bat(100, 300, 90, 10, 40)),
    ],
    milbSplits: [
      split(2018, 14, 30, bat(30, 100, 25)),
      split(2019, 13, 31, bat(80, 300, 80, 5, 30)),
      split(2021, 12, 32, bat(70, 250, 60)),
      split(2022, 11, 33, bat(120, 450, 120, 12, 60)),
    ],
    group: 'hitting',
    role: null,
    debutYear: 2023,
    currentStat: bat(100, 300, 90, 10, 40),
    currentSplits: [split(2026, 1, 20, bat(100, 300, 90, 10, 40))],
    currentSeason: 2026,
    currentSportId: 1,
    warByYear: { 2024: 3.1, 2026: 2.4 },
    ...over,
  })
}
const labels = (rows) => rows.map((r) => `${r.year} ${r.gap ? r.note : r.team}`)
const names = (list) => list.map((s) => s.id)

test('the switch offers a scope only when it has rows: All needs both levels, Postseason needs a debut', () => {
  const reg = register()
  assert.deepEqual(names(scopesOf(reg, false)), ['mlb', 'milb', 'all'])
  assert.deepEqual(names(scopesOf(reg, true)), ['mlb', 'milb', 'all', 'post'])
  assert.deepEqual(names(scopesOf(register({ milbSplits: [] }), false)), ['mlb'])
  const prospect = register({ mlbSplits: [], debutYear: null, currentStat: null, currentSplits: [], currentSportId: 11 })
  assert.deepEqual(names(scopesOf(prospect, false)), ['milb'])
  assert.deepEqual(scopesOf(null, false), [])
})

test('the All-Star star marks the MLB season-lead row of a selected year, and never a minor-league row', () => {
  const reg = withStars(withTeams(register(), {}), new Set([2024, 2023, 2022]))
  const starred = tableFor(reg, null, 'all').rows.filter((r) => r.allStar).map((r) => `${r.year} ${r.tier} ${r.subtotal ? 'TM' : ''}`.trim())
  assert.deepEqual(starred, ['2024 mlb', '2023 mlb TM'])
  assert.ok(tableFor(reg, null, 'milb').rows.every((r) => !r.allStar))
})

test('MLB scope: a traded season keeps its club rows and the 2 TM subtotal; the MLB footer, no minors', () => {
  const view = tableFor(withTeams(register(), { 10: 'AAA', 20: 'BBB' }), null, 'mlb')
  const sub = view.rows.find((r) => r.subtotal)
  assert.equal(sub.team, '2 TM')
  assert.deepEqual(
    view.rows.filter((r) => r.year === '2023').map((r) => r.team),
    ['AAA', 'BBB', '2 TM'],
  )
  assert.ok(view.rows.every((r) => r.tier !== 'milb'))
  assert.deepEqual(view.totals.map((t) => t.label), ['MLB'])
  assert.deepEqual(view.columns, ['G', 'AB', 'AVG', 'HR', 'RBI', 'WAR'])
})

test('Minors scope: minor-league rows only, with the MiLB footer; the pre-debut gap reads in it, the post-debut one does not', () => {
  const view = tableFor(withTeams(register(), {}), null, 'milb')
  assert.deepEqual(view.rows.map((r) => r.year), ['2022', '2021', '2020', '2019', '2018'])
  assert.equal(view.rows.find((r) => r.year === '2020').note, 'No minor-league season')
  assert.deepEqual(view.totals.map((t) => t.label), ['MiLB'])
})

test('MLB scope shows the year off after the debut as a gap row, and none from before it', () => {
  const view = tableFor(withTeams(register(), {}), null, 'mlb')
  const gaps = view.rows.filter((r) => r.gap)
  assert.deepEqual(gaps.map((r) => `${r.year} ${r.note}`), ['2025 Did not play'])
})

test('All scope: every row in year order, both footers', () => {
  const view = tableFor(withTeams(register(), {}), null, 'all')
  assert.equal(view.rows.length, register().rows.length)
  assert.deepEqual(view.totals.map((t) => t.label), ['MLB', 'MiLB'])
  assert.deepEqual(view.rows.map((r) => r.year), [...view.rows.map((r) => r.year)].sort((a, b) => b - a))
})

test('years before the first pro season read "No MLB or MiLB stats" in the Minors and All scopes', () => {
  const reg = register({ milbSplits: [split(2018, 14, 30, bat(30, 100, 25)), split(2016, 14, 30, bat(30, 100, 25))] })
  assert.equal(reg.rows.find((r) => r.year === '2017').note, 'No MLB or MiLB stats')
  const minors = tableFor(withTeams(reg, {}), null, 'milb')
  assert.ok(labels(minors.rows).includes('2017 No MLB or MiLB stats'))
})

test('a row carries the compare button only where it carries the season WAR', () => {
  const view = tableFor(withTeams(register(), {}), null, 'all')
  const flagged = view.rows.filter((r) => r.compare).map((r) => `${r.year} ${r.subtotal ? 'TM' : 'club'}`)
  assert.deepEqual(flagged, ['2026 club', '2024 club', '2023 TM'])
  assert.ok(view.rows.filter((r) => r.compare).every((r) => r.tier === 'mlb'))
})

test('Postseason scope: the postseason rows and its own footer, with no WAR column', () => {
  const post = {
    columns: ['G', 'AB', 'AVG', 'HR', 'RBI'],
    rows: [{ key: '2025-1', year: 2025, team: 'BBB', cells: ['9', '35', '.114', '1', '3'] }],
    totals: [{ label: 'Postseason', cells: ['9', '35', '.114', '1', '3'] }],
  }
  const view = tableFor(register(), post, 'post')
  assert.deepEqual(view.columns, post.columns)
  assert.equal(view.rows[0].year, '2025')
  assert.equal(view.rows[0].compare, false)
  assert.deepEqual(view.totals.map((t) => t.label), ['Postseason'])
})

test('hitter tiles per scope: MLB takes the MLB line and the season WAR; Minors and Postseason show a WAR dash', () => {
  const lines = { mlb: bat(100, 300, 90, 10, 40), milb: bat(20, 70, 21, 2, 9), post: bat(5, 18, 3, 1, 1) }
  const at = (scope) => tilesFor({ scope, group: 'hitting', role: null, lines, war: 2.4, season: 2026 })
  assert.deepEqual(at('mlb').tiles.map((t) => [t.k, t.v]), [['AVG', '.300'], ['HR', '10'], ['RBI', '40'], ['SO', '20'], ['WAR', '2.4']])
  assert.equal(at('mlb').badge, '2026 · MLB')
  assert.deepEqual(at('milb').tiles.map((t) => t.v), ['.300', '2', '9', '20', '—'])
  assert.equal(at('post').tiles.at(-1).v, '—')
  assert.equal(at('post').badge, '2026 postseason · 5 G')
})

test('the All tiles sum the levels and rebuild the rate from the parts', () => {
  const lines = { mlb: bat(100, 300, 90, 10, 40), milb: bat(20, 100, 10, 2, 9), post: null }
  const all = tilesFor({ scope: 'all', group: 'hitting', role: null, lines, war: 2.4, season: 2026 })
  assert.equal(all.tiles[0].v, '.250')
  assert.equal(all.tiles[1].v, '12')
  assert.equal(all.tiles.at(-1).v, '2.4')
  assert.equal(all.badge, '2026 · All levels')
})

test('a scope with no line this season has no tiles and says so with the page season', () => {
  const lines = { mlb: bat(100, 300, 90), milb: null, post: null }
  const minors = tilesFor({ scope: 'milb', group: 'hitting', role: null, lines, war: null, season: 2024 })
  assert.deepEqual(minors.tiles, [])
  assert.equal(minors.empty, 'No 2024 minor-league line yet.')
  assert.equal(tilesFor({ scope: 'post', group: 'hitting', role: null, lines, war: null, season: 2024 }).empty, 'No 2024 postseason yet.')
})

test('"yet" is dropped when no line can follow: a retired player, or one with no stint this season at all', () => {
  const at = (scope, over) => tilesFor({ scope, group: 'hitting', role: null, lines: { mlb: bat(100, 300, 90), milb: null, post: null }, war: null, season: 2026, ...over })
  assert.equal(at('milb', { retired: true }).empty, 'No 2026 minor-league line.')
  assert.equal(at('post', { retired: true }).empty, 'No 2026 postseason.')
  assert.equal(at('mlb', { lines: {}, retired: true }).empty, 'No 2026 line in this scope.')
  assert.equal(at('mlb', { lines: {} }).empty, 'No 2026 line in this scope.')
  assert.equal(at('mlb', { lines: { mlb: bat(0, 0, 0, 0, 0), milb: null } }).empty, 'No 2026 line in this scope.')
})

test('the level rule: an MLB tile level takes the MLB line and the minor-league rows; any other level takes its window as the minors', () => {
  const mlb = bat(100, 300, 90)
  const window = bat(20, 70, 21)
  const rows = bat(10, 30, 9)
  assert.deepEqual(linesOf({ tileSportId: 1, levelOnlyStat: mlb, tileStat: window, milbThisSeason: rows }), { mlb, milb: rows })
  // An MLB tile level with no level-only line falls back to the tile line (a rehab stint).
  assert.equal(linesOf({ tileSportId: 1, levelOnlyStat: null, tileStat: window, milbThisSeason: rows }).mlb, window)
  assert.deepEqual(linesOf({ tileSportId: 11, levelOnlyStat: window, tileStat: window, milbThisSeason: rows }), { mlb: null, milb: window })
})

test('All-Star years: only the All-Star awards, and none dated after the cutoff', () => {
  const awards = [
    { id: 'ALAS', season: '2023', date: '2023-07-11' },
    { id: 'NLAS', season: '2024', date: '2024-07-16' },
    { id: 'ALMVP', season: '2022', date: '2022-11-10' },
    { id: 'NLAS', season: '2025', date: '2025-07-15' },
  ]
  assert.deepEqual([...starYears(awards, null)].sort(), [2023, 2024, 2025])
  assert.deepEqual([...starYears(awards, '2024-07-15')], [2023])
  assert.deepEqual([...starYears([], null)], [])
})

test('pitcher tiles: W–L leads, a closer leads with SV; ERA is the ink tile', () => {
  const arm = { wins: 5, losses: 3, saves: 20, gamesStarted: 0, gamesPlayed: 60, inningsPitched: '61.0', era: '2.50', strikeOuts: 80 }
  const sp = tilesFor({ scope: 'mlb', group: 'pitching', role: 'SP', lines: { mlb: arm }, war: 1.5, season: 2026 })
  assert.deepEqual(sp.tiles.map((t) => t.k), ['W–L', 'IP', 'ERA', 'K', 'WAR'])
  assert.equal(sp.tiles[0].v, '5–3')
  assert.equal(sp.tiles.find((t) => t.tone === 'ink').k, 'ERA')
  const cl = tilesFor({ scope: 'mlb', group: 'pitching', role: 'CL', lines: { mlb: arm }, war: 1.5, season: 2026 })
  assert.deepEqual(cl.tiles.slice(0, 2).map((t) => [t.k, t.v]), [['SV', '20'], ['IP', '61.0']])
  assert.equal(tilesFor({ scope: 'mlb', group: 'hitting', role: null, lines: { mlb: bat(1, 4, 2) }, war: null, season: 2026 }).tiles[0].tone, 'ink')
})

test('WAR vs league: a hitter above the league average is better; the note says what the figure is', () => {
  const reg = withTeams(register(), {})
  const row = reg.rows.find((r) => r.year === '2024')
  const done = compareView({ row, columns: reg.columns, group: 'hitting', league: 0.243, last: 2025 })
  assert.equal(done.mine, '.260')
  assert.equal(done.lg, '.243')
  assert.equal(done.diff, '+.017 better')
  assert.equal(done.good, true)
  assert.match(done.note, /Full-season league figure/)
  const now = compareView({ row: reg.rows.find((r) => r.year === '2026'), columns: reg.columns, group: 'hitting', league: 0.33, last: 2025 })
  assert.equal(now.diff, '−.030 worse')
  assert.match(now.note, /League figure to date/)
  assert.equal(compareView({ row, columns: reg.columns, group: 'hitting', league: null, last: 2025 }).empty, 'No league figure for 2024.')
})

test('WAR vs league: no sign on a zero gap, and no "to date" note when the last complete season is unknown', () => {
  const reg = withTeams(register(), {})
  const row = reg.rows.find((r) => r.year === '2024')
  const view = compareView({ row, columns: reg.columns, group: 'hitting', league: 0.26, last: null })
  assert.equal(view.diff, '.000 even')
  assert.doesNotMatch(view.note, /to date/)
})

test('WAR vs league: a season with no ERA of its own says that, not that the league has no figure', () => {
  const columns = ['G', 'GS', 'W–L', 'ERA', 'IP', 'K', 'BB', 'WHIP', 'WAR']
  const row = { year: '2025', cells: ['3', '0', '0–0', '-.--', '0.0', '0', '2', '-.--', '0.0'] }
  assert.equal(compareView({ row, columns, group: 'pitching', league: 4.1, last: 2025 }).empty, 'No ERA to compare for 2025.')
})

test('WAR vs league for a pitcher: a lower ERA is better', () => {
  const columns = ['G', 'GS', 'W–L', 'ERA', 'IP', 'K', 'BB', 'WHIP', 'WAR']
  const row = { year: '2025', subtotal: false, cells: ['30', '30', '10–8', '3.50', '180.0', '190', '50', '1.10', '3.0'] }
  const view = compareView({ row, columns, group: 'pitching', league: 4.1, last: 2025 })
  assert.equal(view.diff, '−0.60 better')
  assert.match(view.note, /Lower ERA is better/)
  assert.match(compareView({ row: { ...row, subtotal: true }, columns, group: 'pitching', league: 4.1, last: 2025 }).note, /Both clubs combined/)
})
