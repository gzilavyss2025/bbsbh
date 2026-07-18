// Regenerates public/data/postseason-history.json — the completed bracket
// (who played, who won, how many games) for every MLB postseason back to
// 2000 (EARLIEST_YEAR below), plus the round MVP where one exists (LCS +
// World Series only — Wild Card/Division Series carry no official MVP
// award). Covers three different Wild Card formats across that span —
// straight-to-Division-Series (2000-2011), a single Wild Card game
// (2012-2019, plus the pandemic-expanded 8-team-per-league field in 2020),
// and the current best-of-3 round (2022+) — see the SEEDING comment below
// for how each shape degrades gracefully through the same seeding logic.
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
// mix of home/away games it played. Each game also carries its `gamePk` —
// same footing as gen-all-star-rosters.mjs's stored gamePk: the app
// resolves live team-abbreviation/date info from it via
// `fetchGameCardsByPk` (`src/api/schedule.js`) rather than this file
// storing an abbreviation that could go stale on a rename.
//
// Only teamId is stored (mirrors gen-awards-history.mjs) — names/logos
// resolve client-side from the app's own src/lib/teams.js so this file can't
// drift from the rest of the app's team identity. `leagueId` per series is
// the one exception: it's bracket TOPOLOGY (which side of the World Series a
// round belongs on), not team identity, so it's stored the same way `level`/
// `gameType` tags ride along in umpires.json/game-score.json rather than
// forcing the client to hardcode a 30-team AL/NL map that would drift on the
// next realignment.
//
// SEEDING (1-6 per league): statsapi carries no "seed" field anywhere —
// verified live against schedule/feed/standings for a 2024 gamePk. Derived
// instead from two things the API DOES carry, per league per season:
//   GET /api/v1/standings?leagueId={103|104}&season=YYYY&standingsTypes=regularSeason
//   for each team's `divisionChamp` flag (exactly 3 true per league) and
//   `leagueRecord.pct` (tiebreak only — see below), plus the Wild Card
//   round's own schedule already fetched above.
// Only the top 2 seeds get a bye (2022+ format); seed 3 (the weakest
// division champ) plays in the Wild Card round same as the 3 wildcards, so
// "did this division champ appear in a Wild Card series" cleanly separates
// seeds 1-2 (byes) from seed 3 — no standings tiebreak needed there. Within
// the Wild Card round, the higher seed always hosts game 1 of its series
// (verified live: 2024 HOU, the AL's #3 seed, hosted DET; BAL, the #4 seed,
// hosted KC) — that fixes seed 3 vs. 6 and seed 4 vs. 5 deterministically
// from the schedule alone. The ONE place `pct` actually breaks a tie is
// ordering the two seed 1/2 byes against each other (no game between them
// decides it) — a genuine record tie there is rare and, if hit, only swaps
// which bye box reads "1" vs. "2".
//
// Run by hand: node scripts/gen-postseason-history.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'postseason-history.json')
const BASE = 'https://statsapi.mlb.com'

// The app's own UI shows 2020-present eagerly and gates 2000-2019 behind a
// "Load more" button (PostseasonHistoryPage.jsx) — EARLIEST_YEAR is the
// generator's own floor, independent of that UI cutoff.
const EARLIEST_YEAR = 2000
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
    position: award.player.primaryPosition?.abbreviation ?? null,
  }
}

function seriesKeyFor(game) {
  const ids = [game.teams.away.team.id, game.teams.home.team.id].sort((a, b) => a - b)
  return `${game.gameType}|${game.seriesDescription}|${ids.join('-')}`
}

// Seeds (1-6) for one league in one season — see the SEEDING header comment
// for the derivation. `wcSeries`/`allSeries` are this league's own series
// (each `{ teamA: {teamId}, teamB: {teamId}, games: [...] }`), already built
// by buildSeason before this runs.
async function seedsForLeague(leagueId, season, wcSeries, allSeries) {
  const standings = await getJson(
    `/api/v1/standings?leagueId=${leagueId}&season=${season}&standingsTypes=regularSeason`,
  )
  const rows = (standings.records ?? []).flatMap((r) => r.teamRecords ?? [])
  const pctById = new Map(rows.map((r) => [r.team.id, parseFloat(r.leagueRecord?.pct) || 0]))
  const champById = new Map(rows.map((r) => [r.team.id, !!r.divisionChamp]))

  const allTeamIds = new Set()
  for (const s of allSeries) {
    allTeamIds.add(s.teamA.teamId)
    allTeamIds.add(s.teamB.teamId)
  }
  const wcTeamIds = new Set(wcSeries.flatMap((s) => [s.teamA.teamId, s.teamB.teamId]))

  const champs = [...allTeamIds].filter((id) => champById.get(id))
  const wildcards = [...allTeamIds].filter((id) => !champById.get(id))

  const byeChamps = champs
    .filter((id) => !wcTeamIds.has(id))
    .sort((a, b) => (pctById.get(b) ?? 0) - (pctById.get(a) ?? 0))
  // Normally at most one division champ plays in the Wild Card round (the
  // #3 seed, 2022+ format). 2020's pandemic-expanded 8-team-per-league
  // field is the one exception — every team played a Wild Card series that
  // year, so this can be more than one; sort by pct same as the byes since
  // there's no game between them to settle it either.
  const wcChamps = champs
    .filter((id) => wcTeamIds.has(id))
    .sort((a, b) => (pctById.get(b) ?? 0) - (pctById.get(a) ?? 0))

  const seeds = new Map()
  byeChamps.forEach((id, i) => seeds.set(id, i + 1))
  let nextSeed = byeChamps.length + 1
  wcChamps.forEach((id) => seeds.set(id, nextSeed++))

  // The Wild Card series with neither team a division champ is the pure
  // wildcard-vs-wildcard matchup — its game-1 home team is the higher seed.
  const pureWcSeries = wcSeries.filter(
    (s) => !champById.get(s.teamA.teamId) && !champById.get(s.teamB.teamId),
  )
  const ordered = pureWcSeries.flatMap((s) => [s.games[0].homeTeamId, s.games[0].awayTeamId])
  const leftover = wildcards
    .filter((id) => !seeds.has(id) && !ordered.includes(id))
    .sort((a, b) => (pctById.get(b) ?? 0) - (pctById.get(a) ?? 0))
  for (const id of [...ordered, ...leftover]) {
    if (!seeds.has(id)) seeds.set(id, nextSeed++)
  }

  return seeds
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
  // A rain/snow-suspended-and-resumed game can appear TWICE in the schedule
  // pull under the same gamePk — a postponed placeholder row alongside the
  // real completed record — so this tracks, per gamePk, whether the row
  // currently kept is the genuine Final one (side channel, not part of the
  // exported entry shape below).
  const finalByGamePk = new Map()
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
    const entry = {
      gameNumber: g.seriesGameNumber ?? series.games.length + 1,
      date: g.officialDate,
      gamePk: g.gamePk,
      awayTeamId: g.teams.away.team.id,
      awayScore: g.teams.away.score ?? null,
      homeTeamId: g.teams.home.team.id,
      homeScore: g.teams.home.score ?? null,
    }
    // Both the placeholder and the real record report `abstractGameState:
    // "Final"` (why the whole-season gate above doesn't catch this), but
    // only the genuine completed game carries `codedGameState: "F"` — the
    // placeholder's is "D" (Postponed). Verified against the real duplicate
    // rows for 2009 ALCS Game 6 (gamePk 263172) + 22 other suspended games
    // across 2004-2022: the placeholder's `awayScore`/`homeScore` are null
    // in every verified case, but `codedGameState` is the actual signal the
    // API uses to distinguish them, so this keeps the codedGameState==='F'
    // row regardless of whether a future placeholder ever carries a
    // non-null partial score instead of null — `awayScore > homeScore` on
    // a kept placeholder would otherwise silently credit a phantom win.
    const isFinalRecord = g.status?.codedGameState === 'F'
    const dupIndex = series.games.findIndex((existing) => existing.gamePk === entry.gamePk)
    if (dupIndex === -1) {
      series.games.push(entry)
      finalByGamePk.set(entry.gamePk, isFinalRecord)
    } else if (isFinalRecord && !finalByGamePk.get(entry.gamePk)) {
      series.games[dupIndex] = entry
      finalByGamePk.set(entry.gamePk, isFinalRecord)
    }
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
      // The World Series merges both leagues — `series.leagueId` is really
      // just the game-1 home team's league (an artifact of how it's
      // computed above), not this series' actual topology, so it's null
      // here rather than a misleading single value. Everywhere else it's a
      // real single-league round.
      leagueId: series.round.key === 'worldseries' ? null : series.leagueId,
      teamA: { teamId: teamA, wins: wins.get(teamA) ?? 0 },
      teamB: { teamId: teamB, wins: wins.get(teamB) ?? 0 },
      winnerTeamId,
      gamesPlayed: series.games.length,
      mvp,
      games: series.games,
    })
  }

  // Seed every non-World-Series team (the World Series merges both leagues,
  // so it carries whichever seed the team already earned in its own league's
  // rounds instead of computing a fresh one). Scoped to ONLY the
  // single-league rounds (Wild Card/Division/Championship) — the World
  // Series' own (null) leagueId would otherwise never match here, but an
  // earlier version matched it against whichever league happened to be
  // first in the Set, silently pulling the other league's WS team into that
  // league's seed pool and inflating seeds past 6 (e.g. 2025 NL champion
  // Dodgers reading seed "7" on the WS card because the AL side's team
  // count included them). Keep it explicit rather than relying on `null`
  // being falsy and hoping nothing re-introduces a real value there.
  const singleLeagueSeries = ['wildcard', 'division', 'lcs'].flatMap((k) => seriesByRound.get(k) ?? [])
  const leagueIds = [...new Set(singleLeagueSeries.map((s) => s.leagueId))].filter(Boolean)
  const seedsByLeague = new Map()
  for (const leagueId of leagueIds) {
    const allSeries = singleLeagueSeries.filter((s) => s.leagueId === leagueId)
    const wcSeries = (seriesByRound.get('wildcard') ?? []).filter((s) => s.leagueId === leagueId)
    seedsByLeague.set(leagueId, await seedsForLeague(leagueId, year, wcSeries, allSeries))
  }
  const seedFor = (teamId, leagueId) => seedsByLeague.get(leagueId)?.get(teamId) ?? null
  const worldSeries = seriesByRound.get('worldseries') ?? []
  const seedForAnyLeague = (teamId) => {
    for (const seeds of seedsByLeague.values()) {
      if (seeds.has(teamId)) return seeds.get(teamId)
    }
    return null
  }
  for (const s of seriesByRound.get('wildcard') ?? []) {
    s.teamA.seed = seedFor(s.teamA.teamId, s.leagueId)
    s.teamB.seed = seedFor(s.teamB.teamId, s.leagueId)
  }
  for (const s of seriesByRound.get('division') ?? []) {
    s.teamA.seed = seedFor(s.teamA.teamId, s.leagueId)
    s.teamB.seed = seedFor(s.teamB.teamId, s.leagueId)
  }
  for (const s of seriesByRound.get('lcs') ?? []) {
    s.teamA.seed = seedFor(s.teamA.teamId, s.leagueId)
    s.teamB.seed = seedFor(s.teamB.teamId, s.leagueId)
  }
  for (const s of worldSeries) {
    s.teamA.seed = seedForAnyLeague(s.teamA.teamId)
    s.teamB.seed = seedForAnyLeague(s.teamB.teamId)
  }

  const rounds = ROUNDS.map((r) => ({
    key: r.key,
    label: r.label,
    series: seriesByRound.get(r.key),
  })).filter((r) => r.series.length > 0)

  return { year, championTeamId, rounds }
}

const seasons = []
for (let year = CURRENT_YEAR; year >= EARLIEST_YEAR; year--) {
  const season = await buildSeason(year)
  if (season) seasons.push(season)
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), seasons }))
console.log(
  `wrote ${out} (${seasons.length} seasons, ${seasons[seasons.length - 1]?.year}–${seasons[0]?.year})`,
)
