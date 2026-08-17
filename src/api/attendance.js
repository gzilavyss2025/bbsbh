// Per-team, per-season HOME-game attendance: games counted, season average,
// high, and low gate. Read from the static public/data/attendance.json a
// nightly scripts/gen-attendance.mjs precomputes (build-time-fetch pattern).
// Surfaced by the Team hub's Ballpark card (season average, high, low, and
// the club's rank among the other 29 clubs by average).
//
// Spoiler-free: a season aggregate over FINAL games' attendance carries no
// live-game score (same footing as WAR / comeback-wins), so no SealBox.
// Degrades to null with no file, or for any club with no home games ingested
// yet (early season, or MiLB — the generator is MLB only).

import { staticJson } from './staticJson.js'

export const fetchAttendance = staticJson('/data/attendance.json')

// One team's raw totals for a season, or null if the file has no row for it.
export function attendanceFor(data, teamId, season) {
  return data?.seasons?.[season]?.byTeamId?.[teamId] ?? null
}

// The Ballpark card's shape: this club's average/high/low plus its rank
// among every club with a row this season (by average, richest gate first).
// Ties share the best rank, same convention as comebackRatesFor. Null when
// the club has no row yet.
export function attendanceRatesFor(data, teamId, season) {
  const byTeamId = data?.seasons?.[season]?.byTeamId
  const mine = byTeamId?.[teamId]
  if (!byTeamId || !mine || mine.avg == null) return null
  const rows = Object.values(byTeamId).filter((r) => r.avg != null)
  const ahead = rows.filter((r) => r.avg > mine.avg).length
  const tied = rows.filter((r) => r.avg === mine.avg).length > 1
  return {
    games: mine.games,
    avg: mine.avg,
    high: mine.high,
    low: mine.low,
    rank: ahead + 1,
    of: rows.length,
    tied,
  }
}
