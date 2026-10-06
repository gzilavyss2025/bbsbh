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

import { offseasonPhase } from './seasonPhase.js'

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


// WHICH SEASON THE STANDINGS PAGES SHOW, AND WHETHER IT IS OVER.
//
// A season being played reads "entering today": a table dated yesterday. That
// stops working the moment the regular season does. statsapi's /standings only
// answers a `date` the regular season played, so from the day after the last
// game until the offseason opens on Nov 1 the dated request comes back EMPTY
// (verified live, 2026: date=2026-10-05 -> 0 records; no date -> the real final
// table). October is the stretch the pages are most wanted in, and it fell
// between "in season" and seasonPhase.js's winter.
//
// `final` means: ask for no date, and the answer is the season's final table.
// Read off statsapi's own season row, never off an empty response.
//
// The regular season is called over two days after its scheduled last day, not
// one. A tiebreaker (Game 163) is played the day after the finale and counts in
// the regular-season table; asking for the undated table while one is on would
// fold its result in. Through that day the dated table, which still holds, is
// the safe read.
const ISO = /^\d{4}-\d{2}-\d{2}$/
export function standingsSeasonPhase(today, row) {
  const year = Number(today.slice(0, 4))
  const winter = offseasonPhase(today, row)
  if (winter) return { final: true, season: winter.seasonEnded }
  const end = Number(row?.seasonId) === year ? row.regularSeasonEndDate : null
  if (typeof end === 'string' && ISO.test(end) && today > shiftDays(end, 1)) {
    return { final: true, season: year }
  }
  return { final: false, season: year }
}

// The first season the pages offer: 1998 is the first of the six-division,
// 30-club era both boards are drawn for. Older seasons are different shapes.
export const FIRST_STANDINGS_SEASON = 1998
// The wild-card board and the Postseason Race bracket are drawn for the
// 12-team format: three division winners and THREE wild cards a league, the top
// two seeds on a bye. Earlier years had one or two wild cards (and 2020 had
// eight teams a league), so the cutoff line would be wrong, not just old.
export const WILD_CARD_ERA_FROM = 2022

// Newest first, `current` down to `from` (a page drawn for a narrower era, like
// the Postseason Race bracket, passes its own floor).
export function standingsSeasonsFrom(current, from = FIRST_STANDINGS_SEASON) {
  const list = []
  for (let y = current; y >= from; y--) list.push(y)
  return list
}

// What an address asked for, against what is on offer. A year outside the list,
// 'all', or nothing is the current season: the same rule lib/seasons/view.js
// keeps for every other season view.
export function resolveStandingsSeason(asked, current, from = FIRST_STANDINGS_SEASON) {
  const year = Number(asked)
  return Number.isInteger(year) && year >= from && year <= current ? year : current
}
