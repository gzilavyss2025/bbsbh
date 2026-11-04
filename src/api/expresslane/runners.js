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
// REVEAL-ONLY, on the same footing as linescore.js and derive.js. Every card here
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
// cards. The functions here read cards built under that cap and never re-derive
// it. NEVER hand them an uncapped feed.

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

// ONE RUNNER'S IDENTITY, which is not his plate-appearance number for all of
// them: the extra-innings automatic runner never took a plate appearance, so
// `atBatIndex` is undefined for him and every placement in a game would share
// it. Same shape the foot strip and the deck already key their cards on.
export function cardKey(card) {
  return card.kind === 'placed' ? `placed:${card.runnerId}` : `pa:${card.atBatIndex}`
}

// THE MAN THE CURSOR'S PLAY TOOK OFF THE BASES, and why the deck keeps drawing
// him after it has stopped calling him a runner.
//
// `runnersOnBase` above answers "who is standing on a base", and on the play
// that scores a man or cuts him down the honest answer stops including him.
// His CARD went with the answer — and that card is the diamond the scorer has
// to write this very play on: the run he brought home, the force at second
// that ended the double play, the fielder's choice that erased him. Taking the
// box away in the same frame as the thing that has to be written on it is the
// one moment a scoring surface must not do that.
//
// So he is kept for ONE cursor position — the play that changed him — and let
// go when the cursor moves on. A scorer who wants him back steps back a play,
// the same way he gets any other box back.
//
// WHICH PLAY CHANGED HIM is a question the card cannot answer alone: it
// carries `scored` and `outAt`, never the play that set them. The CAP answers
// it. `computeHalfInningFeed`'s `stepCap` gates each play's write-back, so a
// man on base at `cap - 1` and gone at `cap` left on the cursor's own play and
// on no other. That is the whole derivation, and it is why this takes the two
// entry lists rather than one.
//
// NOTHING HERE OUTRUNS THE FILM. Both lists are capped at or behind the
// cursor, so a departure is only ever one the scorer has just watched — and a
// HELD play caps short of its own card (`unwrittenRow`), so the two lists are
// identical and nobody has left yet. That is the correct answer while the clip
// is still running: the paper says he is still standing on third.
//
// `from` rather than `base`, deliberately. He is not on a base — that is the
// whole point — so the field says which one he LEFT, and no caller can read
// this list as men standing somewhere.
export function runnersDeparted(prevEntries, entries, { excludeAtBatIndex = null } = {}) {
  const before = new Map()
  for (const { base, card } of runnersOnBase(prevEntries, { excludeAtBatIndex })) {
    before.set(cardKey(card), base)
  }
  if (before.size === 0) return []
  for (const { card } of runnersOnBase(entries, { excludeAtBatIndex })) before.delete(cardKey(card))
  if (before.size === 0) return []

  const out = []
  for (const card of entries ?? []) {
    if (card?.kind !== 'atbat' && card?.kind !== 'placed') continue
    if (excludeAtBatIndex != null && card.atBatIndex === excludeAtBatIndex) continue
    const from = before.get(cardKey(card))
    if (from == null) continue
    // The two ways off the bases, read off the same two fields `runnersOnBase`
    // drops him for. Anything else is a card that changed for a reason this
    // does not understand, and it is left alone rather than guessed at.
    const fate = card.scored ? 'scored' : card.outAt != null ? 'out' : null
    if (!fate) continue
    out.push({ from, card, fate, outAt: card.outAt ?? null })
  }
  // Ordered by the base they left, so a departed box sits where the eye last
  // saw the man standing.
  return out.sort((a, b) => b.from - a.from)
}
