import { useMemo } from 'react'
import { computeLeaders, positionTag, LEDGER_HITTING, LEDGER_PITCHING } from '../../../../api/teamLeaders.js'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { InjuredMark } from '../../../../components/badges/InjuredMark.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'
import { StatTile } from '../../../../components/ui/frame/StatTile.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
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

// The leader (rank 1) of each category; a category nobody qualifies for is dropped.
const leadersOf = (pool, categories) =>
  categories.map((category) => ({ category, entry: computeLeaders(pool, category, { limit: 1 })[0] })).filter((r) => r.entry)

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

function Leaders({ blocks, injuredIds, still }) {
  return blocks.map((block) => (
    <Card key={block.label} frame="stamped" body="flush" label={block.label} labelAs="h3" stampIn={!still} className="rnk__card">
      <Table frame="bare" density="row" className="tledg__rows">
        <thead>
          <tr>
            <th>Category</th>
            <th>Leader</th>
            <th>Stat</th>
          </tr>
        </thead>
        <tbody>
          {block.rows.map(({ category, entry }) => {
            const tag = positionTag(entry, category.group)
            return (
              <tr key={category.key}>
                <td className="tledg__cat">{category.short}</td>
                <td className="tledg__leader">
                  <span className="tledg__who">
                    <PlayerLink id={entry.id} className="tledg__name">
                      {entry.name}
                    </PlayerLink>
                    {tag && <span className="tledg__pos">{tag}</span>}
                    <InjuredMark hurt={injuredIds?.has(entry.id)} />
                  </span>
                </td>
                <td className="tledg__val">{entry.display}</td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  ))
}

export default function Ranks({ team, asOf, sportId, onReady, onCount }) {
  const navigate = useNav()
  const numbers = useBandData(() => loadRanks(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  const n = numbers.data

  // Motion plays once per page visit; a return shows the band at rest.
  const still = useViewOnce(team.id, 'team-ranks')

  const blocks = useMemo(
    () =>
      n
        ? [
            { label: 'Batting leaders', rows: leadersOf(n.leaderPool, LEDGER_HITTING) },
            { label: 'Pitching leaders', rows: leadersOf(n.leaderPool, LEDGER_PITCHING) },
          ].filter((b) => b.rows.length)
        : [],
    [n],
  )
  const isMilb = (team.sport?.id ?? 1) !== 1
  const orgId = isMilb ? parentOrgIdOf(team) : team.id
  const clubName = teamClubName(team)
  const any = Boolean(n && (n.batting || n.pitching || n.runValue || n.absExposureClubs || blocks.length))

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
      {n && <Leaders blocks={blocks} injuredIds={n.injuredIds} still={still} />}
      {blocks.length > 0 && (
        <div className="rnk__doors">
          <Door onClick={() => navigate(teamLeadersPath(team.id, { d: asOf, s: sportId }))}>See all leaders</Door>
          {orgId && <Door onClick={() => navigate(orgLeadersPath(orgId, { d: asOf, s: sportId }))}>Org leaders</Door>}
        </div>
      )}
    </div>
  )
}
