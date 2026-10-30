import test from 'node:test'
import assert from 'node:assert/strict'
import { pathView } from '../src/screens/player/next/modules/path/pathView.js'
import { SPORT_IDS } from '../src/lib/teams.js'

const row = (season, sportId, id, name, gamesPlayed, extra = {}) => ({
  season: String(season), sport: { id: sportId }, team: id ? { id, name } : undefined,
  stat: { gamesPlayed, atBats: gamesPlayed * 3 }, ...extra,
})

// Turang 668930: Rookie 42 G in two clubs, then A, A+, AA, AAA, then the majors.
const turangMilb = [
  row(2018, SPORT_IDS.ROK, 1, 'AZL Brewers', 13),
  row(2018, SPORT_IDS.ROK, 2, 'Helena Brewers', 29),
  row(2018, SPORT_IDS.ROK, null, '', 42, { numTeams: 2 }),
  row(2019, SPORT_IDS.A, 3, 'Wisconsin Timber Rattlers', 82),
  row(2021, SPORT_IDS.AAA, 4, 'Nashville Sounds', 100),
  row(2023, SPORT_IDS.AAA, 4, 'Nashville Sounds', 90),
]
const turangMlb = [row(2023, SPORT_IDS.MLB, 158, 'Milwaukee Brewers', 99), row(2026, SPORT_IDS.MLB, 158, 'Milwaukee Brewers', 500)]

test('a debuted player: levels with games, years and clubs, then the majors tile: his debut club and date', () => {
  const v = pathView({ milb: turangMilb, mlb: turangMlb, group: 'hitting', debutDate: '2023-03-30', currentSportId: 1 })
  assert.equal(v.badge, 'MLB')
  assert.equal(v.headline, 'Debuted March 30, 2023')
  const rok = v.levels[0]
  assert.deepEqual([rok.label, rok.games, rok.years], ['ROK', 42, '2018'])
  assert.deepEqual(rok.teams.map((t) => [t.id, t.games]), [[1, 13], [2, 29]])
  assert.equal(rok.logoId, 2, 'the club he played most for')
  assert.equal(v.levels.find((l) => l.label === 'AAA').years, '2021–23')
  assert.equal(v.total, 314)
  assert.deepEqual(v.mlb, { debut: '3/30/2023', logoId: 158, now: true })
  assert.ok(v.levels.every((l) => !l.now))
})

test('a debuted player sent down: "Here now" sits on his minor level, not the majors', () => {
  const v = pathView({ milb: turangMilb, mlb: turangMlb, group: 'hitting', debutDate: '2023-03-30', currentSportId: SPORT_IDS.AAA })
  assert.equal(v.mlb.now, false)
  assert.equal(v.levels.find((l) => l.label === 'AAA').now, true)
})

test('a prospect: no majors tile, no headline, "Here now" on his level', () => {
  const milb = [row(2024, SPORT_IDS.ROK, 9, 'DSL Brewers 1', 51), row(2026, SPORT_IDS.AA, 5, 'Biloxi Shuckers', 127)]
  const v = pathView({ milb, mlb: [], group: 'hitting', debutDate: null, currentSportId: SPORT_IDS.AA })
  assert.equal(v.badge, 'Prospect')
  assert.equal(v.headline, '')
  assert.equal(v.mlb, null)
  assert.deepEqual(v.levels.map((l) => [l.label, l.now]), [['ROK', false], ['AA', true]])
})

test('stray rehab stints after the debut year are dropped', () => {
  const milb = [...turangMilb, row(2025, SPORT_IDS.AA, 8, 'Biloxi Shuckers', 4)]
  const v = pathView({ milb, mlb: turangMlb, group: 'hitting', debutDate: '2023-03-30', currentSportId: 1 })
  assert.equal(v.levels.some((l) => l.label === 'AA'), false)
})

test('no minor-league record gives null', () => {
  assert.equal(pathView({ milb: [], mlb: turangMlb, group: 'hitting', debutDate: '2023-03-30', currentSportId: 1 }), null)
  assert.equal(pathView({ milb: null, mlb: null, group: 'hitting', debutDate: null, currentSportId: 1 }), null)
})
