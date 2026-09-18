// The standings page's date arithmetic, and nothing else.
//
// Pure string math on YYYY-MM-DD, split out of StandingsPage.jsx when that file
// crossed its 600-line cap (ADR-0038) — the clean cut, because none of it
// touches React, statsapi or the standings shape. It answers three questions:
// what "today" is for a page that must not fold in tonight's games, what a date
// reads as, and which historical dates the quick-jumps offer.
//
// Every function here is exported for test/standings-dates.test.js. A date that
// looks one day out on this page is a spoiler, not a cosmetic bug: "entering
// today" is the whole reason the page is safe to open in September.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// MLB seasons open in late March / early April; an earlier month-first button
// would only ever show empty pre-season standings, so the quick-jumps start at
// April.
const FIRST_SEASON_MONTH = 4

// The baseball "today" in US Pacific — the last US zone to roll over — so
// "entering today" reliably excludes tonight's whole slate (even a late
// West-coast game the user may still be scoring) rather than the viewer's own
// local/UTC midnight folding one back in. en-CA formats as YYYY-MM-DD.
export function baseballToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

// String date math on YYYY-MM-DD (UTC-anchored so it never drifts a day).
export function shiftDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// "Jul 7, 2026"
export function labelDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// The historical quick-jumps: "30 days ago" plus the first of every month that
// has already begun this season. A month-first is only offered when it's
// strictly in the PAST (`< today`) — so on the 1st of a month that button
// (which would equal today and fold in today's games) is simply absent, and the
// default "entering today" view already covers "start of this month" anyway.
export function buildJumps(today) {
  const y = Number(today.slice(0, 4))
  const curMonth = Number(today.slice(5, 7))
  const jumps = [{ key: '30d', label: '30d ago', date: shiftDays(today, -30) }]
  for (let m = FIRST_SEASON_MONTH; m <= curMonth; m++) {
    const date = `${y}-${String(m).padStart(2, '0')}-01`
    if (date < today) {
      jumps.push({ key: `m${m}`, label: `${MONTHS[m - 1]} 1`, date })
    }
  }
  return jumps
}

