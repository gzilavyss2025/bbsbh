// The count tag over the games grid: every decided game, and how many of them are postseason
// (a gameType other than 'R'), since the grid lists both.
export function gamesTag(games) {
  const post = games.filter((g) => g.gameType !== 'R').length
  return `${games.length} ${games.length === 1 ? 'game' : 'games'}${post ? ` · ${post} postseason` : ''}`
}
