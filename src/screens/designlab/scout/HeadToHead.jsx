import { Pill } from '../../../components/ui/control/Pill.jsx'
import { FactGrid } from '../../../components/ui/frame/FactGrid.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Table } from '../../../components/ui/table/Table.jsx'
import { AsOfBanner } from '../../../components/seal/AsOfBanner.jsx'
import { pitchLabel } from '../../../api/pitchArsenal.js'
import { monthDayYear } from '../../../lib/dates.js'
import { h2hRows } from './fixture.js'
import { ROUND, h2hBefore, h2hTotals, resultShort } from './model.js'

// THE HEAD-TO-HEAD LIST: the total line, then one row per plate appearance,
// newest first. Only games dated before `cutoff` (today, or ?d=) — the one
// part of this open page that could name tonight's meeting (ADR-0087/0088).
// The totals are built from the same rows the list prints.
export function HeadToHead({ scope, cutoff, asOf, missing }) {
  const shown = h2hBefore(h2hRows(), cutoff)
    .filter((r) => scope === 'all' || (scope === 'reg') === (r.gameType === 'R'))
    .reverse()
  const t = h2hTotals(shown)
  return (
    <section className="scout__h2h">
      <SectionHead>Head to head</SectionHead>
      <AsOfBanner asOf={asOf} />
      {missing || shown.length === 0 ? (
        <p className="hint">No head-to-head on file</p>
      ) : (
        <>
          <FactGrid className="scout__totals">
            {[['PA', t.pa], ['AVG/OBP/SLG', t.slash], ['K', t.k], ['BB', t.bb]].map(([k, v]) => (
              <div className="fact" key={k}>
                <dt className="fact__label">{k}</dt>
                <dd className="fact__value">{v}</dd>
              </div>
            ))}
          </FactGrid>
          <Table density="tight" label="Plate appearances" className="scout__pas">
            <thead>
              <tr><th>Date</th><th>Round</th><th>Result</th><th>Pitch</th><th>Pitches</th></tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={i}>
                  <td>{monthDayYear(r.date)}</td>
                  <td><Pill>{ROUND[r.gameType]}</Pill></td>
                  <td>{resultShort(r)}</td>
                  <td>{pitchLabel(r.pitchType)}</td>
                  <td>{r.pitches}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  )
}
