// The weekly Top-100 rank history (#2970): public/data/top-prospects-history.json,
// shape { snapshots: [{ date: 'YYYY-MM-DD', ranks: { [playerId]: rank } }] }.
// fetch-top-prospects.mjs appends one snapshot per ISO week, only after its
// validation gate passes, so a bad scrape never writes history. No back-fill.
// Pure: the caller reads and writes the file.

// The ISO week of a 'YYYY-MM-DD' date, as 'YYYY-Www' (the Monday-start week the
// date's Thursday falls in, so a week never straddles two keys).
export function isoWeek(date) {
  const d = new Date(`${date}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// The history with today's snapshot added, or the same object when this ISO week
// already has one (the first scrape of a week stands). `players` is the Top 100.
export function appendWeeklySnapshot(history, date, players) {
  const snapshots = Array.isArray(history?.snapshots) ? history.snapshots : []
  const week = isoWeek(date)
  if (snapshots.some((s) => isoWeek(s.date) === week)) return { snapshots }
  const ranks = Object.fromEntries(players.map((p) => [p.playerId, p.rank]))
  return { snapshots: [...snapshots, { date, ranks }] }
}
