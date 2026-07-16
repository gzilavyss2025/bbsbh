// A small beeswarm packer for plotting a pool of 0–10 scores on a single
// rail: values cluster heavily in most of these pools (30 teams' Current
// Form especially bunches near .500; a season's Game Scores bunch around the
// mean), so dots land well within a dot-width of each other even when their
// scores differ, not just on exact ties. Left uncorrected, whichever dot
// paints last steals every pointer event in that stretch of the rail, and
// a dense cluster reads as one blob instead of a spread.
//
// Walk scores low to high, and give each dot the first vertical row whose
// last-placed dot is far enough away horizontally, opening a new row only
// when every existing one is still too close. MIN_GAP_PCT is a
// percent-of-track-width stand-in for the dot's own ~5px footprint (the
// track has no fixed pixel width to measure against). Row 0 stays on the
// rail; rows 1, 2, 3… alternate below/above it at growing distance, so a
// small cluster only nudges slightly off-center and a big one fans out
// symmetrically rather than stacking one-sided.
//
// Shared by TeamScoreCard's league-distribution rail and GameScoreCard's
// season-distribution rail — any future rail plotting a scored pool should
// reuse this rather than reinventing the packing.
const MIN_GAP_PCT = 1.6
const ROW_STEP_PX = 5

export function beeswarmRows(rows) {
  const sorted = [...rows].sort((a, b) => a.score - b.score)
  const rowEdges = []
  return sorted.map((r) => {
    const pct = (r.score / 10) * 100
    let rowIndex = rowEdges.findIndex((edge) => pct - edge >= MIN_GAP_PCT)
    if (rowIndex === -1) {
      rowIndex = rowEdges.length
      rowEdges.push(pct)
    } else {
      rowEdges[rowIndex] = pct
    }
    const magnitude = Math.ceil(rowIndex / 2) * ROW_STEP_PX
    const rowOffset = rowIndex === 0 ? 0 : rowIndex % 2 === 1 ? magnitude : -magnitude
    return { ...r, rowOffset }
  })
}

// Thins a large pool down to a fixed count for display, sampling evenly by
// RANK (not randomly) so the picked points still trace the pool's actual
// shape — the min and max always survive, and the spacing between kept
// points approximates the distribution's percentiles rather than skewing
// toward whichever end happens to get picked. `beeswarmRows` was tuned for
// small pools (~30 teams); a season's worth of games (1,000+) would still
// overflow a fixed-height rail dot-for-dot even with packing, so a caller
// with a pool that large should sample it down to roughly this size before
// packing.
export function sampleForDisplay(rows, max) {
  if (rows.length <= max) return rows
  const sorted = [...rows].sort((a, b) => a.score - b.score)
  const step = sorted.length / max
  const out = []
  for (let i = 0; i < max; i++) {
    out.push(sorted[Math.floor(i * step)])
  }
  return out
}
