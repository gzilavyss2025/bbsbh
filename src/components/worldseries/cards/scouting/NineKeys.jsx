import { isFailedKey, keysVerdict, nineKeysTeams } from '../../../../lib/postseason/keysVerdict.js'
import { ordinalSuffix } from '../../../../lib/format.js'
import { teamAbbr } from '../../../../lib/teams.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { leadSide } from '../../../../lib/postseason/worldseries/hotBats.js'
import { Door } from '../../../ui/control/Door.jsx'
import { InfoPopover } from '../../../ui/InfoPopover.jsx'
import { Cluster } from '../../../ui/layout/Cluster.jsx'
import { ComparisonFigure, ComparisonLedger, ComparisonLegend, NO_FIGURE } from './ComparisonLedger.jsx'

// Home-only view: the series pages keep SeriesNineKeys and its rank tracks.
export function NineKeys({ data, clubIds, season }) {
  const routeLink = useRouteLink()
  const teams = nineKeysTeams(data, clubIds.map((id) => ({ id })), season)
  if (!teams) return null
  const [a, b] = teams
  const [sideA, sideB] = teams.map((t) => ({ abbr: teamAbbr({ id: t.teamId }), failed: t.failed?.length ?? 0 }))
  const verdict = keysVerdict(sideA, sideB, { limit: data.limit, firstSeason: data.firstSeason })
  return (
    <ComparisonLedger
      title="Nine keys"
      note="League ranks · lower is better"
      clubIds={clubIds}
      measureLabel="Rank / 30"
      footer={<>
        <Cluster align="center" className="ww-comparison__footline">
          <span className="ww-comparison__tally">
            Failed keys · {sideA.abbr} {sideA.failed} · {sideB.abbr} {sideB.failed}
            <InfoPopover label="What the failed-key count means" className="infopop--paper">{verdict}</InfoPopover>
          </span>
          <Door {...routeLink('/nine-keys')}>Full report</Door>
        </Cluster>
        <ComparisonLegend lead="Better rank" bar={data.bar} />
      </>}
    >
      {data.keys.map((key) => {
        const ranks = [a.ranks?.[key.id], b.ranks?.[key.id]]
        const lead = leadSide(...ranks, { lowerWins: true })
        return (
          <tr key={key.id} className="ww-comparison__row">
            <th scope="row">{key.label}</th>
            {ranks.map((rank, i) => (
              <td key={clubIds[i]}>
                <ComparisonFigure lead={lead === (i === 0 ? 'a' : 'b')} failed={isFailedKey(rank, data.bar)}>
                  {rank == null ? NO_FIGURE : <>{rank}<span className="ww-comparison__ordinal">{ordinalSuffix(rank)}</span></>}
                </ComparisonFigure>
              </td>
            ))}
          </tr>
        )
      })}
    </ComparisonLedger>
  )
}
