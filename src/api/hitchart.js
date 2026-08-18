// Hit chart — every batted ball of a game, placed in the ballpark diagram's
// own SVG space (src/lib/ballpark/ballparkGeometry.js).
//
// SPOILER FOOTING — THIS MODULE IS REVEAL-ONLY (ADR-0001/0002). A batted ball
// IS a play outcome: a dot in the left-field seats is a home run, a cluster of
// dots on the outfield grass is a rally. So `selectBattedBalls` is callable
// ONLY from inside a SealBox's reveal render function, or behind an explicit
// reveal gate — never at render top-level, never in an eager `useMemo`. Its
// `throughHalfIndex` option is the gate's other half: an inning page passes
// the reader's own `revealedThrough` so the chart can never run ahead of the
// scorekeeper. Classified `reveal-only` in spoiler-manifest.json, which also
// carries the importer allowlist.
//
// `hitCoordToSvg` and the three constants are pure geometry — they read no
// feed and reveal nothing on their own — but they live here rather than in
// lib/ so the projection and the selector that feeds it stay in one file.
//
// MiLB DEGRADES, IT DOESN'T CRASH. Most minor-league parks send no `hitData`
// at all (docs/data-enrichment.md's MiLB table), so `selectBattedBalls` simply
// returns an empty array there; every per-ball Statcast field is null-guarded
// on top of that, because a park can track a ball's landing spot and still
// report no exit velocity, launch angle or trajectory.

import { HOME } from '../lib/ballpark/ballparkGeometry.js'
import { halfIndex } from './select.js'
// The batter's own scorebook denotation (1B, F8, 6-3…) — the app's ONE
// spelling of that notation, shared with the play-by-play feed so a dot's
// label and the same play's at-bat card can never disagree.
import { scorebookCode } from './playbyplay/scorebookCode.js'

// Exit velocity at or above which a batted ball is "hard hit" — MLB's own
// Statcast definition. Exported for the chart's ink, not used here.
export const HARD_HIT_MPH = 95

// Gameday's hit coordinates are pixels on a fixed, park-agnostic overlay whose
// origin (home plate) sits here. Verified against the caught-fly-ball sample
// below: every ball's distance from this point, times the scale, agrees with
// the feed's own `totalDistance`.
export const HIT_COORD_ORIGIN = { x: 125.42, y: 198.27 }

// Feet per Gameday coordinate unit. DERIVED EMPIRICALLY, not documented by
// MLB: for each caught fly ball (trajectory `fly_ball`/`popup`, eventType
// `field_out`) carrying a `totalDistance`, the ratio
//   totalDistance / hypot(coordX - 125.42, 198.27 - coordY)
// clusters tightly. Over 39 such balls across gamePks 823427, 823589 and
// 824320 the median was 2.509, with a p10–p90 range of 2.478–2.679. The
// outliers are all short foul popups behind the plate, where the landing
// coordinate sits almost on top of the origin and a few pixels of jitter
// swamp the ratio — see test/hitchart.test.js, which pins this constant
// against that same sample so a feed change that silently shifts every dot
// fails the suite instead of the chart.
export const HIT_COORD_FT_PER_UNIT = 2.51

const round1 = (n) => Math.round(n * 10) / 10

// A Gameday hit coordinate → a point in the ballpark diagram's SVG space. The
// diagram maps FEET 1:1 to SVG units with home plate at HOME, +x toward right
// field and +y up the screen toward center (SVG y grows down, so center field
// SUBTRACTS from home's y — the same convention ballparkGeometry.js's own
// `toSvg` uses). HOME is imported rather than copied so the projection can
// never drift from the drawing it plots onto.
//
// Returns null when either coordinate is missing — a MiLB park that tracked
// the swing but not where the ball landed.
export function hitCoordToSvg(coordX, coordY) {
  if (coordX == null || coordY == null) return null
  const feetX = (coordX - HIT_COORD_ORIGIN.x) * HIT_COORD_FT_PER_UNIT
  const feetY = (HIT_COORD_ORIGIN.y - coordY) * HIT_COORD_FT_PER_UNIT
  return { x: round1(HOME.x + feetX), y: round1(HOME.y - feetY) }
}

// eventTypes whose batted ball is a base hit, and the one that is a home run.
const HIT_EVENT_TYPES = new Set(['single', 'double', 'triple', 'home_run'])
const HOME_RUN_EVENT_TYPE = 'home_run'

// REVEAL-ONLY (see the header). One entry per BATTED BALL in the game — every
// `playEvents[]` entry carrying `hitData` with coordinates, which is the feed's
// record of a ball actually put in play.
//
// Options, both null by default (the whole game):
//   • `teamId`   — keep only balls hit by this club (the BATTING side).
//   • `throughHalfIndex` — keep only plays at or before this 0-based half
//     index (top 1st = 0, the same numbering as select.js's `halfIndex`).
//     This is the reveal clamp: pass the reader's own `revealedThrough` and
//     the chart cannot show a ball from a half they have not opened.
//
// Field paths verified against gamePk 823427 (2026-08-17 MIA@PHI):
// `playEvents[].hitData.coordinates.coordX/coordY`, `.launchSpeed`,
// `.launchAngle`, `.totalDistance`, `.trajectory`.
export function selectBattedBalls(feed, { teamId = null, throughHalfIndex = null } = {}) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null

  const out = []
  for (let playIdx = 0; playIdx < plays.length; playIdx++) {
    const play = plays[playIdx]
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    if (inning == null || (half !== 'top' && half !== 'bottom')) continue
    if (throughHalfIndex != null && halfIndex(inning, half) > throughHalfIndex) continue

    // Top bats away, bottom bats home — the same convention the rest of the
    // innings view uses.
    const isHome = half === 'bottom'
    const battingTeamId = isHome ? homeId : awayId
    if (teamId != null && battingTeamId !== teamId) continue

    const batterId = play?.matchup?.batter?.id ?? null
    const eventType = play?.result?.eventType ?? null

    // The batter's own runner entry, resolved EXACTLY the way
    // playbyplay/halfInningFeed.js resolves it: a batter who reaches and is
    // then thrown out stretching carries TWO entries on the same play — his
    // own plate-appearance result (`movement.start` null, he started this leg
    // from home) and the later extra-base attempt. Prefer the start-null one
    // so scorebookCode reads his hit, not the out that came after it.
    const runners = play?.runners ?? []
    const batterRunner =
      runners.find((r) => r.details?.runner?.id === batterId && r.movement?.start == null) ??
      runners.find((r) => r.details?.runner?.id === batterId)

    // One spelling of the notation, borrowed whole. `calledLooking` cannot
    // happen for a ball put in play, but a defensive fallback costs nothing
    // and keeps `code` a string for every entry.
    const denotation = scorebookCode(play, batterRunner)
    const code = denotation?.calledLooking ? '' : denotation?.code ?? ''
    const codeKind = denotation?.codeKind ?? ''

    const events = play?.playEvents ?? []
    for (let eventIdx = 0; eventIdx < events.length; eventIdx++) {
      const hitData = events[eventIdx]?.hitData
      const coordX = hitData?.coordinates?.coordX ?? null
      const coordY = hitData?.coordinates?.coordY ?? null
      const point = hitCoordToSvg(coordX, coordY)
      if (!point) continue

      out.push({
        // Stable per-ball key: the play's own at-bat index (its index in
        // allPlays when the feed omits one) plus the event's position in it.
        id: `${play?.about?.atBatIndex ?? playIdx}-${eventIdx}`,
        teamId: battingTeamId,
        isHome,
        batter: play?.matchup?.batter?.fullName ?? '',
        batterId,
        code,
        codeKind,
        hit: HIT_EVENT_TYPES.has(eventType),
        homeRun: eventType === HOME_RUN_EVENT_TYPE,
        exitVelo: hitData?.launchSpeed ?? null,
        launchAngle: hitData?.launchAngle ?? null,
        distance: hitData?.totalDistance ?? null,
        trajectory: hitData?.trajectory ?? null,
        inning,
        half,
        x: point.x,
        y: point.y,
      })
    }
  }
  return out
}
