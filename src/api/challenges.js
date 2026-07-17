// ABS (Automated Ball-Strike) challenge tracking for the R/H/E card's third row
// (see StatBox). Each club starts a game with two challenges, KEEPS one when its
// challenge succeeds (the umpire's call is overturned) and LOSES one only when it
// fails; a club that runs out gets one more for each extra inning it enters
// empty. StatBox's AbsRow surfaces this as a REMAINING COUNT — used/open pips,
// same grammar as the mound-visit notice's pip row (UsagePips) — not an outcome
// history: a club that keeps winning its challenges always shows its full
// starting count, since a success never spends one.
//
// REVEAL-ONLY by caller contract: a challenge can flip a called third strike, so
// this reads score-adjacent in-game state. It's computed only from inside
// StatBox's SealBox reveal and CLAMPED to the half the user has reached — a
// challenge in a later half never reaches the DOM.

// A club starts each game with this many challenges.
export const START_CHALLENGES = 2

// ABS is an MLB (sportId 1) system; MiLB feeds carry no challenges, so the row
// stays hidden there rather than showing a misleading "2 remaining" start state.
export function gameHasAbs(feed) {
  return feed?.gameData?.teams?.away?.sport?.id === 1
}

// An ABS challenge review can sit at EITHER the play level (`play.reviewDetails`)
// or on the specific challenged pitch event (`play.playEvents[].reviewDetails`),
// depending on whether the challenged pitch was the at-bat's deciding pitch —
// verified against gamePk 823036, which has four real ABS challenges: two on
// the play itself (Frelick's failed challenge, top 2nd; Mitchell's successful
// one, top 8th) and two on a `type:"pitch"` playEvent instead (Fermín's failed
// challenge, bottom 3rd; Contreras's failed challenge, bottom 8th). Both
// locations must be scanned, or real challenges get missed.
//
// `challengeTeamId` alone isn't enough to identify one: the same game also has
// a `reviewDetails` from MLB's older, unrelated manager's-replay-challenge
// system (e.g. a pickoff-attempt review) that also sets `challengeTeamId`.
// `reviewType` tells the two apart — every genuine ABS ball-strike challenge in
// this game carries `"MJ"`; the manager's-replay review carries `"MA"` and only
// ever appears on a non-`pitch` event. Requiring `reviewType === 'MJ'` is what
// excludes it.
function isAbsChallenge(review) {
  return Boolean(review && review.challengeTeamId != null && review.reviewType === 'MJ')
}

// 1-based half order (top 1 = 1, bottom 1 = 2, top 2 = 3, …), for clamping to
// the reached half.
function halfOrder(inning, half) {
  return half === 'bottom' ? inning * 2 : inning * 2 - 1
}

// Each club's challenge outcomes ('success' | 'fail') in chronological order,
// through (throughInning, throughHalf) inclusive. Later halves are never read,
// so nothing sealed leaks.
export function selectChallengeState(feed, throughInning, throughHalf) {
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const limit = halfOrder(throughInning, throughHalf)
  const outcomes = { away: [], home: [] }
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || half == null) continue
    if (halfOrder(inning, half) > limit) break
    const candidates = [p.reviewDetails, ...(p.playEvents ?? []).map((pe) => pe.reviewDetails)]
    for (const review of candidates) {
      if (!isAbsChallenge(review)) continue
      const side = review.challengeTeamId === awayId ? 'away' : review.challengeTeamId === homeId ? 'home' : null
      if (!side) continue
      outcomes[side].push(review.isOverturned ? 'success' : 'fail')
    }
  }
  return {
    away: { teamId: awayId, outcomes: outcomes.away },
    home: { teamId: homeId, outcomes: outcomes.home },
  }
}
