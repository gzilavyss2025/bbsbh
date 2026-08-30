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

// A club starts each game with this many challenges. THE RULES DO NOT CHANGE BY
// LEVEL: every game that runs the system opens with `remaining: 2` a side in
// gameData.absChallenges, keeps one on a success and spends one on a failure
// (Triple-A clubs reach exactly 2 failures and stop, over 114 club-games of a
// season-wide sample), and refills in extra innings the same way MLB does
// (Triple-A clubs reach 3 failures only in games past the 9th). Single-A's
// Florida State League opens at 2 a side as well. See .scratch/abs-aaa-gate/.
export const START_CHALLENGES = 2

// THE SYSTEM IS NOT A LEVEL, so this does not read one. In 2026 the ABS
// challenge system runs at MLB (sportId 1), at Triple-A (11) and, inside
// Single-A (14), in the Florida State League ALONE — while Double-A (12),
// High-A (13) and Single-A's other two leagues (Carolina, California) do not
// run it at all. A sportId allowlist cannot draw that line: it would either
// hide Triple-A's real challenges (which is what the earlier `sport.id === 1`
// check did) or put a misleading "2 left" row on every Carolina League box
// score.
//
// The feed draws the line itself, and draws it EXACTLY at the two levels this
// row is for. `gameData.absChallenges` was present on 89 of 89 MLB and 95 of
// 95 Triple-A Final games sampled across six dates spanning the 2026 season,
// and absent — with no `MJ` review anywhere in the play data — on all 125
// Double-A, High-A, Carolina League and California League games checked. So a
// level that GAINS the system next season gets its row with no change here,
// and a level that loses it loses the row the same way.
//
// IT IS NOT A PERFECT ORACLE, and do not write code that assumes it is. The
// key is reported per VENUE, not per league, and one park runs the challenge
// system without reporting a bank: every Tampa Tarpons home game at George M.
// Steinbrenner Field (Single-A, Florida State League) carries real `MJ`
// challenges and NO `absChallenges` key — 30 of them over 7 sampled games — so
// this gate hides a row that should show. Daytona's Jackie Robinson Ballpark
// is the honest opposite: no key, and no challenges either. Every other FSL
// park reports the key and its challenges agree. The gap is issue #964.
//
// Widening the gate to "has the key OR carries an `MJ` review" would fix that
// park and BREAK THE SPOILER RULE, which is why it is not done: the row's
// presence would then depend on unrevealed play data, so the row appearing at
// all would tell you a challenge happened somewhere in a game you have not
// revealed. Presence of the pregame key is the only gate available that says
// nothing about what has happened yet. A venue allowlist is the honest fix.
// .scratch/abs-aaa-gate/ has the probes.
//
// PRESENCE ONLY — never the values. The same object also carries live
// whole-game counts (`hasChallenges`, `usedFailed`, `remaining`) that are NOT
// clamped to the reached half; reading one would leak a later half's outcome
// straight past the seal. Presence alone is spoiler-free: the key is already
// there before the first pitch (`hasChallenges: false`, `remaining: 2` at every
// level pregame), so it says which RULES this game plays under, the same class
// of fact as the venue or the club ids beside it. The remaining count AbsRow
// shows still comes from scanChallenges' clamped walk, never from here.
export function gameHasAbs(feed) {
  return feed?.gameData?.absChallenges != null
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
// This returns AT MOST ONE challenge per play, and that is a KNOWN BUG, not a
// property of the data — issue #963. A review can sit at either location and
// is sometimes mirrored at both (see isAbsChallenge above), which is what the
// pitch-level-first order below is for: checking playEvents[].reviewDetails
// (hasReview: true) before the play-level fallback both dedupes a mirrored
// review AND, when the pitch-level location is the one that matches, gives an
// exact pitch rather than a guess.
//
// But the two locations are NOT always mirrors. One plate appearance can carry
// two genuinely distinct challenges — the same club twice (gamePk 816831, bot
// 6: pitch 2 upheld, pitch 4 overturned) or BOTH clubs (gamePk 823011, top 7:
// team 134 overturned at the pitch level, team 138 upheld at the play level).
// Treating the second as a mirror drops it, so the tally runs one light on
// roughly a fifth of games at every level. Fixing it means returning a list
// and deduping on (challengeTeamId, isOverturned, player.id); both callers
// take the shape change.
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
