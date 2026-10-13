import { OvrBars } from '../../../../components/ovr/OvrBars.jsx'
import { useOvr } from '../../../../components/ovr/useOvr.js'
import { ProspectPill } from '../../../../components/badges/ProspectPill.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Cluster } from '../../../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../../../components/ui/layout/Stack.jsx'
import { headerExtras } from '../heroData.js'
import '../../../../styles/ovr/card.css'

const WORD = { hitting: 'Batting', pitching: 'Pitching' }

// The second top card (TbdWire "Header extras"): nickname, the Top-100 and org prospect pills
// (a Top-100 player wears both, as on the live page), the school, and the OVR bars. Hides
// when he has none of them.
export function HeaderExtras({ core }) {
  const x = headerExtras(core, useOvr(core.bio))
  if (!x) return null
  const club = core.rosterStatus ? null : core.bio.team
  return (
    <Card frame="stamped" label="Header extras" className="pnext__slot pnext__top">
      <Stack gap="snug">
        {x.nickname && <p className="pnext__attr">“{x.nickname}”</p>}
        {(x.rank || x.orgRank) && (
          <Cluster>
            <ProspectPill rank={x.rank} />
            <ProspectPill
              orgRank={x.orgRank}
              orgTeamId={club?.parentOrgId ?? club?.id}
              orgTeamName={club?.parentOrgName ?? club?.name}
            />
          </Cluster>
        )}
        {x.education && <p className="pnext__attr">{x.education}</p>}
        {x.bars.map(({ group, rows }) => (
          <div key={group} className="pnext__ovr">
            {x.bars.length > 1 && <h3 className="pnext__rowlabel">{WORD[group]}</h3>}
            <OvrBars rows={rows} />
          </div>
        ))}
      </Stack>
    </Card>
  )
}
