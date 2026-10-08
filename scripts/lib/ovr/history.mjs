// The pure half of the OVR history file (OVR step 8, #1722; docs/ovr-rating.md,
// "Rating changes over time"). A player's history is a list of rows
// [date, ovr, bars | null, 1?], oldest first; the trailing 1 marks a SEEDED row,
// a prospect-trend percentile and not a rating. No file reads, no clock: `today`
// is passed in.

// Every day of this many days back is kept. Older rows of the current season are
// thinned to one per week (the latest of that week); older seasons are dropped.
export const RECENT_DAYS = 60

const epochDay = (date) => Date.parse(date) / 864e5

// Rows to keep, sorted by date.
function retain(rows, today) {
  const cutoff = epochDay(today) - RECENT_DAYS
  const season = today.slice(0, 4)
  const weekly = new Map() // week number -> the latest row of that week
  for (const row of rows) {
    if (!row[0].startsWith(season)) continue
    const week = Math.floor(epochDay(row[0]) / 7)
    if (!weekly.has(week) || weekly.get(week)[0] < row[0]) weekly.set(week, row)
  }
  const keep = new Set(weekly.values())
  return rows.filter((r) => epochDay(r[0]) >= cutoff || keep.has(r)).sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

// prior: the rows already on disk. seed: rows from seedRows(). real: [ovr, bars] for
// today, or undefined for a player with no rating today. A rated date already on disk is
// never rewritten, so a rerun on the same files writes the same bytes. A seeded row
// is kept only before the first real row: past that point the series is ratings.
export function mergeHistory({ prior = [], seed = [], real, today }) {
  const byDate = new Map()
  // Seeds only start a series. Once a real row exists they are not added again: thinning
  // the old real rows would move `firstReal` forward and let a seed back in after them.
  for (const row of prior.some((r) => !r[3]) ? prior : [...seed, ...prior]) byDate.set(row[0], row)
  if (real && (!byDate.has(today) || byDate.get(today)[3])) byDate.set(today, [today, real[0], real[1]])
  const firstReal = [...byDate.values()].filter((r) => !r[3]).map((r) => r[0]).sort()[0]
  const rows = [...byDate.values()].filter((r) => !r[3] || !firstReal || r[0] < firstReal)
  return retain(rows, today)
}

// A prospect-trend history (unpacked rows of the form { date, percentile }) as seeded
// rows. A row with no percentile is a week with no line. Rows before 2026-10-01 summed
// every level (`atLevel` false); they are seeded anyway, by Gary's call, so a series
// shows a step at that date for a player who changed level.
export const seedRows = (history) =>
  history.filter((h) => h.percentile != null).map((h) => [h.date, h.percentile, null, 1])
