// The record AS OF one logged game, in the same three wordings recordLine
// (api/postseason/text.js) uses for the series' current state — mirrored here
// rather than reused because a Series' `games` carry a winnerId, not two scores,
// so the tally itself is simpler than PostseasonSeriesPage.jsx's
// seriesStatusAfterGame.
export function recordAfterGame(series, index) {
  const [a, b] = series.slots
  let aWins = 0
  let bWins = 0
  for (let i = 0; i <= index; i++) {
    const winnerId = series.games[i].winnerId
    if (winnerId === a.club?.id) aWins += 1
    else if (winnerId === b.club?.id) bWins += 1
  }
  const hi = Math.max(aWins, bWins)
  const lo = Math.min(aWins, bWins)
  const isClincher = series.decided && index === series.games.length - 1
  if (isClincher) return `${series.winner.abbreviation} won ${hi}–${lo}`
  if (aWins === bWins) return `Series tied ${hi}–${lo}`
  const leader = aWins > bWins ? a.club : b.club
  return `${leader?.abbreviation ?? ''} leads ${hi}–${lo}`
}
