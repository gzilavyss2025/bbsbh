// The World Series scouting report's card list (#2316, docs/world-series-scouting.md). Pure. It answers: which cards, in what order, for this day type.
//
// ONE ENTRY PER CARD. `rank` is the card's place on each day type (a day type with no
// rank does not show the card); `has(input)` says whether it has data. A card with no
// data is dropped, and its jump-bar button goes with it. To add a card, add an entry
// here and its renderer in components/worldseries/ScoutingReport.jsx.
//
// The built order, so a later card slots in by its rank:
//   off day  1 Nine keys, 2 Glove and legs, 3 Roster, 4 Matchup edges, 5 Pitch by pitch,
//            6 Platoon, 7 Park fit, 8 Film room
//   game day 1 Matchup edges, 2 Umpire edge, 3 Pitch by pitch, 4 Platoon, 5 Film room,
//            6 Park fit, 7 Glove and legs, 8 Roster
// Built: all of them. Glove and legs sits last but Roster on a game day (rank 7, Gary 2026-10-19);
// Roster follows Glove and legs on both day types (direction A, 2026-10-22). Film room is
// full on an off day and compact on a game day (the card reads the day type itself). Park fit shows on
// both day types: it draws both clubs' parks (2026-10-21), so tonight's venue does not decide it.
//
// Matchup edges stays with a row for the game but no edge (edgesState.js: 'none'); it drops with no row.
//
// Input: { dayType, nineKeys, gloveLegs, roster, edges, edgesRow, pitchByPitch, plateUmpire, meetings, platoon, parkFit }.
// No club id: the list is the same for any opponent.

import { edgesState } from './edgesState.js'

// The two Series clubs in the order Tale of the tape draws them (away, home). Every card follows it.
// `sides` that do not name exactly the two clubs fall back to `clubIds`.
export function clubOrder(clubIds, sides) {
  const ok = Array.isArray(sides) && sides.length === 2 && sides.every((id) => clubIds.includes(id)) && sides[0] !== sides[1]
  return ok ? sides : clubIds
}

const CARDS = [
  { id: 'nine-keys', label: 'Nine keys', rank: { off: 1 }, has: (i) => Boolean(i.nineKeys) },
  { id: 'glove-legs', label: 'Glove and legs', rank: { off: 2, game: 7 }, has: (i) => Boolean(i.gloveLegs) },
  // The Series rosters by position group (direction A). `roster` is true once a roster loaded.
  { id: 'roster', label: 'Roster', rank: { off: 3, game: 8 }, has: (i) => Boolean(i.roster) },
  { id: 'matchup-edges', label: 'Matchup edges', rank: { off: 4, game: 1 }, has: (i) => edgesState({ edges: i.edges, hasRow: i.edgesRow }) !== 'absent' },
  { id: 'pitch-by-pitch', label: 'Pitch by pitch', rank: { off: 5, game: 3 }, has: (i) => Boolean(i.pitchByPitch) },
  { id: 'umpire-edge', label: 'Umpire edge', rank: { game: 2 }, has: (i) => Boolean(i.plateUmpire?.name) },
  { id: 'platoon', label: 'Platoon', rank: { off: 6, game: 4 }, has: (i) => Boolean(i.platoon) },
  { id: 'park-fit', label: 'Park fit', rank: { off: 7, game: 6 }, has: (i) => Boolean(i.parkFit) },
  // The jump-bar item reads "Film".
  { id: 'film-room', label: 'Film', rank: { off: 8, game: 5 }, has: (i) => Boolean(i.meetings?.length) },
]

// -> [{ id, label }] in page order.
export function scoutingModel(input) {
  return CARDS.filter((c) => c.rank[input.dayType] != null && c.has(input))
    .sort((a, b) => a.rank[input.dayType] - b.rank[input.dayType])
    .map(({ id, label }) => ({ id, label }))
}

// The cards that take the whole row (the Film room rail, the Roster): every other card flows with
// its neighbours in balanced columns.
export const WIDE_CARDS = ['film-room', 'roster']

// The card list cut into runs: each wide card alone, the cards between two of them together.
// Order is kept, and every card lands in exactly one run.
export function cardRuns(cards) {
  const runs = []
  for (const c of cards) {
    const last = runs.at(-1)
    if (last && !WIDE_CARDS.includes(c.id) && !WIDE_CARDS.includes(last[0].id)) last.push(c)
    else runs.push([c])
  }
  return runs
}
