// The new player page's jump-bar sections (#1884): which sections the bar lists,
// in page order, and which of them the loaded data hides. Pure; the page renders
// one slot per entry. `key` is the section element's id.
const BATTER = [
  ['overview', 'Overview'],
  ['season', 'Season'],
  ['splits', 'Splits'],
  ['plate-approach', 'Plate approach'],
  ['contact', 'Contact'],
  ['form-trend', 'Form trend'],
  ['game-log', 'Game log'],
  ['career', 'Career'],
  ['history', 'History'],
]
const PITCHER = [
  ['overview', 'Overview'],
  ['season', 'Season'],
  ['pitches', 'Pitches'],
  ['splits', 'Splits'],
  ['on-the-mound', 'On the mound'],
  ['form-trend', 'Form trend'],
  ['game-log', 'Game log'],
  ['career', 'Career'],
  ['history', 'History'],
]
// A two-way player has the batter bar, then the two sections only a pitcher has.
const PITCHER_ONLY = PITCHER.filter(([key]) => !BATTER.some(([k]) => k === key))

// `blocks` are the loaded stat blocks (api/player/overview.js), one per role.
// A section hides only when the loaded data shows it is empty: no games this
// season hides the game log. A count shows only when the loaded data gives one.
export function jumpSections(bio, blocks) {
  const batter = blocks.some((b) => b.group === 'hitting')
  const pitcher = blocks.some((b) => b.group === 'pitching') || (!batter && bio.isPitcher)
  const list = pitcher && !batter ? PITCHER : batter && pitcher ? [...BATTER, ...PITCHER_ONLY] : BATTER
  const noGames = blocks.every((b) => !b.seasonGames)
  return list
    .filter(([key]) => !(key === 'game-log' && noGames))
    .map(([key, label]) => ({
      key,
      label,
      count: key === 'game-log' ? blocks[0]?.seasonGames || undefined : undefined,
    }))
}
