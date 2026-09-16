import { useId, useMemo, useState } from 'react'
import {
  umpireBoard,
  umpireSpread,
  umpireTails,
  UMPIRE_SORTS,
  MIN_UMPIRE_GAMES,
} from '../../../api/around-the-game/absChallenges.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { DivergingBarCell } from '../../../components/around-the-game/BroadcastBar.jsx'
import { UmpireLink } from '../../../components/umpire/UmpireLink.jsx'
import { commas, num2, pct1 } from './format.js'

// THE PLATE UMPIRES — how often each man's zone is argued with, and how often
// the argument wins.
//
// The sort chips live here for the same reason the club board's do: the chip,
// the ranking and the column are one mechanism.
//
// TWO THINGS MAKE THIS BOARD DIFFERENT FROM THE CLUB BOARD BESIDE IT.
//
// The per-game column is a bar measured from the LEAGUE RATE, not from zero.
// Drawn from zero, thirty-odd umpires between 3.13 and 5.40 are thirty near
// identical bars; drawn from 4.18, the same column says "more" or "less" in
// one glance. That is the whole spread — 2.27 challenges a game between the
// most argued-with man and the least — and it is a fact about umpires worth
// seeing rather than reading off.
//
// And the board shows BOTH ENDS rather than one. A diverging bar whose view
// only ever reaches the loud end leaves the left half of every track
// permanently empty, which buys nothing over a plain bar. So the head and the
// tail sit on one board with the count of everybody between them
// (`umpireTails`), and that middle is by construction the part with nothing to
// say: a man near the league rate draws a stub whichever way he leans.
//
// NOTHING TO SAY IS NOT NOTHING TO LOOK UP, which the two-ended board forgot.
// It reached 12 of MLB's 87 qualifying umpires, and the ordinary use of this
// page is a reader checking the man working tonight's plate — who is in the
// middle 75 six times out of seven, with no row, no rank and no link to his
// page. So the whole board is one tap away. The two ends stay the default,
// because that is the view the bar is drawn for; `showAll` swaps in every
// qualifying man, in the same order, with the same ranks.

export function UmpireBoard({ summary }) {
  const [umpSort, setUmpSort] = useState('rate')
  const [showAll, setShowAll] = useState(false)
  // The control names the table it opens, and the id is generated rather than
  // written down: a page that ever renders two of these boards would otherwise
  // give both the same one, and `aria-controls` would point at whichever came
  // first.
  const boardId = useId()
  const umps = useMemo(() => (summary ? umpireBoard(summary, umpSort) : []), [summary, umpSort])

  // The league's own rate is the baseline every bar is measured from, and the
  // widest margin on it is the scale. Both come off the whole qualifying
  // board, so changing the sort re-orders the rows without re-scaling them.
  const league = summary?.perGame ?? null
  const spread = useMemo(() => umpireSpread(umps, league), [umps, league])
  const { head, tail, between } = useMemo(() => umpireTails(umps), [umps])

  const Row = (u) => (
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
      <td>
        <DivergingBarCell value={u.perGame} center={league} span={spread}>
          {num2(u.perGame)}
        </DivergingBarCell>
      </td>
      <td>{commas(u.success)}</td>
      <td>{pct1(u.rate)}</td>
    </tr>
  )

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
        <table className="standings rpt" id={boardId}>
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
              {/* The baseline the bar is drawn from, named in the head it
                  belongs to. A diverging bar with an unlabelled centre is a
                  chart a reader has to guess the middle of. */}
              <th>
                Per game
                {league != null && <span className="rpt__sub">Against {num2(league)}</span>}
              </th>
              <th>Overturned</th>
              <th>Overturn rate</th>
            </tr>
          </thead>
          <tbody>
            {showAll ? (
              umps.map(Row)
            ) : (
              <>
                {head.map(Row)}
                {between > 0 && (
                  <tr className="rpt__between">
                    <th scope="row" className="team">
                      {commas(between)} more between them
                    </th>
                    <td colSpan={5} />
                  </tr>
                )}
                {tail.map(Row)}
              </>
            )}
          </tbody>
        </table>
      </BoardScroller>

      {/* UNDER THE BOARD, NOT IN IT. The table sits inside a BoardScroller, and
          a control placed in a scrolling box travels out from under the finger
          reaching for it. It appears only when there is a middle to open —
          a Triple-A board thin enough to be returned whole has nothing to
          show that is not already on screen. */}
      {between > 0 && (
        <button
          type="button"
          className="rpt-expand"
          aria-expanded={showAll}
          aria-controls={boardId}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show the two ends' : `Show all ${commas(umps.length)}`}
        </button>
      )}
    </BroadcastSection>
  )
}
