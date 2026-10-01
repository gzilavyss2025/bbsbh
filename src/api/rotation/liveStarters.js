// Likely starters from LIVE game logs — the read the card uses.
//
// projectedStarters.js is the pure rule. This file feeds it the right rows.
// workload.json cannot be that source: it keeps REGULAR-SEASON appearances only
// (gen-workload.mjs filters gameType 'R') and is up to a day old. On 2026-10-01
// that listed Chris Sale as rested ("7 days rest, 9/23") for a game whose series
// he had opened on 9/29. So the file only NAMES the candidates (active-roster
// pitchers with a recent start), and each one's appearances are read live, with
// every game type, the way fetchPitcherLastGame does (ADR-0088).
//
// A pitcher whose live log is empty, or whose read fails, is DROPPED. His rows in
// the file are exactly the stale ones this module exists to avoid, so using them
// as a fallback would put the bug back. If every read fails the list is empty and
// the card says "Not posted yet."
//
// Spoiler class: spoiler-FREE. Game logs of completed games, cut at the game's
// own date by projectStarters (strictly before). No feed is read.
//
// Cost: one request per candidate, usually six to nine, only while a starter is
// unannounced and only for the one club whose card is open.

import { fetchPersonStats } from '../person-fetch.js'
import { dayIndex } from '../workload.js'
import { projectStarters, START_WINDOW_DAYS } from './projectedStarters.js'

// Regular season, wild card, division, league and world series.
const GAME_TYPES = 'R,F,D,L,W'

// The ids worth a live read: this club's pitchers that the file shows with a
// start inside the window. A superset of whoever the rule will name, because the
// live log may change the answer in either direction.
export function rotationCandidateIds(data, teamId, asOfDate) {
  if (!data?.pitchers || teamId == null || !asOfDate) return []
  const asOfIdx = dayIndex(asOfDate)
  if (!Number.isFinite(asOfIdx)) return []
  return Object.entries(data.pitchers)
    .filter(([, p]) => Number(p.teamId) === Number(teamId))
    .filter(([, p]) =>
      (p.apps ?? []).some((a) => {
        const idx = dayIndex(a.d)
        return a.gs && Number.isFinite(idx) && idx < asOfIdx && asOfIdx - idx <= START_WINDOW_DAYS
      }),
    )
    .map(([id]) => id)
}

const liveGameLog = (season) => (id) =>
  fetchPersonStats(id, { type: 'gameLog', group: 'pitching', season, gameType: GAME_TYPES })

// Up to `limit` likely starters for `teamId` on `asOfDate`, from live logs.
// `fetchLog(id)` returns a game-log splits array; the default reads statsapi.
export async function projectFromLiveLogs(
  data,
  teamId,
  asOfDate,
  fetchLog = liveGameLog(String(asOfDate ?? '').slice(0, 4)),
  limit = 2,
) {
  const live = {}
  await Promise.all(
    rotationCandidateIds(data, teamId, asOfDate).map(async (id) => {
      let splits
      try {
        splits = await fetchLog(id)
      } catch {
        return
      }
      const apps = (splits ?? [])
        .filter((s) => s.date)
        .map((s) => ({
          d: s.date,
          p: s.stat?.numberOfPitches ?? null,
          gs: Number(s.stat?.gamesStarted) || 0,
        }))
      if (apps.length === 0) return
      live[id] = { name: data.pitchers[id].name, teamId: data.pitchers[id].teamId, apps }
    }),
  )
  return projectStarters({ pitchers: live }, teamId, asOfDate, limit)
}
