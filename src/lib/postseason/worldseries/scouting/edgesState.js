// The Matchup edges card's state (#2316, #2332). Pure.
//   'edges'   at least one hitter or pitcher edge: draw the rows.
//   'none'    the career-matchups file HAS a row for the focus game, but no edge clears the thresholds: draw one plain line.
//   'absent'  no row for the game (or the file failed to load): the card drops, and its jump-bar button with it.
// `hasRow` is true when starterMatchupsFor finds a side for at least one club.
export function edgesState({ edges, hasRow } = {}) {
  if (edges?.length) return 'edges'
  return hasRow ? 'none' : 'absent'
}
