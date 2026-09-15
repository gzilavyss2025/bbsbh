// THE OFFSEASON, as statsapi states it rather than as the slate infers it.
//
// The slate today learns the season is over the same way it learns anything
// else: it asks for a day's games, gets none, and scans forward ten days for
// the next one (fetchNextGameDate). In November that scan costs ten fetches
// and returns null, and null is not an answer — "Schedule unavailable" and
// "the season ended" arrive at this code looking identical. So nothing here
// reads an ABSENCE. Every judgment below comes off a date statsapi published.
//
// THE TWO-ROW WINTER. A seasons row for calendar year Y splits the winter it
// opens into two named halves and gives neither of them the reader's name for
// it (verified live against 2025, 2026 and 2027 rows):
//
//   offseasonStartDate .. offSeasonEndDate   Nov 1  ->  Dec 31 of Y
//   preSeasonStartDate .. preSeasonEndDate   Jan 1  ->  the day before spring
//
// The winter a reader lives through runs straight across that New Year seam,
// so this joins the halves: the offseason after season Y starts on Y's
// `offseasonStartDate` and ends the day before Y+1's `springStartDate`. That
// span was checked against the schedule itself — for 2025-26 the MLB tab had
// no played game from Nov 2 to Feb 19, which is exactly the join, to the day.
//
// WHICH ROW TO ASK FOR. Always the row for the calendar year the DATE is in.
// In November that row's own `offseasonStartDate` has already passed, and the
// season that just ended is its own year. In January the row is next season's
// (statsapi rolls over on Jan 1), its `springStartDate` is the one coming, and
// the season that just ended is the year before. Both readings come off the
// one row, which is why a January visit needs no second fetch.
//
// Everything here is pure and fails CLOSED: a missing or unparseable date
// returns null, and null means "not the offseason", so a bad fetch leaves the
// ordinary slate exactly as it is today.

// statsapi dates are ISO (YYYY-MM-DD) and so is the slate's `dateStr`, so every
// comparison in this file is a string compare. No Date is built to answer "is
// this day inside that span" — a Date would introduce a timezone where the two
// sides are already the same plain calendar day.
const ISO = /^\d{4}-\d{2}-\d{2}$/

function isIso(value) {
  return typeof value === 'string' && ISO.test(value)
}

// Whole days from one calendar day to another. Both are parsed as UTC noon so
// the subtraction cannot be moved a day by a daylight-saving boundary between
// them — the answer is a count of dates, not of elapsed hours.
export function daysBetween(fromIso, toIso) {
  if (!isIso(fromIso) || !isIso(toIso)) return null
  const from = Date.parse(`${fromIso}T12:00:00Z`)
  const to = Date.parse(`${toIso}T12:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86400000)
}

// `row` is a statsapi seasons row for the calendar year `dateStr` falls in.
// Returns null unless that date is inside the winter the row describes.
//
// `seasonEnded` is the season whose games are over — the year the page labels
// itself with, and the year its roster wire has been covering. It is derived
// from the row, never from `new Date().getFullYear() - 1`, which is wrong for
// the whole of November and December.
export function offseasonPhase(dateStr, row) {
  if (!isIso(dateStr) || !row) return null
  const year = Number(dateStr.slice(0, 4))
  // The row has to be the one for this date's year, or its dates describe a
  // different winter and every comparison below is meaningless.
  if (Number(row.seasonId) !== year) return null

  const spring = row.springStartDate
  const offseasonStart = row.offseasonStartDate
  if (!isIso(spring) || !isIso(offseasonStart)) return null

  // November/December: this year's own offseason has opened. Spring is in the
  // NEXT row, so the caller is told to go and get it (`springFromNextSeason`).
  if (dateStr >= offseasonStart) {
    return {
      seasonEnded: year,
      startDate: offseasonStart,
      springStartDate: null,
      springFromNextSeason: year + 1,
    }
  }

  // January through the day before spring: still the winter that opened last
  // November. Spring is on THIS row, so nothing further is needed.
  if (dateStr < spring) {
    return {
      seasonEnded: year - 1,
      startDate: null,
      springStartDate: spring,
      springFromNextSeason: null,
    }
  }

  // Spring training, the regular season or October. Not the offseason — note
  // that October passes this test on the postseason dates alone, with no help
  // from the schedule, which is the whole point of reading the row.
  return null
}

// The winter calendar's rows, parsed out of the one admin-editable string that
// holds them (`offseason.calendar` in the copy registry). One milestone per
// line, `YYYY-MM-DD | Label`.
//
// A full ISO date, not MM-DD with the year inferred: the Rule 5 draft and the
// arbitration filing deadline move every winter, and a shape that reuses last
// winter's day numbers would print a confident wrong date rather than nothing.
//
// So this fails CLOSED in both directions. A line that does not parse is
// dropped, and a line whose date falls outside the offseason now on screen is
// dropped too — which means an unedited calendar left over from last winter
// renders as no strip at all, rather than as a strip of dates that have all
// already happened.
export function parseWinterCalendar(text, { startDate, endDate } = {}) {
  if (typeof text !== 'string') return []
  const rows = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const at = trimmed.indexOf('|')
    if (at < 0) continue
    const date = trimmed.slice(0, at).trim()
    const label = trimmed.slice(at + 1).trim()
    if (!isIso(date) || !label) continue
    if (isIso(startDate) && date < startDate) continue
    if (isIso(endDate) && date > endDate) continue
    // A repeated date is the admin's business (two things can land on the same
    // day); a repeated date AND label is a duplicated line, and drops.
    if (rows.some((r) => r.date === date && r.label === label)) continue
    rows.push({ date, label })
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// The index of the row the reader is on or heading for — the first one that has
// not passed. -1 once every milestone is behind them (the last days before
// spring, when the strip is all history and nothing is marked).
export function currentMilestone(rows, todayIso) {
  if (!Array.isArray(rows) || !isIso(todayIso)) return -1
  return rows.findIndex((r) => r.date >= todayIso)
}
