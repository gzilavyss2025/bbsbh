// Regenerates public/data/season-score.json — MLB's daily, 0.0–10.0 Season
// Surprise Score. It answers one narrow question: how far above or below its
// preseason expectation has a club performed THROUGH a completed date? The
// headline uses actual wins only; run-differential "earned pace" and last-30
// form are stored as diagnostics, not blended into the grade. See
// docs/season-score.md and ADR-0018.
//
// The file stores date-keyed snapshots so a historical Team Page can use its
// exact spoiler-safe cutoff rather than today's season result. Normal nightly
// use appends yesterday's MLB snapshot; --date=YYYY-MM-DD rebuilds one date,
// and --from/--to backfills an inclusive date range.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'season-score.json')
const seedPath = join(here, 'season-expectations-seed.json')
const BASE = 'https://statsapi.mlb.com'
const MLB_LEAGUES = [103, 104]
const HOME_WIN_PROBABILITY = 0.54
const EARLY_SEASON_VARIANCE = 9 // keeps a 10-game hot streak below the ceiling

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))
const round1 = (n) => Math.round(n * 10) / 10
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

// Converts team strength into a per-game expectation. Log-odds preserves the
// relative gap between two projections, and the 54% home baseline applies only
// to that game's venue. It is deliberately not a live-strength forecast.
export function expectedHomeWinProbability(homeWins, awayWins) {
  const logit = (p) => Math.log(p / (1 - p))
  const logistic = (x) => 1 / (1 + Math.exp(-x))
  const home = clamp(homeWins / 162, 0.25, 0.75)
  const away = clamp(awayWins / 162, 0.25, 0.75)
  return logistic(logit(home) - logit(away) + logit(HOME_WIN_PROBABILITY))
}

// A damped residual maps cleanly onto 5.0 at expectation while a short sample
// cannot reach 9–10. The constants are calibration candidates, not hidden
// factors: the stored residual and effective z make every score inspectable.
export function seasonScoreFromResidual(residualWins, gameVariance) {
  const effectiveZ = residualWins / Math.sqrt(Math.max(0, gameVariance) + EARLY_SEASON_VARIANCE)
  return {
    effectiveZ,
    score: round1(clamp(5 + 4.5 * Math.tanh(effectiveZ / 2), 0, 10)),
  }
}

export function marcelBaseline(records) {
  const weights = [3, 2, 1]
  let weightedGames = 0
  let weightedWins = 0
  for (let i = 0; i < weights.length; i++) {
    const record = records[i]
    const games = (record?.wins ?? 0) + (record?.losses ?? 0)
    if (!games) continue
    weightedWins += weights[i] * record.wins
    weightedGames += weights[i] * games
  }
  if (!weightedGames) return 81
  // Fifty .500 games is a compact Marcel-style regression prior.
  return round1(162 * (weightedWins + 25) / (weightedGames + 50))
}

function pythagoreanPace(record, gamesPlayed) {
  const expected = (record.expectedRecords ?? []).find((r) => r.type === 'xWinLoss')
  const xGames = (expected?.wins ?? 0) + (expected?.losses ?? 0)
  if (xGames > 0) return round1((expected.wins / xGames) * 162)
  const rs = record.runsScored ?? 0
  const ra = record.runsAllowed ?? 0
  if (gamesPlayed <= 0 || rs + ra <= 0) return null
  const exponent = ((rs + ra) / gamesPlayed) ** 0.287
  const pct = rs ** exponent / (rs ** exponent + ra ** exponent)
  return Number.isFinite(pct) ? round1(pct * 162) : null
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
    homeWon: home.score > away.score,
  }
}

export function buildSnapshots({ games, baselines, standings, asOf }) {
  const state = new Map()
  const ensure = (id) => {
    if (!state.has(id)) state.set(id, { wins: 0, losses: 0, expectedWins: 0, variance: 0, games: [] })
    return state.get(id)
  }

  for (const game of games) {
    const home = ensure(game.homeId)
    const away = ensure(game.awayId)
    const homeP = expectedHomeWinProbability(baselines[game.homeId].wins, baselines[game.awayId].wins)
    const gameVariance = homeP * (1 - homeP)
    home.expectedWins += homeP
    away.expectedWins += 1 - homeP
    home.variance += gameVariance
    away.variance += gameVariance
    if (game.homeWon) {
      home.wins++
      away.losses++
    } else {
      away.wins++
      home.losses++
    }
    home.games.push({ date: game.date, won: game.homeWon })
    away.games.push({ date: game.date, won: !game.homeWon })
  }

  const snapshots = {}
  for (const [teamId, s] of state) {
    const gamesPlayed = s.wins + s.losses
    if (!gamesPlayed) continue
    const residualWins = s.wins - s.expectedWins
    const { score, effectiveZ } = seasonScoreFromResidual(residualWins, s.variance)
    const trendGames = s.games.sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
    const trendWins = trendGames.filter((g) => g.won).length
    const standing = standings[teamId] ?? {}
    snapshots[teamId] = {
      score,
      asOf,
      gamesPlayed,
      wins: s.wins,
      losses: s.losses,
      expectedWinsToDate: round1(s.expectedWins),
      residualWins: round1(residualWins),
      effectiveZ: round1(effectiveZ),
      baselineWins: baselines[teamId].wins,
      baselineKind: baselines[teamId].kind,
      baselineSource: baselines[teamId].source ?? null,
      paceWins: round1((s.wins / gamesPlayed) * 162),
      earnedPaceWins: pythagoreanPace(standing, gamesPlayed),
      trend: { wins: trendWins, losses: trendGames.length - trendWins, games: trendGames.length },
    }
  }
  return snapshots
}

async function loadSeed() {
  try {
    return JSON.parse(await readFile(seedPath, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

async function loadOutput() {
  try {
    return JSON.parse(await readFile(out, 'utf8'))
  } catch {
    return { version: 1, generatedAt: null, seasons: {} }
  }
}

async function fetchStandingRows(season, date) {
  const results = await Promise.all(
    MLB_LEAGUES.map((leagueId) =>
      getJson(`/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason&date=${date}`),
    ),
  )
  const out = {}
  for (const result of results) {
    for (const division of result.records ?? []) {
      for (const record of division.teamRecords ?? []) out[record.team?.id] = record
    }
  }
  return out
}

async function fetchPriorRecords(season, teamIds) {
  const prior = await Promise.all(
    [season - 1, season - 2, season - 3].map(async (year) => fetchStandingRows(year, `${year}-12-31`)),
  )
  const out = {}
  for (const teamId of teamIds) out[teamId] = prior.map((rows) => rows[teamId] ?? null)
  return out
}

async function fetchCompletedGames(asOf) {
  const season = Number(asOf.slice(0, 4))
  const startDate = `${season}-03-01`
  const data = await getJson(
    `/api/v1/schedule?sportId=1&gameType=R&startDate=${startDate}&endDate=${asOf}`,
  )
  const seen = new Set()
  const games = []
  for (const row of (data.dates ?? []).flatMap((d) => d.games ?? [])) {
    if (row.status?.abstractGameState !== 'Final' || seen.has(row.gamePk)) continue
    const outcome = gameOutcome(row)
    if (!outcome) continue
    seen.add(row.gamePk)
    games.push(outcome)
  }
  return games
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

async function buildDate(asOf, seed) {
  const season = Number(asOf.slice(0, 4))
  const [standings, games] = await Promise.all([fetchStandingRows(season, asOf), fetchCompletedGames(asOf)])
  const teamIds = new Set([...Object.keys(standings).map(Number), ...games.flatMap((g) => [g.homeId, g.awayId])])
  const priorRecords = await fetchPriorRecords(season, teamIds)
  const seasonSeed = seed[season] ?? {}
  const baselines = {}
  for (const teamId of teamIds) {
    const seeded = seasonSeed[teamId]
    if (Number.isFinite(seeded?.baselineWins)) {
      baselines[teamId] = { wins: seeded.baselineWins, kind: 'market', source: seeded.source ?? null }
    } else {
      baselines[teamId] = { wins: marcelBaseline(priorRecords[teamId]), kind: 'marcel', source: null }
    }
  }
  return { season, snapshots: buildSnapshots({ games, baselines, standings, asOf }) }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dates = datesFromArgs(args)
  const [seed, existing] = await Promise.all([loadSeed(), loadOutput()])
  const seasons = { ...(existing.seasons ?? {}) }
  for (const date of dates) {
    const { season, snapshots } = await buildDate(date, seed)
    const oldSeason = seasons[season] ?? { byTeamId: {} }
    const byTeamId = { ...oldSeason.byTeamId }
    for (const [teamId, snapshot] of Object.entries(snapshots)) {
      byTeamId[teamId] = { ...(byTeamId[teamId] ?? {}), [date]: snapshot }
    }
    seasons[season] = { byTeamId }
    console.log(`${date}: ${Object.keys(snapshots).length} MLB season-score snapshots`)
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), seasons }))
  console.log(`wrote ${out}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
