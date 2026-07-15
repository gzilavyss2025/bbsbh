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
// PRECOMPUTED SECTIONS: each season's roster also carries, per league, three
// buckets — starters (the starting lineup that actually took the field,
// including the starting pitcher and DH slot), bullpen (pitchers who didn't
// start), and substitutes (position players who didn't start) — computed
// here rather than on every page load (the "thin local database" the app
// reads is meant to need no client-side grouping). Membership comes from one
// extra call per season, GET /api/v1/game/{gamePk}/boxscore (the lightweight
// standalone boxscore endpoint, same teams.{away,home}.players[...] shape as
// feed.liveData.boxscore — see src/api/boxscore.js's findBoxscorePlayer), read
// the same way src/api/select.js's selectLineup does: a player whose
// battingOrder is an exact multiple of 100 started that lineup slot (this
// naturally covers the DH slot too), and team.pitchers[0] is the starting
// pitcher. A starter's position is overwritten with the position he actually
// played that game (box.allPositions[0], falling back to box.position) rather
// than his career-primary position label, so Starting Lineup sorts by what
// happened on the field. A season whose boxscore fetch fails or doesn't
// resolve a recipient (very old games, data gaps) falls back to the simple
// rule: pitchers -> bullpen, everyone else -> substitutes, nobody -> starters.
//
// FINAL SCORE: the same schedule call that resolves gamePk already carries
// the final score for a completed game (teams.{away,home}.score) — no extra
// fetch needed. Read by team id rather than by side, since the ASG's two
// "teams" are the fixed AL/NL All-Star pseudo-clubs (159/160, not the real
// clubs), and stored as `scores[season] = { al, nl }`. All-Star Rosters is
// the one game surface in this app that shows a final score plainly — see
// docs/adr/0019-all-star-rosters-shows-final-scores.md for why that's safe
// here specifically.
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
// fixed order so a recipient who can't be matched against the boxscore (the
// fallback path) still lands in a stable slot within its bucket.
const POSITION_ORDER = ['P', 'SP', 'RP', 'CP', 'C', '1B', '2B', '3B', 'SS', 'OF', 'LF', 'CF', 'RF', 'DH', 'UT']
const POSITION_RANK = Object.fromEntries(POSITION_ORDER.map((p, i) => [p, i]))

// Scorebook order for the Starting Lineup bucket: pitcher first, then the
// defensive spots in their traditional #2-9 numbering, generic "OF" (some
// older rosters don't split LF/CF/RF) grouped with the outfield trio, DH last.
const SCOREBOOK_ORDER = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH']
const SCOREBOOK_RANK = Object.fromEntries(SCOREBOOK_ORDER.map((p, i) => [p, i]))

const PITCHER_POSITIONS = new Set(['P', 'SP', 'RP', 'CP'])

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
  const game = sched?.dates?.[0]?.games?.[0] ?? null
  const gamePk = game?.gamePk ?? null
  // The schedule row itself already carries the final score for a completed
  // game (teams.{away,home}.score) — no extra call needed. The ASG's two
  // "teams" are the fixed AL/NL All-Star pseudo-clubs (ids 159/160), so read
  // by id rather than assuming AL is always away/home.
  let alScore = null
  let nlScore = null
  for (const side of ['away', 'home']) {
    const t = game?.teams?.[side]
    if (t?.team?.id === 159 && typeof t.score === 'number') alScore = t.score
    if (t?.team?.id === 160 && typeof t.score === 'number') nlScore = t.score
  }
  const score = alScore != null && nlScore != null ? { al: alScore, nl: nlScore } : null
  return { season, recipients, gamePk, score }
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

const gamesToFetch = seasonJobs.filter((j) => j?.gamePk)
console.log(`Fetching ${gamesToFetch.length} game boxscores for lineup detail…`)

const boxscoreByGamePk = new Map()
await mapConcurrent(gamesToFetch, 8, async (job) => {
  try {
    const data = await getJson(`/api/v1/game/${job.gamePk}/boxscore`)
    boxscoreByGamePk.set(job.gamePk, data)
  } catch {
    boxscoreByGamePk.set(job.gamePk, null)
  }
})

// Who started (batting slot or on the mound) and what each starter actually
// played, scanning both boxscore sides — league membership comes from the
// recipient list itself, so there's no need to know which side is AL/NL.
function buildBoxscoreInfo(box) {
  if (!box) return null
  const startingBatterIds = new Set()
  const startingPitcherIds = new Set()
  const positionById = new Map()
  for (const side of ['away', 'home']) {
    const team = box?.teams?.[side]
    if (!team) continue
    for (const p of Object.values(team.players ?? {})) {
      const id = p?.person?.id
      if (!id) continue
      const bo = Number(p.battingOrder)
      if (Number.isFinite(bo) && bo >= 100 && bo % 100 === 0) {
        startingBatterIds.add(id)
        const pos = p.allPositions?.[0]?.abbreviation || p.position?.abbreviation || ''
        if (pos) positionById.set(id, pos)
      }
    }
    const starterId = team.pitchers?.[0]
    if (starterId) startingPitcherIds.add(starterId)
  }
  return { startingBatterIds, startingPitcherIds, positionById }
}

// Group a bucket's players by team (players on the same club adjacent),
// ordered by each team's first appearance in the input list, and within a
// team by POSITION_RANK — stable, no extra sort key needed since the input
// already carries the recipients endpoint's own order.
function groupByTeam(list) {
  const order = []
  const groups = new Map()
  for (const r of list) {
    const key = r.teamId ?? 'none'
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key).push(r)
  }
  const result = []
  for (const key of order) {
    const group = groups.get(key)
    group.sort((a, b) => (POSITION_RANK[a.position] ?? 99) - (POSITION_RANK[b.position] ?? 99))
    result.push(...group)
  }
  return result
}

function sortStarters(list) {
  return list
    .map((r, i) => ({ r, i, rank: SCOREBOOK_RANK[r.position] ?? 99 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ r }) => r)
}

// Classify one league's recipients for a season into starters/bullpen/
// substitutes. `boxInfo` is null when the boxscore fetch failed or the game
// predates reliable data — every recipient then falls back to the simple
// pitcher-or-not split, with nobody in starters (see header comment).
function classifyRecipients(recipients, boxInfo) {
  const starters = []
  const bullpen = []
  const substitutes = []
  for (const r of recipients) {
    const isPitcherRole = PITCHER_POSITIONS.has(r.position)
    if (boxInfo?.startingPitcherIds.has(r.playerId)) {
      starters.push({ ...r, position: 'P' })
    } else if (boxInfo?.startingBatterIds.has(r.playerId)) {
      starters.push({ ...r, position: boxInfo.positionById.get(r.playerId) || r.position })
    } else if (isPitcherRole) {
      bullpen.push(r)
    } else {
      substitutes.push(r)
    }
  }
  return {
    starters: sortStarters(starters),
    bullpen: groupByTeam(bullpen),
    substitutes: groupByTeam(substitutes),
  }
}

const rosters = {}
const games = {}
const scores = {}
for (const job of seasonJobs) {
  if (!job) continue
  if (job.recipients.length > 0) {
    const withNames = job.recipients.map((r) => ({
      ...r,
      teamName: r.teamId ? teamNames.get(`${r.teamId}:${job.season}`) || '' : '',
    }))
    const boxInfo = buildBoxscoreInfo(boxscoreByGamePk.get(job.gamePk))
    const al = withNames.filter((r) => r.league === 'AL')
    const nl = withNames.filter((r) => r.league === 'NL')
    rosters[job.season] = {
      AL: classifyRecipients(al, boxInfo),
      NL: classifyRecipients(nl, boxInfo),
    }
  }
  if (job.gamePk) games[job.season] = job.gamePk
  if (job.score) scores[job.season] = job.score
}

const seasonsOut = Object.keys(rosters)
  .map(Number)
  .sort((a, b) => b - a)

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ generatedAt: new Date().toISOString(), seasons: seasonsOut, rosters, games, scores }),
)
console.log(
  `wrote ${out} (${seasonsOut.length} seasons, ${seasonsOut[seasonsOut.length - 1]}–${seasonsOut[0]})`,
)
