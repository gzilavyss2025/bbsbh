// World Series mode for the home page (#1906, slice 1). Pure: it reads the
// bracket `usePostseasonBracket(cutoff)` returns and answers one question,
// "is the slate date a World Series date, and which kind of day?".
//
// ON when, HEADING INTO the slate date, both World Series clubs are known and
// the Series is not decided. The bracket already applies the cutoff (ADR-0087):
// a game on the slate date never counts, so the answer holds all day. The day
// after the clincher `decided` is true, mode is off, and the existing champion
// band takes over. The `live` flag (Scores Unlocked) is the bracket's, not
// this function's.
//
// DAY TYPE. A game day is a date the bracket marks `playsOnCutoff`; every
// other mode-on date is an off day. `gameNumber` is the cutoff game's number
// on a game day, and the next game's number on an off day (null when the
// schedule does not name one yet).

export function worldSeriesMode(bracket) {
  const ws = bracket?.worldSeries
  if (!ws || ws.decided) return null
  const slots = ws.slots ?? []
  if (slots.length !== 2 || !slots.every((s) => s?.club)) return null

  if (ws.playsOnCutoff) {
    return { series: ws, dayType: 'game', gameNumber: ws.cutoffGame?.gameNumber ?? null }
  }
  const next = (ws.upcoming ?? []).find((g) => !g.ifNecessary)
  return { series: ws, dayType: 'off', gameNumber: next?.gameNumber ?? null }
}
