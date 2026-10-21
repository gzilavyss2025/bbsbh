import { useState } from 'react'
import '../../../../styles/worldseries/fit.css'
import { teamClubNameShort, teamLocationName } from '../../../../lib/teams.js'
import { Segmented } from '../../../ui/control/Segmented.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Key } from '../../../ui/frame/Key.jsx'
import { Table } from '../../../ui/table/Table.jsx'
import { FenceOverlay } from './FenceOverlay.jsx'

// PARK FIT (#2316; the two-park overlay is 2026-10-21): both Series clubs' parks drawn over each
// other (FenceOverlay), over the share of each club's fly balls hit to pull, centre and opposite
// field. A control picks Both, or one park alone: that park's wall is all that stays on the map, and
// the table gains a block, the share of each club's fly balls that carry past that wall. That block is
// an ESTIMATE (parkFit.js carryRates) and says so. `model` is parkFitModel's output and `parks` is
// fitParks' (one or two; the control shows only for two), in the order of `clubIds`, the table's columns.
// Numbers only: no leader mark. Open surface (ADR-0034): regular-season balls in play, no score.
const noFigure = (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">no figure</span>
  </>
)

export function ParkFit({ model, parks, clubIds }) {
  const names = clubIds.map((id) => teamClubNameShort(id))
  const one = parks.length === 1
  const [pick, setPick] = useState('both')
  const show = one ? parks[0].clubId : parks.some((p) => p.clubId === pick) ? pick : 'both'
  const both = show === 'both'
  // The carry block keeps the park last shown while it folds away, so its figures do not change under the fold.
  const [last, setLast] = useState(parks[0].clubId)
  if (!both && show !== last) setLast(show)
  const at = Math.max(0, parks.findIndex((p) => p.clubId === (both ? last : show)))
  const carry = model.carry?.[at]
  const parkName = parks[at].layout.name
  const label = both
    ? `${parks.map((p) => p.layout.name).join(' and ')}, outfield walls overlaid`
    : `${parkName} field, walls and distances`
  return (
    <Card frame="stamped" label="Park fit" labelAs="h3" count={both ? 'Both parks' : parkName} className="ww-fit">
      <FenceOverlay parks={parks} show={show} label={label} className="ww-fit__field" />
      {!one && (
        <>
          <Key
            className="ww-fence__key"
            items={parks.map((p) => {
              const on = both || p.clubId === show
              return {
                mark: <span className="ww-fence__swatch" data-ink={p.ink} data-on={on} aria-hidden="true" />,
                label: <span className="ww-fence__keyname" data-on={on}>{p.layout.name}</span>,
              }
            })}
          />
          <Segmented
            label="Show park"
            fill
            className="ww-fit__pick"
            value={show}
            onChange={setPick}
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
      {carry && (
        <div className="ww-fit__carry" data-open={one || !both} inert={!one && both}>
          <div className="ww-fit__carryin">
            <Table frame="bare" className="ww-fit__table ww-fit__table--carry" key={parks[at].clubId}>
              <caption className="sr-only">{`Share of fly balls that carry past the wall at ${parkName}, by direction`}</caption>
              <thead>
                <tr>
                  <th scope="col">Carry past wall</th>
                  {names.map((n) => (
                    <th key={n} scope="col">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {carry.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label}</th>
                    {r.rates.map((v, i) => (
                      <td key={clubIds[i]}>{v == null ? noFigure : `${v}%`}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="ww-fit__note">
              {"Estimate: a fly ball counts when its distance is more than the wall's distance plus its height, on the ball's own angle."}
            </p>
          </div>
        </div>
      )}
      <p className="ww-fit__note">{`Regular season, the regulars' fly balls: ${names.map((n, i) => `${n} ${model.counts[i]}`).join(', ')}.`}</p>
    </Card>
  )
}
