// Regenerates public/data/postseason-odds.json — MLB's date-keyed postseason
// odds (playoff / division-winner / bye probability + projected wins),
// via a Monte Carlo simulation of the rest of each season. Team strength comes
// from team-score.json (60% actual wins / 40% Pythagorean, already computed by
// gen-team-score.mjs) rather than a separate projection system, so the odds
// stay in lockstep with the Team Score badge already on the Team Page.
//
// The file stores date-keyed snapshots, same shape as season-score.json, so a
// historical Team Page can render the odds AS THEY STOOD entering its
// spoiler-safe cutoff rather than today's live number. Normal nightly use
// appends yesterday's snapshot; --date=YYYY-MM-DD rebuilds one date, and
// --from/--to backfills an inclusive range. --sims overrides the per-date
// simulation count (default 5000).
//
// World Series / pennant odds are deliberately NOT computed here — they need a
// bracket simulation (best-of-3/5/7) on top of this, a separate layer. This
// generator only answers "does this team make the 6-team field."
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'postseason-odds.json')
const teamScorePath = join(here, '..', 'public', 'data', 'team-score.json')
const BASE = 'https://statsapi.mlb.com'
const MLB_LEAGUES = [103, 104]
const HOME_WIN_PROBABILITY = 0.54
const DEFAULT_SIMS = 5000

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10
// Two decimals for the probability fields: at DEFAULT_SIMS the true
// granularity is finer than 0.1%, and near the 0%/100% extremes that extra
// digit is what lets the UI show "99.95%" instead of overstating certainty
// with a flat "100.0%" (see PostseasonOddsCard's formatPct).
const round2 = (n) => Math.round(n * 100) / 100
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

// Same log-odds combiner as gen-season-score.mjs's expectedHomeWinProbability,
// but on WIN PROBABILITIES directly rather than wins/162 — the strength inputs
// here are already rates (team-score.json's weightedWins/games).
export function homeWinProbability(homeStrength, awayStrength) {
  const logit = (p) => Math.log(p / (1 - p))
  const logistic = (x) => 1 / (1 + Math.exp(-x))
  const home = clamp(homeStrength, 0.05, 0.95)
  const away = clamp(awayStrength, 0.05, 0.95)
  return logistic(logit(home) - logit(away) + logit(HOME_WIN_PROBABILITY))
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Groups teams by division/league once per date (structure doesn't change
// across simulations, only the wins do).
function buildLeagueStructure(standings) {
  const divisions = new Map() // divisionId -> [teamId]
  const leagueDivisions = new Map() // leagueId -> Set(divisionId)
  const leagueTeams = new Map() // leagueId -> [teamId]
  for (const [teamIdStr, info] of Object.entries(standings)) {
    const teamId = Number(teamIdStr)
    if (!divisions.has(info.divisionId)) divisions.set(info.divisionId, [])
    divisions.get(info.divisionId).push(teamId)
    if (!leagueDivisions.has(info.leagueId)) leagueDivisions.set(info.leagueId, new Set())
    leagueDivisions.get(info.leagueId).add(info.divisionId)
    if (!leagueTeams.has(info.leagueId)) leagueTeams.set(info.leagueId, [])
    leagueTeams.get(info.leagueId).push(teamId)
  }
  return { divisions, leagueDivisions, leagueTeams }
}

// Current 6-team-per-league field: the 3 division winners (seeded 1-3 by
// record, top 2 seeds get the bye into the Division Series) plus the
// next-3-best records league-wide as wild cards (seeded 4-6, playing the
// Wild Card round). Ties are broken by a random shuffle before comparing
// wins — an approximation of real tiebreaker games/rules, acceptable for
// odds that are already an average over thousands of simulated seasons.
export function classifyPlayoffs(wins, structure) {
  const result = {}
  for (const [leagueId, divisionIds] of structure.leagueDivisions) {
    const winners = []
    for (const divisionId of divisionIds) {
      const contenders = shuffle(structure.divisions.get(divisionId))
      winners.push(contenders.reduce((best, id) => (wins[id] > wins[best] ? id : best), contenders[0]))
    }
    const winnerSet = new Set(winners)
    const wildCardField = shuffle(structure.leagueTeams.get(leagueId).filter((id) => !winnerSet.has(id)))
    wildCardField.sort((a, b) => wins[b] - wins[a])
    const wildcards = wildCardField.slice(0, 3)
    const seededWinners = shuffle(winners).sort((a, b) => wins[b] - wins[a])
    const byeSeeds = new Set(seededWinners.slice(0, 2))
    for (const id of winners) result[id] = { playoffs: true, divisionWinner: true, bye: byeSeeds.has(id) }
    for (const id of wildcards) result[id] = { playoffs: true, divisionWinner: false, bye: false }
    for (const id of wildCardField) if (!result[id]) result[id] = { playoffs: false, divisionWinner: false, bye: false }
  }
  return result
}

export function simulateOdds({ standings, remaining, strength, sims }) {
  const structure = buildLeagueStructure(standings)
  const teamIds = Object.keys(standings).map(Number)
  const tally = {}
  for (const id of teamIds) tally[id] = { playoffs: 0, divisionWinner: 0, bye: 0, winsSum: 0 }

  for (let i = 0; i < sims; i++) {
    const wins = {}
    for (const id of teamIds) wins[id] = standings[id].wins
    for (const g of remaining) {
      const p = homeWinProbability(strength[g.homeId] ?? 0.5, strength[g.awayId] ?? 0.5)
      if (Math.random() < p) wins[g.homeId]++
      else wins[g.awayId]++
    }
    const classified = classifyPlayoffs(wins, structure)
    for (const id of teamIds) {
      tally[id].winsSum += wins[id]
      if (classified[id]?.playoffs) tally[id].playoffs++
      if (classified[id]?.divisionWinner) tally[id].divisionWinner++
      if (classified[id]?.bye) tally[id].bye++
    }
  }

  const snapshots = {}
  for (const id of teamIds) {
    snapshots[id] = {
      sims,
      playoffPct: round2((100 * tally[id].playoffs) / sims),
      divisionPct: round2((100 * tally[id].divisionWinner) / sims),
      byePct: round2((100 * tally[id].bye) / sims),
      projectedWins: round1(tally[id].winsSum / sims),
    }
  }
  return snapshots
}

async function fetchStandingsWithDivisions(season, date) {
  const results = await Promise.all(
    MLB_LEAGUES.map((leagueId) =>
      getJson(`/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason&date=${date}`),
    ),
  )
  const out = {}
  for (const result of results) {
    for (const division of result.records ?? []) {
      const leagueId = division.league?.id
      const divisionId = division.division?.id
      for (const record of division.teamRecords ?? []) {
        const teamId = record.team?.id
        if (teamId == null) continue
        out[teamId] = { wins: record.wins ?? 0, losses: record.losses ?? 0, leagueId, divisionId }
      }
    }
  }
  return out
}

async function fetchRemainingGames(season, asOf) {
  const startDate = addDays(asOf, 1)
  const endDate = `${season}-10-05` // generous buffer past the regular-season finish
  const data = await getJson(`/api/v1/schedule?sportId=1&gameType=R&startDate=${startDate}&endDate=${endDate}`)
  const seen = new Set()
  const games = []
  for (const row of (data.dates ?? []).flatMap((d) => d.games ?? [])) {
    const homeId = row.teams?.home?.team?.id
    const awayId = row.teams?.away?.team?.id
    if (homeId == null || awayId == null || seen.has(row.gamePk)) continue
    seen.add(row.gamePk)
    games.push({ gamePk: row.gamePk, homeId, awayId })
  }
  return games
}

async function loadTeamScores() {
  try {
    return JSON.parse(await readFile(teamScorePath, 'utf8'))
  } catch {
    return { seasons: {} }
  }
}

// Deliberate small duplicate of teamScore.js's teamScoreFor (self-contained
// generator convention, same as gen-rehab.mjs mirroring person.js).
function teamScoreSnapshot(teamScores, teamId, season, cutoff) {
  const snapshots = teamScores?.seasons?.[season]?.byTeamId?.[teamId]
  if (!snapshots) return null
  const eligible = Object.keys(snapshots).filter((date) => date <= cutoff).sort()
  return eligible.length ? snapshots[eligible[eligible.length - 1]] : null
}

// Neutral-site win rate per team: team-score.json's weightedWins/games when
// available, falling back to raw standings win% for teams too new to have a
// snapshot (early expansion of a backfill range).
function buildStrength(standings, teamScores, season, cutoff) {
  const strength = {}
  for (const [teamIdStr, record] of Object.entries(standings)) {
    const teamId = Number(teamIdStr)
    const snap = teamScoreSnapshot(teamScores, teamId, season, cutoff)
    const games = snap?.season?.games ?? record.wins + record.losses
    const wins = snap?.season?.weightedWins ?? record.wins
    strength[teamId] = games > 0 ? clamp(wins / games, 0.3, 0.7) : 0.5
  }
  return strength
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

async function buildDate(asOf, teamScores, sims) {
  const season = Number(asOf.slice(0, 4))
  const [standings, remaining] = await Promise.all([
    fetchStandingsWithDivisions(season, asOf),
    fetchRemainingGames(season, asOf),
  ])
  const strength = buildStrength(standings, teamScores, season, asOf)
  const snapshots = simulateOdds({ standings, remaining, strength, sims })
  for (const snapshot of Object.values(snapshots)) snapshot.asOf = asOf
  return { season, snapshots }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dates = datesFromArgs(args)
  const sims = args.sims ? Number(args.sims) : DEFAULT_SIMS
  const [teamScores, existing] = await Promise.all([loadTeamScores(), loadOutput()])
  const seasons = { ...(existing.seasons ?? {}) }
  for (const date of dates) {
    const { season, snapshots } = await buildDate(date, teamScores, sims)
    const oldSeason = seasons[season] ?? { byTeamId: {} }
    const byTeamId = { ...oldSeason.byTeamId }
    for (const [teamId, snapshot] of Object.entries(snapshots)) {
      byTeamId[teamId] = { ...(byTeamId[teamId] ?? {}), [date]: snapshot }
    }
    seasons[season] = { byTeamId }
    console.log(`${date}: ${Object.keys(snapshots).length} MLB postseason-odds snapshots (${sims} sims)`)
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), seasons }))
  console.log(`wrote ${out}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
