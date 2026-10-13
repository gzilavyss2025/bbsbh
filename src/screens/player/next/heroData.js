// The hero's pure rules (#1884): the Age fact, and which rank mark a tile wears.
const DASH = '—'

// The Age fact. A retired player shows his age at retirement, as the live page does, and
// never flips: his birthday is not the point of the fact. Only a living player with a
// birthday gets the flip.
export function ageFact(bio, status) {
  if (status?.state === 'retired') return { label: 'Age at retirement', value: status.retiredAge ?? DASH, flip: false }
  return { label: 'Age', value: bio.age, flip: Boolean(bio.birthDate) }
}

// The rank mark for a tile: each mark's `label` is the hero tile it ranks (leagueRanks.js),
// so the W–L tile wears the wins rank. { rank, of } is what StatTile takes.
export function rankFor(marks, tileKey) {
  const m = marks?.find((x) => x.label === tileKey)
  return m && { rank: m.rank, of: m.of }
}
