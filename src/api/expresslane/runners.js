// EXPRESS LANE — the scoring deck: whose diamond to mark, and where he stands.
//
// A scorer does not write a stolen base on the batter's box. He writes it on
// the RUNNER's box — the box of the plate appearance in which that runner
// reached base, which on the paper sheet is a row further up. So a surface
// that shows only the man at the plate is unusable for exactly the plays
// Express Lane exists to catch: the steal, the wild pitch, the hit that sends
// a runner first to third. This module names the boxes that have to be on the
// screen beside the batter's.
//
// REVEAL-ONLY, on the same footing as rail.js beside it. Every card here
// carries its plate appearance's outcome, so this is callable only from inside
// a SealBox's reveal render function (ADR-0001/0002).
//
// THE TRAP THIS EXISTS TO CLEAR, and it is a real one. A runner's diamond
// shows the bases he legged out — and if it is built from the finished feed it
// shows his EVENTUAL fate. A man who reached first in the third and came
// around to score two batters later would have a fully shaded diamond the
// moment his own at-bat was revealed, which tells the scorer the run came home
// before he has scored the play that drove it in.
//
// `computeHalfInningFeed` already solved that for at-bat stepping (ADR-0016):
// its `stepCap` gates what LATER plays are allowed to write back onto EARLIER
// cards. Express Lane passes the film-gate cursor as that same cap, so the
// runners' diamonds are true as of the cursor and never past it. This module
// does not re-derive any of it — it maps one rail row onto that cap and reads
// the cards back out.
//
// The rule it enforces on top: NEVER build the deck from an uncapped feed.
// `expressDeck` takes the cursor and there is deliberately no variant that
// omits it.

import { computeHalfInningFeed, pitchLadder } from '../playbyplay.js'
import { classifyOut, scorecardCenterCode } from '../scorecard/notation.js'

// The batting side of a half, the same convention the rest of InningViewer
// uses: the away club bats the top, the home club the bottom.
export function battingSideOf(half) {
  return half === 'bottom' ? 'home' : 'away'
}

// One rail row -> `computeHalfInningFeed`'s `stepCap`.
//
// The rail keys on the feed's own game-wide plate-appearance number, and so do
// the cards, so the join is that number rather than a position — the two lists
// do not have the same length, because the rail carries a row per EVENT and
// the feed carries a card per PLAY, with mound-visit notes interleaved.
//
// `isTerminal` IS PART OF THE JOIN, AND LEAVING IT OUT IS A LEAK. Result mode
// keeps every `action` row, and an action row sits INSIDE a plate appearance
// and carries that plate appearance's own atBatIndex — a batter timeout, a
// mound visit, a substitution announced mid-count. Joined on the number alone,
// a cursor resting on the timeout inside Lara's at-bat capped the feed one card
// too far and drew his finished box: "6-3", read before the pitch that made it
// had been watched. The film gate was intact; the deck walked around it. Found
// on the real surface, pinned by test/express-lane-runners.test.js.
//
// So a TERMINAL row includes its own card — that play is over and its film has
// been seen — and any other row stops SHORT of it, because the plate appearance
// it sits inside has not been earned yet.
//
// The cap is a COUNT of visible entries. Zero is a real answer: the cursor is
// inside the first plate appearance of the half and nothing is finished. A row
// whose plate appearance is not in this half returns null, and a caller reads
// that as "nothing to draw" rather than falling back to the uncapped feed.
export function railStepCap(entries, row) {
  if (!row || row.atBatIndex == null) return null
  const at = (entries ?? []).findIndex((card) => card?.atBatIndex === row.atBatIndex)
  if (at < 0) return null
  return row.isTerminal ? at + 1 : at
}

// THE NUMBER EXPRESS LANE WRITES INTO THE APP'S OWN AT-BAT MARK.
//
// Express Lane is not a second scoring frontier beside the innings viewer's —
// it is the same one, walked a different way — so advancing here has to move
// the same mark, in the same unit, that a tap in the innings viewer or on the
// scorecard moves. That unit is a COUNT OF `computeHalfInningFeed` ENTRIES
// (ADR-0016): `revealAtBat(inning, half, count)` stores it, and PlayByPlay
// reads it back as how much of the half to draw.
//
// A COUNT OF RAIL ROWS IS A DIFFERENT NUMBER, and the two are not
// interchangeable. The rail carries a row per EVENT and the feed a card per
// PLAY, with mound visits, substitutions and timeouts interleaved on one side
// and not the other. Over the captured game (gamePk 823035) they disagree at 99
// of 128 cursor positions, and at 91 of those the rail position is the LARGER
// — so writing it would open entries in the innings viewer that Express Lane
// never showed. Pinned by test/express-lane-runners.test.js.
//
// This is `expressDeck`'s own cap, exposed on its own, because the reveal
// happens as the cursor lands rather than a render later.
export function railRevealCap(feed, inningNum, half, row) {
  if (!feed || !row) return null
  return railStepCap(computeHalfInningFeed(feed, inningNum, half, battingSideOf(half)), row)
}

// The runners standing on base, as of whatever cap built these entries.
//
// A card is a live runner when its trip reached a base, has not come home, and
// did not end with him put out. Each of those three is a field the feed itself
// filled in and `computeHalfInningFeed` already cap-gated:
//
//   reached  1-3 = the furthest base of his current trip; 4 = he scored
//   scored   he is home, so he is not on base
//   outAt    he was put out on the bases, so he is not on base either
//
// `outAt` is the one a naive read drops, and dropping it puts a man on first
// who was erased on a fielder's choice two pitches ago. Verified over the
// captured game (gamePk 823035): 101 cursor positions, no base ever holding
// two runners and no cursor holding four.
//
// Ordered THIRD, SECOND, FIRST — the order they will score in, and the order
// the eye reads a diamond. The batter's own card is excluded even when he has
// reached, because his box is the deck's main box and drawing it twice would
// have the scorer marking one play in two places.
export function runnersOnBase(entries, { excludeAtBatIndex = null } = {}) {
  const out = []
  for (const card of entries ?? []) {
    if (card?.kind !== 'atbat' && card?.kind !== 'placed') continue
    if (excludeAtBatIndex != null && card.atBatIndex === excludeAtBatIndex) continue
    const base = card.reached ?? 0
    if (base < 1 || base > 3) continue
    if (card.scored) continue
    if (card.outAt != null) continue
    out.push({ base, card })
  }
  // Two live trips can never share a base, so the sort is a presentation
  // order rather than a tie-break.
  return out.sort((a, b) => b.base - a.base)
}

// The three derived marks `AtBatBox` draws but does not compute: the outcome
// box's out CATEGORY, the fielding chain penciled mid-diamond, and the pitch
// ladder down the right edge.
//
// Composed from the same two modules the #22 sheet composes them from
// (`scorecardGame.js` does this in its own loop) rather than spelled a second
// way here. That is the point: one plate appearance has to draw the SAME box
// on the sheet and in Express Lane, or a scorer copying from the screen onto
// paper meets two different marks for one play.
function withBoxMarks(card, descByAtBat) {
  if (!card || (card.kind !== 'atbat' && card.kind !== 'placed')) return card
  return {
    ...card,
    // The placed automatic runner is normalized onto the batter shape the box
    // reads, the same way the sheet normalizes him.
    batterId: card.kind === 'placed' ? card.runnerId : card.batterId,
    batter: card.kind === 'placed' ? card.runner : card.batter,
    outType:
      card.codeKind === 'out' ? classifyOut(card.eventType, descByAtBat.get(card.atBatIndex)) : '',
    centerCode: scorecardCenterCode(card.code),
    ladder: pitchLadder(card.pitches ?? []),
  }
}

function descriptionsByAtBat(feed) {
  const out = new Map()
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    if (play?.about?.atBatIndex != null) {
      out.set(play.about.atBatIndex, play.result?.description ?? '')
    }
  }
  return out
}

// The whole deck for one cursor position: the box the scorer is writing in,
// and the boxes of the men already on. One call, one cap, one feed read.
//
// `row` is the rail row the cursor sits on — the last row whose film has been
// watched. Everything here is therefore a play the scorer has REACHED; nothing
// is drawn for the row ahead, which is the film gate's whole point.
//
// Returns `entries` as well, because the plate-appearance expand and the foot
// strip of chips both read the same capped list and must not build a second
// one at a different cap.
export function expressDeck(feed, inningNum, half, row) {
  const side = battingSideOf(half)
  const uncapped = computeHalfInningFeed(feed, inningNum, half, side)
  const cap = railStepCap(uncapped, row)
  if (cap == null) return { batter: null, runners: [], entries: [], cap: null }
  // Built a second time, this time capped. The first pass exists only to find
  // where the cursor's plate appearance sits; nothing off it is rendered.
  const descByAtBat = descriptionsByAtBat(feed)
  const entries = computeHalfInningFeed(feed, inningNum, half, side, cap)
    .slice(0, cap)
    .map((card) => withBoxMarks(card, descByAtBat))
  // "This play" is the plate appearance the cursor's row FINISHED. A cursor
  // resting inside one that is still going has no such play, and saying it had
  // would be the leak again by a shorter route: the last finished box would
  // creep back onto the deck as though it were the one being written.
  //
  // So mid-plate-appearance the deck has no main box, and every man standing
  // on base reads as a runner — which is also what the paper looks like at that
  // moment, an empty box for the batter with the men on above it.
  const last = cap > 0 ? entries[cap - 1] : null
  const finished = last?.kind === 'atbat' || last?.kind === 'placed' ? last : null
  const batter = row.isTerminal ? finished : null

  // A non-terminal row is a cursor sitting INSIDE a plate appearance that is
  // not over. There is no finished box for it — that is the point of the cap
  // above — but the man at the plate is still worth naming, so the deck can
  // say whose box is about to be written in.
  //
  // IDENTITY ONLY, and the two fields taken here are the whole of it. Who is
  // batting is pre-pitch fact the app already shows on its due-up console; his
  // `code`, `reached` and `result` are not, and none of them is read.
  const inProgress = row.isTerminal
    ? null
    : (uncapped.find((card) => card?.atBatIndex === row.atBatIndex) ?? null)
  const who = inProgress?.batter ?? inProgress?.runner ?? null

  return {
    batter,
    pending: who ? { last: who.last ?? '', first: who.first ?? '' } : null,
    runners: runnersOnBase(entries, { excludeAtBatIndex: batter?.atBatIndex ?? null }),
    entries,
    cap,
  }
}

// The plate appearances the scorer has already reached, newest last — the foot
// strip of chips, and the only way back to a play he did not read the first
// time.
//
// REACHED ones only. Chips for plate appearances still ahead would say how
// many batters are left to bat in the half, and the staging frontier would
// draw them before the scorer got there. Position within the current half is
// all any indicator on this surface may show (ADR-0008).
//
// THE AUTOMATIC RUNNER HAS NO PLATE-APPEARANCE NUMBER, and a chip strip that
// assumed one broke three ways at once in extra innings. He is placed on second
// to start the half without batting, so `computeHalfInningFeed`'s `placed` card
// carries no `atBatIndex` — deliberately, since giving him the leadoff batter's
// number would make `railStepCap` join the wrong card and draw a box the scorer
// had not reached. Keyed on that missing number he got an `undefined` React
// key, a tap that matched no rail row, and an `is-on` test of `undefined ===
// undefined` that lit him up on every cursor with no batter on the deck.
//
// So each chip carries an `id` of its own and says what KIND it is. The
// placement is a marker rather than a way back: there is no play of his to
// return to, and the surface renders him as one.
export function reachedPlateAppearances(entries) {
  return (entries ?? [])
    .filter((card) => card?.kind === 'atbat' || card?.kind === 'placed')
    .map((card) => ({
      id: card.kind === 'placed' ? `placed:${card.runnerId}` : `pa:${card.atBatIndex}`,
      kind: card.kind,
      // Null, never undefined: the difference is what an equality test against
      // another card's index turns on.
      atBatIndex: card.atBatIndex ?? null,
      last: card.batter?.last ?? card.runner?.last ?? '',
      code: card.code ?? '',
      codeKind: card.codeKind ?? '',
      scored: Boolean(card.scored),
    }))
}
