// Regenerates public/data/team-score.json — MLB's date-keyed Quality and
// Current Form. Both are team-quality measures: 60% actual wins and 40%
// Pythagorean run quality, centered on .500 and damped for small samples.
// Season Surprise remains in season-score.json as the Grade's separate,
// visible Vs. expectation driver. The composite Season Grade is derived in
// src/api/seasonGradeFormula.js from same-cutoff snapshots. The
// formula itself lives in src/api/teamScoreFormula.js (pure, no node
// imports) so the team page's "how this is calculated" explainer can run the
// same math client-side — re-exported here so this script stays the
// existing import site for test/team-score.test.js.
import { dirname, join } from 'node:path'
import { writeJsonAtomic } from './lib/io.js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  pythagoreanPct,
  qualityScoreFromGames,
  currentFormScoreFromGames,
  lateGameAdjustment,
  CURRENT_FORM_GAMES,
} from '../src/api/teamScoreFormula.js'
import { classifyLateGame } from '../src/api/lateGameSwing.js'
import { openDb, dumpGroup } from './lib/db.js'

export { pythagoreanPct, qualityScoreFromGames, currentFormScoreFromGames }

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

function summarize(games, scoreFn = qualityScoreFromGames, scoreExtras = {}) {
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
    ...scoreFn({ wins, games: games.length, runsScored, runsAllowed, ...scoreExtras }),
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
    innings: game.linescore?.innings ?? [],
  }
}

export function buildTeamScoreSnapshots({ games, asOf }) {
  const byTeam = new Map()
  const ensure = (teamId) => {
    if (!byTeam.has(teamId)) byTeam.set(teamId, [])
    return byTeam.get(teamId)
  }

  for (const game of games) {
    const late = classifyLateGame({ innings: game.innings, homeRuns: game.homeRuns, awayRuns: game.awayRuns })
    ensure(game.homeId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.homeRuns > game.awayRuns,
      runsFor: game.homeRuns,
      runsAllowed: game.awayRuns,
      late: late.home,
    })
    ensure(game.awayId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.awayRuns > game.homeRuns,
      runsFor: game.awayRuns,
      runsAllowed: game.homeRuns,
      late: late.away,
    })
  }

  const snapshots = {}
  for (const [teamId, teamGames] of byTeam) {
    const ordered = [...teamGames].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
    const formGames = ordered.slice(-CURRENT_FORM_GAMES)
    const currentForm = summarize(formGames, currentFormScoreFromGames, {
      lateSwingAdjustment: lateGameAdjustment(formGames.map((g) => g.late)),
    })
    currentForm.blownLeads = formGames.filter((g) => g.late.blownLead).length
    currentForm.clutchWins = formGames.filter((g) => g.late.clutchWin).length
    snapshots[teamId] = {
      asOf,
      season: summarize(ordered),
      currentForm,
    }
  }
  return snapshots
}

async function fetchCompletedGames(asOf) {
  const season = Number(asOf.slice(0, 4))
  const data = await getJson(
    `/api/v1/schedule?sportId=1&gameType=R&startDate=${season}-03-01&endDate=${asOf}&hydrate=linescore`,
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

const upsertSnapshot = (db) =>
  db.prepare(
    `INSERT INTO team_snapshots (season, team_id, date, metric, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(season, team_id, date, metric) DO UPDATE SET payload_json = excluded.payload_json`,
  )

// Reconstructs public/data/team-score.json's original nested shape —
// { seasons: { <year>: { byTeamId: { <teamId>: { <date>: { asOf, season, currentForm } } } } } } —
// from the flat team_snapshots table (docs/adr/0021). `asOf` comes back from
// the table's own `date` column rather than being duplicated in payload_json.
function exportJson(db) {
  const rows = db
    .prepare(
      `SELECT * FROM team_snapshots WHERE metric IN ('quality', 'current_form')
       ORDER BY season, team_id, date, metric DESC`, // DESC: 'quality' sorts before 'current_form'
    )
    .all()
  const seasons = {}
  for (const row of rows) {
    const season = (seasons[row.season] ??= { byTeamId: {} })
    const byDate = (season.byTeamId[row.team_id] ??= {})
    const entry = (byDate[row.date] ??= { asOf: row.date })
    const payload = JSON.parse(row.payload_json)
    if (row.metric === 'quality') entry.season = payload
    else entry.currentForm = payload
  }
  return { version: 1, generatedAt: new Date().toISOString(), seasons }
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
  const db = await openDb()
  const insert = upsertSnapshot(db)
  for (const asOf of dates) {
    const games = await fetchCompletedGames(asOf)
    const season = Number(asOf.slice(0, 4))
    const snapshots = buildTeamScoreSnapshots({ games, asOf })
    for (const [teamId, snapshot] of Object.entries(snapshots)) {
      insert.run(season, Number(teamId), asOf, 'quality', JSON.stringify(snapshot.season))
      insert.run(season, Number(teamId), asOf, 'current_form', JSON.stringify(snapshot.currentForm))
    }
    console.log(`${asOf}: ${Object.keys(snapshots).length} MLB team-score snapshots`)
  }
  await dumpGroup(db, 'team-snapshots')
  await writeJsonAtomic(out, exportJson(db))
  console.log(`wrote ${out}`)
  db.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
