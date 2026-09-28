// The MLB slate's postseason date cutoff (ADR-0087). MLB only.
//
// The trap (build prompt section 4, trap 6, checked live 2026-09-28): an
// unplayed "if necessary" game drops off the schedule the moment a series
// ends, with no cancelled marker, and a placeholder club ("SD/CHC") turns
// into the winner's real row the same moment. So a future date's slate can
// show today's result plainly, even with no bracket drawn on the page at
// all. Gary's decision: in the postseason window, the slate never shows a
// date after today.
//
// The window is read off the season row `fetchSeasonMeta` already fetches
// (`src/api/schedule.js`) — `postSeasonStartDate` through the day before
// `offseasonStartDate` — never off the clock and never inferred from an
// empty slate, the same rule `src/hooks/useOffseason.js` follows for the
// regular-season/offseason line. Every date argument here is `YYYY-MM-DD`
// (the app's internal date shape), so plain string comparison is
// chronological order.
//
// Both functions are pure so the rule is checkable without a browser or a
// network call — see test/postseason/cap-slate-date.test.js.

// Is `dateStr` (typically "today") inside the postseason window? A missing or
// incomplete season row answers false rather than guessing — the caller
// (`capSlateDate` below) is the one that turns "don't know" into a safe cap.
export function isPostseasonWindow(dateStr, seasonMeta) {
  const start = seasonMeta?.postSeasonStartDate
  const end = seasonMeta?.offseasonStartDate
  if (!start || !end) return false
  return dateStr >= start && dateStr < end
}

// Caps a requested slate date at today, but only when TODAY sits in the
// postseason window — outside it, a future date is an ordinary preview of an
// upcoming day's schedule (tomorrow's probable pitchers, for example) and
// passes through untouched, exactly as it does now.
//
// A today-or-past date always passes through: the rule only ever holds back
// what has not happened yet.
//
// A missing or still-loading season row (`seasonMeta` null/undefined) is
// treated as "assume the window" for any date after today. The row not
// being in hand yet is never a reason to risk a flash of a spoiling slate;
// the safe default renders today, and is replaced by the real answer — cap
// or pass-through — one render later once the row lands.
export function capSlateDate(dateStr, todayStr, seasonMeta) {
  if (dateStr <= todayStr) return dateStr
  if (seasonMeta && !isPostseasonWindow(todayStr, seasonMeta)) return dateStr
  return todayStr
}

// The forward date arrow's own limit: disable it once paging forward again
// would only land back on today's own slate. True only sitting on today,
// and only while today is in the postseason window — everywhere else the
// arrow behaves as it always has.
export function atForwardLimit(dateStr, todayStr, seasonMeta) {
  return dateStr === todayStr && isPostseasonWindow(todayStr, seasonMeta)
}
