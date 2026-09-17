import { useMemo, useState } from 'react'
import {
  streakBoard,
  streakRoles,
  inGameLossCap,
} from '../../../api/around-the-game/absChallenges.js'
import { clubShort } from '../../../api/around-the-game/clubs.js'
import { useFavoriteTeam } from '../../../hooks/preferences/useFavoriteTeam.js'
import { BroadcastSection } from '../../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../../components/around-the-game/BoardScroller.jsx'
import { Slab, SlabRow } from '../../../components/around-the-game/StatSlab.jsx'
import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { commas } from './format.js'

// LONGEST RUNS — how long a man stayed right, and how long he stayed wrong.
//
// THE SMALL SAMPLE IS THE TRAP, so every row carries the season behind it. A
// run of sixteen out of ninety calls and a run of ten out of fourteen are
// different achievements, and a board that printed the run alone would rank
// them as one. The season total is a COLUMN with a head that says what it is,
// never a sentence under the table — a reader comparing two rows does not have
// a sentence in front of them.
//
// TWO IS NOT A RULE THE PAGE MAY STATE. A club is issued two challenges, so in
// nine innings the second loss ends its argument — and the obvious caption,
// "two is the rulebook and not a record", is FALSE one chip tap away. A club
// that has run out is armed again at the start of every extra inning
// (ADR-0075), 55 club-games on file carry a third failed challenge and every
// one is in extras, and two Triple-A catchers lost three in a row because of
// it. So the figure comes from inGameLossCap(summary), which reads it off the
// season, and the sentence is written around what came back.
//
// THE PIPS ARE COUNTABLE AND A BAR IS NOT. Sixteen wins in a row is sixteen
// separate calls, and the row of pips beside the figure says so; a bar would
// say "a large quantity". They wrap rather than stopping at a cap, because a
// capped row draws the record-holder the same length as the man under him.
//
// ONE CHIP SCALE, USED TWICE. Outcome on the first row, role on the second,
// both `.rpt-chip` — a second, smaller scale with its own on-state would make a
// reader who learned "navy is on" relearn it halfway down the page.
//
// IT READS THE `summary` IT IS HANDED and never the file, so the page's MLB /
// Triple-A chip switches every board and every slab here for free.

// The two season boards, in the order the page offers them.
const CUTS = [
  { key: 'seasonWin', label: 'Won in a row' },
  { key: 'seasonLoss', label: 'Lost in a row' },
]

// The role chips. Held as their own plural labels rather than built from
// ROLE_LABEL: "Someone else" does not take an -s, and a component that edits
// rendered words can drift from the caps invariant (ADR-0017).
const ROLE_CHIP = {
  batter: 'Batters',
  catcher: 'Catchers',
  pitcher: 'Pitchers',
  other: 'Everyone else',
}

// THE LONGEST RUN AT A LEVEL, ACROSS THE THREE ROLES — folded here out of the
// reader's own per-role boards rather than derived again. `streakRoles` has
// already dropped the boards too short to rank (the pitchers' in-game loss
// board is a list of everybody who ever lost one), and `streakBoard` has
// already read the distribution behind each, so this is composition and not a
// second derivation of the same fact.
function topRun(summary, key) {
  const boards = streakRoles(summary, key).map((r) => streakBoard(summary, key, r))
  const max = boards.reduce((m, b) => (b.max > m ? b.max : m), 0)
  if (max === 0) return null
  return {
    max,
    // Every man who reached it, from the full distribution — not only the ones
    // the twelve-row boards happen to name.
    players: boards.reduce((n, b) => n + (b.reached.find((x) => x.run === max)?.n ?? 0), 0),
    leader: boards.flatMap((b) => b.rows).find((r) => r.run === max) ?? null,
  }
}

export function LongestRuns({ summary, clubs }) {
  const [cut, setCut] = useState('seasonWin')
  const [picked, setPicked] = useState(null)
  const { favoriteTeamId } = useFavoriteTeam()

  const roles = useMemo(() => streakRoles(summary, cut), [summary, cut])

  // The board opens on the role that holds the record, not on the first role in
  // page order: a section headed "Longest runs" that opens on the batters buries
  // the catcher who won sixteen. A role the reader picked is kept as long as the
  // cut they switch to has a board for it.
  const deepest = useMemo(() => {
    let best = null
    for (const role of roles) {
      const board = streakBoard(summary, cut, role)
      if (!best || board.max > best.max) best = { role, max: board.max }
    }
    return best?.role ?? null
  }, [summary, cut, roles])

  const shown = picked && roles.includes(picked) ? picked : deepest
  const board = useMemo(
    () => (shown ? streakBoard(summary, cut, shown) : null),
    [summary, cut, shown],
  )

  const tops = useMemo(
    () => ({
      seasonWin: topRun(summary, 'seasonWin'),
      seasonLoss: topRun(summary, 'seasonLoss'),
      gameWin: topRun(summary, 'gameWin'),
    }),
    [summary],
  )
  const cap = useMemo(() => inGameLossCap(summary), [summary])

  if (!board) return null

  const lost = cut === 'seasonLoss'
  const men = (n) => `${commas(n)} ${n === 1 ? 'man' : 'men'}`
  const holder = (top) =>
    top?.leader ? `${top.leader.name} · ${commas(top.leader.success)} of ${commas(top.leader.n)}` : '—'

  return (
    <BroadcastSection title="Longest runs">
      {/* SEASON BESIDE ONE GAME, which is the contrast the section is for: a
          man can be right sixteen times running across a summer and never more
          than five times in one night, because his club runs out of challenges
          long before his judgement does. */}
      <SlabRow>
        <Slab
          tone="lead"
          value={commas(tops.seasonWin?.max)}
          label="Won in a row, a season"
          note={holder(tops.seasonWin)}
        />
        <Slab
          value={commas(tops.seasonLoss?.max)}
          label="Lost in a row, a season"
          note={holder(tops.seasonLoss)}
        />
        <Slab
          value={commas(tops.gameWin?.max)}
          label="Won in a row, one game"
          note={tops.gameWin ? `${men(tops.gameWin.players)} reached it` : '—'}
        />
        <Slab
          value={commas(cap?.max)}
          label="Lost in a row, one game"
          note={cap ? `${men(cap.players)} reached it` : '—'}
        />
      </SlabRow>

      <div className="rpt-controls" role="group" aria-label="Runs of wins or runs of losses">
        {CUTS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={`rpt-chip${c.key === cut ? ' is-on' : ''}`}
            aria-pressed={c.key === cut}
            onClick={() => setCut(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="rpt-controls" role="group" aria-label="Whose runs to rank">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            className={`rpt-chip${role === shown ? ' is-on' : ''}`}
            aria-pressed={role === shown}
            onClick={() => setPicked(role)}
          >
            {ROLE_CHIP[role] ?? role}
          </button>
        ))}
      </div>

      <BoardScroller label={`Longest runs, ${lost ? 'losses' : 'wins'}, ${ROLE_CHIP[shown] ?? shown}`}>
        <table className="standings rpt">
          <thead>
            <tr>
              <th className="team">
                Player
                <span className="rpt__sub">Longest run first</span>
              </th>
              <th>Run</th>
              {/* THE SEASON BEHIND THE RUN, IN A HEAD THAT SAYS SO. It is what
                  lets 10 of 14 and 16 of 90 read as different achievements, and
                  it has to be on the row rather than in a note below the board. */}
              <th>
                Won of called
                <span className="rpt__sub">All season</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r) => (
              <tr
                key={r.playerId}
                className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
              >
                <th scope="row" className="team">
                  <PlayerLink id={r.playerId} name={r.name}>
                    {r.name}
                  </PlayerLink>
                  <span className="rpt__sub">
                    <TeamLink id={r.teamId} name={clubShort(clubs, r.teamId)}>
                      {clubShort(clubs, r.teamId)}
                    </TeamLink>
                  </span>
                  <span
                    className={`rptpips${lost ? ' rptpips--lost' : ''}`}
                    role="img"
                    aria-label={`${r.run} in a row`}
                  >
                    {Array.from({ length: r.run }, (_, i) => (
                      <span key={i} className="rptpips__pip" />
                    ))}
                  </span>
                </th>
                <td>
                  <span className={`rptrun${lost ? ' rptrun--lost' : ''}`}>{commas(r.run)}</span>
                </td>
                <td>
                  {commas(r.success)} of {commas(r.n)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </BoardScroller>

      {/* WHAT THE CUT HIDES. The file ships twelve rows and the whole
          distribution behind them, and this is the distribution's job: a reader
          looking at four men tied at three has to know whether forty more are
          tied with them. */}
      {board.tiedBelow > 0 ? (
        <p className="hint rptprose">
          The board holds the {board.rows.length} longest.{' '}
          {men(board.tiedBelow)} also ran {board.cut} in a row without appearing on it,
          and {commas(board.unshown)} of the{' '}
          {commas(board.unshown + board.rows.length)} men who put a run together at all
          are below the board altogether.
        </p>
      ) : null}

      {/* THE ONE SENTENCE THIS SECTION KEEPS, and the reason it cannot be
          written as a rule: see the header. `cap` is read off the season, so
          the sentence follows the level chip instead of contradicting it. */}
      {cap ? (
        <p className="hint rptprose">
          {cap.max > 2 ? (
            <>
              A club is issued two challenges and loses one each time the call stands,
              so in nine innings a second loss ends its argument for the night. Extra
              innings hand it another one at the start of every inning, and that is the
              whole of the {cap.max}: {men(cap.players)} lost {cap.max} in a row, in a
              game that went long.
            </>
          ) : (
            <>
              A club is issued two challenges and loses one each time the call stands, so
              a second loss ends its argument for the night. That figure is the rulebook
              and not a record — and it is a rule that only holds for nine innings, since
              a club reaching extras is handed another challenge at the start of each
              one, and a long night can carry more.
            </>
          )}
        </p>
      ) : null}
    </BroadcastSection>
  )
}
