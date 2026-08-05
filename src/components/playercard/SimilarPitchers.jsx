import { SimilarPlayerGrid } from './SimilarPlayerGrid.jsx'

// PITCHES LIKE — the three arms whose season pitch mix and velocities most
// resemble this pitcher's. The ranking is src/lib/pitcherSimilarity.js (pure,
// unit-tested); the level-aware pool comes from api/pitchArsenal.js's
// similarPitchersFor. This file only shapes that ranking into rows;
// SimilarPlayerGrid.jsx draws them (and carries the reasoning for the
// three-across layout and the match figure).
//
// Each name is a PlayerLink, so the card doubles as a way to wander the staff
// — which is most of its value on a second screen. Spoiler-free like the rest
// of the arsenal data (a completed-game season aggregate), so no SealBox.

// What the grid's "Measured on" band names, in the same order the model
// weights them: pitcherSimilarity.js scores SHAPE (per-type share of pitches)
// against VELOCITY, then filters the pool to one throwing hand. The hand is
// listed because it's the reason a whole side of the staff is missing from a
// list, which a reader can otherwise only read as a bug.
const MEASURE = ['Pitch mix', 'Average velo', 'Same throwing hand']

// The position line under each face. pitch-arsenal.json carries `throws` but
// no position, and every arm in this pool is a pitcher, so "P" alone would
// print the same letter three times and say nothing. The hand is the live
// distinction, in the form a scorecard already uses. An unknown hand can't
// reach here — similarPitchers skips a candidate the file has no hand for
// rather than guessing — but the fallback stays for the day that changes.
function pitcherPos(throws) {
  if (throws === 'R') return 'RHP'
  if (throws === 'L') return 'LHP'
  return 'P'
}

export function SimilarPitchers({ similar }) {
  if (!similar?.length) return null

  const rows = similar.map((p) => ({
    personId: p.personId,
    match: p.match,
    name: p.name,
    teamId: p.teamId,
    pos: pitcherPos(p.throws),
  }))

  return (
    <SimilarPlayerGrid
      rows={rows}
      measure={MEASURE}
      note="What he throws, not how he fares with it."
    />
  )
}
