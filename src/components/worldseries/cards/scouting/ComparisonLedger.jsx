import { useId } from 'react'
import '../../../../styles/worldseries/comparison.css'
import { teamClubNameShort, teamLocationName } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Key } from '../../../ui/frame/Key.jsx'
import { Cluster } from '../../../ui/layout/Cluster.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'
import { Table } from '../../../ui/table/Table.jsx'

// The home scouting cards share one reading order: measure, first club, second club.
// Models supply the figures and leaders; this part only draws them.
export function ComparisonLedger({ title, note, clubIds, measureLabel, footer, className = '', children }) {
  const titleId = useId()
  return (
    <Card frame="stamped" body="flush" className={`ww-comparison ${className}`} aria-labelledby={titleId}>
      <Stack as="header" gap="tight" className="ww-comparison__head">
        <Cluster align="center" className="ww-comparison__titleline">
          <h3 id={titleId} className="ww-comparison__title">{title}</h3>
          <span className="t-label ww-comparison__season">Regular season</span>
        </Cluster>
        <p className="ww-comparison__note">{note}</p>
      </Stack>
      <Table frame="bare" density="keep" className="ww-comparison__table">
        <caption className="sr-only">
          {title}, regular season: {teamClubNameShort(clubIds[0])} and {teamClubNameShort(clubIds[1])}
        </caption>
        <colgroup>
          <col />
          <col className="ww-comparison__teamcol" />
          <col className="ww-comparison__teamcol" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="ww-comparison__measure">{measureLabel}</th>
            {clubIds.map((id) => (
              <th scope="col" key={id}>
                <Cluster as="span" gap="tight" align="center" className="ww-comparison__club">
                  <TeamLogo teamId={id} name={teamClubNameShort(id)} size={28} />
                  <span className="ww-comparison__clubname">
                    <span className="t-label ww-comparison__city">{teamLocationName(id)}</span>
                    <span>{teamClubNameShort(id)}</span>
                  </span>
                </Cluster>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </Table>
      <Stack as="footer" gap="tight" className="ww-comparison__foot">{footer}</Stack>
    </Card>
  )
}

export function ComparisonFigure({ lead = false, failed = false, children }) {
  return (
    <span className={`ww-comparison__figure${lead ? ' ww-comparison__figure--lead' : ''}${failed ? ' ww-comparison__figure--failed' : ''}`}>
      {children}
      {failed && <><sup aria-hidden="true">*</sup><span className="sr-only"> (failed)</span></>}
      {lead && <span className="sr-only"> (leads)</span>}
    </span>
  )
}

export function ComparisonLegend({ bar }) {
  const items = [{ label: bar == null ? 'Highlighted figure leads' : 'Better rank', mark: <span className="ww-comparison__mark" aria-hidden="true" /> }]
  if (bar != null) items.push({ label: `Outside top ${bar}`, mark: <span className="ww-comparison__failuremark" aria-hidden="true">*</span> })
  return <Key items={items} className="ww-comparison__legend" />
}
