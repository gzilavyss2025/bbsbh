// A club's postseason results before the slate date, split home and road
// (#1906, slice 2). Pure.
//
//   games: [{ gamePk, date, final, homeId, awayId, winnerId }]
//
// SPOILER FOOTING (ADR-0087). Only a Final game with a winner and a date
// BEFORE `slateDate` counts, so the slate date's own game never reaches a
// block or a record, whatever the caller passes.
function played(games, clubId, slateDate) {
  return (games ?? [])
    .filter((g) => g.final && g.winnerId && g.date < slateDate && (g.homeId === clubId || g.awayId === clubId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
}

const tally = (marks) => ({ wins: marks.filter((m) => m === 'W').length, losses: marks.filter((m) => m === 'L').length })

export function homeRoad(games, clubId, slateDate) {
  const home = []
  const road = []
  for (const g of played(games, clubId, slateDate)) {
    ;(g.homeId === clubId ? home : road).push(g.winnerId === clubId ? 'W' : 'L')
  }
  return { home, road, homeRecord: tally(home), roadRecord: tally(road) }
}

// The club's postseason W-L before the slate date: the tape's "Oct W–L" row.
export function octRecord(games, clubId, slateDate) {
  return tally(played(games, clubId, slateDate).map((g) => (g.winnerId === clubId ? 'W' : 'L')))
}
