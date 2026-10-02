import { useAsync } from '../../hooks/useAsync.js'
import { fetchHeadToHead, totalsOf } from '../../api/scout/headToHead.js'
import { pitchLabel } from '../../api/pitchArsenal.js'
import { rate3 } from '../../api/person/shared.js'
import { humanDateWithYear, monthDayYear } from '../../lib/dates.js'
import { ROUND_TAG, resultShort } from '../../lib/scout/format.js'
import { Pill } from '../../components/ui/control/Pill.jsx'
import { FactGrid } from '../../components/ui/frame/FactGrid.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { Table } from '../../components/ui/table/Table.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { AsOfBanner } from '../../components/seal/AsOfBanner.jsx'


// THE HEAD-TO-HEAD LIST (#1410): every past plate appearance between the two,
// regular season and postseason, newest first, under one total line.
//
// THE CUTOFF IS THE SPOILER RULE HERE. This open page (ADR-0034) could
// otherwise name tonight's meeting, so the request holds back every game
// dated on or after `cutoff`: today, or `?d=` (ADR-0087, ADR-0088). The
// module sends Savant the day before it, because Savant's bounds are
// inclusive. `AsOfBanner` is the way to move it.
//
// Scope filters the rows by round, and the totals are rebuilt from the same
// rows, so the line and the list cannot disagree. The Scope control sits
// under the maps and moves both (ScoutPage.jsx).
export function HeadToHead({ pitcherId, hitterId, cutoff, asOf, scope }) {
  const h2h = useAsync(() => fetchHeadToHead(hitterId, pitcherId, cutoff), [hitterId, pitcherId, cutoff])
  const pas = (h2h.data?.pas ?? []).filter((r) => scope === 'all' || (scope === 'reg') === (r.round === 'R'))
  const t = totalsOf(pas)
  const failed = !h2h.loading && h2h.data === null
  return (
    <section className="scout__h2h" aria-label="Head to head">
      <SectionHead>Head to head</SectionHead>
      <AsOfBanner asOf={asOf} />
      {h2h.loading ? (
        <AsyncStatus loading hasData={false} />
      ) : failed ? (
        <p className="hint">No head-to-head on file</p>
      ) : pas.length === 0 ? (
        <p className="hint">No meetings before {humanDateWithYear(cutoff)}</p>
      ) : (
        <>
          <FactGrid className="scout__totals">
            {/* The slash line spans its row; the six counts fill three. */}
            {[
              ['AVG/OBP/SLG', [t.avg, t.obp, t.slg].map(rate3).join('/')],
              ['PA', t.pa],
              ['AB', t.ab],
              ['H', t.h],
              ['HR', t.hr],
              ['K', t.k],
              ['BB', t.bb],
            ].map(([k, v], i) => (
              <div className={i === 0 ? 'fact fact--wide' : 'fact'} key={k}>
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
              {pas.map((r) => (
                <tr key={r.key}>
                  <td>{monthDayYear(r.date)}</td>
                  <td><Pill>{ROUND_TAG[r.round] ?? r.round}</Pill></td>
                  <td>{resultShort(r)}</td>
                  <td>{r.pitchType ? pitchLabel(r.pitchType) : '—'}</td>
                  {/* A plate appearance with no tracked pitch (its rows carry no
                      location) has no count to print. */}
                  <td>{r.pitches || '—'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  )
}
