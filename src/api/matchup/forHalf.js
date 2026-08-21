import { halfIndex, selectHalfStartingPitcher } from '../select.js'
import { selectDueUpNow } from '../dueup.js'
import { buildMatchupNotes } from './notes.js'
import { buildArsenalNote } from './arsenal.js'

// Matchup notes for ONE half — the hitters due up in it against the arm who
// will be on the mound for it. The shared step both surfaces need: the pre-half
// strip stages the half it is entering, Between Innings stages the half after
// the one that just closed, and past that target the work is identical.
//
// SPOILER FOOTING. The notes themselves read only season aggregates and are
// safe anywhere (see ./notes.js). What needs a gate is resolving WHO is in the
// matchup, because a lineup or a pitching change read too far ahead leaks — a
// flurry of substitutions telegraphs a still-sealed blowout (ADR-0003/0010).
// This module adds NO gate of its own and deliberately owns none: it goes
// through `selectDueUpNow` and `defenseEntering`, each of which enforces
// `safeToShowEntering` internally and returns null rather than trusting a
// caller. A half further out than the reader's own next one therefore yields no
// players here, and so no notes — the same way the lineup and defense cards go
// blank rather than guessing.

// How many due-up hitters to offer the ranker. Only one note per kind survives
// a surface's cap, so this is about giving that cap a CHOICE — the best
// collision among the men actually coming up — not about printing three.
const DUE_UP_DEPTH = 3

// defenseEntering carries surnames only; the prose wants a full name on first
// reference (docs/callouts.md), and the feed already has it.
function nameOf(feed, id, last) {
  const p = feed?.gameData?.players?.[`ID${id}`]
  return { id, first: p?.useName ?? p?.firstName ?? '', last: p?.lastName ?? last ?? '' }
}

// Who will be on the mound for this half. `selectHalfStartingPitcher` is the
// right source and carries its own reveal gate, but it reads the half's FIRST
// PLAY — so for a half that has not been played yet it has nothing to report.
// The game's first half is the case that matters (a reader staging the 1st
// before a pitch is thrown), and there the announced probable IS the answer:
// pre-game, already on the slate, and the same value the starter-record note
// beside this one already reads. The gate is re-applied to that fallback so it
// can never outrun `selectHalfStartingPitcher`'s own boundary.
function armFor(feed, fieldingSide, inning, half, revealedThrough) {
  const entering = selectHalfStartingPitcher(feed, inning, half, revealedThrough)
  if (entering?.id != null) return entering.id
  if (inning !== 1) return null
  if (halfIndex(inning, half) > revealedThrough + 1) return null
  return feed?.gameData?.probablePitchers?.[fieldingSide]?.id ?? null
}

export function matchupNotesForHalf({ feed, data, inning, half, revealedThrough }) {
  if (!data) return []
  const fieldingSide = half === 'top' ? 'home' : 'away'

  // Both resolvers self-gate; either coming back empty means this half is not
  // the reader's to stage yet, and there is nothing to say.
  const dueUp = selectDueUpNow(feed, inning, half, revealedThrough, DUE_UP_DEPTH)
  if (!dueUp?.batters?.length) return []
  const armId = armFor(feed, fieldingSide, inning, half, revealedThrough)
  if (armId == null) return []

  const pitcher = nameOf(feed, armId, '')
  const base = halfIndex(inning, half)
  const notes = []
  for (const b of dueUp.batters) {
    const batter = nameOf(feed, b.id, b.last)
    // Rotate the sentence shape by BOTH the slot and the half, so neither two
    // hitters in one strip nor the same hitter across innings repeats a shape.
    const shapeIndex = base + (b.slot ?? 0)
    notes.push(...buildMatchupNotes({ data, batter, pitcher, index: shapeIndex }))
    notes.push(...buildArsenalNote({ data, batter, pitcher, index: shapeIndex }))
  }
  return notes
}
