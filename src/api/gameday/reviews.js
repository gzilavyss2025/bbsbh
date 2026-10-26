// Reviews and the ABS bank for Gameday (#2607), as of the step the reader has
// tapped to. REVEAL-ONLY (ADR-0001): a review can flip a called third strike or
// an out, so call it only inside a SealBox's reveal render function (ADR-0002).
//
// THE CLAMP. Every half before the reader's is read whole (it is revealed by
// construction: a reader can step only a half at or under revealedThrough + 1,
// and a half past that answers null). The reader's own half is read only up to
// the last plate appearance on screen (./stepCut.js). challenges.js clamps to a
// HALF; this is the step-level clamp on top of it. A review in a play past the
// cut never reaches the result. `gameData.absChallenges` is never read: its
// counts are the whole game's, so they would leak challenges not yet reached.
//
// What the feed carries, checked 2026-10-26 against gamePk 823036, 823169,
// 824546 and 823035 (live /feed/live):
//  - `reviewDetails` sits on the play or on one of its playEvents (a pitch, or a
//    pickoff). Fields: `reviewType`, `isOverturned`, `inProgress`, and, for a
//    club's challenge, `challengeTeamId` and `player`.
//  - `reviewType` is two letters. The second is the reason, from MLB's own
//    /api/v1/reviewReasons table (REASONS below, copied 2026-10-26). A review
//    WITH a `challengeTeamId` is a club's challenge: `MJ` (and Single-A's `MZ`)
//    is an ABS challenge (challenges.js decides that), anything else a manager's
//    replay challenge (`MA`, a pickoff tag play, gamePk 823036 bottom 3). A
//    review with NO club is the umpires' own (`NO` fair/foul, `NH` home run,
//    gamePk 823169): the crew chief's. That reading of the first letter is an
//    inference; the code keys on `challengeTeamId`, which the feed states.
//  - The feed says only `isOverturned` true or false. "Confirmed" and "stands"
//    are not told apart, so this module does not invent the difference: a call
//    that was not overturned is `overturned: false`. While `inProgress` is true
//    the outcome is not known yet and `overturned` is null.
//
// THE BANK (ABS only, the challenges.js rules): each club starts with
// START_CHALLENGES, keeps one on a success and spends one on a failure, and a
// club that enters an extra inning empty is given one. Checked on gamePk
// 815625 (13 innings, five failed away challenges): walked this way, no club
// ever fails a challenge with an empty bank. A game that does not run the
// system (gameHasAbs) has no bank: `bank` is null.

import { isAbsChallenge, gameHasAbs, START_CHALLENGES } from '../challenges.js'
import { halfIndex, selectRegulationInnings } from '../select.js'
import { stepCutAtBatIndex, safeStep } from './stepCut.js'

// MLB's /api/v1/reviewReasons, fetched 2026-10-26.
const REASONS = {
  A: 'Tag play', F: 'Close play at 1st', C: 'Force play', H: 'Home run',
  O: 'Fair/foul in outfield', D: 'Catch/drop in outfield', T: 'Trap play in outfield',
  J: 'Pitch result', I: 'Hit by pitch', P: 'Home-plate collision', E: 'Slide interference',
  M: 'Timing play', U: 'Tag-up play', B: 'Touching a base', R: 'Passing runners',
  Y: 'Runner placement', S: 'Stadium boundary call', N: 'Fan interference',
  V: 'Catcher interference', Q: 'Rules check', K: 'Record keeping', G: 'Grounds rule',
  L: 'Multiple issues', X: 'Other', W: 'Defensive shift', Z: 'Check swing',
  AA: 'Runner abandonment',
}

function sideOf(feed, teamId) {
  if (teamId == null) return null
  if (teamId === feed?.gameData?.teams?.away?.id) return 'away'
  if (teamId === feed?.gameData?.teams?.home?.id) return 'home'
  return null
}

// One review record. `pitchNumber` is the reviewed pitch's own number; a
// play-level review names the at-bat's last pitch, flagged `isHeuristic` (the
// same rule challengesForPlay uses).
function record(feed, play, review, pitchNumber, isHeuristic) {
  const abs = isAbsChallenge(review)
  const side = sideOf(feed, review.challengeTeamId)
  if (abs && !side) return null // an ABS review naming neither club: challenges.js drops it too
  const code = typeof review.reviewType === 'string' ? review.reviewType.slice(1) : ''
  const inProgress = review.inProgress === true
  return {
    kind: abs ? 'abs' : side ? 'manager' : 'crew',
    side,
    teamId: side ? review.challengeTeamId : null,
    reasonCode: code || null,
    reason: REASONS[code] ?? null,
    overturned: inProgress ? null : review.isOverturned === true,
    inProgress,
    playerId: review.player?.id ?? null,
    playerName: review.player?.fullName ?? '',
    inning: play.about?.inning ?? null,
    half: play.about?.halfInning ?? null,
    atBatIndex: play.about?.atBatIndex ?? null,
    pitchNumber,
    isHeuristic,
  }
}

// Every review in one play, in the order it happened: event-level ones in
// event order, then a play-level one last (where it belongs in time).
function reviewsInPlay(feed, play) {
  const out = []
  for (const e of play.playEvents ?? []) {
    if (!e?.reviewDetails) continue
    const r = record(feed, play, e.reviewDetails, e.isPitch ? e.pitchNumber ?? null : null, false)
    if (r) out.push(r)
  }
  if (play.reviewDetails) {
    const lastPitch = (play.playEvents ?? []).filter((e) => e?.isPitch).at(-1)
    const r = record(feed, play, play.reviewDetails, lastPitch?.pitchNumber ?? null, true)
    if (r) out.push(r)
  }
  return out
}

// Reviews and the ABS bank as of the reader's step in (inning, half), or null
// for a half past revealedThrough + 1. Shape:
// { reviews: [record…], bank: null | { away: { remaining, used, overturned },
//   home: {…} } }. `used` counts every ABS challenge made, `overturned` the
// successful ones.
export function reviewsAtStep(feed, { inning, half, step = null, revealedThrough }) {
  if (!inning || !half) return null
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return null
  const cut = stepCutAtBatIndex(feed, inning, half, safeStep(step, here, revealedThrough))
  const regulation = selectRegulationInnings(feed)
  const hasBank = gameHasAbs(feed)
  const bank = {
    away: { remaining: START_CHALLENGES, used: 0, overturned: 0 },
    home: { remaining: START_CHALLENGES, used: 0, overturned: 0 },
  }
  const reviews = []
  // The refill keys on the inning alone (a structural fact, never a result), so
  // it lands when the reader enters an extra inning, before any play in it.
  let lastInning = null
  const enter = (inn) => {
    if (inn === lastInning) return
    lastInning = inn
    if (inn > regulation) for (const s of ['away', 'home']) if (bank[s].remaining === 0) bank[s].remaining = 1
  }
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || !h) continue
    const i = halfIndex(inn, h)
    if (i > here) break
    enter(inn)
    if (i === here && (play.about?.atBatIndex ?? Infinity) > cut) continue
    for (const r of reviewsInPlay(feed, play)) {
      reviews.push(r)
      if (r.kind !== 'abs' || r.inProgress) continue
      const b = bank[r.side]
      b.used += 1
      if (r.overturned) b.overturned += 1
      else b.remaining = Math.max(0, b.remaining - 1)
    }
  }
  enter(inning)
  return { reviews, bank: hasBank ? bank : null }
}
