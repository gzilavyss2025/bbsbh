// SEASON ROWS, REMEMBERED (issue #2907). The offseason page decides its phase
// from published season dates (hooks/useOffseason.js); asking the network first
// made the home slate build itself three times. So every row the phase uses is
// saved under `bbsbh:seasonrows:{sportId}:{year}`, and the next load decides at
// once and lets the network correct it quietly. The key carries the year, so a
// new season or another date never reads the wrong row. Season dates are not
// scores: the spoiler rule does not apply. No storage, or a bad value: null.
const key = (sportId, year) => `bbsbh:seasonrows:${sportId}:${year}`

export function readSeasonRow(sportId, year) {
  if (!sportId || !year) return null
  try {
    const raw = localStorage.getItem(key(sportId, year))
    const row = raw ? JSON.parse(raw) : null
    return row && typeof row === 'object' ? row : null
  } catch {
    return null
  }
}

export function saveSeasonRow(sportId, year, row) {
  if (!sportId || !year || !row) return
  try {
    localStorage.setItem(key(sportId, year), JSON.stringify(row))
  } catch {
    // Private mode or a full disk: behave as if nothing was saved.
  }
}
