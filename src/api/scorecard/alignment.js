// The #22 sheet's DEFENSE DIAMOND — the fielding club's alignment as it stands
// at the reveal frontier, and the half-index arithmetic that decides which half
// to read it for. Split off scorecardGame.js at the file cap (ADR-0038).
//
// The diamond draws the rest (api/defense.js's entry stack -> DefenseDiamond):
// a replaced fielder crossed out, his replacement penciled on the writing line
// above him with the inning he took the field, one line per change when a spot
// turned over more than once.
//
// SPOILER FOOTING: caller-gated, and the gate it inherits is api/defense.js's
// own. Substitution TIMING is spoiler-adjacent — a flurry of pre-half
// replacements telegraphs a still-sealed blowout — so `defenseEntering` may be
// read only for the half at `through + 1`, the reader's own next one, which is
// exactly the boundary enteringHalf.js's safeToShowEntering draws. That
// function enforces the boundary itself rather than trusting this caller, so a
// null coming back is a real answer and never an error: the sheet keeps the
// pre-pitch nine, which is the same shape with no changes drawn on it.
//
// Nothing here reads a run, a hit or a linescore — only who is standing where,
// and since when.

import { defenseEntering } from '../defense.js'

// halfIndex's inverse: the (inning, half, batting side-of-sheet) a half-index
// names. Structural, same footing as halfIndex itself, and re-exported to
// scorecardGame.js — which needs the same inverse for its own frontier walk and
// held the only copy until this module needed it too.
export function halfAt(idx) {
  const inning = Math.floor(idx / 2) + 1
  const half = idx % 2 === 1 ? 'bottom' : 'top'
  return { inning, half, side: half === 'top' ? 'top' : 'bottom' }
}

// The alignment this sheet's batting order is facing, `through` half-indexes in.
// `side` is the sheet's own half — 'top' means the visitors bat, so the HOME
// club is the one in the field.
//
// A `through` of Infinity is the Lab, or a game revealed to its end, and reads
// the whole-game alignment: the same (Infinity, 'bottom', Infinity) call the
// box score makes from inside its own seal.
export function scorecardDefense(feed, side /* 'top' | 'bottom' */, { through = -1 } = {}) {
  if (!feed) return null
  const fieldingSide = side === 'bottom' ? 'away' : 'home'
  if (through === Infinity) {
    return defenseEntering(feed, fieldingSide, Infinity, 'bottom', Infinity)
  }
  // The half AFTER the clamp — the one the reader is due to turn over next, and
  // the furthest out safeToShowEntering will answer for. Reading the clamp's own
  // half instead would hold a change back a full half after the reader had
  // already watched it happen.
  const { inning, half } = halfAt(through + 1)
  return defenseEntering(feed, fieldingSide, inning, half, through)
}
