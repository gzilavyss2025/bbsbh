// The pure half of scripts/gen-world-series-events.mjs: from the World Series games and
// their play-by-play, build public/data/world-series/events.json. What a tag MEANS is not
// here: src/lib/worldSeries/classify.js decides that. This file decides which games are
// winner-take-all (`wta`), numbers the games, and shapes the file.
import { classifyGame, finalScore, orderedPlays } from '../../../src/lib/worldSeries/classify.js'

export const FIRST_SEASON = 1903

// The play-by-play keys the classifier reads (the same list as test/fixtures/world-series/capture.mjs).
export const PLAY_FIELDS = [
  'allPlays', 'about', 'atBatIndex', 'halfInning', 'isTopInning', 'inning',
  'result', 'event', 'eventType', 'description', 'rbi', 'awayScore', 'homeScore',
  'matchup', 'batter', 'pitcher', 'id', 'fullName',
  'playEvents', 'details', 'player', 'isSubstitution',
].join(',')

const FLAGS = ['from', 'to', 'out', 'check']

// `parsed` is lib/args.mjs parseArgs. `last` is the default final season. -> { from, to }.
export function seasonRange(parsed, last) {
  const stray = Object.keys(parsed).filter((k) => !FLAGS.includes(k))
  if (stray.length) throw new Error(`unknown flag: --${stray.join(', --')}`)
  if (parsed.out === true) throw new Error('--out takes a folder: --out=DIR')
  const year = (flag, fallback) => {
    if (parsed[flag] === undefined) return fallback
    const n = Number(parsed[flag])
    if (!Number.isInteger(n) || n < FIRST_SEASON || n > last) {
      throw new Error(`--${flag} takes a year from ${FIRST_SEASON} to ${last}, not "${parsed[flag]}"`)
    }
    return n
  }
  const from = year('from', FIRST_SEASON)
  const to = year('to', last)
  if (from > to) throw new Error(`--from ${from} is after --to ${to}`)
  return { from, to }
}

// A schedule body (gameType=W) -> the played games, once for each gamePk. A postponed or
// suspended game is listed under its old date and its played date: the last listing wins,
// and only a Final one is a game. -> [{ pk, date, away, home }] (club ids).
export function gamesFromSchedule(schedule) {
  const byPk = new Map()
  for (const day of schedule?.dates ?? []) {
    for (const g of day.games ?? []) {
      if (g.gameType === 'W') byPk.set(g.gamePk, { day: day.date, g })
    }
  }
  return [...byPk.values()]
    .filter(({ g }) => g.status?.abstractGameState === 'Final')
    .map(({ day, g }) => ({
      pk: g.gamePk, date: day, away: g.teams.away.team.id, home: g.teams.home.team.id,
    }))
}

// series.json (contract section 3) -> the same shape, for one season.
export function gamesFromSeriesJson(doc, season) {
  const series = doc?.series?.find((s) => s.season === season)
  return (series?.games ?? []).map(({ pk, date, away, home }) => ({ pk, date, away, home }))
}

// Order by (date, pk) and number 1..n. A tied game takes a number.
export const numberGames = (games) =>
  [...games].sort((a, b) => a.date.localeCompare(b.date) || a.pk - b.pk).map((g, i) => ({ ...g, n: i + 1 }))

// Games with runs { awayRuns, homeRuns } -> the Series' winsNeeded, winner, and the pks of
// its winner-take-all games. winsNeeded is the winner's win count (never a constant). A
// winner-take-all game is the last decided game when both clubs had winsNeeded - 1 wins
// before it. A tie is not a win.
export function seriesFacts(games) {
  const wins = new Map()
  const decided = games.filter((g) => g.awayRuns !== g.homeRuns)
  const winnerOf = (g) => (g.awayRuns > g.homeRuns ? g.away : g.home)
  for (const g of decided) wins.set(winnerOf(g), (wins.get(winnerOf(g)) ?? 0) + 1)
  const [top, second] = [...wins.entries()].sort((a, b) => b[1] - a[1])
  if (!top || top[1] === second?.[1]) throw new Error('no single winner for this Series')
  const [winner, winsNeeded] = top
  const before = new Map()
  let wtaPk = null
  decided.forEach((g, i) => {
    const w = winnerOf(g)
    const l = w === g.away ? g.home : g.away
    const last = i === decided.length - 1
    if (last && (before.get(w) ?? 0) === winsNeeded - 1 && (before.get(l) ?? 0) === winsNeeded - 1) wtaPk = g.pk
    before.set(w, (before.get(w) ?? 0) + 1)
  })
  return { winner, winsNeeded, wtaPk }
}

export const sortRows = (rows) => rows.sort((a, b) =>
  a.date.localeCompare(b.date) || a.pk - b.pk || a.tag.localeCompare(b.tag)
  || (a.club ?? 0) - (b.club ?? 0) || (a.player ?? 0) - (b.player ?? 0) || (a.value ?? 0) - (b.value ?? 0))

// seasons: [{ season, games: [{ pk, date, away, home, pbp }] }] -> the events.json document.
export function buildEventsDoc(seasons, { from, to }) {
  const rows = []
  let games = 0
  for (const { season, games: listed } of seasons) {
    const withRuns = numberGames(listed).map((g) => {
      const { awayRuns, homeRuns } = finalScore(orderedPlays(g.pbp))
      return { ...g, awayRuns, homeRuns }
    })
    const { wtaPk } = seriesFacts(withRuns)
    for (const g of withRuns) {
      games += 1
      rows.push(...classifyGame(g.pbp, {
        wta: g.pk === wtaPk,
        clubs: { away: g.away, home: g.home },
        game: { pk: g.pk, date: g.date, season, n: g.n },
      }))
    }
  }
  return { coverage: { from, through: to, games }, events: sortRows(rows) }
}

// One event per line: a diff of a regenerated file stays reviewable.
export const serializeDoc = (doc) =>
  `{"coverage":${JSON.stringify(doc.coverage)},"events":[\n${doc.events.map((e) => JSON.stringify(e)).join(',\n')}\n]}\n`
