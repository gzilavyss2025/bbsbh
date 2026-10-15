import { Card } from '../../../../components/ui/frame/Card.jsx'
import { Door } from '../../../../components/ui/control/Door.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { ordinal } from '../../../../lib/format.js'

// The team score card (#1107, row 5b), the picked frame's "1e" without the season grade: the club's
// rank at the top, a strip with one cell per club (the club's own on the marker, never the seal),
// the four parts and their ranks, and the same strips folded under "rails". Open surface (ADR-0034).
const rankText = (r) => (r ? (r.of ? `${r.rank} of ${r.of}` : ordinal(r.rank)) : '—')

function Strip({ n, at, tall }) {
  return (
    <div className={`stnd__strip${tall ? ' stnd__strip--tall' : ''}`} style={{ '--cells': n }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`stnd__cell${i === at ? ' stnd__cell--me' : ''}`} />
      ))}
    </div>
  )
}

export function ScoreCard({ card, onAll, stampIn, style }) {
  const { label, col, rank, strip, rows } = card
  // The best sixth of the places (the best five of 30) take the whole marker stroke; the others keep the half underline.
  const best = Math.ceil(strip.n / 6)
  return (
    <Card frame="stamped" body="flush" label="Team score" count={`${strip.n} clubs`} stampIn={stampIn} className="stnd__card" style={style}>
      <div className="stnd__lead">
        <div className="stnd__top">
          <div>
            <p className="stattile__label">{label}</p>
            <p className="stnd__rank">{rankText(rank)}</p>
          </div>
          <Door onClick={onAll}>All {strip.n}</Door>
        </div>
        <Strip {...strip} tall />
        <p className="stnd__ends">
          <span>1st</span>
          <span>{ordinal(strip.n)}</span>
        </p>
      </div>
      <Table frame="bare" density="row" className="stnd__parts">
        <thead>
          <tr>
            <th>Part</th>
            <th>Value</th>
            <th>{col}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.part}>
              <td>{r.part}</td>
              <td>{r.value}</td>
              <td>
                <span className={`rankmark${r.rank && r.rank.rank <= best ? ' stnd__best' : ''}`}>{rankText(r.rank)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.some((r) => r.strip) && (
        <details className="stnd__rails">
          <summary>{col === 'MLB' ? 'League rails' : 'Division rails'}</summary>
          {rows.map(
            (r) =>
              r.strip && (
                <div key={r.part} className="stnd__rail">
                  <p className="stnd__railname">
                    {r.part} <span>{rankText(r.rank)}</span>
                  </p>
                  <Strip {...r.strip} />
                </div>
              ),
          )}
        </details>
      )}
    </Card>
  )
}
