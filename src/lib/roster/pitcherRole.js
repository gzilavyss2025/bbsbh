// A pitcher's role from his season's starts, games and saves: SP when half his
// games are starts, CL at 8 saves, else RP; null with no games. The team page's
// staff (screens/team/data/loadRoster.js) and the trade simulator's pitcher
// rows (api/trade/side.js) both read it. Pure.
export function roleFromCounts(gamesStarted, gamesPitched, saves) {
  const g = Number(gamesPitched) || 0
  if (g === 0) return null
  const gs = Number(gamesStarted) || 0
  if (gs / g >= 0.5) return 'SP'
  if ((Number(saves) || 0) >= 8) return 'CL'
  return 'RP'
}
