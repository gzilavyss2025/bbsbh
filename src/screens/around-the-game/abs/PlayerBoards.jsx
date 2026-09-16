import { useMemo } from 'react'
import { playerBoards, ROLE_LABEL } from '../../../api/around-the-game/absChallenges.js'
import { clubShort } from '../../../api/around-the-game/clubs.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { commas, pct1 } from './format.js'

// THE PLAYERS — the men who ask, ranked two ways.
//
// TWO BOARDS, TWO TABLES. These are two independent rankings, and they used to
// be zipped into ONE table by row index — row 3 of the count board sharing a
// <tr> with row 3 of the rate board, which relates two men who have nothing to
// do with each other, and puts the first board's Won/Called columns BETWEEN the
// two names.
//
// It also broke the sticky column outright. `.rpt th.team` pins the row-header
// cell to left:0 so the figures scroll under it; with a second `.team` cell in
// the same row BOTH pinned to left:0, the right-hand board's name column slid
// on top of the left-hand one on any horizontal scroll — at 390px, 146px in,
// "Best success rate" painted over "Most calls overturned" and clipped every
// name on the left board mid-word, with the Won/Called columns hidden
// underneath. One sticky column per table is the invariant; two tables keep it.

export function PlayerBoards({ summary, clubs }) {
  const players = useMemo(() => (summary ? playerBoards(summary) : null), [summary])
  if (!players) return null

  return (
    <BroadcastSection title="The players">
      <div className="rptpair">
        <BoardScroller label="Most overturned calls won">
          <table className="standings rpt">
            <thead>
              <tr>
                {/* Both heads carry a sub-line, and the left one says
                    "no minimum" rather than saying nothing: it keeps
                    the two headers the same height, so the two boards'
                    rows line up across the pair, and it answers the
                    question the right-hand floor raises about it. */}
                <th className="team">
                  Most calls overturned
                  <span className="rpt__sub">No minimum</span>
                </th>
                <th>Won</th>
                <th>Called</th>
              </tr>
            </thead>
            <tbody>
              {players.byCount.map((p) => (
                <tr key={p.playerId}>
                  <th scope="row" className="team">
                    <PlayerLink id={p.playerId} name={p.name}>
                      {p.name}
                    </PlayerLink>
                    <span className="rpt__sub">
                      {clubShort(clubs, p.teamId)} — {ROLE_LABEL[p.role] ?? p.role}
                    </span>
                  </th>
                  <td>{commas(p.success)}</td>
                  <td>{commas(p.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BoardScroller>

        <BoardScroller label="Best challenge success rate">
          <table className="standings rpt">
            <thead>
              <tr>
                <th className="team">
                  Best success rate
                  <span className="rpt__sub">
                    Minimum {players.minChallenges} called · {commas(players.qualified)}{' '}
                    qualify
                  </span>
                </th>
                <th>Success</th>
                <th>Called</th>
              </tr>
            </thead>
            <tbody>
              {players.byRate.map((q) => (
                <tr key={q.playerId}>
                  <th scope="row" className="team">
                    <PlayerLink id={q.playerId} name={q.name}>
                      {q.name}
                    </PlayerLink>
                    <span className="rpt__sub">
                      {clubShort(clubs, q.teamId)} — {ROLE_LABEL[q.role] ?? q.role}
                    </span>
                  </th>
                  <td>{pct1(q.rate)}</td>
                  <td>{commas(q.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BoardScroller>
      </div>
    </BroadcastSection>
  )
}
