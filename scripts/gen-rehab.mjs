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
// Run by hand: node scripts/gen-rehab.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPORT_LABEL } from '../src/lib/teams.js'
import { txnDate, isRehabTxn, isRehabEndingTxn } from '../src/api/rehab-policy.js'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'rehab.json')
const BASE = 'https://statsapi.mlb.com'

// A rehab assignment can't run longer than ~30 days, so a 40-day transaction
// window always contains the start of every currently-active stint.
const REHAB_WINDOW_DAYS = 40
// The rehab club must have played FEWER than this many games since the player's
// last appearance for them; at or beyond it the stint is treated as ended.
// Counting contests (not days) clears a starter's 5–6-day turn with margin.
const REHAB_STALE_GAMES = 7

const isoToday = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const currentSeason = () => new Date().getUTCFullYear()

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

// --- transaction pass: who is on a rehab assignment right now -----------------
// A rehab starts with an "Assigned" (ASG) row whose description says "rehab" and
// ends when the player returns to the majors (recall / contract selection /
// activation off the IL), is really sent down, is released/retired, or is
// reassigned somewhere non-rehab. txnDate/isRehabTxn/isRehabEndingTxn: see
// src/api/rehab-policy.js — shared with person.js's single-player detector.

// From a flat league-wide transaction window, the players CURRENTLY on a
// major-league rehab assignment — a big leaguer sent to a minor-league affiliate
// whose stint hasn't been closed out and began at an MLB club. One row per
// player, newest stint first.
function selectActiveRehabAssignments(transactions, mlbIds) {
  const byPlayer = new Map()
  for (const t of transactions) {
    const pid = t.person?.id
    if (!pid || !txnDate(t)) continue
    if (!byPlayer.has(pid)) byPlayer.set(pid, [])
    byPlayer.get(pid).push(t)
  }
  const rows = []
  for (const [pid, ts] of byPlayer) {
    const lastEnd = ts.filter(isRehabEndingTxn).reduce((m, t) => (txnDate(t) > m ? txnDate(t) : m), '')
    const run = ts.filter((t) => isRehabTxn(t) && txnDate(t) > lastEnd)
    if (!run.length) continue
    const mlbLeg = run.find((t) => mlbIds.has(t.fromTeam?.id))
    if (!mlbLeg) continue
    const latest = run.reduce((a, b) => (txnDate(a) >= txnDate(b) ? a : b))
    const since = run.reduce((m, t) => (!m || txnDate(t) < m ? txnDate(t) : m), '')
    const club = latest.toTeam
    if (!club?.id) continue
    rows.push({
      playerId: pid,
      playerName: latest.person?.fullName || '',
      orgId: mlbLeg.fromTeam?.id ?? null,
      orgName: mlbLeg.fromTeam?.name || '',
      clubId: club.id,
      clubName: club.name || '',
      since,
    })
  }
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

// Run an async predicate across items with a small concurrency cap, keeping the
// survivors in order (be polite to statsapi rather than firing dozens at once).
async function keepConcurrent(items, limit, predicate) {
  const keep = new Array(items.length).fill(false)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        keep[i] = await predicate(items[i])
      } catch {
        keep[i] = false
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return items.filter((_, i) => keep[i])
}

// --- main ---------------------------------------------------------------------
const mlbIds = await fetchMlbTeamIds()
const txns = (await getJson(`/api/v1/transactions?startDate=${daysAgo(REHAB_WINDOW_DAYS)}&endDate=${isoToday()}`)).transactions ?? []
const candidates = selectActiveRehabAssignments(txns, mlbIds)
const [positions, levels] = await Promise.all([
  fetchPositions(candidates.map((r) => r.playerId)),
  fetchTeamLevels(candidates.map((r) => r.clubId)),
])
const season = currentSeason()
const active = await keepConcurrent(candidates, 8, (r) =>
  isStillRehabbing(r, positions[r.playerId] || '', levels[r.clubId] ?? null, season),
)
const players = active.map((r) => ({
  ...r,
  position: positions[r.playerId] || '',
  level: SPORT_LABEL[levels[r.clubId]] ?? '',
}))

await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), players }))
console.log(`wrote ${out} (${players.length} of ${candidates.length} candidates still active)`)
