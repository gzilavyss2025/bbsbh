import { useMemo } from 'react'
import { missBands } from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { BarCell } from '../../../components/around-the-game/BroadcastBar.jsx'
import { commas, pct1 } from './format.js'

// HOW CLOSE WAS THE CALL — the challenged pitches banded by how far off the
// zone edge they were, and how the success rate moves across the bands.
//
// Distance is measured from the BUFFERED rule-book zone, per batter. That is
// the generator's geometry, written up in scripts/gen-abs-challenges.mjs; the
// page's source line at the foot repeats it for the reader.

export function MissBands({ summary }) {
  const bands = useMemo(() => (summary ? missBands(summary) : []), [summary])
  const bandMax = bands.reduce((m, b) => (b.share != null && b.share > m ? b.share : m), 0)

  return (
    <BroadcastSection title="How close was the call">
      <BoardScroller label="Challenges by distance from the zone edge">
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">Off the edge</th>
              <th>Challenges</th>
              <th>Share</th>
              <th>Won</th>
              <th>Success</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.key}>
                <th scope="row" className="team">
                  {b.label}
                </th>
                <td>{commas(b.n)}</td>
                <td>
                  <BarCell value={b.share} min={0} max={bandMax || 1}>
                    {pct1(b.share)}
                  </BarCell>
                </td>
                <td>{commas(b.success)}</td>
                <td>{pct1(b.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BoardScroller>
    </BroadcastSection>
  )
}
