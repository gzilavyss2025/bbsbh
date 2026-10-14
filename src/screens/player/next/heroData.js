// The hero's pure rules (#1884): the Age fact, and which rank mark a tile wears.
import { DASH } from '../../../api/person/shared.js'
import { ovrView } from '../../../lib/ovr/card.js'

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

// Header extras (#2009), the hero's parts: the nickname, the two prospect ranks, the school and
// one ovrView per rated group, hitting first (the stamp shows the first; the old OvrTile rule).
// Null when he has none of them. `ratings` is useOvr's answer. A minor leaguer's view has no rows
// and a `minor` (POT, level, meter marks); a player with no rating has an empty `ratings`.
export function headerExtras(core, ratings) {
  const { bio } = core
  const views = ['hitting', 'pitching'].filter((g) => ratings?.[g]).map((group) => ({ group, ...ovrView({ rating: ratings[group], group }) }))
  const x = { nickname: bio.nickname, rank: core.prospectRank, orgRank: core.orgProspectRank, education: bio.education, ratings: views }
  return x.nickname || x.rank || x.orgRank || x.education || views.length ? x : null
}

// The sentence a tapped bar reads (#2009): "Speed 74 is All-Star level on its own." Looked up by
// key; null for no pick or a key the rows lack.
export function tierLine(rows, key) {
  const r = key && rows.find((x) => x.key === key)
  return r ? `${r.label} ${r.value} is ${r.tier.name} level on its own.` : null
}

// Overview extras (#1884): a stat block's league-rank chips, postseason row and other-level rows.
export const hasExtras = (b) => Boolean(b.ranks?.length || b.postseason || b.otherLevels?.length)
