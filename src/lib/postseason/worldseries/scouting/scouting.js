// The World Series scouting report's card list (#2316, .scratch/ws-scouting/handoff.md
// sections 2 and 5). Pure. It answers: which cards, in what order, for this day type.
//
// ONE ENTRY PER CARD. `rank` is the card's place on each day type (a day type with no
// rank does not show the card); `has(input)` says whether it has data. A card with no
// data is dropped, and its jump-bar button goes with it. To add a card, add an entry
// here and its renderer in components/worldseries/ScoutingReport.jsx.
//
// The order from handoff.md section 2, so a later card slots in by its rank:
//   off day  1 Nine keys, 2 Glove and legs, 3 Matchup edges, 4 Pitch by pitch,
//            5 Platoon, 6 Park fit, 7 Film room
//   game day 1 Matchup edges, 2 Umpire edge, 3 Pitch by pitch, 4 Platoon, 5 Film room,
//            6 Park fit (only at Milwaukee)
// Built so far: Nine keys, Matchup edges, Umpire edge, Film room (full off day, compact on a
// game day; the card reads the day type itself). Glove and legs, Pitch by pitch, Platoon and
// Park fit keep their slots and are absent until built.
//
// Input: { dayType, nineKeys, edges, pitchByPitch, plateUmpire, meetings }. No club id: the list is the same
// for any opponent.
const CARDS = [
  { id: 'nine-keys', label: 'Nine keys', rank: { off: 1 }, has: (i) => Boolean(i.nineKeys) },
  { id: 'matchup-edges', label: 'Matchup edges', rank: { off: 3, game: 1 }, has: (i) => Boolean(i.edges?.length) },
  { id: 'pitch-by-pitch', label: 'Pitch by pitch', rank: { off: 4, game: 3 }, has: (i) => Boolean(i.pitchByPitch) },
  { id: 'umpire-edge', label: 'Umpire edge', rank: { game: 2 }, has: (i) => Boolean(i.plateUmpire?.name) },
  // Ranks 7 and 5 leave the unbuilt cards' slots in place. The jump-bar item reads "Film".
  { id: 'film-room', label: 'Film', rank: { off: 7, game: 5 }, has: (i) => Boolean(i.meetings?.length) },
]

// -> [{ id, label }] in page order.
export function scoutingModel(input) {
  return CARDS.filter((c) => c.rank[input.dayType] != null && c.has(input))
    .sort((a, b) => a.rank[input.dayType] - b.rank[input.dayType])
    .map(({ id, label }) => ({ id, label }))
}
