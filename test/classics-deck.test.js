// THE CLASSICS DECK (issue #1525, slice 1) — which old games may be dealt, and
// the proof that no request for one can carry a score.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CLASSICS_FIELDS, scheduleUrl, classicsFrom, rollClassic } from '../src/api/classics/deck.js'

// Real responses, fetched 2026-10-21 with CLASSICS_FIELDS: the 1982 Brewers'
// first twelve dates, and the 1982 clubs. Copied, not typed.
const SCHEDULE_1982 = {"dates":[{"date":"1982-04-09","games":[{"gamePk":181911,"gameType":"R","officialDate":"1982-04-09","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":141,"name":"Toronto Blue Jays"}}},"venue":{"id":3123,"name":"Exhibition Stadium"},"gameNumber":1,"seriesGameNumber":1}]},{"date":"1982-04-10","games":[{"gamePk":181922,"gameType":"R","officialDate":"1982-04-10","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":141,"name":"Toronto Blue Jays"}}},"venue":{"id":3123,"name":"Exhibition Stadium"},"gameNumber":1,"seriesGameNumber":2}]},{"date":"1982-04-11","games":[{"gamePk":181935,"gameType":"R","officialDate":"1982-04-11","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":141,"name":"Toronto Blue Jays"}}},"venue":{"id":3123,"name":"Exhibition Stadium"},"gameNumber":1,"seriesGameNumber":3}]},{"date":"1982-04-13","games":[{"gamePk":181954,"gameType":"R","officialDate":"1982-04-13","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":114,"name":"Cleveland Indians"}}},"venue":{"id":3116,"name":"Cleveland Municipal Stadium"},"gameNumber":1,"seriesGameNumber":1}]},{"date":"1982-04-14","games":[{"gamePk":181966,"gameType":"R","officialDate":"1982-04-14","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":114,"name":"Cleveland Indians"}}},"venue":{"id":3116,"name":"Cleveland Municipal Stadium"},"gameNumber":1,"seriesGameNumber":2}]},{"date":"1982-04-15","games":[{"gamePk":181976,"gameType":"R","officialDate":"1982-04-15","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":114,"name":"Cleveland Indians"}}},"venue":{"id":3116,"name":"Cleveland Municipal Stadium"},"gameNumber":1,"seriesGameNumber":3}]},{"date":"1982-04-16","games":[{"gamePk":181993,"gameType":"R","officialDate":"1982-04-16","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":140,"name":"Texas Rangers"}},"home":{"team":{"id":158,"name":"Milwaukee Brewers"}}},"venue":{"id":23,"name":"Milwaukee County Stadium"},"gameNumber":1,"seriesGameNumber":1}]},{"date":"1982-04-17","games":[{"gamePk":182007,"gameType":"R","officialDate":"1982-04-17","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":140,"name":"Texas Rangers"}},"home":{"team":{"id":158,"name":"Milwaukee Brewers"}}},"venue":{"id":23,"name":"Milwaukee County Stadium"},"gameNumber":1,"seriesGameNumber":2}]},{"date":"1982-04-18","games":[{"gamePk":182020,"gameType":"R","officialDate":"1982-04-18","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":140,"name":"Texas Rangers"}},"home":{"team":{"id":158,"name":"Milwaukee Brewers"}}},"venue":{"id":23,"name":"Milwaukee County Stadium"},"gameNumber":1,"seriesGameNumber":3}]},{"date":"1982-04-21","games":[{"gamePk":182052,"gameType":"R","officialDate":"1982-04-21","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":141,"name":"Toronto Blue Jays"}},"home":{"team":{"id":158,"name":"Milwaukee Brewers"}}},"venue":{"id":23,"name":"Milwaukee County Stadium"},"gameNumber":1,"seriesGameNumber":1}]},{"date":"1982-04-22","games":[{"gamePk":182057,"gameType":"R","officialDate":"1982-04-22","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":141,"name":"Toronto Blue Jays"}},"home":{"team":{"id":158,"name":"Milwaukee Brewers"}}},"venue":{"id":23,"name":"Milwaukee County Stadium"},"gameNumber":1,"seriesGameNumber":2}]},{"date":"1982-04-23","games":[{"gamePk":182065,"gameType":"R","officialDate":"1982-04-23","status":{"detailedState":"Final"},"teams":{"away":{"team":{"id":158,"name":"Milwaukee Brewers"}},"home":{"team":{"id":140,"name":"Texas Rangers"}}},"venue":{"id":3111,"name":"Arlington Stadium"},"gameNumber":1,"seriesGameNumber":1}]}]}
const TEAMS_1982 = {"teams":[{"id":133,"name":"Oakland Athletics","abbreviation":"OAK","league":{"id":103,"name":"American League"}},{"id":134,"name":"Pittsburgh Pirates","abbreviation":"PIT","league":{"id":104,"name":"National League"}},{"id":135,"name":"San Diego Padres","abbreviation":"SD","league":{"id":104,"name":"National League"}},{"id":136,"name":"Seattle Mariners","abbreviation":"SEA","league":{"id":103,"name":"American League"}},{"id":137,"name":"San Francisco Giants","abbreviation":"SF","league":{"id":104,"name":"National League"}},{"id":138,"name":"St. Louis Cardinals","abbreviation":"STL","league":{"id":104,"name":"National League"}},{"id":140,"name":"Texas Rangers","abbreviation":"TEX","league":{"id":103,"name":"American League"}},{"id":141,"name":"Toronto Blue Jays","abbreviation":"TOR","league":{"id":103,"name":"American League"}},{"id":142,"name":"Minnesota Twins","abbreviation":"MIN","league":{"id":103,"name":"American League"}},{"id":143,"name":"Philadelphia Phillies","abbreviation":"PHI","league":{"id":104,"name":"National League"}},{"id":144,"name":"Atlanta Braves","abbreviation":"ATL","league":{"id":104,"name":"National League"}},{"id":145,"name":"Chicago White Sox","abbreviation":"CWS","league":{"id":103,"name":"American League"}},{"id":147,"name":"New York Yankees","abbreviation":"NYY","league":{"id":103,"name":"American League"}},{"id":158,"name":"Milwaukee Brewers","abbreviation":"MIL","league":{"id":103,"name":"American League"}},{"id":108,"name":"California Angels","abbreviation":"CAL","league":{"id":103,"name":"American League"}},{"id":110,"name":"Baltimore Orioles","abbreviation":"BAL","league":{"id":103,"name":"American League"}},{"id":111,"name":"Boston Red Sox","abbreviation":"BOS","league":{"id":103,"name":"American League"}},{"id":112,"name":"Chicago Cubs","abbreviation":"CHC","league":{"id":104,"name":"National League"}},{"id":113,"name":"Cincinnati Reds","abbreviation":"CIN","league":{"id":104,"name":"National League"}},{"id":114,"name":"Cleveland Indians","abbreviation":"CLE","league":{"id":103,"name":"American League"}},{"id":116,"name":"Detroit Tigers","abbreviation":"DET","league":{"id":103,"name":"American League"}},{"id":117,"name":"Houston Astros","abbreviation":"HOU","league":{"id":104,"name":"National League"}},{"id":118,"name":"Kansas City Royals","abbreviation":"KC","league":{"id":103,"name":"American League"}},{"id":119,"name":"Los Angeles Dodgers","abbreviation":"LA","league":{"id":104,"name":"National League"}},{"id":120,"name":"Montreal Expos","abbreviation":"MON","league":{"id":104,"name":"National League"}},{"id":121,"name":"New York Mets","abbreviation":"NYM","league":{"id":104,"name":"National League"}}]}

const abbr = new Map(TEAMS_1982.teams.map((t) => [t.id, t.abbreviation]))
const rows = () => structuredClone(SCHEDULE_1982).dates.flatMap((d) => d.games)

test('a played regular-season game is eligible and carries a lineup address', () => {
  const [g] = classicsFrom(rows(), abbr)
  assert.deepEqual([g.pk, g.date, g.away.abbr, g.home.abbr, g.g], [181911, '1982-04-09', 'MIL', 'TOR', 1])
})

test('forfeits, postponements and non-league clubs drop', () => {
  const r = rows()
  const n = classicsFrom(r, abbr).length
  r[0].status.detailedState = 'Postponed'
  r[1].status.detailedState = 'Final: Forfeit'
  r[2].gameType = 'S'
  r[3].teams.home.team.id = 999999
  assert.equal(classicsFrom(r, abbr).length, n - 4)
})

test('a pre-1960 row drops', () => {
  const r = rows()
  r[0].officialDate = '1959-09-27'
  assert.equal(classicsFrom(r, abbr).some((g) => g.pk === r[0].gamePk), false)
})

function fakeFetch(log) {
  return async (path) => {
    log.push(path)
    return path.includes('/teams?') ? TEAMS_1982 : SCHEDULE_1982
  }
}

test('the same seed deals the same game, another seed can differ', async () => {
  const deal = (seed) => rollClassic({ seed, lastSeason: 1990, fetchJson: fakeFetch([]) }).then((r) => r.game.pk)
  assert.equal(await deal(7), await deal(7))
  const pks = new Set(await Promise.all([1, 2, 3, 4, 5, 6].map(deal)))
  assert.ok(pks.size > 1)
})

test('an era filter keeps only that decade', async () => {
  const log = []
  await rollClassic({ seed: 3, era: 1980, lastSeason: 2025, fetchJson: fakeFetch(log) })
  const seasons = log.map((p) => Number(/season=(\d{4})/.exec(p)[1]))
  assert.ok(seasons.length > 0 && seasons.every((y) => y >= 1980 && y <= 1989))
})

test('the request holds fields= and never asks for a linescore', async () => {
  const log = []
  await rollClassic({ seed: 1, lastSeason: 1990, fetchJson: fakeFetch(log) })
  const sched = log.filter((p) => p.includes('/schedule?'))
  assert.ok(sched.length > 0)
  for (const p of log) {
    assert.ok(p.includes('fields='), p)
    assert.ok(!/hydrate=/.test(p), p)
  }
  assert.ok(scheduleUrl(158, 1982).includes(`fields=${CLASSICS_FIELDS}`))
  assert.ok(!/score|isWinner|leagueRecord/.test(CLASSICS_FIELDS))
})

test('a club filter deals that club only', async () => {
  const r = await rollClassic({ seed: 5, teamId: 158, lastSeason: 1982, fetchJson: fakeFetch([]) })
  assert.ok([r.game.away.abbr, r.game.home.abbr].includes('MIL'))
})

test('rollClassic spreads the club pick across seeds and accepts a string era', async () => {
  const clubs = Array.from({ length: 26 }, (_, i) => ({ id: 100 + i, abbreviation: `C${i}` }))
  const asked = new Set()
  const fetchJson = async (url) => {
    if (url.includes('/teams?')) return { teams: clubs }
    asked.add(Number(url.match(/teamId=(\d+)/)[1]))
    return { dates: [] }
  }
  for (let seed = 0; seed < 40; seed++) await rollClassic({ seed, era: '1980', lastSeason: 1989, fetchJson })
  assert.ok(asked.size > 8, `only ${asked.size} clubs asked`)
})
