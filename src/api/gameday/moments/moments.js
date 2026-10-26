// Gameday's moments engine (#2608): score ONE revealed play and return the moments
// it holds. REVEAL-ONLY (ADR-0001): a moment names a result ("grand slam",
// "walk-off"), so call this only inside a SealBox's reveal render function
// (ADR-0002). It returns data and decides no timing (ADR-0046).
//
// THE CLAMP. The play must be on screen: a half before the reader's (revealed by
// construction), or the reader's own half up to the last plate appearance on
// screen (../stepCut.js). Any other play answers null. Every detector reads
// only this play and the plays before it.
//
// FOUR KINDS (Gary, 2026-10-22), each with families:
//  - rare: walkOff, grandSlam, triplePlay, cycle. The walk-off needs no look
//    ahead: a bottom-half play in or past the last regulation inning that puts
//    the home club ahead from level or behind ends the game by rule. It reads
//    the feed's own running score after this play (`result.homeScore`) and
//    after the play before it. Triple play and cycle are
//    ../../callout-notes/lastTime.js's detectPlayFeat, so there is one spelling.
//    "First-ever" (a first career hit, say) is NOT built: nothing on the
//    revealed card or in the callouts bundle says a feat is a player's first.
//  - odds: the swing in the home club's win % from the play before to this one
//    (../../winprob.js's own path, clamped to this play). No data at most MiLB
//    parks, so no odds moment there.
//  - milestone: the callouts bundle's `milestones[personId]` (the player's
//    nearest round career number entering tonight, docs/callouts.md). It fires
//    on the play that reaches it, counting tonight's plays up to this one. Hits,
//    home runs, doubles and RBI for a batter, strikeouts for a pitcher. Runs,
//    stolen bases, wins and saves are not detected per play here.
//  - statcast: hit hard, hit far, thrown fast, past the p99 floors in
//    ./thresholds.js.
//
// RANKING (docs/callouts.md, "Worthiness"): family base + a 0–20 magnitude bonus
// (magnitudeOf), clamped to 0–100. The three dial levels of #2574 are the
// cut-offs in CUTOFFS: Quiet shows a play at or over `quiet`, Normal at or over
// `normal`, Lots every play. The dial's default is Normal (Gary, 2026-10-26).

import { detectPlayFeat } from '../../callout-notes/lastTime.js'
import { magnitudeOf, clampScore } from '../../callout-notes/shared.js'
import { selectWinProbPath } from '../../winprob.js'
import { halfIndex, selectRegulationInnings } from '../../select.js'
import { stepCutAtBatIndex } from '../stepCut.js'
import { STATCAST, ODDS_SWING } from './thresholds.js'

export const CUTOFFS = { quiet: 60, normal: 35, lots: 0 }

// Rare and milestone families are fixed; the others add a magnitude bonus.
export const MOMENT_BASE = {
  walkOff: 90,
  cycle: 88,
  triplePlay: 85,
  grandSlam: 80,
  milestone: 75,
  oddsSwing: 40,
  hitHard: 35,
  hitFar: 35,
  thrownFast: 35,
}

// The dial level a score reaches: 'quiet', 'normal' or 'lots'.
export function levelFor(score) {
  if (score >= CUTOFFS.quiet) return 'quiet'
  if (score >= CUTOFFS.normal) return 'normal'
  return 'lots'
}

const HIT_EVENTS = new Set(['single', 'double', 'triple', 'home_run'])
const MILESTONE_COUNT = {
  hits: (p) => (HIT_EVENTS.has(p.result?.eventType) ? 1 : 0),
  homeRuns: (p) => (p.result?.eventType === 'home_run' ? 1 : 0),
  doubles: (p) => (p.result?.eventType === 'double' ? 1 : 0),
  rbi: (p) => p.result?.rbi ?? 0,
}
const PITCHER_MILESTONE_COUNT = {
  strikeOuts: (p) => (/^strikeout/.test(p.result?.eventType ?? '') ? 1 : 0),
}

const moment = (kind, family, bonus, facts) => ({
  kind,
  family,
  score: clampScore(MOMENT_BASE[family] + bonus),
  facts,
})

function rareMoments(feed, plays, i, battingSide) {
  const play = plays[i]
  const out = []
  const et = play.result?.eventType
  const batter = { id: play.matchup?.batter?.id ?? null, name: play.matchup?.batter?.fullName ?? '' }
  if (et === 'home_run' && (play.result?.rbi ?? 0) >= 4) out.push(moment('rare', 'grandSlam', 0, { batter }))
  const home = play.result?.homeScore
  const away = play.result?.awayScore
  if (
    play.about?.halfInning === 'bottom' &&
    (play.about?.inning ?? 0) >= selectRegulationInnings(feed) &&
    typeof home === 'number' &&
    typeof away === 'number' &&
    home > away
  ) {
    const prev = plays[i - 1]?.result
    const homeBefore = typeof prev?.homeScore === 'number' ? prev.homeScore : 0
    const awayBefore = typeof prev?.awayScore === 'number' ? prev.awayScore : 0
    if (homeBefore <= awayBefore) out.push(moment('rare', 'walkOff', 0, { batter, home, away }))
  }
  const feat = detectPlayFeat(feed, play.about?.atBatIndex, battingSide)
  if (feat?.kind === 'tripleplays') out.push(moment('rare', 'triplePlay', 0, { side: feat.side }))
  if (feat?.kind === 'cycles') out.push(moment('rare', 'cycle', 0, { batter: feat.player }))
  return out
}

function oddsMoment(winProb, play) {
  const atBatIndex = play.about?.atBatIndex
  const h = halfIndex(play.about?.inning, play.about?.halfInning)
  const path = selectWinProbPath(winProb, { throughHalf: h - 1, stepHalfIndex: h, throughAtBatIndex: atBatIndex })
  const last = path.at(-1)
  if (!last || last.atBatIndex !== atBatIndex) return null
  const swing = Math.abs(last.delta)
  if (swing < ODDS_SWING.floor) return null
  const bonus = magnitudeOf(swing - ODDS_SWING.floor, ODDS_SWING.full - ODDS_SWING.floor)
  return moment('odds', 'oddsSwing', bonus, { swing, homeBefore: last.home - last.delta, homeAfter: last.home })
}

function milestoneMoments(milestones, plays, i) {
  if (!milestones) return []
  const play = plays[i]
  const out = []
  const check = (personId, role, counters, sameRole) => {
    const m = milestones[personId]
    const count = m && counters[m.stat]
    if (!count) return
    const today = plays.slice(0, i + 1).filter(sameRole)
    const after = today.reduce((n, p) => n + count(p), 0)
    const before = after - count(play)
    if (before < m.remaining && after >= m.remaining) {
      out.push(moment('milestone', 'milestone', 0, { personId, role, stat: m.stat, label: m.label, threshold: m.threshold }))
    }
  }
  const batterId = play.matchup?.batter?.id
  const pitcherId = play.matchup?.pitcher?.id
  if (batterId != null) check(batterId, 'batter', MILESTONE_COUNT, (p) => p.matchup?.batter?.id === batterId)
  if (pitcherId != null) check(pitcherId, 'pitcher', PITCHER_MILESTONE_COUNT, (p) => p.matchup?.pitcher?.id === pitcherId)
  return out
}

function statcastMoments(play) {
  const out = []
  const pitches = (play.playEvents ?? []).filter((e) => e?.isPitch)
  const hit = pitches.findLast((e) => e.hitData)?.hitData
  const add = (family, value) => {
    const t = STATCAST[family]
    if (typeof value !== 'number' || value < t.floor) return
    out.push(moment('statcast', family, magnitudeOf(value - t.floor, t.full - t.floor), { value }))
  }
  add('hitHard', hit?.launchSpeed)
  add('hitFar', hit?.totalDistance)
  const speeds = pitches.map((e) => e.pitchData?.startSpeed).filter((v) => typeof v === 'number')
  if (speeds.length) add('thrownFast', Math.max(...speeds))
  return out
}

// The moments one on-screen play holds, highest score first, or null when the
// play is not on screen. `winProb` is the /winProbability array (null when the
// park has none); `milestones` is the callouts bundle's `milestones` map.
export function momentsForPlay(
  feed,
  atBatIndex,
  { inning, half, step = null, revealedThrough, winProb = null, milestones = null },
) {
  if (atBatIndex == null || !inning || !half) return null
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return null
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const i = plays.findIndex((p) => p?.about?.atBatIndex === atBatIndex)
  if (i < 0) return null
  const play = plays[i]
  const h = halfIndex(play.about?.inning, play.about?.halfInning)
  if (h > here) return null
  if (h === here && atBatIndex > stepCutAtBatIndex(feed, inning, half, step)) return null
  const battingSide = play.about?.halfInning === 'top' ? 'away' : 'home'
  const odds = Array.isArray(winProb) ? oddsMoment(winProb, play) : null
  return [
    ...rareMoments(feed, plays, i, battingSide),
    ...(odds ? [odds] : []),
    ...milestoneMoments(milestones, plays, i),
    ...statcastMoments(play),
  ].sort((a, b) => b.score - a.score)
}
