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
// THE BANK (ABS only) is challenges.js' challengesLeft, the one rule the
// scorebug row and the box score read too: START_CHALLENGES, a failure spends
// one, a success keeps it, and a club that enters an extra inning empty is
// given one. A game that does not run the
// system (gameHasAbs) has no bank: `bank` is null.

import { isAbsChallenge, challengesForPlay, challengesLeft, gameHasAbs } from '../challenges.js'
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

const reasonOf = (reviewType) => {
  const code = typeof reviewType === 'string' ? reviewType.slice(1) : ''
  return { reasonCode: code || null, reason: REASONS[code] ?? null }
}
const placeOf = (play) => ({
  inning: play.about?.inning ?? null,
  half: play.about?.halfInning ?? null,
  atBatIndex: play.about?.atBatIndex ?? null,
})

// Every review in one play. ABS challenges come from challenges.js'
// challengesForPlay, the one walk that finds them and pins each to its pitch
// (StatBox and the pitch list read it too); this module only adds the
// manager's and the umpires' reviews, event-level in event order, then a
// play-level one last (where it belongs in time).
function reviewsInPlay(feed, play) {
  const out = challengesForPlay(feed, play).map((c) => ({
    kind: 'abs',
    side: c.side,
    teamId: c.teamId,
    ...reasonOf(c.reviewType),
    overturned: c.inProgress ? null : c.outcome === 'success',
    inProgress: c.inProgress,
    playerId: c.playerId,
    playerName: c.playerName,
    ...placeOf(play),
    pitchNumber: c.pitchNumber,
    isHeuristic: c.isHeuristic,
  }))
  const other = (review, pitchNumber, isHeuristic) => {
    if (!review || isAbsChallenge(review)) return
    const side = sideOf(feed, review.challengeTeamId)
    const inProgress = review.inProgress === true
    out.push({
      kind: side ? 'manager' : 'crew',
      side,
      teamId: side ? review.challengeTeamId : null,
      ...reasonOf(review.reviewType),
      overturned: inProgress ? null : review.isOverturned === true,
      inProgress,
      playerId: review.player?.id ?? null,
      playerName: review.player?.fullName ?? '',
      ...placeOf(play),
      pitchNumber,
      isHeuristic,
    })
  }
  for (const e of play.playEvents ?? []) other(e?.reviewDetails, e?.isPitch ? e.pitchNumber ?? null : null, false)
  const lastPitch = (play.playEvents ?? []).filter((e) => e?.isPitch).at(-1)
  other(play.reviewDetails, lastPitch?.pitchNumber ?? null, true)
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
  const reviews = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || !h) continue
    const i = halfIndex(inn, h)
    if (i > here) break
    if (i === here && (play.about?.atBatIndex ?? Infinity) > cut) continue
    reviews.push(...reviewsInPlay(feed, play))
  }
  if (!gameHasAbs(feed)) return { reviews, bank: null }
  // The refill keys on the inning alone (a structural fact, never a result),
  // so it lands when the reader enters an extra inning, before any play in it.
  const regulation = selectRegulationInnings(feed)
  const bankOf = (side) => {
    const abs = reviews.filter((r) => r.kind === 'abs' && r.side === side)
    const settled = abs.filter((r) => !r.inProgress)
    return {
      remaining: challengesLeft(
        abs.map((r) => ({ inning: r.inning, inProgress: r.inProgress, outcome: r.overturned ? 'success' : 'fail' })),
        { regulation, throughInning: inning },
      ),
      used: settled.length,
      overturned: settled.filter((r) => r.overturned).length,
    }
  }
  return { reviews, bank: { away: bankOf('away'), home: bankOf('home') } }
}
