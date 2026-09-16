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
// So the model takes the conservative reading — topped up TO one, never
// accumulating — and the surfaces that matter are unaffected by the choice.
//
// A WIN COSTS NOTHING, BUT IT STILL HAS TO BE PAID FOR FIRST. This is the trap
// that makes a failures-only model quietly wrong: a club must HOLD a challenge
// to ask at all, win or lose, and the overturn refunds it afterwards. So the
// ORDER matters and a failure count alone cannot see it — `L L W` and `W L L`
// both end on two failures, but only the second is spendable out of a bank of
// two. Two real club-games are the first shape. Hence TOLERATED below, and
// hence this function takes every challenge rather than only the lost ones.

// What a club is issued at the first pitch.
export const ISSUED = 2

// HOW LONG THE GAME WAS SCHEDULED FOR, when nothing says. Every MLB game and
// all but 171 of Triple-A's.
export const REGULATION_INNINGS = 9

// The first inning at which a club that has run out is armed again. It is the
// tenth in a nine-inning game and the EIGHTH in a seven-inning one, so it is
// derived from the game's own length rather than fixed.
//
// IT WAS FIXED AT TEN, AND THE LEDGER HELD THE EXCEPTION. 171 Triple-A games
// on file are seven-inning doubleheader games, 22 of them went past the
// seventh, and 23 challenges on file were called in the 8th or later of one.
// Nothing shipped was wrong, because replayBank was only ever called WITHOUT a
// length and so topped a club up solely at innings it really challenged in.
// Passing a length is what broke it: replaying those 22 games at their real
// length asked about innings the club never challenged in, and the answer came
// out wrong 15 times — a club called unarmed in the 8th when the rule had just
// re-armed it. The chances denominator passes a length on every game, which is
// why `scheduled_innings` is stored beside `final_inning` (docs/adr/0075). The
// schedule row --recheck already reads carries it, at no extra call.
//
// A caller that does not know the length gets the nine-inning answer, which is
// right for every MLB game and wrong only for a seven-inning game it did not
// identify as one.
export function firstExtraInning(scheduledInnings) {
  return (scheduledInnings ?? REGULATION_INNINGS) + 1
}

// The nine-inning answer, named. Kept as a constant because it is the one the
// tests and the prose both reach for.
export const FIRST_EXTRA_INNING = firstExtraInning(null)

// TWO CLUB-GAMES THE RULE CANNOT PAY FOR, AND THEY ARE MLB'S DATA, NOT OURS.
// Each was checked row by row against its own feed and every challenge is
// really there; in each game the OTHER club goes through the same code and
// comes out legal, which is what rules out a bug on this side. gamePk 816599
// is the control: both clubs end on one overturn and two losses, and only the
// order differs — `1L 5L 9W` is what team 416 did, and the 9th-inning overturn
// had to be paid for out of a bank the 5th had already emptied.
//
// They are listed rather than silently floored, so `auditBank` stays a live
// check: it is green today, and a THIRD entry means MLB moved the rule.
export const TOLERATED = new Set(['815094:102', '816599:416'])

// THE TWO HALVES OF AN INNING, IN THE ORDER THEY ARE PLAYED. The bank is
// carried across them, so the replay walks them by name rather than counting.
export const HALVES = ['top', 'bottom']

// Which half a row belongs to, and the fallback is `bottom` for the same
// reason inOrder sorts an unnamed half last: a row the feed left unlabelled is
// put after the top, never before it, so the two agree on every night.
function halfOf(c) {
  return c.half === 'top' ? 'top' : 'bottom'
}

// The key `atHalf` is read by. One string rather than a Map of Maps, because
// every caller asks for one half at a time and never iterates a whole inning.
export function halfKey(inning, half) {
  return `${inning}:${half}`
}

// Top before bottom, then the order the rows were written in — the sequence a
// club actually spent its challenges in.
function inOrder(challenges) {
  return [...challenges].sort(
    (a, b) =>
      a.inning - b.inning ||
      (halfOf(a) === 'top' ? 0 : 1) - (halfOf(b) === 'top' ? 0 : 1) ||
      (a.seq ?? 0) - (b.seq ?? 0),
  )
}

// How far the replay has to run. A caller that knows the game's length passes
// it; the ledger does not carry it yet, so a caller that does not know gets a
// replay to the last inning the club challenged in. That is enough to replay
// what DID happen, which is what every check against the rows needs. It is not
// enough to say a club was re-armed in an extra inning it never challenged in
// — for that, pass `innings`.
function lastInning(challenges, innings) {
  const seen = challenges.reduce((m, c) => (c.inning > m ? c.inning : m), 0)
  return Math.max(innings ?? 0, seen)
}

// One club's night, half-inning by half-inning. `challenges` is every challenge
// that club called for, in any order, each `{ inning, half, outcome }` — the
// shape the rows already have.
//
// Returns what it held at the START of each inning (`atStart`, keyed by inning
// number) AND at the start of each HALF (`atHalf`, keyed by halfKey), what it
// held at the end (`held`), how many times it was armed again in extras
// (`toppedUp`), the inning of each emptying (`emptiedIn`, in order), the
// challenge that CAUSED each of those emptyings (`emptiedBy`, the same order
// and the same length), and how many challenges the model could not pay for
// (`overdrawn`).
//
// `emptiedBy` IS THE ROW, not a copy of it, so a caller reads the player, the
// half, the call and the miss distance off the one the club really spent. The
// out-of-challenges board is built on it (ranout.mjs), and it comes from the
// replay rather than from "the second failed challenge" for the reason the
// whole of this file exists: two fails empty a club under TODAY'S rule, and a
// board that counted to two would keep printing a confident answer on the day
// the rule moves.
//
// THE HALF IS THE UNIT, AND THE INNING IS TOO COARSE FOR THE ONE QUESTION THAT
// MATTERS. A club that spends its last challenge in the TOP of the seventh
// holds nothing in the bottom of it, but `atStart` — recorded once, before the
// inning's rows are spent — still says it was armed. Counting chances off that
// credits the club a half-inning it could not have argued in. It is 0.62% of
// MLB's chances and 0.80% of Triple-A's, and it is concentrated in exactly the
// late innings the appetite finding is measured across (docs/adr/0075), so the
// replay carries the bank across the two halves and records it at each.
//
// AN EMPTYING IS DATED TO THE INNING THE LAST CHALLENGE WAS SPENT IN, not to
// the next inning the club starts with nothing. The two differ by one, and the
// first is what "ran out in the sixth" has always meant here: a second loss in
// the sixth is a club that enters the seventh unable to argue, which is the
// cost LAST_EARLY_INNING is drawn around.
//
// `overdrawn` is COUNTED AND CARRIED, never thrown and never allowed to go
// negative. Two real club-games overdraw (see TOLERATED) and they are MLB's
// data rather than a bug here, so a replay that threw would take the whole
// season's export down over two rows, and one that dropped the club would lose
// challenges that genuinely happened.
export function replayBank(challenges, innings = null, scheduledInnings = null) {
  const ordered = inOrder(challenges)
  const last = lastInning(ordered, innings)
  const firstExtra = firstExtraInning(scheduledInnings)

  const byInning = new Map()
  for (const c of ordered) {
    const list = byInning.get(c.inning) ?? []
    list.push(c)
    byInning.set(c.inning, list)
  }

  let held = ISSUED
  const atStart = new Map()
  const atHalf = new Map()
  const emptiedIn = []
  const emptiedBy = []
  let toppedUp = 0
  let overdrawn = 0

  for (let inning = 1; inning <= last; inning++) {
    // The top-up lands at the START of the extra inning, which is its top.
    if (inning >= firstExtra && held === 0) {
      held = 1
      toppedUp += 1
    }
    atStart.set(inning, held)
    const here = byInning.get(inning) ?? []
    let emptiedHere = null
    for (const half of HALVES) {
      atHalf.set(halfKey(inning, half), held)
      for (const c of here) {
        if (halfOf(c) !== half) continue
        if (held === 0) {
          overdrawn += 1
        } else {
          held -= 1
          if (held === 0) emptiedHere = c
        }
        // The overturn gives it straight back, so the club is not out after all.
        if (c.outcome === 'success') {
          held += 1
          emptiedHere = null
        }
      }
    }
    // AN EMPTYING IS STILL DATED TO THE INNING, not to the half. "Ran out in
    // the sixth" is the figure the club board prints and LAST_EARLY_INNING is
    // drawn around, and splitting it by half would change what that column
    // means for a reason that has nothing to do with the column.
    if (emptiedHere) {
      emptiedIn.push(inning)
      emptiedBy.push(emptiedHere)
    }
  }
  return { held, atStart, atHalf, toppedUp, emptiedIn, emptiedBy, overdrawn, innings: last }
}

// Did this club's challenges fit the rule? True when the replay never had to
// spend one the club did not hold.
export function bankHolds(challenges, innings = null, scheduledInnings = null) {
  return replayBank(challenges, innings, scheduledInnings).overdrawn === 0
}

// Was the club armed at the start of this HALF-INNING? The question the chances
// denominator asks of every one of them.
//
// `half` defaults to the top, which is the start of the inning and so the
// answer a caller asking about a whole inning means.
//
// PASS THE GAME'S LENGTH, BOTH OF THEM. `innings` is how far the game went and
// `scheduledInnings` is how far it was meant to, and the second is what says
// which innings were extra. Asking about the 8th of a seven-inning game
// without it gets the nine-inning answer, which is wrong.
export function armedAt(challenges, inning, innings = null, scheduledInnings = null, half = 'top') {
  const { atHalf } = replayBank(challenges, Math.max(inning, innings ?? 0), scheduledInnings)
  return (atHalf.get(halfKey(inning, half)) ?? 0) > 0
}

// EVERY CLUB-GAME ON FILE, CHECKED AGAINST THE MODEL. A standing check rather
// than a fixture, for the same reason challengerGain's sign convention is
// checked against the season total in export.mjs: the rule is MLB's to change,
// and a fixture pinned today would keep passing on the day it does.
//
// It returns the club-games whose challenges the model cannot pay for, less
// the two known ones. That list is empty across all 18,957 challenges on file.
// A row appearing in it means the top-up is bigger, or earlier, than
// FIRST_EXTRA_INNING and ISSUED say — not that a club overdrew.
//
// The game's length is not passed, because the ledger does not carry it. That
// only makes the check STRICTER: without it the replay tops a club up solely
// at innings it actually challenged in, so a real top-up it never used cannot
// paper over a challenge it could not afford.
export function auditBank(rows) {
  const byGameTeam = new Map()
  for (const r of rows) {
    const key = `${r.game_pk}:${r.team_id}`
    const list = byGameTeam.get(key) ?? []
    list.push(r)
    byGameTeam.set(key, list)
  }
  const bad = []
  for (const [key, challenges] of byGameTeam) {
    if (TOLERATED.has(key)) continue
    const { overdrawn } = replayBank(challenges)
    if (overdrawn === 0) continue
    const [gamePk, teamId] = key.split(':').map(Number)
    bad.push({
      gamePk,
      teamId,
      overdrawn,
      order: inOrder(challenges)
        .map((c) => `${c.inning}${c.outcome === 'success' ? 'W' : 'L'}`)
        .join(' '),
    })
  }
  return bad
}
