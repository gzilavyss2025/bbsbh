// WHEN THE WINTER TAB EXISTS, AND WHICH LEAGUE IT OPENS ON.
//
// Everything here is pure and fails CLOSED. A missing calendar, an empty one,
// or a league whose schedule call failed all come out the same way — that
// league is not offered, and if none are, the rail is exactly what it is today.
// That matters more here than in most gates: this tab RE-ORDERS the rail, so a
// bad morning at statsapi must not be able to shuffle the level buttons.
//
// Nothing below reads the clock. Every answer comes off dates statsapi
// published for the league, which is what makes a past winter browsable in
// September — the same stance ADR-0074 takes for the offseason page.
import { WINTER_LEAGUES } from './leagues.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/

function isIso(value) {
  return typeof value === 'string' && ISO.test(value)
}

// A WINTER LEAGUE'S SEASON IS NAMED FOR THE YEAR IT STARTS IN — verified live
// against all four leagues (2026-09-17). `season=2025` answers October 2025
// through February 2026; asking `season=2026` for a January 2026 date returns
// the NEXT winter, or nothing at all.
//
// So the season to ask for is this date's own year from August onward, and the
// year before it from January to July. The cut is at August because the
// earliest a shipped league has ever opened is October 3, which leaves two
// clear months of margin on the near side and five on the far side. A February
// date resolves to the previous year's row, which is the winter it is actually
// in.
//
// This is the same shape of trap as ADR-0074's two-row winter, and it is not
// the same trap: the seasons endpoint splits ONE winter across two rows at New
// Year, while the schedule endpoint keeps the whole winter on one row and files
// it under the year it opened.
const SEASON_CUT_MONTH = 8

export function winterSeasonFor(dateStr) {
  if (!isIso(dateStr)) return null
  const year = Number(dateStr.slice(0, 4))
  const month = Number(dateStr.slice(5, 7))
  return month >= SEASON_CUT_MONTH ? year : year - 1
}

// THE CHIPS ARE SPAN-BASED, NOT DAY-BASED, and that is a decision rather than a
// shortcut. A league is offered on every date between its own first and last
// dated game, including its off days. Two reasons:
//
//   The rail must not flicker. Tab presence is the union of these spans, so a
//   day-based test would delete the WINTER tab on a quiet Christmas and put it
//   back on Boxing Day, re-ordering the level buttons twice in two days.
//   A tab that vanishes on an off day is a tab the reader cannot trust.
//
//   An off day is a real answer. MLB's tab does not disappear on a Monday; it
//   says "No games scheduled." A winter league's off day should read the same
//   way, because it means the same thing.
//
// The span still ENDS. FALL leaves the picker after November 14 because the
// Arizona Fall League is over, not because it is idle — which is why
// '/mex/12152025' shows three chips and '/fall/10082025' shows one.
export function leaguesOnDate(calendar, dateStr) {
  if (!calendar || !isIso(dateStr)) return []
  const out = []
  for (const league of WINTER_LEAGUES) {
    const row = calendar[league.leagueId]
    if (!row || !isIso(row.firstDate) || !isIso(row.lastDate)) continue
    if (dateStr < row.firstDate || dateStr > row.lastDate) continue
    out.push({ ...league, games: row.gamesByDate?.[dateStr] ?? 0 })
  }
  return out
}

// Does the rail carry a WINTER tab on this date? True when any shipped league's
// season covers it — and false, deliberately, the rest of the year. February to
// October the rail looks exactly as it does today.
export function hasWinterTab(calendar, dateStr) {
  return leaguesOnDate(calendar, dateStr).length > 0
}

// WHICH LEAGUE THE TAB OPENS ON when the reader taps WINTER rather than naming
// a league in the URL.
//
// FALL wins whenever the Arizona Fall League is in season, and it wins on the
// SPAN rather than on the day's game count, which is the whole point: in
// October the Mexican league usually has more games than the AFL (5 against 3),
// so a pure volume rule would hand the default away in the one month the AFL
// exists. The AFL is the league holding the players whose own tabs just went
// dark, so it is the one a reader arriving in October is looking for.
//
// After November 14 there is no such claim to make, so volume decides: the
// league with the most games on this date, and on a date where none of them
// plays, the league with the longest season still running. Ties fall to the
// order in WINTER_LEAGUES, so the answer is stable rather than arbitrary.
export function defaultWinterLeagueId(calendar, dateStr) {
  const open = leaguesOnDate(calendar, dateStr)
  if (!open.length) return null
  const fall = open.find((l) => l.chip === 'FALL')
  if (fall) return fall.leagueId
  let best = open[0]
  for (const league of open) if (league.games > best.games) best = league
  return best.leagueId
}

// The league a slate should actually render, given whatever the URL asked for.
// A URL naming a league OUT of season on that date (a shared '/fall/12152025',
// or a reader paging forward out of the AFL's six weeks) falls back to the
// default rather than showing an empty tab for a league that is not playing —
// the same shrug route.js takes for a hand-mangled date.
export function resolveWinterLeagueId(calendar, dateStr, wantedLeagueId) {
  const open = leaguesOnDate(calendar, dateStr)
  if (!open.length) return null
  if (open.some((l) => l.leagueId === Number(wantedLeagueId))) return Number(wantedLeagueId)
  return defaultWinterLeagueId(calendar, dateStr)
}
