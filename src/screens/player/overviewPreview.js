// Pure helpers for the Overview tab's preview doors — split out of
// PlayerPage.jsx so the count/label logic can be unit-tested without
// rendering React (same split as src/screens/sheet/sheetModel.js).

// "Game log, splits & career · 42 games" — the door under the Overview's
// trimmed game-log preview (PlayerPage.jsx wraps it in a PreviewDoor, which
// appends the chevron). `seasonGames` is the block's OWN season game count
// (api/person/activity.js's `tileStat.gamesPlayed`), never the 3 rows the
// preview actually shows — a reader who sees three lines should still be
// told how many the door behind them holds.
export function gameLogDoorLabel(seasonGames) {
  const n = Number(seasonGames) || 0
  return `Game log, splits & career · ${n} ${n === 1 ? 'game' : 'games'}`
}
