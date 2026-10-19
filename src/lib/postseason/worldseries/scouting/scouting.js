// The World Series scouting report's card list (#2316, docs/world-series-scouting.md). Pure. It answers: which cards, in what order, for this day type.
//
// ONE ENTRY PER CARD. `rank` is the card's place on each day type (a day type with no
// rank does not show the card); `has(input)` says whether it has data. A card with no
// data is dropped, and its jump-bar button goes with it. To add a card, add an entry
// here and its renderer in components/worldseries/ScoutingReport.jsx.
//
// The built order, so a later card slots in by its rank:
//   off day  1 Nine keys, 2 Glove and legs, 3 Matchup edges, 4 Pitch by pitch,
//            5 Platoon, 6 Park fit, 7 Film room
//   game day 1 Matchup edges, 2 Umpire edge, 3 Pitch by pitch, 4 Platoon, 5 Film room,
//            6 Park fit (only at Milwaukee)
// Built: all of them. Glove and legs sits last on a game day (rank 7, Gary 2026-10-19); Film room is
// full on an off day and compact on a game day (the card reads the day type itself). Park fit shows on
// an off day, and on a game day only when tonight's park is Milwaukee (it draws Milwaukee's field).
//
// Input: { dayType, nineKeys, gloveLegs, edges, pitchByPitch, plateUmpire, meetings, platoon, parkFit,
// venueId }. No club id: the list is the same for any opponent.
// Park fit draws Milwaukee's field (Stats API venue id), so a game day shows it only there.
export const MILWAUKEE_VENUE_ID = 32

// The two Series clubs in the order Tale of the tape draws them (away, home). Every card follows it.
// `sides` that do not name exactly the two clubs fall back to `clubIds`.
export function clubOrder(clubIds, sides) {
  const ok = Array.isArray(sides) && sides.length === 2 && sides.every((id) => clubIds.includes(id)) && sides[0] !== sides[1]
  return ok ? sides : clubIds
}

const CARDS = [
  { id: 'nine-keys', label: 'Nine keys', rank: { off: 1 }, has: (i) => Boolean(i.nineKeys) },
  { id: 'glove-legs', label: 'Glove and legs', rank: { off: 2, game: 7 }, has: (i) => Boolean(i.gloveLegs) },
  { id: 'matchup-edges', label: 'Matchup edges', rank: { off: 3, game: 1 }, has: (i) => Boolean(i.edges?.length) },
  { id: 'pitch-by-pitch', label: 'Pitch by pitch', rank: { off: 4, game: 3 }, has: (i) => Boolean(i.pitchByPitch) },
  { id: 'umpire-edge', label: 'Umpire edge', rank: { game: 2 }, has: (i) => Boolean(i.plateUmpire?.name) },
  { id: 'platoon', label: 'Platoon', rank: { off: 5, game: 4 }, has: (i) => Boolean(i.platoon) },
  { id: 'park-fit', label: 'Park fit', rank: { off: 6, game: 6 }, has: (i) => Boolean(i.parkFit) && (i.dayType !== 'game' || i.venueId === MILWAUKEE_VENUE_ID) },
  // The jump-bar item reads "Film".
  { id: 'film-room', label: 'Film', rank: { off: 7, game: 5 }, has: (i) => Boolean(i.meetings?.length) },
]

// -> [{ id, label }] in page order.
export function scoutingModel(input) {
  return CARDS.filter((c) => c.rank[input.dayType] != null && c.has(input))
    .sort((a, b) => a.rank[input.dayType] - b.rank[input.dayType])
    .map(({ id, label }) => ({ id, label }))
}
