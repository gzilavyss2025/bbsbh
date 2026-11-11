// SEASON ROWS, REMEMBERED (issue #2907). The offseason page decides its phase
// from published season dates (hooks/useOffseason.js); asking the network first
// made the home slate build itself three times. So every row the phase uses is
// saved under `bbsbh:seasonrows:{sportId}:{year}`, and the next load decides at
// once and lets the network correct it quietly. The key carries the year, so a
// new season or another date never reads the wrong row. Season dates are not
// scores: the spoiler rule does not apply. No storage, or a bad value: null.
//
// A row is checked against its key on the way in AND on the way out (fail
// closed): a MLB row must say it is that year's (`seasonId`), a level's league
// rows must start that year, and the stored envelope names its sport and year.
// A mismatch is not saved and reads as "no row".
const key = (sportId, year) => `bbsbh:seasonrows:${sportId}:${year}`

// Does this row (a MLB season row, or a level's array of league rows) describe `year`?
export function rowFitsYear(row, year) {
  if (Array.isArray(row)) return row.length > 0 && row.every((r) => rowFitsYear(r, year))
  if (!row || typeof row !== 'object') return false
  if (row.seasonId != null) return Number(row.seasonId) === year
  const date = row.regularSeasonStartDate || row.offseasonStartDate
  return typeof date === 'string' && Number(date.slice(0, 4)) === year
}

export function readSeasonRow(sportId, year) {
  if (!sportId || !year) return null
  try {
    const raw = localStorage.getItem(key(sportId, year))
    const saved = raw ? JSON.parse(raw) : null
    return saved?.sportId === sportId && saved?.year === year && rowFitsYear(saved.row, year)
      ? saved.row
      : null
  } catch {
    return null
  }
}

export function saveSeasonRow(sportId, year, row) {
  if (!sportId || !year || !rowFitsYear(row, year)) return
  try {
    localStorage.setItem(key(sportId, year), JSON.stringify({ sportId, year, row }))
  } catch {
    // Private mode or a full disk: behave as if nothing was saved.
  }
}
