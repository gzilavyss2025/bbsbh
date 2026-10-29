// Tale of the tape rows (#1906, slice 2). Pure: it formats what the caller
// already loaded, all of it through the day before the slate date.
//
//   side: { wins, runDiff, octW, octL, lastWs, lastTitle }  (away on the left)
//   meetingDates: ISO dates of the clubs' regular-season games against each other
//
// A row is { key, label, away, home, bar? }; `bar` rows draw a mirrored bar.
// `meetingWins` ({ away, home }) is the optional head-to-head count for that row.
// The meeting row is dropped when the clubs did not meet. A missing last Series
// or title reads "—".
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_MS = 86_400_000
// Two meetings further apart than this are two series.
const SERIES_GAP_DAYS = 4

const parts = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { m: MONTHS[m - 1], d, t: Date.UTC(y, m - 1, d) }
}
const fmt = (a, b) => {
  if (a.t === b.t) return `${a.m} ${a.d}`
  return a.m === b.m ? `${a.m} ${a.d}–${b.d}` : `${a.m} ${a.d}–${b.m} ${b.d}`
}

export function meetingLabel(dates) {
  const days = [...new Set(dates ?? [])].sort().map(parts)
  const groups = []
  for (const day of days) {
    const last = groups.at(-1)
    if (last && day.t - last.at(-1).t <= SERIES_GAP_DAYS * DAY_MS) last.push(day)
    else groups.push([day])
  }
  return groups.map((g) => fmt(g[0], g.at(-1))).join(', ')
}

const orDash = (v) => (v == null ? '—' : v)

export function tapeRows({ away, home, meetingDates, meetingWins = null }) {
  const rows = [
    { key: 'wins', label: 'Wins', away: away.wins, home: home.wins, bar: true },
    { key: 'runDiff', label: 'Run diff', away: away.runDiff, home: home.runDiff, bar: true },
    { key: 'oct', label: 'Oct W–L', away: `${away.octW}–${away.octL}`, home: `${home.octW}–${home.octL}` },
  ]
  const meeting = meetingLabel(meetingDates)
  // Named for what it counts, not its dates (Gary, 2026-10-28).
  if (meeting) rows.push({ key: 'meeting', label: 'Vs in regular season', away: meetingWins?.away ?? null, home: meetingWins?.home ?? null })
  rows.push(
    { key: 'lastWs', label: 'Last WS app', away: orDash(away.lastWs), home: orDash(home.lastWs) }, // app = appearance
    { key: 'lastTitle', label: 'Last WS title', away: orDash(away.lastTitle), home: orDash(home.lastTitle) },
  )
  return rows
}
