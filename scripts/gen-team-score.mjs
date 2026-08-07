// Regenerates public/data/team-score.json — MLB's date-keyed Quality and
// Current Form. Both are team-quality measures: 60% actual wins and 40%
// Pythagorean run quality, centered on .500 and damped for small samples;
// Quality also folds in a per-game park adjustment to that run differential
// and a capped strength-of-schedule nudge from opponents' own season winning
// percentage (Current Form does neither — see teamScoreFormula.js). Season
// Surprise remains in season-score.json as the Grade's separate, visible Vs.
// expectation driver. The composite Season Grade is derived in
// src/api/seasonGradeFormula.js from same-cutoff snapshots. The formula
// itself lives in src/api/teamScoreFormula.js (pure, no node imports) so the
// team page's "how this is calculated" explainer can run the same math
// client-side — re-exported here so this script stays the existing import
// site for test/team-score.test.js. `game.venue.id`/`.name` were verified
// present on the schedule fetch below with no added hydration, checked
// against a live 2026-08-01 STL@TOR window.
import { dirname, join } from 'node:path'
import { writeJsonAtomic } from './lib/io.js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  pythagoreanPct,
  qualityScoreFromGames,
  currentFormScoreFromGames,
  lateGameAdjustment,
  scheduleStrengthAdjustment,
  venueRunFactor,
  CURRENT_FORM_GAMES,
} from '../src/api/teamScoreFormula.js'
import { classifyLateGame } from '../src/api/lateGameSwing.js'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'

export { pythagoreanPct, qualityScoreFromGames, currentFormScoreFromGames }

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'team-score.json')
const isoDay = (d) => d.toISOString().slice(0, 10)
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return isoDay(d)
}
const previousUtcDay = () => addDays(isoDay(new Date()), -1)

function parseArgs(argv) {
  const args = {}
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (match) args[match[1]] = match[2] ?? true
  }
  return args
}

const round1 = (n) => Math.round(n * 10) / 10
const round2 = (n) => Math.round(n * 100) / 100
const round3 = (n) => Math.round(n * 1000) / 1000

function summarize(games, scoreFn = qualityScoreFromGames, scoreExtras = {}, extraFields = {}) {
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
    ...extraFields,
  }
  return result
}

// Every opponent a team has actually played, so Quality's strength-of-
// schedule nudge (see teamScoreFormula.js) can compare a team's average
// opponent to a .500 club using real season records rather than a preseason
// projection. `winPctByTeam` is built from the SAME completed-games list
// summarize() draws from, so it can never look past the snapshot's own
// cutoff — no separate fetch, no extra cost.
function opponentWinPctLookup(byTeam) {
  const winPctByTeam = new Map()
  for (const [teamId, games] of byTeam) {
    const wins = games.filter((g) => g.won).length
    winPctByTeam.set(teamId, games.length ? wins / games.length : 0.5)
  }
  return winPctByTeam
}

function avgOpponentWinPct(games, winPctByTeam) {
  if (!games.length) return null
  const total = games.reduce((sum, g) => sum + (winPctByTeam.get(g.opponentId) ?? 0.5), 0)
  return total / games.length
}

// Every completed game's own venue, so Quality's park adjustment (see
// teamScoreFormula.js) can compare a game's actual runs to what a neutral
// park would have produced, from the SAME completed-games list summarize()
// already draws from — no separate fetch, and it can never look past the
// snapshot's own cutoff (asOf) because `games` already is.
function venueRunFactorLookup(games) {
  const byVenue = new Map()
  let leagueRuns = 0, leagueGames = 0
  for (const g of games) {
    const runs = g.homeRuns + g.awayRuns
    leagueRuns += runs
    leagueGames += 1
    if (g.venueId == null) continue
    const bucket = byVenue.get(g.venueId) ?? { runs: 0, games: 0 }
    bucket.runs += runs
    bucket.games += 1
    byVenue.set(g.venueId, bucket)
  }
  const leagueAvg = leagueGames ? leagueRuns / leagueGames : 0
  const factorByVenue = new Map()
  for (const [venueId, { runs, games: n }] of byVenue) {
    factorByVenue.set(venueId, venueRunFactor(runs / n, leagueAvg, n))
  }
  return factorByVenue
}

// Per-team season totals with each game's runs divided by that game's own
// venue factor — the Pythagorean half's actual inputs. The raw runsScored/
// runsAllowed/runDifferential summarize() already computes stay untouched
// and keep feeding the displayed Record/Run differential.
function parkAdjustedTotals(games) {
  return games.reduce(
    (totals, g) => {
      const factor = g.parkFactor ?? 1
      totals.runsScored += g.runsFor / factor
      totals.runsAllowed += g.runsAllowed / factor
      return totals
    },
    { runsScored: 0, runsAllowed: 0 },
  )
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
    venueId: game.venue?.id ?? null,
    innings: game.linescore?.innings ?? [],
  }
}

export function buildTeamScoreSnapshots({ games, asOf }) {
  const venueFactorByVenue = venueRunFactorLookup(games)
  const byTeam = new Map()
  const ensure = (teamId) => {
    if (!byTeam.has(teamId)) byTeam.set(teamId, [])
    return byTeam.get(teamId)
  }

  for (const game of games) {
    const late = classifyLateGame({ innings: game.innings, homeRuns: game.homeRuns, awayRuns: game.awayRuns })
    const parkFactor = game.venueId != null ? (venueFactorByVenue.get(game.venueId) ?? 1) : 1
    ensure(game.homeId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.homeRuns > game.awayRuns,
      runsFor: game.homeRuns,
      runsAllowed: game.awayRuns,
      opponentId: game.awayId,
      late: late.home,
      parkFactor,
    })
    ensure(game.awayId).push({
      gamePk: game.gamePk,
      date: game.date,
      won: game.awayRuns > game.homeRuns,
      runsFor: game.awayRuns,
      runsAllowed: game.homeRuns,
      opponentId: game.homeId,
      late: late.away,
      parkFactor,
    })
  }

  const winPctByTeam = opponentWinPctLookup(byTeam)

  const snapshots = {}
  for (const [teamId, teamGames] of byTeam) {
    const ordered = [...teamGames].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
    const formGames = ordered.slice(-CURRENT_FORM_GAMES)
    const currentForm = summarize(formGames, currentFormScoreFromGames, {
      lateSwingAdjustment: lateGameAdjustment(formGames.map((g) => g.late)),
    })
    currentForm.blownLeads = formGames.filter((g) => g.late.blownLead).length
    currentForm.clutchWins = formGames.filter((g) => g.late.clutchWin).length

    const oppWinPct = avgOpponentWinPct(ordered, winPctByTeam)
    const sos = scheduleStrengthAdjustment(oppWinPct, ordered.length)
    const parkAdjusted = parkAdjustedTotals(ordered)
    const avgParkFactor = ordered.length
      ? round3(ordered.reduce((sum, g) => sum + (g.parkFactor ?? 1), 0) / ordered.length)
      : null
    snapshots[teamId] = {
      asOf,
      season: summarize(
        ordered,
        qualityScoreFromGames,
        {
          adjustment: sos,
          parkAdjustedRunsScored: parkAdjusted.runsScored,
          parkAdjustedRunsAllowed: parkAdjusted.runsAllowed,
        },
        {
          avgOpponentWinPct: oppWinPct == null ? null : round3(oppWinPct),
          sosAdjustment: round2(sos),
          avgParkFactor,
          parkAdjustedRunDifferential: round1(parkAdjusted.runsScored - parkAdjusted.runsAllowed),
        },
      ),
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
