// The standalone "Rehab Assignments" page's data — the players currently on a
// major-league rehab assignment, league-wide. Unlike the player page (which
// reads one player's own transaction feed), this scans a recent window of EVERY
// club's roster moves in a single request, so it gets its own small module
// (mirroring prospects.js's split from the per-player fetchers). Spoiler-free:
// roster moves and game *appearances* (dates, not scores) carry no result, same
// as the transaction timeline this shares logic with (selectActiveRehabAssignments
// in person.js).
//
// The transaction feed alone over-reports: it lists the ASG that STARTS a rehab
// but doesn't always carry a clean closing move, so a stint that has really
// ended — the player was quietly activated, sent back down, or (Quinn Priester)
// had season-ending surgery and never pitched again — lingers on the list. So on
// top of the transaction pass we VERIFY each candidate against his actual game
// log:
//   • if he's appeared in an MLB game since the assignment began, he's back with
//     the big club and the rehab is over (Francisco Alvarez);
//   • if his rehab club has played REHAB_STALE_GAMES or more completed games
//     since his last appearance for them (or since the assignment began, if he
//     never took the field), the stint has gone cold and is treated as over.
// "Contests, not days" is deliberate: a rehabbing starter pitches only every
// 5–6 days, so a day-count would wrongly drop him between outings; counting the
// club's games clears that cadence with room to spare.

import { getJson } from './statsapi.js'
import { selectActiveRehabAssignments } from './person.js'
import { SPORT_LABEL } from '../lib/teams.js'

// A rehab assignment can't run longer than ~30 days (20 for a position player),
// so a 40-day window always contains the start of every currently-active stint —
// wide enough to catch one begun before the window without pulling needless
// history.
const REHAB_WINDOW_DAYS = 40

// The rehab club must have played FEWER than this many games since the player
// last appeared for them; at or beyond it the stint is treated as cold/ended.
// Seven clears a starter's 5–6-day turn (the club plays ~5–6 games between his
// outings) with a game of margin, while still catching a stint that's truly
// lapsed.
const REHAB_STALE_GAMES = 7

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
function currentSeason() {
  return new Date().getUTCFullYear()
}

// The 30 MLB club ids — the fromTeam set that marks a rehab as a big leaguer's
// (vs. a purely minor-league one). Degrades to an empty set, which just yields
// an empty list rather than an error.
async function fetchMlbTeamIds() {
  try {
    const data = await getJson('/api/v1/teams?sportId=1')
    return new Set((data.teams ?? []).map((t) => t.id))
  } catch {
    return new Set()
  }
}

// Every club's transactions across a date window, one request. Degrades to [].
async function fetchLeagueTransactions(startDate, endDate) {
  try {
    const data = await getJson(`/api/v1/transactions?startDate=${startDate}&endDate=${endDate}`)
    return data.transactions ?? []
  } catch {
    return []
  }
}

// Primary position abbreviation per player, one batched request (the transaction
// feed's person object carries no position). Degrades to {}. Also decides which
// game-log group to verify against — a pitcher's appearances live in the
// pitching log, everyone else's in the hitting log.
async function fetchPositions(ids) {
  const list = [...new Set((ids ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(`/api/v1/people?personIds=${list.join(',')}`)
    const out = {}
    for (const p of data.people ?? []) out[p.id] = p.primaryPosition?.abbreviation || ''
    return out
  } catch {
    return {}
  }
}

// Level (sportId) per rehab club, one batched request — the affiliate the player
// is rehabbing at (its level isn't on the transaction row). Also the sportId the
// player's minor-league game log and the club's schedule must be queried at.
// Degrades to {}.
async function fetchTeamLevels(ids) {
  const list = [...new Set((ids ?? []).filter(Boolean))]
  if (!list.length) return {}
  try {
    const data = await getJson(`/api/v1/teams?teamId=${list.join(',')}`)
    const out = {}
    for (const t of data.teams ?? []) out[t.id] = t.sport?.id ?? null
    return out
  } catch {
    return {}
  }
}

// One player's game-log dates for a (group, level), each tagged with the team he
// appeared for — enough to answer "did he play an MLB game?" and "when did he
// last play for the rehab club?". A comma-list of sportIds returns nothing, so
// the caller queries one level at a time. Degrades to [].
async function fetchGameLogDates(personId, group, season, sportId) {
  if (!personId || !group) return []
  const params = [`stats=gameLog`, `group=${group}`, `season=${season}`]
  if (sportId && sportId !== 1) params.push(`sportId=${sportId}`)
  try {
    const data = await getJson(`/api/v1/people/${personId}/stats?${params.join('&')}`)
    return (data.stats?.[0]?.splits ?? []).map((s) => ({ date: s.date || '', teamId: s.team?.id ?? null }))
  } catch {
    return []
  }
}

// Completed-game dates for one club over the rehab window, sorted — the basis
// for counting how many contests a club has played since a given date. Memoized
// per club id so several players rehabbing at the same affiliate share one
// request. Degrades to [].
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

// The verification pass for one candidate: keep him only if he hasn't returned
// to the majors AND his rehab club hasn't gone cold on him. `level` is the
// club's sportId. Returns true to keep, false to drop.
async function isStillRehabbing(row, position, level, season) {
  const group = position === 'P' ? 'pitching' : 'hitting'
  // Back with the big club? Any MLB appearance dated after the assignment began
  // means the rehab is over — this is the backstop for a stint the transaction
  // feed never cleanly closed (the recall row is missing or outside the window).
  const mlbLog = await fetchGameLogDates(row.playerId, group, season, 1)
  if (mlbLog.some((g) => g.date && g.date > row.since)) return false

  // Last time he actually took the field for the rehab club; fall back to the
  // assignment date if he never has (e.g. assigned, then surgery — he shows up
  // in the club's log zero times).
  const clubLog = level
    ? await fetchGameLogDates(row.playerId, group, season, level)
    : []
  const lastClubGame = clubLog
    .filter((g) => g.teamId === row.clubId && g.date)
    .reduce((m, g) => (g.date > m ? g.date : m), '')
  const anchor = lastClubGame || row.since

  // How many games the club has completed SINCE that appearance. At or beyond
  // the stale threshold the stint has lapsed.
  const finalDates = await fetchClubFinalDates(row.clubId, level)
  const gamesSince = finalDates.filter((d) => d > anchor).length
  return gamesSince < REHAB_STALE_GAMES
}

// Run an async check across items with a small concurrency cap, so verifying a
// few dozen candidates doesn't fire hundreds of requests at once. Preserves
// order. Any check that throws resolves to `false` (drop) rather than taking the
// page down.
async function filterConcurrent(items, limit, predicate) {
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

// The page in a handful of cheap league-wide calls plus a bounded per-candidate
// verification: the MLB club ids + a ~40-day transaction window find the
// rehabbers; batched lookups fold in each player's position and each rehab
// club's level; then each candidate is checked against his game log so ended
// stints (returned to the majors, sent down, or shut down for the season) fall
// off. Positions and levels feed both the verification and the final row.
export async function loadRehabAssignments() {
  const [mlbIds, txns] = await Promise.all([
    fetchMlbTeamIds(),
    fetchLeagueTransactions(daysAgo(REHAB_WINDOW_DAYS), isoToday()),
  ])
  const candidates = selectActiveRehabAssignments(txns, mlbIds)
  const [positions, levels] = await Promise.all([
    fetchPositions(candidates.map((r) => r.playerId)),
    fetchTeamLevels(candidates.map((r) => r.clubId)),
  ])
  const season = currentSeason()
  const active = await filterConcurrent(candidates, 8, (r) =>
    isStillRehabbing(r, positions[r.playerId] || '', levels[r.clubId] ?? null, season),
  )
  return {
    players: active.map((r) => ({
      ...r,
      position: positions[r.playerId] || '',
      level: SPORT_LABEL[levels[r.clubId]] ?? '',
    })),
  }
}
