import { useMemo, useState } from 'react'
import {
  umpireBoard,
  UMPIRE_SORTS,
  MIN_UMPIRE_GAMES,
} from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { UmpireLink } from '../../../components/umpire/UmpireLink.jsx'
import { commas, num2, pct1 } from './format.js'

// THE PLATE UMPIRES — how often each man's zone is argued with, and how often
// the argument wins.
//
// The sort chips live here for the same reason the club board's do: the chip,
// the ranking and the column are one mechanism.

export function UmpireBoard({ summary }) {
  const [umpSort, setUmpSort] = useState('rate')
  const umps = useMemo(() => (summary ? umpireBoard(summary, umpSort) : []), [summary, umpSort])

  return (
    <BroadcastSection title="The plate umpires">
      <div className="rpt-controls" role="group" aria-label="Sort the umpire board">
        {UMPIRE_SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`rpt-chip${s.key === umpSort ? ' is-on' : ''}`}
            aria-pressed={s.key === umpSort}
            onClick={() => setUmpSort(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <BoardScroller label="Challenges against each plate umpire">
        <table className="standings rpt">
          <thead>
            <tr>
              {/* The floor rides in the column head it qualifies, where a
                  reader meets it while reading the column, instead of in
                  a paragraph above the board.

                  SO DOES THE DENOMINATOR, in three words. This board is
                  the one thing on the page that can be misread against
                  another page — /umpire-rankings scores every called
                  pitch of a man's season, this scores only the pitches
                  somebody thought were wrong — and a reader who takes
                  one for the other has the wrong idea of an umpire, not
                  just a wrong figure. The source line at the foot says it
                  in full; the head says enough to stop the mistake. */}
              <th className="team">
                Umpire
                <span className="rpt__sub">
                  Minimum {MIN_UMPIRE_GAMES} games · challenged pitches only
                </span>
              </th>
              <th>Games</th>
              <th>Challenged</th>
              <th>Per game</th>
              <th>Overturned</th>
              <th>Overturn rate</th>
            </tr>
          </thead>
          <tbody>
            {umps.map((u) => (
              <tr key={u.umpireId}>
                <th scope="row" className="team">
                  <span className="rpt__club">
                    <span className="rpt__rank">
                      {u.tied ? 'T' : ''}
                      {u.rank ?? '—'}
                    </span>
                    <UmpireLink id={u.umpireId} name={u.name}>
                      {u.name}
                    </UmpireLink>
                  </span>
                </th>
                <td>{commas(u.games)}</td>
                <td>{commas(u.n)}</td>
                <td>{num2(u.perGame)}</td>
                <td>{commas(u.success)}</td>
                <td>{pct1(u.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BoardScroller>
    </BroadcastSection>
  )
}
