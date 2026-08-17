// Running pitching lines, gated by what the user has revealed.
//
// SPOILER NOTE — read before touching this. A pitcher's line (IP/R/ER/H…) is
// score-revealing, so it is driven entirely by the reveal high-water mark
// (`revealedThrough`, the furthest half-inning the user has uncovered — see
// InningViewer / RollingLine). Stats are accumulated ONLY from plays in revealed
// half-innings, so nothing from a sealed inning ever reaches the DOM. Runs and
// earned runs are attributed to the play's `responsiblePitcher` (so an inherited
// runner's run is charged to the pitcher who put him on, not the one who let him
// score) — and because that credit is read off the SCORING play itself, an
// inherited runner never counts against his old pitcher until the play that
// scores him is itself revealed. A pitcher whose whole outing is already
// revealed uses his exact boxscore line; a still-active pitcher mid-outing uses
// the partial computed from revealed plays only.
//
// `stepHalfIndex`/`throughAtBatIndex` extend that same clamp one notch finer,
// for the ONE half currently being STEPPED through one at-bat at a time
// (ADR-0016) — same shape and same adjacency discipline as
// api/winprob.js's own `selectWinProbPath`. `throughAtBatIndex` is reported
// back up from inside PlayByPlay's own SealBox reveal function (its
// `onStepInfo`); this module never computes that boundary itself, only
// consumes it, so ADR-0001 still holds. Leaving both at their null default
// reproduces the old whole-halves-only behavior exactly.

import { halfIndex, personNameParts } from './select.js'
import { NON_PA_EVENT_TYPES, GAME_ADVISORY_EVENT_TYPE } from './playbyplay.js'

function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// Local copy of playbyplay/shared.js's BASE_NUM (barrel-internal, not
// re-exported) — this module lives outside playbyplay/, and the table is
// four literals, not worth reaching into that directory's internals for.
const HANDOFF_BASE_NUM = { '1B': 1, '2B': 2, '3B': 3 }

// Per-team pitching lines for every pitcher who has appeared in a revealed
// half-inning, or in the currently-stepped half up through `throughAtBatIndex`.
// `revealedThrough` is a half-index (see halfIndex); pass -1 for "nothing
// revealed". Returns { away: [...], home: [...] } in the order pitchers
// entered, each row: { id, last, first, jersey, hand, ip, pitches, bf, h, r,
// er, bb, k }.
export function computePitcherLines(
  feed,
  revealedThrough,
  { stepHalfIndex = null, throughAtBatIndex = null } = {},
) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const players = feed?.gameData?.players ?? {}
  const boxTeams = feed?.liveData?.boxscore?.teams ?? {}

  const acc = {} // pitcherId -> partial stat accumulator over revealed plays
  const lastIdx = {} // pitcherId -> last half-index he threw in (spoiler-free)
  const get = (id, side) =>
    (acc[id] ??= { id, side, outs: 0, pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 })

  let curHalf = null
  let outsBefore = 0
  for (const p of plays) {
    const inn = p?.about?.inning
    const half = p?.about?.halfInning
    if (!inn || !half) continue
    const i = halfIndex(inn, half)
    const pid = p?.matchup?.pitcher?.id

    // Appearance span reads innings only — safe to compute over every play.
    if (pid) {
      if (lastIdx[pid] == null || i > lastIdx[pid]) lastIdx[pid] = i
    }

    if (i > revealedThrough) {
      // Not committed yet — only in if it's the half being stepped through
      // right now, and only up to the last at-bat PlayByPlay has revealed.
      const atBatIndex = p.about?.atBatIndex ?? null
      const withinStep =
        stepHalfIndex != null &&
        i === stepHalfIndex &&
        throughAtBatIndex != null &&
        atBatIndex != null &&
        atBatIndex <= throughAtBatIndex
      if (!withinStep) continue
    }
    if (!pid) continue

    const side = half === 'top' ? 'home' : 'away' // pitching side works this half
    const a = get(pid, side)

    // Batters faced: every play carries result.type 'atBat' — including
    // baserunning-only plays (an inning-ending caught stealing mid-count),
    // where the batter comes up again as his own later play, and the pregame/
    // mid-game "Game Advisory" placeholder (GAME_ADVISORY_EVENT_TYPE — see
    // playbyplay.js), which carries a real matchup.pitcher but no actual
    // batter faced. Skip those or a mid-outing partial BF over-counts and
    // visibly drops when the exact boxscore line takes over at full reveal.
    // Pitches on those plays still count (thrown for real, never re-listed);
    // so do their outs and runs.
    if (
      p.result?.type === 'atBat' &&
      !NON_PA_EVENT_TYPES.has(p.result?.eventType) &&
      p.result?.eventType !== GAME_ADVISORY_EVENT_TYPE
    ) {
      a.bf += 1
    }
    a.pitches += (p.playEvents ?? []).filter((e) => e.isPitch).length

    const ev = p.result?.eventType
    if (ev === 'single' || ev === 'double' || ev === 'triple' || ev === 'home_run') a.h += 1
    if (ev === 'walk' || ev === 'intent_walk') a.bb += 1
    if (ev === 'strikeout' || ev === 'strikeout_double_play') a.k += 1

    for (const rn of p.runners ?? []) {
      const md = rn.details
      if (md?.isScoringEvent && rn.movement?.end === 'score') {
        const rp = md.responsiblePitcher?.id ?? pid
        const ra = get(rp, side)
        ra.r += 1
        if (md.earned) ra.er += 1
      }
    }

    // Outs (for IP) = the running out count's delta within the half-inning.
    const hk = `${inn}-${half}`
    if (curHalf !== hk) {
      curHalf = hk
      outsBefore = 0
    }
    const outsAfter = p.count?.outs ?? outsBefore
    a.outs += Math.max(0, outsAfter - outsBefore)
    outsBefore = outsAfter
  }

  const out = { away: [], home: [] }
  for (const side of ['away', 'home']) {
    const team = boxTeams[side]
    const order = team?.pitchers ?? []
    const boxPlayers = team?.players ?? {}
    for (const id of order) {
      // `acc[id]` exists exactly when at least one revealed-or-stepped-into
      // play was accumulated for him above — equivalent to, but finer than,
      // the old whole-half `firstIdx[id] > revealedThrough` check, since it
      // also picks up a pitcher whose only appearance so far is the partial
      // step half.
      if (!acc[id]) continue

      const person = players[`ID${id}`] ?? {}
      const box = boxPlayers[`ID${id}`] ?? {}
      const a = acc[id] ?? { outs: 0, pitches: 0, bf: 0, h: 0, r: 0, er: 0, bb: 0, k: 0 }
      const s = box.stats?.pitching ?? {}

      // Whole outing revealed → exact boxscore line; otherwise the running
      // partial from revealed plays only (never past the reveal mark).
      const fullyRevealed = lastIdx[id] <= revealedThrough
      const line = fullyRevealed
        ? {
            ip: s.inningsPitched ?? outsToIp(a.outs),
            pitches: s.numberOfPitches ?? s.pitchesThrown ?? a.pitches,
            bf: s.battersFaced ?? a.bf,
            h: s.hits ?? a.h,
            r: s.runs ?? a.r,
            er: s.earnedRuns ?? a.er,
            bb: s.baseOnBalls ?? a.bb,
            k: s.strikeOuts ?? a.k,
          }
        : {
            ip: outsToIp(a.outs),
            pitches: a.pitches,
            bf: a.bf,
            h: a.h,
            r: a.r,
            er: a.er,
            bb: a.bb,
            k: a.k,
          }

      out[side].push({
        id,
        ...personNameParts(person),
        jersey: box.jerseyNumber ?? person.primaryNumber ?? '',
        hand: person.pitchHand?.code ?? '', // 'L' | 'R'
        ...line,
      })
    }
  }
  return out
}

// One pitcher's line frozen at an exact atBatIndex cut, for the pitching-
// handoff cards (see pitcherHandoffs below) — a thin call shape over
// computePitcherLines, not a new spoiler surface. Forcing `revealedThrough`
// to `stepHalfIndex - 1` always routes through computePitcherLines' partial/
// accumulator branch (never its "whole outing revealed, use the exact
// boxscore line" branch — see that function's `fullyRevealed` check), so the
// result is always the running total AT `cutAtBatIndex`, regardless of how
// far the reader has actually revealed. Returns null if the pitcher has no
// accumulated line at that cut (nothing thrown yet, or a bad id).
export function pitcherLineAt(feed, side, pitcherId, cutAtBatIndex, stepHalfIndex) {
  if (pitcherId == null || cutAtBatIndex == null || stepHalfIndex == null) return null
  const lines = computePitcherLines(feed, stepHalfIndex - 1, {
    stepHalfIndex,
    throughAtBatIndex: cutAtBatIndex,
  })
  return lines[side]?.find((row) => row.id === pitcherId) ?? null
}

// Whether (inning, half) is the GAME's very last half played — no play exists
// anywhere in the feed for a later inning. The one case a `resolvedAtHalfEnd`
// handoff (see pitcherHandoffs) has no "next defensive half" page to defer
// its finalized card to, and must render in-feed instead — PlayByPlay.jsx's
// own fallback.
export function isLastHalfOfGame(feed, inning, half) {
  const last = (feed?.liveData?.plays?.allPlays ?? []).at(-1)
  return last?.about?.inning === inning && last?.about?.halfInning === half
}

// The pitcher who threw (inning, half)'s own LAST play — distinct from
// pitcherHandoffs' departing pitchers (who each left mid-half, before the
// half was over). A team's next defensive half's leading notice
// (HalfInning.jsx) shows a finalized card for this pitcher too whenever he
// ISN'T that next half's own starter — the ordinary case of a clean
// between-innings change, which never touches pitcherHandoffs at all since
// nothing about it happens mid-half. Returns null for an empty/malformed
// half.
export function halfClosingPitcher(feed, inning, half, battingSide) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p) => p?.about?.inning === inning && p?.about?.halfInning === half,
  )
  const last = plays.at(-1)
  const pitcherId = last?.matchup?.pitcher?.id
  if (pitcherId == null) return null
  return {
    pitcherId,
    side: battingSide === 'away' ? 'home' : 'away',
    lastAtBatIndex: last.about?.atBatIndex ?? null,
  }
}

// The handoffs (from `handoffs`, pitcherHandoffs' output) whose finalized
// card belongs in-feed right after the play at `atBatIndex` — mid-half
// resolutions always, plus `resolvedAtHalfEnd` ones when there's no later
// half to defer to (`isLastHalfOfGame`). Marks each match into
// `renderedFinal` (a caller-owned Set of `incomingPitcherId`) so a later
// entry in the same half never re-renders it. Pure bookkeeping — the caller
// still resolves each match's actual `line` via `pitcherLineAt`.
export function handoffsResolvingAt(handoffs, atBatIndex, renderedFinal, isLastHalf) {
  const matches = []
  for (const h of handoffs) {
    if (renderedFinal.has(h.incomingPitcherId)) continue
    if (h.resolvedAtHalfEnd && !isLastHalf) continue
    if (h.resolutionAtBatIndex !== atBatIndex) continue
    renderedFinal.add(h.incomingPitcherId)
    matches.push(h)
  }
  return matches
}

// For each MID-half pitching change in (inning, half) — the half's very
// first, pre-pitch change is skipped, same `anyPitchInHalf`-style rule
// halfInningFeed.js already uses for the same reason (selectHalfStartingPitcher
// / HalfInning's persistent header already names that arm) — reports:
//   - who left (`departingPitcherId`) and who entered (`incomingPitcherId`)
//   - `snapshotAtBatIndex`: the last play BEFORE the change, i.e. the cut for
//     "his line at the moment he left" (feed straight into pitcherLineAt)
//   - `inheritedCount`: how many runners were on base at that moment
//   - `resolutionAtBatIndex`: the cut at which every one of those runners'
//     fates (scored, put out, or left on base when the half ended) is known
//     — before this cut, his R/ER could still change; at and after it, they
//     cannot
//   - `resolvedAtHalfEnd`: true when resolution coincided with the half's
//     own last play (there were inherited runners, and the half ended before
//     they all individually resolved) rather than happening mid-half with
//     more of the half still to reveal afterward. The two placements this
//     drives (in-feed vs. a leading card on the team's NEXT defensive half)
//     are the caller's job — see PlayByPlay.jsx and HalfInning.jsx.
// `side` is which team was PITCHING this half (`battingSide`'s opposite),
// same convention computePitcherLines uses internally.
export function pitcherHandoffs(feed, inning, half, battingSide) {
  const plays = (feed?.liveData?.plays?.allPlays ?? []).filter(
    (p) => p?.about?.inning === inning && p?.about?.halfInning === half,
  )
  if (plays.length === 0) return []
  const side = battingSide === 'away' ? 'home' : 'away'
  const halfLastAtBatIndex = plays[plays.length - 1]?.about?.atBatIndex ?? null

  const handoffs = []
  const bases = [null, null, null] // runner id currently on 1B/2B/3B, this half only
  let anyPitchInHalf = false

  plays.forEach((play, idx) => {
    // Event-level, same as halfInningFeed.js's own anyPitchInHalf walk — a
    // change nested ahead of this play's OWN first pitch (still pre-pitch as
    // of the moment it happens) must agree with that derivation's skip, or
    // this card would contradict HalfInning's persistent "Now pitching" header
    // about who started the half.
    for (const e of play.playEvents ?? []) {
      if (e.isPitch) {
        anyPitchInHalf = true
        continue
      }
      if (e.details?.eventType === 'pitching_substitution' && anyPitchInHalf) {
        const prevPlay = idx > 0 ? plays[idx - 1] : null
        const departingPitcherId = prevPlay?.matchup?.pitcher?.id ?? null
        const snapshotAtBatIndex = prevPlay?.about?.atBatIndex ?? null
        if (departingPitcherId != null && snapshotAtBatIndex != null) {
          const inheritedRunnerIds = bases.filter((id) => id != null)
          const resolutionAtBatIndex = resolveHandoffRunners(
            plays,
            snapshotAtBatIndex,
            inheritedRunnerIds,
          )
          handoffs.push({
            subAtBatIndex: play.about?.atBatIndex ?? null,
            departingPitcherId,
            incomingPitcherId: play.matchup?.pitcher?.id ?? null,
            side,
            snapshotAtBatIndex,
            inheritedCount: inheritedRunnerIds.length,
            resolutionAtBatIndex,
            resolvedAtHalfEnd:
              inheritedRunnerIds.length > 0 && resolutionAtBatIndex === halfLastAtBatIndex,
          })
        }
      }
    }

    // Fold this play's own baserunning in AFTER checking it for a leading
    // substitution — `bases` must reflect state as of the moment he left,
    // which is everything from STRICTLY EARLIER plays only.
    for (const r of play.runners ?? []) {
      const startBase = HANDOFF_BASE_NUM[r.movement?.start]
      const endBase = HANDOFF_BASE_NUM[r.movement?.end]
      if (startBase) bases[startBase - 1] = null
      if (!r.movement?.isOut && endBase) bases[endBase - 1] = r.details?.runner?.id ?? null
    }
  })

  return handoffs
}

// The atBatIndex at which every runner in `runnerIds` has an individually
// known fate (scored or put out) — or, for whoever's still pending once
// `plays` runs out, the half's own last play (left on base is a resolution
// too). `plays` is the WHOLE half's plays (pitcherHandoffs already scoped
// it); only entries after `afterAtBatIndex` are walked. Bases-empty case
// (`runnerIds` empty) returns `afterAtBatIndex` unchanged — already closed.
function resolveHandoffRunners(plays, afterAtBatIndex, runnerIds) {
  if (runnerIds.length === 0) return afterAtBatIndex
  const pending = new Set(runnerIds)
  let maxResolved = afterAtBatIndex
  let lastAtBatIndex = afterAtBatIndex
  for (const play of plays) {
    const idx = play.about?.atBatIndex
    if (idx == null || idx <= afterAtBatIndex) continue
    lastAtBatIndex = idx
    for (const r of play.runners ?? []) {
      const rid = r.details?.runner?.id
      if (rid == null || !pending.has(rid)) continue
      if (r.movement?.end === 'score' || r.movement?.isOut) {
        pending.delete(rid)
        if (idx > maxResolved) maxResolved = idx
      }
    }
    if (pending.size === 0) break
  }
  if (pending.size > 0) maxResolved = lastAtBatIndex
  return maxResolved
}
