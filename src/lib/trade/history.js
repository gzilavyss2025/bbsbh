// One past trade, rebuilt from the wire (/api/v1/transactions). Pure.
// Verified 2026-11-18 on the White Sox, 2025-06-13: every row of one trade
// shares the transaction `id`; each row moves one player (`person`, `fromTeam`,
// `toTeam`), and a row with no `person` is the cash or a player to be named.

// rows: the wire for one club and day. Returns the trade `playerId` was part
// of, seen from `toId` (the club he joined): who it got, who it gave up, and
// whether cash moved. Null when he is not in it.
export function groupTrade(rows, playerId, toId) {
  const mine = rows.find((r) => r.typeCode === 'TR' && r.person?.id === playerId)
  if (!mine) return null
  const deal = rows.filter((r) => r.typeCode === 'TR' && r.id === mine.id)
  const player = (r) => ({ id: r.person.id, name: r.person.fullName, fromId: r.fromTeam?.id ?? null, toId: r.toTeam?.id ?? null })
  const moved = deal.filter((r) => r.person)
  return {
    id: mine.id,
    date: mine.date,
    description: mine.description ?? '',
    toId,
    fromId: mine.fromTeam?.id ?? null,
    got: moved.filter((r) => r.toTeam?.id === toId).map(player),
    gave: moved.filter((r) => r.fromTeam?.id === toId).map(player),
    // A row with no player: cash, or a player to be named later.
    other: deal.some((r) => !r.person),
  }
}
