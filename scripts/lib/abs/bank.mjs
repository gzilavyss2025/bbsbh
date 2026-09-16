// THE CHALLENGE BANK — how many challenges a club still holds, inning by
// inning. Every cut that asks "could this club have challenged" divides by
// this: the chances denominator, the after-a-win control, and the streak
// boards all need to know whether a club was armed, not only whether it asked.
//
// THE RULE IN REGULATION, and it is the one this repo already wrote down: a
// club is issued two challenges and keeps one every time the call is
// overturned, so it is out of them after its SECOND loss. That much is right
// in every game that ends in nine.
//
// IT IS NOT THE WHOLE RULE. A club that has run out is armed again in extra
// innings, and the season's own rows say so out loud:
//
//   54 club-games carry a THIRD failed challenge. Every one of them went to
//   extras, and every third failure fell in an extra inning. Not one club-game
//   in the whole season lost three in regulation.
//
// So the replenishment is certain. Its exact size took more work, because the
// obvious check does not check anything:
//
// `gameData.absChallenges.remaining` IS NOT THE BANK. It equals
// max(0, ISSUED - usedFailed) on 342 of 342 club-sides tested, with no
// exceptions — including every club that failed three times and every club
// that played four extra innings. It is a display value derived from the
// failure count, not a tracked balance, so it cannot tell a topped-up club
// from an empty one, and a model reconciled against it would pass while being
// wrong. Anything that wants the bank has to replay the game.
//
// WHAT THE ROWS DO SETTLE. Replaying all 368 club-games that either lost three
// or lost two in one inning:
//
//   * A club never lost more than ISSUED + (extra innings played). 368 of 368.
//   * One top-up is not enough. gamePk 815625 (Triple-A) lost five — at the
//     3rd, 4th, 10th, 12th and 13th of a thirteen-inning game. Three
//     replenishments, in three separate extra innings.
//   * Topping a club back up to one at the start of each extra inning never
//     asks it to spend a challenge it did not have. 368 of 368.
//
// WHAT THEY DO NOT SETTLE, said plainly. "Topped up TO one when empty" and
// "given one more each extra inning" fit the season equally well, because no
// club has ever entered an extra inning holding one and then lost two in that
// same inning — the only shape that separates them. They agree on the question
// every surface actually asks, which is whether a club is armed at the start
// of an extra inning: under both, it is. MLB's own club-games are all capped
// at three failures, but only 39 of them ever played two or more extra innings
// after running out, which is too few to say whether MLB stops at one top-up
// or simply never needed a second.
//
// So the model below takes the conservative reading — topped up TO one, never
// accumulating — and the surfaces that matter are unaffected by the choice.

// What a club is issued at the first pitch.
export const ISSUED = 2

// The first inning at which a club that has run out is armed again.
export const FIRST_EXTRA_INNING = 10

// How many a club holds at the start of an inning, given the innings it LOST a
// challenge in. Wins are not passed, because a win costs nothing.
function countByInning(failInnings) {
  const lost = new Map()
  for (const i of failInnings) lost.set(i, (lost.get(i) ?? 0) + 1)
  return lost
}

// How far the replay has to run. A caller that knows the game's length passes
// it; the ledger does not carry it yet, so a caller that does not know gets a
// replay to the last inning a challenge was lost in. That is enough to replay
// what DID happen, which is what every check against the rows needs. It is not
// enough to say a club was re-armed in an extra inning it never challenged in
// — for that, pass `innings`.
function lastInning(failInnings, innings) {
  const seen = failInnings.reduce((m, i) => (i > m ? i : m), 0)
  return Math.max(innings ?? 0, seen)
}

// One club's night, inning by inning.
//
// Returns what it held at the START of each inning (`atStart`, keyed by inning
// number), what it held at the end (`held`), how many times it was armed again
// in extras (`toppedUp`), the inning of each emptying (`emptiedIn`, in order),
// and whether the rule held at all (`overdrawn`).
//
// AN EMPTYING IS DATED TO THE INNING THE LAST CHALLENGE WAS SPENT IN, not to
// the next inning the club starts with nothing. The two differ by one, and the
// first is what "ran out in the sixth" has always meant here: a second loss in
// the sixth is a club that enters the seventh unable to argue, which is the
// cost LAST_EARLY_INNING is drawn around.
//
// `overdrawn` is reported rather than clamped away. A club cannot spend a
// challenge it does not hold, so a game that overdraws means the MODEL is
// wrong about the rule, not that the club cheated — and a model that quietly
// floored it would hide the day the rule changes.
export function replayBank(failInnings, innings = null) {
  const lost = countByInning(failInnings)
  const last = lastInning(failInnings, innings)

  let held = ISSUED
  const atStart = new Map()
  const emptiedIn = []
  let toppedUp = 0
  let overdrawn = 0

  for (let inning = 1; inning <= last; inning++) {
    if (inning >= FIRST_EXTRA_INNING && held === 0) {
      held = 1
      toppedUp += 1
    }
    atStart.set(inning, held)
    const spent = lost.get(inning) ?? 0
    if (spent > held) overdrawn += spent - held
    const after = Math.max(0, held - spent)
    if (spent > 0 && after === 0) emptiedIn.push(inning)
    held = after
  }
  return { held, atStart, toppedUp, emptiedIn, overdrawn, innings: last }
}

// Did this club's failures fit the rule? True when the replay never had to
// spend a challenge the club did not hold. It is the season-wide invariant the
// tests assert — a club that fails it means the model is wrong, not the game.
export function bankHolds(failInnings, innings = null) {
  return replayBank(failInnings, innings).overdrawn === 0
}

// Was the club armed at the start of this inning? The question the chances
// denominator asks of every half-inning.
export function armedAt(failInnings, inning, innings = null) {
  const { atStart } = replayBank(failInnings, Math.max(inning, innings ?? 0))
  return (atStart.get(inning) ?? 0) > 0
}

// EVERY CLUB-GAME ON FILE, CHECKED AGAINST THE MODEL. A standing check rather
// than a fixture, for the same reason challengerGain's sign convention is
// checked against the season total in export.mjs: the rule is MLB's to change,
// and a fixture pinned today would keep passing on the day it does.
//
// It returns the club-games whose failures the model cannot pay for. That list
// is empty across all 18,957 challenges on file. A row appearing in it means
// the top-up is bigger, or earlier, than FIRST_EXTRA_INNING and ISSUED say —
// not that a club overdrew.
//
// The game's length is not passed, because the ledger does not carry it. That
// only makes the check STRICTER: without it the replay tops a club up solely
// at innings it actually challenged in, so a real top-up it never used cannot
// paper over a failure it could not afford.
export function auditBank(rows) {
  const byGameTeam = new Map()
  for (const r of rows) {
    if (r.outcome !== 'fail') continue
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r.inning)
    byGameTeam.set(key, list)
  }
  const bad = []
  for (const [key, failInnings] of byGameTeam) {
    const { overdrawn } = replayBank(failInnings)
    if (overdrawn > 0) {
      const [gamePk, teamId] = key.split(':').map(Number)
      bad.push({ gamePk, teamId, failInnings: [...failInnings].sort((a, b) => a - b), overdrawn })
    }
  }
  return bad
}
