// Regenerates public/data/team-score.json — MLB's date-keyed Season Score and
// Current Form. Both are team-quality measures: 60% actual wins and 40%
// Pythagorean run quality, centered on .500 and damped for small samples.
// Season Surprise remains in season-score.json as a separate diagnostic. The
// formula itself lives in src/api/teamScoreFormula.js (pure, no node
// imports) so the team page's "how this is calculated" explainer can run the
// same math client-side — re-exported here so this script stays the
// existing import site for test/team-score.test.js.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pythagoreanPct, qualityScoreFromGames, CURRENT_FORM_GAMES } from '../src/api/teamScoreFormula.js'

export { pythagoreanPct, qualityScoreFromGames }

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'team-score.json')
const BASE = 'https://statsapi.mlb.com'
const isoDay = (d) => d.toISOString().slice(0, 10)
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDay(d)
}
const previousUtcDay = () => addDays(isoDay(new Date()), -1)

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

function parseArgs(argv) {
  const args = {}
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (match) args[match[1]] = match[2] ?? true
  }
  return args
}

function summarize(games) {
  const wins = games.filter((game) => game.won).length
  const runsScored = games.reduce((sum, game) => sum + game.runsFor, 0)
  const runsAllowed = games.reduce((sum, game) => sum + game.runsAllowed, 0)
  const result = {
    games: games.length,
    wins,
    losses: games.length - wins,
    runsScored,
    runsAllowed,
    runDifferential: runsScored - runsAllowed,
    ...qualityScoreFromGames({ wins, games: games.length, runsScored, runsAllowed }),
  }
  return result
}

function gameOutcome(game) {
  const home = game.teams?.home
  const away = game.teams?.away
  if (!home?.team?.id || !away?.team?.id) return null
  if (typeof home.score !== 'number' || typeof away.score !== 'number' || home.score === away.score) return null
  return {
    gamePk: game.gamePk,
    date: game.officialDate ?? game.gameDate?.slice(0, 10),
    homeId: home.team.id,
    awayId: away.team.id,
    homeRuns: home.score,
    awayRuns: away.score,
  }
}

export function buildTeamScoreSnapshots({ games, asOf }) {
  const byTeam = new Map()
  const ensure = (teamId) => {
    if (!byTeam.has(teamId)) byTeam.set(teamId, [])
    return byTeam.get(teamId)
  }

  for (const game of games) {
    ensure(game.homeId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.homeRuns > game.awayRuns,
      runsFor: game.homeRuns,
      runsAllowed: game.awayRuns,
    })
    ensure(game.awayId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.awayRuns > game.homeRuns,
      runsFor: game.awayRuns,
      runsAllowed: game.homeRuns,
    })
  }

  const snapshots = {}
  for (const [teamId, teamGames] of byTeam) {
    const ordered = [...teamGames].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
    snapshots[teamId] = {
      asOf,
      season: summarize(ordered),
      currentForm: summarize(ordered.slice(-CURRENT_FORM_GAMES)),
    }
  }
  return snapshots
}

async function fetchCompletedGames(asOf) {
  const season = Number(asOf.slice(0, 4))
  const data = await getJson(
    `/api/v1/schedule?sportId=1&gameType=R&startDate=${season}-03-01&endDate=${asOf}`,
  )
  const seen = new Set()
  const games = []
  for (const row of (data.dates ?? []).flatMap((date) => date.games ?? [])) {
    if (row.status?.abstractGameState !== 'Final' || seen.has(row.gamePk)) continue
    const outcome = gameOutcome(row)
    if (!outcome) continue
    seen.add(row.gamePk)
    games.push(outcome)
  }
  return games
}

async function loadOutput() {
  try {
    return JSON.parse(await readFile(out, 'utf8'))
  } catch {
    return { version: 1, generatedAt: null, seasons: {} }
  }
}

function datesFromArgs(args) {
  if (args.date) return [args.date]
  if (args.from || args.to) {
    if (!args.from || !args.to) throw new Error('--from and --to must be provided together')
    const dates = []
    for (let date = args.from; date <= args.to; date = addDays(date, 1)) dates.push(date)
    return dates
  }
  return [previousUtcDay()]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dates = datesFromArgs(args)
  const existing = await loadOutput()
  const seasons = { ...(existing.seasons ?? {}) }
  for (const asOf of dates) {
    const games = await fetchCompletedGames(asOf)
    const season = Number(asOf.slice(0, 4))
    const snapshots = buildTeamScoreSnapshots({ games, asOf })
    const oldSeason = seasons[season] ?? { byTeamId: {} }
    const byTeamId = { ...oldSeason.byTeamId }
    for (const [teamId, snapshot] of Object.entries(snapshots)) {
      byTeamId[teamId] = { ...(byTeamId[teamId] ?? {}), [asOf]: snapshot }
    }
    seasons[season] = { byTeamId }
    console.log(`${asOf}: ${Object.keys(snapshots).length} MLB team-score snapshots`)
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), seasons }))
  console.log(`wrote ${out}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
