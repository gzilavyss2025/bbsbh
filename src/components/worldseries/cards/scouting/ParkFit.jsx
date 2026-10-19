import '../../../../styles/worldseries/fit.css'
import { teamClubNameShort } from '../../../../lib/teams.js'
import { BallparkDiagram } from '../../../ballpark/BallparkDiagram.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Table } from '../../../ui/table/Table.jsx'

// PARK FIT (#2316): the park's field (walls and distances, BallparkDiagram) over the share of each
// club's fly balls hit to pull, centre and opposite field. `model` is parkFitModel's output and
// `layout` the park's resolved wall (never null here). Numbers only: no leader mark. Open surface
// (ADR-0034): regular-season balls in play, no score.
export function ParkFit({ model, layout, clubIds }) {
  const names = clubIds.map((id) => teamClubNameShort(id))
  return (
    <Card frame="stamped" label="Park fit" count={layout.name} className="ww-fit">
      <BallparkDiagram layout={layout} className="ww-fit__field" label={`${layout.name} field, walls and distances`} />
      <Table frame="bare" className="ww-fit__table">
        <caption className="sr-only">Share of fly balls by direction</caption>
        <thead>
          <tr>
            <th scope="col">Fly balls</th>
            {names.map((n) => (
              <th key={n} scope="col">{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {r.shares.map((s, i) => (
                <td key={clubIds[i]}>{s}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="ww-fit__note">{`Regular season, the regulars' fly balls: ${names.map((n, i) => `${n} ${model.counts[i]}`).join(', ')}.`}</p>
    </Card>
  )
}
