import { useMemo } from 'react'
import { teammateLadder } from '../../../../api/formerTeammates.js'
import { Ladder } from '../../../../components/team/ladder/Ladder.jsx'
import { OrgTies } from '../../../../components/team/FormerTeammates.jsx'
import { FoldCard } from './FoldCard.jsx'

// Former teammates: the live page's Ladder, without its legend line, in a card folded shut. An org-ties
// fallback shows when no literal pair exists. Spoiler-free: rosters and team history only.
export function TeammatesCard({ data, side }) {
  const { teammatePairs, orgTies, startingIds, info, meta, oppMeta } = data
  const away = side === 'away' ? meta : oppMeta
  const home = side === 'away' ? oppMeta : meta
  const ladder = useMemo(
    () => teammateLadder(teammatePairs, away.id, home.id, startingIds, { [away.id]: away.teamName, [home.id]: home.teamName }),
    [teammatePairs, away.id, home.id, away.teamName, home.teamName, startingIds],
  )
  const ties = Object.keys(ladder.players).length
  if (ties === 0) return <OrgTies ties={orgTies} />
  return (
    <FoldCard title="Former teammates" count={`${teammatePairs.length} ${teammatePairs.length === 1 ? 'tie' : 'ties'}`} className="ltm">
      <Ladder ladder={ladder} dayNight={info.dayNight} away={away} home={home} legend={false} />
    </FoldCard>
  )
}
