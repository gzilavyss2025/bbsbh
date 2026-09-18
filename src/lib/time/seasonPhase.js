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

// THE SAME READING, ONE LEVEL DOWN — issue #1077.
//
// A minor level is not a season; it is three leagues that each publish their
// own. So there is no single row to compare a date against, and the sport-wide
// row is not a stand-in for one (src/api/schedule.js's fetchLevelSeasonDates
// records the year it was wrong by a day, in the direction that matters).
//
// The level's winter is the span in which NO league at it is playing:
//
//   it opens  the day the LAST league's offseason opens   max(offseasonStartDate)
//   it closes the day before the FIRST league plays again min(regularSeasonStartDate)
//
// Both ends are the conservative one. Taking the max at the front means a level
// whose third league is still in a championship series is not called a winter;
// taking the min at the back means the page is gone before the earliest league's
// Opening Day rather than after the latest one's.
//
// `leagues` is fetchLevelSeasonDates' array for the calendar year `dateStr`
// falls in — the same "always the row for the DATE's year" rule offseasonPhase
// above follows, and the same rollover consequence: statsapi rolls a minor
// league over on January 1 too, so a January visit reads next season's opener
// off the rows already in hand and needs no second call.
//
// There is no spring training at a minor level (no MiLB season row carries
// springStartDate — checked for 2025, 2026 and 2027 at all four sport ids), so
// the date the winter counts down to is the level's own Opening Day.
//
// Fails CLOSED at every step: an empty list, or one league missing either date,
// returns null, and null means "not the offseason".
export function levelOffseasonPhase(dateStr, leagues) {
  if (!isIso(dateStr) || !Array.isArray(leagues) || leagues.length === 0) return null
  const year = Number(dateStr.slice(0, 4))

  let winterOpens = null
  let opener = null
  for (const league of leagues) {
    const starts = league?.offseasonStartDate
    const plays = league?.regularSeasonStartDate
    // One unreadable league is enough to stop the whole level: the answer is a
    // max and a min over ALL of them, and a partial list would silently give a
    // window that is too wide at one end.
    if (!isIso(starts) || !isIso(plays)) return null
    if (winterOpens === null || starts > winterOpens) winterOpens = starts
    if (opener === null || plays < opener) opener = plays
  }

  // September through December: this level's own offseason has opened. Next
  // season's opener is on the NEXT year's rows, so the caller goes and gets it.
  if (dateStr >= winterOpens) {
    return {
      seasonEnded: year,
      startDate: winterOpens,
      openingDay: null,
      openerFromNextSeason: year + 1,
    }
  }

  // January through the day before the first league plays: still the winter
  // that opened last September, and the opener is on these rows already.
  if (dateStr < opener) {
    return {
      seasonEnded: year - 1,
      startDate: null,
      openingDay: opener,
      openerFromNextSeason: null,
    }
  }

  // A day inside the season the leagues are playing. Not the offseason.
  return null
}

// The first day any league at the level plays, out of one season's rows — the
// date the September-to-December branch above has to fetch forward for. Null
// unless every row carries one, for the same reason the phase itself is all or
// nothing.
export function levelOpeningDay(leagues) {
  if (!Array.isArray(leagues) || leagues.length === 0) return null
  let opener = null
  for (const league of leagues) {
    const plays = league?.regularSeasonStartDate
    if (!isIso(plays)) return null
    if (opener === null || plays < opener) opener = plays
  }
  return opener
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
