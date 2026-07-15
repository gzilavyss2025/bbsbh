// Regenerates public/data/postseason-history.json — the completed bracket
// (who played, who won, how many games) for each of the last several MLB
// postseasons, plus the round MVP where one exists (LCS + World Series only
// — Wild Card/Division Series carry no official MVP award).
//
// A finished postseason's results are immutable, so like
// gen-awards-history.mjs / gen-milb-history.mjs this is a HAND-RUN
// regenerate, NOT a cron — re-run it once a year after the World Series ends
// to fold in the season that just finished.
//
// Source: GET /api/v1/schedule?sportId=1&season=YYYY&gameType=F,D,L,W
// &hydrate=team,seriesStatus for the games (verified live: seriesDescription/
// seriesGameNumber/seriesStatus.totalGames all present on a 2024 pull), plus
// GET /api/v1/awards/{awardId}/recipients?season=YYYY for ALCSMVP/NLCSMVP/
// WSMVP (verified live: 2024 WSMVP returns Freddie Freeman). Games are
// grouped into a series by (gameType, seriesDescription, sorted team-id
// pair) — a team can play at most one series per label in a given
// postseason, so that triple is a stable series identity across whichever
// mix of home/away games it played.
//
// Only teamId is stored (mirrors gen-awards-history.mjs) — names/logos
// resolve client-side from the app's own src/lib/teams.js so this file can't
// drift from the rest of the app's team identity.
//
// Run by hand: node scripts/gen-postseason-history.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'postseason-history.json')
const BASE = 'https://statsapi.mlb.com'

const SEASON_COUNT = 5
const CURRENT_YEAR = new Date().getUTCFullYear()

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// gameType -> round bucket. Order here is bracket order (earliest round
// first), and doubles as the fixed render order on the page.
const ROUNDS = [
  { gameType: 'F', key: 'wildcard', label: 'Wild Card' },
  { gameType: 'D', key: 'division', label: 'Division Series' },
  { gameType: 'L', key: 'lcs', label: 'Championship Series' },
  { gameType: 'W', key: 'worldseries', label: 'World Series' },
]
const ROUND_BY_TYPE = Object.fromEntries(ROUNDS.map((r) => [r.gameType, r]))

// Only LCS/World Series hand out a series MVP. LCS splits AL/NL by the
// series' own league id; World Series is a single award.
function mvpAwardId(roundKey, leagueId) {
  if (roundKey === 'worldseries') return 'WSMVP'
  if (roundKey === 'lcs') return leagueId === 103 ? 'ALCSMVP' : leagueId === 104 ? 'NLCSMVP' : null
  return null
}

async function fetchMvp(awardId, season) {
  if (!awardId) return null
  const data = await getJson(`/api/v1/awards/${awardId}/recipients?season=${season}`)
  const award = (data.awards ?? [])[0]
  if (!award?.player?.id) return null
  return {
    playerId: award.player.id,
    name: award.player.nameFirstLast || '',
    teamId: award.team?.id ?? null,
  }
}

function seriesKeyFor(game) {
  const ids = [game.teams.away.team.id, game.teams.home.team.id].sort((a, b) => a - b)
  return `${game.gameType}|${game.seriesDescription}|${ids.join('-')}`
}

async function buildSeason(year) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${year}&gameType=F,D,L,W&hydrate=team,seriesStatus`,
  )
  const games = (data.dates ?? []).flatMap((d) => d.games ?? [])
  // Not started, or still in progress — nothing to show for this year yet.
  if (games.length === 0 || games.some((g) => g.status?.abstractGameState !== 'Final')) {
    return null
  }

  const seriesMap = new Map()
  for (const g of games) {
    const key = seriesKeyFor(g)
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        round: ROUND_BY_TYPE[g.gameType],
        label: g.seriesDescription || ROUND_BY_TYPE[g.gameType]?.label,
        leagueId: g.teams.home.team.league?.id ?? null,
        teamIds: [g.teams.away.team.id, g.teams.home.team.id],
        games: [],
      })
    }
    const series = seriesMap.get(key)
    series.games.push({
      gameNumber: g.seriesGameNumber ?? series.games.length + 1,
      date: g.officialDate,
      awayTeamId: g.teams.away.team.id,
      awayScore: g.teams.away.score ?? null,
      homeTeamId: g.teams.home.team.id,
      homeScore: g.teams.home.score ?? null,
    })
  }

  const seriesByRound = new Map(ROUNDS.map((r) => [r.key, []]))
  let championTeamId = null

  for (const series of seriesMap.values()) {
    series.games.sort((a, b) => a.gameNumber - b.gameNumber)
    const wins = new Map()
    for (const g of series.games) {
      const winnerId = g.awayScore > g.homeScore ? g.awayTeamId : g.homeTeamId
      wins.set(winnerId, (wins.get(winnerId) ?? 0) + 1)
    }
    const [teamA, teamB] = series.teamIds
    const winnerTeamId = (wins.get(teamA) ?? 0) > (wins.get(teamB) ?? 0) ? teamA : teamB
    if (series.round.key === 'worldseries') championTeamId = winnerTeamId

    const awardId = mvpAwardId(series.round.key, series.leagueId)
    const mvp = await fetchMvp(awardId, year)

    seriesByRound.get(series.round.key).push({
      id: `${year}-${series.round.key}-${teamA}-${teamB}`,
      label: series.label,
      teamA: { teamId: teamA, wins: wins.get(teamA) ?? 0 },
      teamB: { teamId: teamB, wins: wins.get(teamB) ?? 0 },
      winnerTeamId,
      gamesPlayed: series.games.length,
      mvp,
      games: series.games,
    })
  }

  const rounds = ROUNDS.map((r) => ({
    key: r.key,
    label: r.label,
    series: seriesByRound.get(r.key),
  })).filter((r) => r.series.length > 0)

  return { year, championTeamId, rounds }
}

const seasons = []
for (let year = CURRENT_YEAR; seasons.length < SEASON_COUNT && year > CURRENT_YEAR - 10; year--) {
  const season = await buildSeason(year)
  if (season) seasons.push(season)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), seasons }))
console.log(
  `wrote ${out} (${seasons.length} seasons, ${seasons[seasons.length - 1]?.year}–${seasons[0]?.year})`,
)
