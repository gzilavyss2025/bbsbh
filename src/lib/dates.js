// Date helpers. The MLB schedule endpoint expects YYYY-MM-DD in the park's
// local sense, but for slate selection the user's local date is close enough.

export function toApiDate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date, n) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + n)
  return copy
}

// "7/5" — compact month/day for a game-log row, no leading zeros on either
// side. Takes a YYYY-MM-DD string directly (not a Date) since callers already
// have the raw statsapi date and a game-log row doesn't need to round-trip
// through a Date object. Returns '' for a missing/garbled date.
export function monthDay(apiDate) {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(apiDate ?? '')
  return m ? `${Number(m[1])}/${Number(m[2])}` : ''
}

// "4/14/26" — compact month/day/2-digit-year, for a context where the season
// isn't otherwise implied (e.g. a cross-month season-series strip). Same
// no-Date-round-trip approach as monthDay above.
export function monthDayYear(apiDate) {
  const m = /^\d{2}(\d{2})-(\d{2})-(\d{2})/.exec(apiDate ?? '')
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : ''
}

// "MON" — 3-letter uppercase weekday abbreviation, for a compact date badge
// (foul tracker's single-game-highs link). Same no-Date-round-trip approach
// as monthDay/monthDayYear; returns '' for a missing/garbled date.
export function weekdayAbbr(apiDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDate ?? '')) return ''
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3).toUpperCase() // caps-js-exempt
}

// "Fri, Jul 5" style label for the slate header.
export function humanDate(apiDate) {
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// "Fri, June 12, 2026" — the full date line the scorebook header wants, so it
// can be copied straight onto the sheet. Same parse as humanDate; returns ''
// for a missing/garbled date (thin MiLB feeds) so callers show the usual "—".
export function scorebookDate(apiDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDate ?? '')) return ''
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// "July 5, 2026" — no weekday, for the box score page's title line. Same
// parse/fallback as scorebookDate.
export function longDate(apiDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiDate ?? '')) return ''
  const [y, m, d] = apiDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
