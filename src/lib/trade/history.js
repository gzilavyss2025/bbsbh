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
  // A row may name an affiliate (a prospect traded straight to Double-A), so
  // the sides are read off the player's own row, not the MLB club's id: what
  // went where he went, or left where he left, came to his club; what left
  // his club (or went to the club he came from) is what it gave up.
  const into = mine.toTeam?.id, from = mine.fromTeam?.id
  const got = moved.filter((r) => r.toTeam?.id === into || r.fromTeam?.id === from)
  const wentOut = (r) => r.fromTeam?.id === toId || r.fromTeam?.id === into || r.toTeam?.id === from
  return {
    id: mine.id,
    date: mine.date,
    description: mine.description ?? '',
    toId,
    fromId: mine.fromTeam?.id ?? null,
    got: got.map(player),
    gave: moved.filter((r) => !got.includes(r) && wentOut(r)).map(player),
    // A row with no player: cash, or a player to be named later.
    other: deal.some((r) => !r.person),
  }
}

// The trade as one sentence from the player's side, for the player sheet's
// "How he got here": "Came from Seattle on July 24, 2025, with Brandyn Garcia,
// for Josh Naylor." `extras` are the wire's non-player pieces ("cash",
// "a player to be named later") the other club got.
const listOf = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
export function tradeLead(trade, playerId, from, extras = []) {
  const with_ = trade.got.filter((p) => p.id !== playerId).map((p) => p.name)
  const for_ = [...trade.gave.map((p) => p.name), ...extras]
  const withText = with_.length ? `, with ${listOf(with_)}` : ''
  const forText = for_.length ? `, for ${listOf(for_)}` : ''
  return `Came from ${from} on ${longDate(trade.date)}${withText}${forText}.`
}
