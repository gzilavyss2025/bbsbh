// The Team Page's "Last 10 Games" roster view — the same Preferred Lineup /
// Top Substitutes / Starting Pitchers / Bullpen shape TeamPage.jsx already
// builds from season-cumulative stats (see its own "Preferred Lineup" block),
// but keyed off actual starts/appearances in the club's last N COMPLETED
// games instead. Spoiler-free: every game this reads is already Final, same
// footing as postseasonSeries.js (which this fetcher is modeled on) — no
// SealBox needed.
import { getJson } from './statsapi.js'
import { startingPositionAbbr } from './select.js'
import { isTwoWay } from './person.js'
import { splitPitchingStaff } from './pitcherSplit.js'

async function fetchGameBoxscore(gamePk) {
  try {
    return await getJson(`/api/v1/game/${gamePk}/boxscore`)
  } catch {
    return null
  }
}

// The club's last `windowSize` COMPLETED games (schedule rows with `won` set —
// same `.won != null` idiom TeamPage.jsx's `decidedGames` already uses, so a
// game the caller is mid-viewing stays excluded via fetchTeamSchedule's own
// resultsCutoff), each resolved to its standalone boxscore. A game whose
// boxscore fails to load is dropped rather than aborting the whole window.
export async function fetchRecentFormGames(schedule, windowSize = 10) {
  const decided = schedule.filter((g) => g.won != null).slice(-windowSize)
  if (!decided.length) return []
  const boxes = await Promise.all(decided.map((g) => fetchGameBoxscore(g.gamePk)))
  return decided
    .map((g, i) => ({ apiDate: g.apiDate, side: g.isHome ? 'home' : 'away', box: boxes[i] }))
    .filter((g) => g.box)
}

// Who counts as "on the roster right now" for this view — the club's ACTIVE
// (26-man) roster, NOT the 40Man `fullRoster` the season cards are built from.
// The two views ask different questions: the season Preferred Lineup card
// deliberately keeps the 40-man (an injured or rehabbing regular is still the
// season's preferred answer at his spot), while this one projects who is
// available right now. A player optioned to Triple-A is on the 40 but hasn't
// been available for a single game in the window — and since buildRecentForm
// keeps idle roster hitters (the zero-game tail in Top Substitutes, so a bench
// bat who happened to sit the stretch doesn't vanish), a 40-man-only player
// would land in Top Substitutes with no window data behind him at all. Anyone
// on the IL is dropped for the same "available right now" reason. Falls back
// to the 40-man list when a club has no active roster posted (a thin MiLB
// feed), same graceful-degradation convention as the rest of the data layer.
export function recentFormEligibleRoster(activeRoster, fullRoster, injuredIds = new Set()) {
  const pool = activeRoster?.length ? activeRoster : fullRoster ?? []
  return pool.filter((r) => r.person?.id && !injuredIds.has(r.person.id))
}

// Same nine-spot order the season Preferred Lineup card uses (see
// TeamPage.jsx's PREFERRED_LINEUP_POSITIONS) — kept in sync manually since
// this module has no other reason to import from the screen.
const LINEUP_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH']

// Pure aggregation over the fetched boxscore window, restricted to players
// still on the CURRENT roster (a player who's since been traded, released, or
// optioned doesn't belong in a "current lineup" projection, even if he started
// half the window) — the caller passes `recentFormEligibleRoster`'s output
// above, so eligibility here is the active roster, not the 40-man.
// Returns id lists only; the caller (TeamPage.jsx) already has a roster
// metadata lookup (name/jersey/WAR/badges) built for the season cards and
// maps these ids through the same one, so this module carries no rendering
// shape of its own.
export function buildRecentForm(games, roster) {
  const hitterIds = new Set(
    roster.filter((r) => r.person?.id && r.position?.type !== 'Pitcher').map((r) => r.person.id),
  )
  const pitcherIds = new Set(
    roster
      .filter((r) => r.person?.id && (r.position?.type === 'Pitcher' || isTwoWay(r.person)))
      .map((r) => r.person.id),
  )

  const startsByPos = new Map() // id -> Map(pos -> { count, lastDate })
  const gamesPlayedByHitter = new Map() // id -> count
  const pitchStats = new Map() // id -> { starts, lastStartDate, appearances, outs, saves }

  for (const { apiDate, side, box } of games) {
    const teamBox = box?.teams?.[side]
    if (!teamBox) continue
    for (const p of Object.values(teamBox.players ?? {})) {
      const id = p.person?.id
      if (!id) continue
      const bo = Number(p.battingOrder)
      const isStarterSlot = Number.isFinite(bo) && bo >= 100 && bo % 100 === 0

      if (hitterIds.has(id)) {
        const appeared = Boolean(p.battingOrder) || Object.keys(p.stats?.batting ?? {}).length > 0
        if (appeared) gamesPlayedByHitter.set(id, (gamesPlayedByHitter.get(id) ?? 0) + 1)
        if (isStarterSlot) {
          const pos = startingPositionAbbr(p) || 'DH'
          if (!startsByPos.has(id)) startsByPos.set(id, new Map())
          const posMap = startsByPos.get(id)
          const cur = posMap.get(pos) ?? { count: 0, lastDate: null }
          cur.count += 1
          if (!cur.lastDate || apiDate > cur.lastDate) cur.lastDate = apiDate
          posMap.set(pos, cur)
        }
      }

      if (pitcherIds.has(id)) {
        const pitch = p.stats?.pitching
        const outs = Number(pitch?.outs) || 0
        const started = pitch?.gamesStarted === 1
        if (pitch && (outs > 0 || started)) {
          const cur = pitchStats.get(id) ?? {
            starts: 0, lastStartDate: null, appearances: 0, outs: 0, saves: 0,
          }
          if (started) {
            cur.starts += 1
            if (!cur.lastStartDate || apiDate > cur.lastStartDate) cur.lastStartDate = apiDate
          } else {
            cur.appearances += 1
          }
          cur.outs += outs
          cur.saves += Number(pitch.saves) || 0
          pitchStats.set(id, cur)
        }
      }
    }
  }

  // Preferred Lineup — one greedy pass per position in a fixed order (same
  // shape as the season card's own first pass): the unclaimed candidate with
  // the most recent-window starts at that spot, ties broken by the more
  // recent start. No second "fill from anyone" pass — over a 10-game window a
  // position simply not started by anyone still on the roster is rare enough
  // that leaving the spot open (same graceful-degradation convention as a
  // thin MiLB feed) beats guessing.
  const claimed = new Set()
  const bestByPosition = {}
  for (const pos of LINEUP_POSITIONS) {
    let best = null
    for (const [id, posMap] of startsByPos) {
      if (claimed.has(id)) continue
      const entry = posMap.get(pos)
      if (!entry || entry.count <= 0) continue
      if (!best || entry.count > best.count || (entry.count === best.count && entry.lastDate > best.lastDate)) {
        best = { id, count: entry.count, lastDate: entry.lastDate }
      }
    }
    if (best) {
      bestByPosition[pos] = { position: pos, id: best.id }
      claimed.add(best.id)
    }
  }
  const preferredLineupIds = LINEUP_POSITIONS.map((pos) => bestByPosition[pos]).filter(Boolean)

  // Top Substitutes — hitters who didn't win a lineup spot, ranked by games
  // played in the window, capped at 6 (same cap as the season card). A
  // roster hitter who didn't appear in ANY of the window's games (a bench
  // bat who happened to sit the whole stretch, or just returned from a rehab
  // stint) still belongs here rather than vanishing entirely — appended
  // after the ranked group since there's no window data to rank him by.
  const zeroGameHitterIds = [...hitterIds].filter((id) => !claimed.has(id) && !gamesPlayedByHitter.has(id))
  const substituteIds = [
    ...[...gamesPlayedByHitter.entries()]
      .filter(([id, games2]) => !claimed.has(id) && games2 > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id),
    ...zeroGameHitterIds,
  ].slice(0, 6)

  // Starting Pitchers / Bullpen — by role, not rank; see splitPitchingStaff
  // for why neither section is capped. Ties broken by the more recent start
  // (starters) or appearances then innings (relievers), same convention as
  // the season card.
  const { starters, bullpen } = splitPitchingStaff(
    [...pitchStats.entries()].map(([id, s]) => ({ id, ...s })),
    {
      compareStarters: (a, b) => b.starts - a.starts || (b.lastStartDate > a.lastStartDate ? 1 : -1),
      compareRelievers: (a, b) => b.appearances - a.appearances || b.outs - a.outs,
    },
  )
  const startingPitcherIds = starters.map((s) => s.id)
  const bullpenIds = bullpen.map((s) => s.id)

  // Every current-roster pitcher who threw not one pitch in the window (a
  // true zero, not just "didn't start") — the caller (TeamPage.jsx) infers a
  // role for these from AAA/prior-team stats and folds them into the lists
  // above, since a rookie call-up or a just-returned rehabber genuinely has
  // no window data to rank by either.
  const pitcherAppearanceIds = [...pitchStats.keys()]

  return { preferredLineupIds, substituteIds, startingPitcherIds, bullpenIds, pitcherAppearanceIds }
}
