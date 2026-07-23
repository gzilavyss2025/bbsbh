// ABS (Automated Ball-Strike) challenge tracking for the R/H/E card's third row
// (see StatBox) and the play-by-play pitch list's per-pitch marker
// (api/playbyplay.js's pitchCardInfo). Each club starts a game with two
// challenges, KEEPS one when its challenge succeeds (the umpire's call is
// overturned) and LOSES one only when it fails; a club that runs out gets one
// more for each extra inning it enters empty. StatBox's AbsRow surfaces this
// as a REMAINING COUNT — used/open pips, same grammar as the mound-visit
// notice's pip row (UsagePips) — not an outcome history: a club that keeps
// winning its challenges always shows its full starting count, since a
// success never spends one.
//
// REVEAL-ONLY by caller contract: a challenge can flip a called third strike, so
// this reads score-adjacent in-game state. It's computed only from inside
// StatBox's SealBox reveal and CLAMPED to the half the user has reached — a
// challenge in a later half never reaches the DOM. challengeForPlay itself
// carries no gate of its own — it's only ever called (directly, or via
// scanChallenges below) on a play already inside a reveal-only caller's own
// clamped scope (StatBox's inning/half, or playbyplay.js's single half), same
// footing as every other per-play read in this app.

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

// The ABS challenge (if any) carried by one play, resolved down to the exact
// pitch it belongs to — the shared primitive behind both this file's own
// scanChallenges (below) and playbyplay.js's per-pitch marker, so there's one
// place that knows how to find a challenge and pin it to a pitch, not two
// copies that could drift.
//
// A play carries AT MOST one ABS challenge, which can sit at either location
// — sometimes mirrored at both (see isAbsChallenge above). Pitch-level first:
// checking playEvents[].reviewDetails (hasReview: true) before the play-level
// fallback both dedupes a mirrored review AND, when the pitch-level location
// is the one that matches, gives an exact pitch rather than a guess.
//
// About half of real challenges (verified against gamePk 823036) carry no
// pitch-level reviewDetails at all — only play.reviewDetails, with no pitch
// flagged. For those, `pitchNumber` falls back to the at-bat's LAST pitch
// (`isHeuristic: true`) — true in every case checked (a challenge is always
// on the deciding pitch of the plate appearance), but the feed never says so
// explicitly, so callers that need to know the difference can check the flag.
export function challengeForPlay(feed, play) {
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const pitchEvents = (play.playEvents ?? []).filter((e) => e.isPitch)

  let review = null
  let pitchNumber = null
  let isHeuristic = false
  for (const e of pitchEvents) {
    if (isAbsChallenge(e.reviewDetails)) {
      review = e.reviewDetails
      pitchNumber = e.pitchNumber ?? null
      break
    }
  }
  if (!review && isAbsChallenge(play.reviewDetails)) {
    review = play.reviewDetails
    isHeuristic = true
    pitchNumber = pitchEvents.at(-1)?.pitchNumber ?? null
  }
  if (!review) return null

  const side = review.challengeTeamId === awayId ? 'away' : review.challengeTeamId === homeId ? 'home' : null
  if (!side) return null

  return {
    side,
    teamId: review.challengeTeamId,
    outcome: review.isOverturned ? 'success' : 'fail',
    pitchNumber,
    isHeuristic,
    playerId: review.player?.id ?? null,
    playerName: review.player?.fullName ?? '',
  }
}

// Every ABS challenge through (throughInning, throughHalf) inclusive, in
// chronological order, each carrying who challenged, when, on which pitch,
// and whether it succeeded. Later halves are never read, so nothing sealed
// leaks. Not exported directly — selectChallengeState below is every current
// caller's own shape (grouped by side, for AbsRow's pip row + detail list).
function scanChallenges(feed, throughInning, throughHalf) {
  const limit = halfOrder(throughInning, throughHalf)
  const out = []
  for (const p of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = p.about?.inning
    const half = p.about?.halfInning
    if (inning == null || half == null) continue
    if (halfOrder(inning, half) > limit) break
    const c = challengeForPlay(feed, p)
    if (c) out.push({ ...c, inning, half, atBatIndex: p.about?.atBatIndex ?? null })
  }
  return out
}

// Each club's challenges, in chronological order, through (throughInning,
// throughHalf) inclusive — grouped by side for AbsRow's pip row + expandable
// detail list (StatBox.jsx). Each entry is a full challengeForPlay record
// (outcome, inning, half, who), not just the outcome string — AbsRow reads
// the extra fields to answer "who challenged, and when" once expanded.
export function selectChallengeState(feed, throughInning, throughHalf) {
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const all = scanChallenges(feed, throughInning, throughHalf)
  return {
    away: { teamId: awayId, outcomes: all.filter((c) => c.side === 'away') },
    home: { teamId: homeId, outcomes: all.filter((c) => c.side === 'home') },
  }
}
