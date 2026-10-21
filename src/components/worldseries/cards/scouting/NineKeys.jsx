import { keysVerdict, nineKeysTeams } from '../../../../lib/postseason/keysVerdict.js'
import { ordinal } from '../../../../lib/format.js'
import { teamAbbr } from '../../../../lib/teams.js'
import { useRouteLink } from '../../../../lib/nav.js'
import { leadSide } from '../../../../lib/postseason/worldseries/hotBats.js'
import { Door } from '../../../ui/control/Door.jsx'
import { InfoPopover } from '../../../ui/InfoPopover.jsx'
import { Cluster } from '../../../ui/layout/Cluster.jsx'
import { ComparisonFigure, ComparisonLedger, ComparisonLegend } from './ComparisonLedger.jsx'

// Home-only view: the series pages keep SeriesNineKeys and its rank tracks.
export function NineKeys({ data, clubIds, season }) {
  const routeLink = useRouteLink()
  const teams = nineKeysTeams(data, clubIds.map((id) => ({ id })), season)
  if (!teams) return null
  const [a, b] = teams
  const abbr = (id) => teamAbbr({ id })
  const verdict = keysVerdict(
    { abbr: abbr(a.teamId), failed: a.failed?.length ?? 0 },
    { abbr: abbr(b.teamId), failed: b.failed?.length ?? 0 },
    { limit: data.limit, firstSeason: data.firstSeason },
  )
  return (
    <ComparisonLedger
      title="Nine keys"
      note="League ranks · lower is better"
      clubIds={clubIds}
      measureLabel="Rank / 30"
      footer={<>
        <Cluster align="center" className="ww-comparison__footline">
          <span className="ww-comparison__tally">
            Failed keys · {abbr(a.teamId)} {a.failed?.length ?? 0} · {abbr(b.teamId)} {b.failed?.length ?? 0}
            <InfoPopover label="What the failed-key count means">{verdict}</InfoPopover>
          </span>
          <Door {...routeLink('/nine-keys')}>Full report</Door>
        </Cluster>
        <ComparisonLegend bar={data.bar} />
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
                {rank == null ? <span>—<span className="sr-only"> no figure</span></span> : (
                  <ComparisonFigure lead={lead === (i === 0 ? 'a' : 'b')} failed={rank > data.bar}>
                    {rank}<span className="ww-comparison__ordinal">{ordinal(rank).slice(String(rank).length)}</span>
                  </ComparisonFigure>
                )}
              </td>
            ))}
          </tr>
        )
      })}
    </ComparisonLedger>
  )
}
