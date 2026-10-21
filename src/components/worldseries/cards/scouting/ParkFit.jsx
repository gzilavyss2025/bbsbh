import { useState } from 'react'
import '../../../../styles/worldseries/fit.css'
import { parkView } from '../../../../lib/postseason/worldseries/scouting/parkFit.js'
import { teamClubNameShort, teamLocationName } from '../../../../lib/teams.js'
import { Segmented } from '../../../ui/control/Segmented.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Key } from '../../../ui/frame/Key.jsx'
import { NO_FIGURE } from '../../../ui/table/PairLedger.jsx'
import { Table } from '../../../ui/table/Table.jsx'
import { FenceOverlay } from './FenceOverlay.jsx'

// PARK FIT (#2316; the two-park overlay is 2026-10-21): both Series clubs' parks drawn over each
// other (FenceOverlay), over the share of each club's fly balls hit to pull, centre and opposite
// field. A control picks Both, or one park alone: that park's wall is all that stays on the map, and
// the table gains a block, the share of each club's fly balls that carry past that wall. That block is
// an ESTIMATE (parkFit.js carryRates) and says so. `model` is parkFitModel's output and `parks` is
// fitParks' (one or two; the control shows only for two), in the order of `clubIds`, the table's columns.
// `model.carry[i]` is the carry block for `parks[i]`. Which park shows, and which one's figures sit under
// the carry block, is parkView (parkFit.js).
// Numbers only: no leader mark. Open surface (ADR-0034): regular-season balls in play, no score.

// A table of one figure per club per direction. `figures` names the row field that holds them: `shares` or
// `rates`. A null is a dash, never a zero.
function FigureTable({ head, caption, rows, figures, clubIds, className }) {
  return (
    <Table frame="bare" className={className}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head}</th>
          {clubIds.map((id) => (
            <th key={id} scope="col">{teamClubNameShort(id)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <th scope="row">{r.label}</th>
            {r[figures].map((v, i) => (
              <td key={clubIds[i]}>{v == null ? NO_FIGURE : `${v}%`}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function ParkFit({ model, parks, clubIds }) {
  const [pick, setPick] = useState('both')
  const [last, setLast] = useState(null)
  const { one, show, both, at, lit } = parkView(parks, pick, last)
  // The park last picked stays under the carry block while it folds away, so its figures do not change under the fold.
  const choose = (v) => {
    setPick(v)
    if (v !== 'both') setLast(v)
  }
  const parkName = parks[at].layout.name
  const label = both
    ? `${parks.map((p) => p.layout.name).join(' and ')}, outfield walls overlaid`
    : `${parkName} field, walls and distances`
  const names = clubIds.map((id) => teamClubNameShort(id))
  return (
    <Card frame="stamped" label="Park fit" labelAs="h3" count={both ? 'Both parks' : parkName} className="ww-fit">
      <FenceOverlay parks={lit} both={both} label={label} className="ww-fit__field" />
      {!one && (
        <>
          <Key
            className="ww-fence__key"
            items={lit.map((p) => ({
              mark: <span className="ww-fence__swatch" data-ink={p.ink} data-on={p.on} aria-hidden="true" />,
              label: <span className="ww-fence__keyname" data-on={p.on}>{p.layout.name}</span>,
            }))}
          />
          <Segmented
            label="Show park"
            fill
            className="ww-fit__pick"
            value={show}
            onChange={choose}
            options={[
              { value: 'both', label: 'Both' },
              ...parks.map((p) => ({ value: p.clubId, label: teamLocationName(p.clubId) ?? p.layout.name })),
            ]}
          />
          <p className="sr-only" role="status">
            {both ? 'Showing both parks.' : `Showing ${parkName}. The table adds the share of fly balls that carry past its wall.`}
          </p>
        </>
      )}
      <FigureTable
        head="Fly balls"
        caption="Share of fly balls by direction"
        rows={model.rows}
        figures="shares"
        clubIds={clubIds}
        className="ww-fit__table"
      />
      <div className="ww-fit__carry" data-open={!both} inert={both}>
        <div className="ww-fit__carryin">
          <FigureTable
            key={parks[at].clubId}
            head="Carry past wall"
            caption={`Share of fly balls that carry past the wall at ${parkName}, by direction`}
            rows={model.carry[at]}
            figures="rates"
            clubIds={clubIds}
            className="ww-fit__table ww-fit__table--carry"
          />
          <p className="ww-fit__note">
            {"Estimate: a fly ball counts when its distance is more than the wall's distance plus its height, on the ball's own angle."}
          </p>
        </div>
      </div>
      <p className="ww-fit__note">{`Regular season, the regulars' fly balls: ${names.map((n, i) => `${n} ${model.counts[i]}`).join(', ')}.`}</p>
    </Card>
  )
}
