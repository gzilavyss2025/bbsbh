// Regenerates public/data/rehab.json — the players currently on a major-league
// rehab assignment, league-wide, already shaped for the Rehab Assignments page
// (src/api/rehab.js just reads this file). Keyed by MLB Stats API personId.
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at request
// time. Building the list is expensive: the transaction feed tells us who STARTS
// a rehab but not reliably when one ENDS, so each candidate has to be verified
// against his actual game log and his rehab club's schedule (a few statsapi
// calls per player) to drop stints that have really finished — the player was
// activated back to the majors, sent down, or (season-ending surgery) never took
// the field again. Doing that on every page load would be dozens of requests; a
// nightly job that writes a small static file keeps the live page to a single
// same-origin read. Mirrors scripts/gen-war.mjs's build-time-fetch pattern (see
// docs/data-enrichment.md §5); rehab status changes slowly enough that a daily
// refresh is plenty.
// Regular season only, ON PURPOSE (#1438): the club schedule reads below ask
// gameType=R. A rehab stint is judged against the regular-season schedule, so
// postseason games are not read here.
// Run by hand: node scripts/gen-rehab.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPORT_LABEL } from '../src/lib/teams.js'
import { isoToday } from '../src/lib/dates.js'
import { txnDate, isRehabTxn, rehabListRow } from '../src/api/rehab-policy.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'rehab.json')
// An open stint has a rehab leg in the last 30 days (REHAB_MAX_DAYS), so a
// 40-day league-wide window finds every CANDIDATE. It does not decide the
// stint: each candidate's whole feed does (#1362), since the leg that started
// his stint, or the row that ended it, can sit outside any window.
const REHAB_WINDOW_DAYS = 40
// The rehab club must have played FEWER than this many games since the player's
// last appearance for them; at or beyond it the stint is treated as ended.
// Counting contests (not days) clears a starter's 5–6-day turn with margin.
const REHAB_STALE_GAMES = 7

const daysAgo = (n) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const currentSeason = () => new Date().getUTCFullYear()

// --- transaction pass: who is on a rehab assignment right now -----------------
// The stint rule — when one starts, what ends it, the 30-day cap, the
// same-day tie — is rehabListRow / openRehabStint in src/api/rehab-policy.js,
// the ONE rule the player page's banner also calls, so the two agree (#1362).

// The players with a rehab leg in the league-wide window: the candidates.
function rehabCandidateIds(transactions) {
  return [...new Set(transactions.filter((t) => isRehabTxn(t) && txnDate(t)).map((t) => t.person?.id).filter(Boolean))]
}

// One player's whole transaction feed, or null on a failed lookup (the player
// is dropped, same as a rehab that has ended).
async function fetchPlayerTransactions(personId) {
  try {
    return (await getJson(`/api/v1/transactions?playerId=${personId}`)).transactions ?? []
  } catch {
    return null
  }
}

// From the candidates' whole feeds, the players CURRENTLY on a major-league
// rehab assignment, one row per player, newest stint first.
async function selectActiveRehabAssignments(candidateIds, mlbIds, today) {
  const feeds = await mapConcurrent(candidateIds, 8, fetchPlayerTransactions)
  const rows = feeds.map((ts) => (ts ? rehabListRow(ts, mlbIds, today) : null)).filter(Boolean)
  rows.sort((a, b) =>
    a.since < b.since ? 1 : a.since > b.since ? -1 : a.playerName.localeCompare(b.playerName),
  )
  return rows
}

// --- batched lookups the transaction rows lack --------------------------------
async function fetchMlbTeamIds() {
  const data = await getJson('/api/v1/teams?sportId=1')
  return new Set((data.teams ?? []).map((t) => t.id))
}
async function fetchPositions(ids) {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return {}
  const data = await getJson(`/api/v1/people?personIds=${list.join(',')}`)
  const out = {}
  for (const p of data.people ?? []) out[p.id] = p.primaryPosition?.abbreviation || ''
  return out
}
async function fetchTeamLevels(ids) {
  const list = [...new Set(ids.filter(Boolean))]
  if (!list.length) return {}
  const data = await getJson(`/api/v1/teams?teamId=${list.join(',')}`)
  const out = {}
  for (const t of data.teams ?? []) out[t.id] = t.sport?.id ?? null
  return out
}

// --- verification pass: is the stint still live -------------------------------
async function fetchGameLogDates(personId, group, season, sportId) {
  const params = [`stats=gameLog`, `group=${group}`, `season=${season}`]
  if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
  try {
    const data = await getJson(`/api/v1/people/${personId}/stats?${params.join('&')}`)
    return (data.stats?.[0]?.splits ?? []).map((s) => ({ date: s.date || '', teamId: s.team?.id ?? null }))
  } catch {
    return []
  }
}

const clubFinalDatesCache = new Map()
function fetchClubFinalDates(clubId, sportId) {
  if (!clubId) return Promise.resolve([])
  if (clubFinalDatesCache.has(clubId)) return clubFinalDatesCache.get(clubId)
  const p = (async () => {
    const params = [
      `teamId=${clubId}`,
      `startDate=${daysAgo(REHAB_WINDOW_DAYS + 5)}`,
      `endDate=${isoToday()}`,
      `gameType=R`,
    ]
    if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
    try {
      const data = await getJson(`/api/v1/schedule?${params.join('&')}`)
      const dates = []
      for (const d of data.dates ?? []) {
        for (const g of d.games ?? []) {
          if (g.status?.abstractGameState === 'Final' || g.status?.codedGameState === 'F') {
            dates.push(g.officialDate ?? (g.gameDate ?? '').slice(0, 10))
          }
        }
      }
      return dates.filter(Boolean).sort()
    } catch {
      return []
    }
  })()
  clubFinalDatesCache.set(clubId, p)
  return p
}

async function isStillRehabbing(row, position, level, season) {
  const group = position === 'P' ? 'pitching' : 'hitting'
  const mlbLog = await fetchGameLogDates(row.playerId, group, season, 1)
  if (mlbLog.some((g) => g.date && g.date > row.since)) return false
  const clubLog = level ? await fetchGameLogDates(row.playerId, group, season, level) : []
  const lastClubGame = clubLog
    .filter((g) => g.teamId === row.clubId && g.date)
    .reduce((m, g) => (g.date > m ? g.date : m), '')
  const anchor = lastClubGame || row.since
  const finalDates = await fetchClubFinalDates(row.clubId, level)
  const gamesSince = finalDates.filter((d) => d > anchor).length
  return gamesSince < REHAB_STALE_GAMES
}

// --- main ---------------------------------------------------------------------
const mlbIds = await fetchMlbTeamIds()
const txns = (await getJson(`/api/v1/transactions?startDate=${daysAgo(REHAB_WINDOW_DAYS)}&endDate=${isoToday()}`)).transactions ?? []
const candidates = await selectActiveRehabAssignments(rehabCandidateIds(txns), mlbIds, isoToday())
const [positions, levels] = await Promise.all([
  fetchPositions(candidates.map((r) => r.playerId)),
  fetchTeamLevels(candidates.map((r) => r.clubId)),
])
const season = currentSeason()
// A failed lookup drops the player (null), same as a rehab that has ended.
const stillRehabbing = await mapConcurrent(candidates, 8, (r) =>
  isStillRehabbing(r, positions[r.playerId] || '', levels[r.clubId] ?? null, season),
)
const active = candidates.filter((_, i) => stillRehabbing[i])
const players = active.map((r) => ({
  ...r,
  position: positions[r.playerId] || '',
  level: SPORT_LABEL[levels[r.clubId]] ?? '',
}))

await writeJsonAtomic(out, { generatedAt: new Date().toISOString(), players })
console.log(`wrote ${out} (${players.length} of ${candidates.length} candidates still active)`)
