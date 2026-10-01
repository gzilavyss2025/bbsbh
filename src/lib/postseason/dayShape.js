// The shape of the days around a series game: was there a day off before it,
// and did the series change parks? A scorer writes the park at the head of the
// sheet, and a rested or a travelling bullpen explains a lot (#1224).
//
// Pure. It reads only the DATES and PARKS of two games that are already on the
// page: the one before and this one. Never call it for an "if necessary" game:
// that game has no date or park (docs/api/postseason.md), and giving it a line
// would say whether the series ran long.
//
//   prev, game: { date: 'YYYY-MM-DD', venueId?: number }
//
// A park change after a gap is a travel day. A gap with no park change is an
// off day. A park change with no gap is rare enough to say so. A game on the
// next day in the same park, the first game of a series, and a missing date all
// say nothing.

const DAY_MS = 86_400_000

// Whole days since 1970 for 'YYYY-MM-DD', read off the string so a local-time
// Date cannot slide it a day.
function dayNumber(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function dayShape(prev, game) {
  if (!prev?.date || !game?.date) return ''
  const between = dayNumber(game.date) - dayNumber(prev.date) - 1
  // Same date (a doubleheader) or out of order: nothing to say.
  if (!(between >= 0)) return ''
  const moved = prev.venueId != null && game.venueId != null && prev.venueId !== game.venueId
  if (between === 0) return moved ? 'No off day before' : ''
  return moved ? 'Travel day before' : 'Off day before'
}
