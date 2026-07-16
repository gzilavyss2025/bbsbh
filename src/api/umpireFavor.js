// Reveal-only, cumulative-through-the-revealed-half plate-umpire consistency +
// favor for the box score's StatBox card — a per-game companion to the season
// aggregate in umpires.js. Mirrors challenges.js's pattern exactly: computed
// only inside a SealBox's reveal render function, clamped to the reached half
// via halfOrder, so a later half's missed calls / favor never reach the DOM —
// see .scratch/umpire-accuracy/consistency-favor-scope.md §3 for why this
// needs the same gating as ABS challenges rather than the free-standing
// season card (a per-half favor figure is derived from THIS game's own
// ball/strike calls up to the current point, which is score-adjacent in-game
// state, same as a challenge that can flip a called third strike).
//
// The run-expectancy TABLE itself (public/data/run-expectancy.json) is a
// static, same-origin, league-wide file with no game or score information —
// safe to fetch eagerly, same footing as vsTeamSplits.js/highlights.js's raw
// fetch. Only the SELECTOR that combines it with this game's own plays is
// reveal-only.
import { estimateGameConsistency } from '../lib/euz.js'
import { pitchFavor } from '../lib/runExpectancy.js'

const HALF_PLATE = 8.5 / 12
const BALL_R = 1.45 / 12
const BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

let cached = null
export async function fetchRunExpectancy() {
  if (cached) return cached
  try {
    const res = await fetch('/data/run-expectancy.json')
    if (!res.ok) throw new Error(`run-expectancy.json ${res.status}`)
    cached = await res.json()
  } catch {
    cached = null
  }
  return cached
}

// MLB + AAA only — the two levels with full Hawk-Eye pitch tracking (same
// levels gen-umpire-accuracy.mjs sweeps); sport.id lives on gameData.teams.away,
// same field gameHasAbs (challenges.js) reads.
export function hasPitchTracking(feed) {
  const id = feed?.gameData?.teams?.away?.sport?.id
  return id === 1 || id === 11
}

// 1-based half order (top 1 = 1, bottom 1 = 2, top 2 = 3, …), for clamping to
// the reached half — identical to challenges.js's halfOrder.
function halfOrder(inning, half) {
  return half === 'bottom' ? inning * 2 : inning * 2 - 1
}

// Cumulative plate-umpire consistency + favor through (throughInning,
// throughHalf) inclusive. `table` is the (possibly null) result of
// fetchRunExpectancy() — favor degrades to null when it hasn't loaded or
// public/data/run-expectancy.json hasn't been built yet, but consistency
// still works (it needs no external table). Returns null before any called
// pitch has been revealed.
export function selectUmpireFavor(feed, table, throughInning, throughHalf) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const limit = halfOrder(throughInning, throughHalf)

  let bases = [null, null, null]
  let outs = 0
  let curHalfKey = null
  const consistencyPitches = []
  let favorAway = 0
  let favorHome = 0
  let hasFavor = false

  for (const p of plays) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || half == null) continue
    if (halfOrder(inning, half) > limit) break

    const halfKey = `${inning}-${half}`
    if (halfKey !== curHalfKey) {
      bases = [null, null, null]
      outs = 0
      curHalfKey = halfKey
    }
    const preBaseMask = (bases[0] ? 1 : 0) | (bases[1] ? 2 : 0) | (bases[2] ? 4 : 0)
    const preOuts = Math.min(outs, 2)
    const battingAway = half === 'top' // top bats away, bottom bats home

    let prevCount = { balls: 0, strikes: 0 } // resets per play — see gen-run-expectancy.mjs's documented edge case
    for (const ev of p.playEvents ?? []) {
      if (!ev.isPitch) continue
      const preCount = prevCount
      prevCount = { balls: ev.count?.balls ?? preCount.balls, strikes: ev.count?.strikes ?? preCount.strikes }

      const code = ev.details?.code
      const strikeCall = code === 'C'
      const ballCall = code === 'B' || code === '*B'
      if (!strikeCall && !ballCall) continue

      const c = ev.pitchData?.coordinates
      const top = ev.pitchData?.strikeZoneTop
      const bot = ev.pitchData?.strikeZoneBottom
      if (!c || c.pX == null || c.pZ == null || top == null || bot == null) continue

      const inX = Math.abs(c.pX) <= HALF_PLATE + BALL_R
      const inZ = c.pZ <= top + BALL_R && c.pZ >= bot - BALL_R
      const actualStrike = inX && inZ

      consistencyPitches.push({ pX: c.pX, pZ: c.pZ, strikeCall })

      // A pre-pitch count outside 0–3 balls / 0–2 strikes is corrupted feed
      // data (a 4th ball ends the plate appearance) — rare, see
      // gen-run-expectancy.mjs's header — skip favor for that one pitch.
      if (actualStrike !== strikeCall && table && preCount.balls <= 3 && preCount.strikes <= 2) {
        hasFavor = true
        const favor = pitchFavor(table, preBaseMask, preOuts, preCount.balls, preCount.strikes, actualStrike)
        if (battingAway) favorAway += favor
        else favorHome += favor
      }
    }

    // Apply this play's runner movements for the NEXT play's base/out state —
    // identical logic to gen-run-expectancy.mjs / gen-umpire-accuracy.mjs.
    for (const r of p.runners ?? []) {
      const rid = r.details?.runner?.id
      const startBase = BASE_NUM[r.movement?.start]
      const endBase = BASE_NUM[r.movement?.end]
      const isOut = r.movement?.isOut
      if (startBase) bases[startBase - 1] = null
      if (isOut) outs = Math.min(outs + 1, 3)
      else if (endBase) bases[endBase - 1] = rid
    }
  }

  if (!consistencyPitches.length) return null
  return {
    called: consistencyPitches.length,
    consistency: estimateGameConsistency(consistencyPitches), // { consistent, called } or null (thin sample)
    favorAway: hasFavor ? favorAway : null,
    favorHome: hasFavor ? favorHome : null,
  }
}
