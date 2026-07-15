// Regenerates public/data/all-star-rosters.json — every MLB All-Star Game
// roster, year over year, back to the game's 1933 debut.
//
// Source: GET /api/v1/awards/{ALAS,NLAS}/recipients?sportId=1&season=YYYY —
// the same authoritative selections endpoint fetchAllStarRosterIds
// (src/api/person-fetch.js) already uses. It is the AUTHORITATIVE roster:
// it still names a player who was selected but then withdrew (an injury, or
// a starter who pitched the Sunday before and begged off) — he earned the
// honor and stays listed, even though he never played. A plain boxscore scan
// would miss him.
//
// Each season's game (for the box-score link) comes from
// GET /api/v1/schedule?sportId=1&season=YYYY&gameType=A — this file stores
// only the gamePk; the screen resolves live team/date info from it via
// fetchGameCardsByPk (src/api/schedule.js), same pattern as TopGamesPage, so
// the JSON never goes stale on a franchise rename. 1959–1962 played two
// games a year; like fetchAllStarBoxscoreIds's existing fallback, this just
// takes dates[0]'s first game and drops the second, rather than modeling
// doubleheader-style multi-game seasons no other part of the route grammar
// supports.
//
// A season's ASG roster is decided once (rosters are locked at selection,
// even a late injury replacement is itself a fresh, permanent recipient) and
// never changes, so this is a HAND-RUN regenerate (like gen-awards-history.mjs
// / gen-milb-history.mjs), NOT a cron. A season with no game (1945: wartime
// travel restrictions; 2020: canceled) simply comes back empty and is
// dropped, same graceful-degradation rule as gen-awards-history.mjs's
// still-in-progress current season.
//
// Team names are resolved PER (teamId, season) via
// GET /api/v1/teams/{id}?season=YYYY rather than the app's static
// current-team table (teamFullName in src/lib/teams.js) — a franchise's id
// is stable across a relocation/rename (e.g. id 142 is the Minnesota Twins
// today but was the Washington Senators in 1933) but its NAME isn't, and a
// historical roster should read with the name the player actually played
// under. Deduped across the whole run so each (teamId, season) pair costs
// exactly one call regardless of how many players on that team were named.
//
// Run by hand: node scripts/gen-all-star-rosters.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'all-star-rosters.json')
const BASE = 'https://statsapi.mlb.com'

const FIRST_SEASON = 1933
const CURRENT_SEASON = new Date().getUTCFullYear()
const seasons = []
for (let y = CURRENT_SEASON; y >= FIRST_SEASON; y--) seasons.push(y)

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// Run an async mapper across items with a small concurrency cap, results in
// order (be polite to statsapi). Mirrors gen-awards-history.mjs's helper.
async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// Same bucket order as gen-awards-history.mjs's POSITION_ORDER (kept as a
// deliberate small duplication, not a shared import — self-contained
// generators, same convention as gen-rehab.mjs mirroring person.js's
// detectRehabAssignment) — pitchers, catchers, infield, outfield, DH, in a
// fixed order so the same position lands in the same slot every year
// instead of reshuffling with whatever order the recipients endpoint
// happened to return.
const POSITION_ORDER = ['P', 'SP', 'RP', 'CP', 'C', '1B', '2B', '3B', 'SS', 'OF', 'LF', 'CF', 'RF', 'DH', 'UT']
const POSITION_RANK = Object.fromEntries(POSITION_ORDER.map((p, i) => [p, i]))

function sortByPosition(recipients) {
  return recipients
    .map((r, i) => ({ r, i, rank: POSITION_RANK[r.position] ?? 99 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ r }) => r)
}

console.log(`Fetching ${seasons.length} seasons of All-Star selections + games…`)

const seasonJobs = await mapConcurrent(seasons, 8, async (season) => {
  const [al, nl, sched] = await Promise.all([
    getJson(`/api/v1/awards/ALAS/recipients?sportId=1&season=${season}`).catch(() => null),
    getJson(`/api/v1/awards/NLAS/recipients?sportId=1&season=${season}`).catch(() => null),
    getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=A`).catch(() => null),
  ])
  // 1959-1962 played two All-Star Games a year, and the recipients endpoint
  // returns the same season's roster once per game — dedup by (league,
  // playerId) so a player selected for both games of a two-game season
  // isn't listed twice.
  const recipients = []
  const seenPlayers = new Set()
  for (const [league, data] of [['AL', al], ['NL', nl]]) {
    for (const a of data?.awards ?? []) {
      if (!a.player?.id) continue
      const key = `${league}:${a.player.id}`
      if (seenPlayers.has(key)) continue
      seenPlayers.add(key)
      recipients.push({
        league,
        playerId: a.player.id,
        name: a.player.nameFirstLast || '',
        teamId: a.team?.id ?? null,
        position: a.player.primaryPosition?.abbreviation || '',
      })
    }
  }
  const gamePk = sched?.dates?.[0]?.games?.[0]?.gamePk ?? null
  return { season, recipients, gamePk }
})

// Dedup (teamId, season) pairs across every season before resolving names —
// the same team is named by 2-3 players most years, and a naive per-recipient
// call would waste most of its requests re-fetching an identical answer.
const teamPairKeys = new Set()
const teamPairs = []
for (const job of seasonJobs) {
  if (!job) continue
  for (const r of job.recipients) {
    if (!r.teamId) continue
    const key = `${r.teamId}:${job.season}`
    if (teamPairKeys.has(key)) continue
    teamPairKeys.add(key)
    teamPairs.push({ teamId: r.teamId, season: job.season })
  }
}

console.log(`Resolving ${teamPairs.length} historical team names…`)

const teamNames = new Map()
await mapConcurrent(teamPairs, 10, async ({ teamId, season }) => {
  try {
    const data = await getJson(`/api/v1/teams/${teamId}?season=${season}`)
    teamNames.set(`${teamId}:${season}`, data.teams?.[0]?.name || '')
  } catch {
    teamNames.set(`${teamId}:${season}`, '')
  }
})

const rosters = {}
const games = {}
for (const job of seasonJobs) {
  if (!job) continue
  if (job.recipients.length > 0) {
    const withNames = job.recipients.map((r) => ({
      ...r,
      teamName: r.teamId ? teamNames.get(`${r.teamId}:${job.season}`) || '' : '',
    }))
    rosters[job.season] = sortByPosition(withNames)
  }
  if (job.gamePk) games[job.season] = job.gamePk
}

const seasonsOut = Object.keys(rosters)
  .map(Number)
  .sort((a, b) => b - a)

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), seasons: seasonsOut, rosters, games }),
)
console.log(
  `wrote ${out} (${seasonsOut.length} seasons, ${seasonsOut[seasonsOut.length - 1]}–${seasonsOut[0]})`,
)
