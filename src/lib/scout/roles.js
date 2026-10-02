// Who may stand in each Matchup Scout picker (#1410). The pitcher box lists
// pitchers, the hitter box lists everyone else, and a two-way player (position
// code 'Y', Ohtani) is in both. Read off the search row's position CODE, not
// its abbreviation: the code is the API's fixed key.
export const canPitch = (person) => person.posCode === '1' || person.posCode === 'Y'
export const canHit = (person) => person.posCode !== '1'

// The side of the plate this hitter stands on against this pitcher. A switch
// hitter bats opposite the pitcher's hand (#1408, verified on Lindor 2025: no
// exceptions in 2,952 pitches). Null when a hand is unknown.
export function stanceFor(bats, throws) {
  if (bats === 'S') return throws === 'R' ? 'L' : throws === 'L' ? 'R' : null
  return bats === 'L' || bats === 'R' ? bats : null
}
