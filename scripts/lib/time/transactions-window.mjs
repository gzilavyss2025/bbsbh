// WHICH SEASON'S FILE OWNS A TRANSACTION DATE — issue #1477.
//
// The NEXT season's file owns the winter. A season's file starts the day after
// the PREVIOUS season's seasonEndDate, so a January signing is a 2027 move and
// a move on 2025-11-01 (the 2025 seasonEndDate) is still a 2025 move. Windows
// tile the calendar: no overlap, no gap. seasonEndDate includes the postseason
// (it equals postSeasonEndDate), so a late-October trade stays in its own
// season.
//
// The freeze rule is unchanged: a season is final once today is past its OWN
// seasonEndDate. The calendar year is the wrong pick for the file in play: on
// 2026-11-15 the 2026 file is final and the 2027 file already owns the day, so
// transactionsSeason() turns to next year the day after this year's
// seasonEndDate.
//
// Rows are statsapi's /api/v1/seasons/{year}?sportId=1 rows. Pure; the
// generator does the reads.
const dayAfter = (iso) => new Date(Date.parse(iso) + 864e5).toISOString().slice(0, 10)

// The season whose file holds `todayIso` (YYYY-MM-DD, UTC). `row` is the row
// for today's calendar year; with none, the calendar year.
export function transactionsSeason(todayIso, row) {
  const year = Number(todayIso.slice(0, 4))
  return row?.seasonEndDate && todayIso > row.seasonEndDate ? year + 1 : year
}

// `start`: first day the season's file holds. `final`: no more rebuilds.
export function transactionsWindow(row, prevRow, todayIso) {
  return {
    start: prevRow?.seasonEndDate ? dayAfter(prevRow.seasonEndDate) : row.regularSeasonStartDate,
    final: Boolean(row.seasonEndDate) && todayIso > row.seasonEndDate,
  }
}
