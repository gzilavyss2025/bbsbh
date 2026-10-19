import { LEDGER_HITTING, LEDGER_PITCHING } from '../../../../api/teamLeaders.js'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { TeamLeaders } from '../../../../components/teamstats/TeamLeaders.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { useNav } from '../../../../lib/nav.js'
import { orgLeadersPath, teamLeadersPath } from '../../../../lib/route.js'
import { teamClubName } from '../../../../lib/teams.js'
import { loadRanks } from '../../data/loadNumbers.js'
import { parentOrgIdOf } from '../../data/shared.js'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import { ChallengeBoard } from './ChallengeBoard.jsx'
import { RunValueBoard } from './RunValueBoard.jsx'
import { rankCount } from './ranksData.js'
import '../../../../styles/team-next/ranks.css'

// Ranks: the Ranks share of the Numbers tab on its own loader (loadRanks), each card on the
// stamped parts (#1107, row 6a). Open surface (ADR-0034): season figures, nothing sealed. The
// club's /stats lines come through SHARED, which Farm reads too, so the band adds no request.
// A band with no data draws nothing: the cards that need MLB data self-null for a club below it.
const count = (n) => rankCount(n) || undefined

// One rank cell per stat on the compact tile; the rank reads "3rd" under the figure. The best five
// take the marker (never the seal). A cell with no rank draws no mark.
function RankBoard({ title, stats, still }) {
  return (
    <Card frame="stamped" label={title} labelAs="h3" count="rank of 30" stampIn={!still} className="rnk__card">
      <div className="rnk__grid">
        {stats.map((s, i) => {
          const rank = parseInt(s.rank, 10)
          return (
            <StatTile
              key={s.k}
              tone="soft"
              className={`stattile--compact rnk__tile${s.extreme === 'best' ? ' rnk__tile--best' : ''}`}
              label={s.k}
              value={s.v}
              rank={rank ? { rank } : undefined}
              stampIn={!still}
              style={{ '--stamp-delay': `${Math.min(i, 8) * 40}ms` }}
            />
          )
        })}
      </div>
    </Card>
  )
}

export default function Ranks({ team, asOf, sportId, onReady, onCount }) {
  const navigate = useNav()
  const numbers = useBandData(() => loadRanks(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  const n = numbers.data

  // Motion plays once per page visit; a return shows the band at rest.
  const still = useViewOnce(team.id, 'team-ranks')

  const hasLeaders = Boolean(n?.leaderPool?.length)
  const isMilb = (team.sport?.id ?? 1) !== 1
  const orgId = isMilb ? parentOrgIdOf(team) : team.id
  const clubName = teamClubName(team)
  const any = Boolean(n && (n.batting || n.pitching || n.runValue || n.absExposureClubs || hasLeaders))

  return (
    <div className={`tnext__square rnk${still ? ' rnk--still' : ''}`}>
      <AsyncStatus loading={numbers.loading} error={numbers.error} hasData={n != null} errorMessage="Couldn’t load team ranks. Try again." />
      {any && <h2 className="tnext__bandhead">Ranks</h2>}
      {n?.batting && <RankBoard title="Team batting" stats={n.batting} still={still} />}
      {n?.pitching && <RankBoard title="Team pitching" stats={n.pitching} still={still} />}
      {n && <RunValueBoard data={n.runValue} clubName={clubName} asOf={asOf} sportId={sportId} still={still} />}
      {n && (
        <ChallengeBoard data={n.absExposureClubs} teamId={team.id} level={n.absExposureLevel} still={still} />
      )}
      {hasLeaders && (
        <>
          <TeamLeaders pool={n.leaderPool} categories={LEDGER_HITTING} limit={5} title="Batting leaders" showTeamAbbr={false} showCount={false} injuredIds={n.injuredIds} />
          <TeamLeaders pool={n.leaderPool} categories={LEDGER_PITCHING} limit={5} title="Pitching leaders" showTeamAbbr={false} showCount={false} injuredIds={n.injuredIds} />
        </>
      )}
      {hasLeaders && (
        <div className="rnk__doors">
          <Door onClick={() => navigate(teamLeadersPath(team.id, { d: asOf, s: sportId }))}>See all leaders</Door>
          {orgId && <Door onClick={() => navigate(orgLeadersPath(orgId, { d: asOf, s: sportId }))}>Org leaders</Door>}
        </div>
      )}
    </div>
  )
}
