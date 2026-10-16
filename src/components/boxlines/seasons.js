// Where a new season starts in a Box Lines list (newest first). The sheet draws an ink rule
// above that row, and the year sits in its gutter. This replaced the alternating band: two
// games in one year read as one group, and a new year reads as a new group, without a second
// paper colour. Pure, so a test can pin it.
export function startsSeason(rows, i) {
  return i > 0 && rows[i].season !== rows[i - 1].season
}
