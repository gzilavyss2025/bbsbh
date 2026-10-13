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

// Header extras (#1884): the nickname, the two prospect ranks, the school and the OVR bars. Null
// when he has none of them, so the card hides. `ratings` is useOvr's answer; a bar is a row of
// ovrView, so a minor leaguer (no bars) and a player with no rating add none.
export function headerExtras(core, ratings) {
  const { bio } = core
  const bars = ['hitting', 'pitching'].flatMap((group) => {
    const rows = ratings?.[group] ? ovrView({ rating: ratings[group], group }).rows : []
    return rows.length ? [{ group, rows }] : []
  })
  const x = { nickname: bio.nickname, rank: core.prospectRank, orgRank: core.orgProspectRank, education: bio.education, bars }
  return x.nickname || x.rank || x.orgRank || x.education || bars.length ? x : null
}

// Overview extras (#1884): a stat block's league-rank chips, postseason row and other-level rows.
export const hasExtras = (b) => Boolean(b.ranks?.length || b.postseason || b.otherLevels?.length)
