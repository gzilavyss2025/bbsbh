import { useMemo } from 'react'
import {
  roleRows,
  callSplitAnomalies,
  callSplitOffBy,
  ROLE_CALL,
  ROLE_LABEL,
} from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { BarCell } from '../../../components/around-the-game/BroadcastBar.jsx'
import { commas, pct1 } from './format.js'

// WHO CALLS FOR ONE — the three jobs that can ask, and how often each is right.
//
// It reads the `summary` it is handed and never the file, so the page's MLB /
// Triple-A chip switches this board for free.

export function WhoCalls({ summary }) {
  const roles = useMemo(() => (summary ? roleRows(summary) : []), [summary])
  const anomalies = useMemo(() => (summary ? callSplitAnomalies(summary) : []), [summary])
  const offBy = useMemo(() => callSplitOffBy(anomalies), [anomalies])
  const roleMax = roles.reduce((m, r) => (r.rate != null && r.rate > m ? r.rate : m), 0)

  return (
    <BroadcastSection title="Who calls for one">
      {/* WHAT IS UNDER REVIEW RIDES WITH WHO ASKED, in the row header,
          rather than in a column of its own. The two are one fact: a
          batter can only challenge a called strike, a catcher or a
          pitcher only a called ball. As a column it was three rows of
          repeated words set right-aligned in mono like a figure, and it
          took 233px — a quarter of the board — to say what the row label
          already implies. As a sub-line it costs nothing and the three
          numbers move left into the space it gave back. */}
      <BoardScroller label="Challenge success rate by who called for it">
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">Called by</th>
              <th>Called</th>
              <th>Won</th>
              <th>Success</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.role}>
                <th scope="row" className="team">
                  {ROLE_LABEL[r.role] ?? r.role}
                  {ROLE_CALL[r.role] ? (
                    <span className="rpt__sub">
                      on a called {ROLE_CALL[r.role]}
                    </span>
                  ) : null}
                </th>
                <td>{commas(r.n)}</td>
                <td>{commas(r.success)}</td>
                <td>
                  <BarCell value={r.rate} min={0} max={roleMax || 1}>
                    {pct1(r.rate)}
                  </BarCell>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BoardScroller>
      {/* The anomaly line has to carry its own antecedent, its own rule
          and its own arithmetic.

          THE ANTECEDENT. It used to read "do not follow that rule", where
          "that rule" lived in the section note above it. The note is
          gone, and the rows now say only "on a called strike" / "on a
          called ball" — which states the rule but never names what breaks
          it. So the line says both itself.

          THE ARITHMETIC. It used to add the disagreeing rows' `n`, which
          is each whole bucket rather than what disagrees: on the Triple-A
          board a single miscoded challenge printed as 4,813 of them.
          callSplitOffBy takes the real figure. */}
      {offBy > 0 && (
        <p className="hint rptprose">
          {commas(offBy)} {offBy === 1 ? 'challenge does' : 'challenges do'} not fit these
          rows — the feed put the challenger at no position it recognises, or recorded a
          call his job cannot ask for: a batter can only challenge a called strike, a
          catcher or a pitcher a called ball.
        </p>
      )}
    </BroadcastSection>
  )
}
