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
// against VELOCITY. That is the whole list — handedness used to restrict the
// pool and was dropped (see that module's header), so there is no third term
// and no filter left to explain.
const MEASURE = ['Pitch mix', 'Average velo']

// The position line under each face. pitch-arsenal.json carries `throws` but
// no position, and every arm in this pool is a pitcher, so "P" alone would
// print the same letter three times and say nothing. The hand is the live
// distinction, in the form a scorecard already uses — and it does real work
// now that the ranking no longer filters on it: a list CAN come back mixed,
// and this line is the only place that says so. An unknown hand reaches here
// (the ranking stopped skipping those too), which is what the fallback is for.
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
