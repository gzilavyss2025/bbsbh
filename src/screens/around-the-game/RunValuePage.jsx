import '../../styles/68-around-the-game.css'
import '../../styles/report/chrome.css'
import { useMemo, useState } from 'react'
import {
  COMPONENTS,
  MIN_ABS_RUNS,
  ROLES,
  board,
  clubBoard,
  componentBoard,
  fetchRunValue,
  signed,
} from '../../api/around-the-game/runValue.js'
import { loadClubs, clubShort } from '../../api/around-the-game/clubs.js'
import { groupLabelFor } from '../../lib/reportPages.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { PlayerNameplate, RunCell } from '../../components/around-the-game/RunValueParts.jsx'

// RUN VALUE LEADERS — the one board in this app where a centre fielder's glove,
// a leadoff man's legs and a starter's arm can be compared, because all three
// are measured in the same thing: runs.
//
// THE ARGUMENT THE PAGE MAKES. Every other leader board here ranks one skill in
// its own units — home runs, ERA, stolen bases — and leaves a reader to guess
// how twenty home runs stack against a season of elite defense. Baseball Savant
// scores each of the four things a player does against the run expectancy it
// moved, which puts them all on one scale and makes the addition real. So the
// total leads, the four components sit beside it in the order a player meets
// them in a game, and everything below asks who is best at one of them.
//
// CONTEXT NEUTRAL, and the masthead's meta row says so in two words. Every
// event is scored off the generic run-expectancy table, never off the leverage
// of the game it happened in (see scripts/gen-run-value.mjs). This says how
// much a player DID, not what it happened to be worth to his club's record on
// the night.
//
// THE PAGE SHOWS, IT DOES NOT EXPLAIN. There is no dek, no note under a section
// heading and no "how this was counted" essay: a board of signed runs under a
// column key needs none of them, and six hundred words of prose around four
// tables buries the tables. What survives is what a figure cannot be read
// without — the column key under the board, and the source line at the foot.
// Anything longer belongs in this comment or in docs/, not on the page.
//
// SPOILER-FREE. A season aggregate off a nightly file, over completed games —
// the same footing as every other open season board (ADR-0034).
//
// It wears the broadcast masthead but is filed under "This season" beside
// League Leaders (src/lib/reportPages.js), the same call /abs-challenges made.
// The masthead chip reads that group back rather than naming the package.

const RUN_VALUE_PATH = '/run-value'
const BOARD_LIMIT = 25
const COMPONENT_LEADERS = 5

// A component's column head, ABBREVIATED. Five numeric columns beside a
// nameplate carrying a face do not fit a phone at all with "Batting" /
// "Defense" / "Running" / "Pitching" over them — the last two scrolled off a
// 430px viewport entirely, and a board whose columns a reader has to go looking
// for is a board they read the first two columns of. Short heads bring all five
// on screen at once.
//
// The full word is still announced, and still printed: the visually-hidden span
// carries it for a screen reader (the column head is what names each figure in
// a row), and the key under the board pairs every abbreviation with its word.
// So nothing is available only as an abbreviation.
function shortHead(c) {
  return (
    <>
      <span aria-hidden="true">{c.short}</span>
      <span className="sr-only">{c.label}</span>
    </>
  )
}

export function RunValuePage() {
  useDocumentTitle('Run Value Leaders')
  const [role, setRole] = useState('all')
  const [direction, setDirection] = useState('desc')
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchRunValue(), [])
  const { data: clubs } = useAsync(() => loadClubs([1]), [])

  const rows = useMemo(
    () => board(data, { role, direction, limit: BOARD_LIMIT }),
    [data, role, direction],
  )
  // The whole board, unlimited, for the figures the slabs quote — a leader is a
  // fact about the league, not about the twenty-five rows on screen.
  const everyone = useMemo(() => board(data), [data])
  const leaders = useMemo(
    () =>
      COMPONENTS.map((c) => ({
        ...c,
        rows: componentBoard(data, c.key, { limit: COMPONENT_LEADERS }),
      })).filter((c) => c.rows.length > 0),
    [data],
  )
  const byClub = useMemo(() => clubBoard(data), [data])

  const best = everyone[0] ?? null
  const worst = everyone[everyone.length - 1] ?? null
  const glove = leaders.find((c) => c.key === 'fld')?.rows[0] ?? null
  const twoWay = useMemo(
    () =>
      everyone.filter(
        (p) => Math.abs(p.pit) >= MIN_ABS_RUNS && Math.abs(p.bat) >= MIN_ABS_RUNS,
      ).length,
    [everyone],
  )

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        strand={groupLabelFor(RUN_VALUE_PATH)}
        eyebrow="Run Value"
        title="Run Value Leaders"
        meta={[
          { label: 'Season', value: data?.season ?? '—' },
          {
            label: 'Through',
            value: data?.generatedAt ? humanDateWithYear(data.generatedAt.slice(0, 10)) : '—',
          },
          { label: 'Players', value: everyone.length || '—' },
          { label: 'Leverage', value: 'Context neutral' },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={everyone.length > 0}
        errorMessage="Couldn’t load the run value board. Try again."
        emptyMessage="No run values on file for this season yet."
        emptyProse
      />

      {everyone.length > 0 && (
        <>
          <SlabRow>
            <Slab
              tone="lead"
              value={best ? signed(best.value) : '—'}
              label="Best season"
              note={best ? `${best.name}${best.pos ? ` · ${best.pos}` : ''}` : ''}
            />
            <Slab
              value={glove ? signed(glove.value) : '—'}
              label="Best with the glove"
              note={glove ? `${glove.name}${glove.pos ? ` · ${glove.pos}` : ''}` : '—'}
            />
            <Slab
              value={twoWay || '—'}
              label="Two-way seasons"
              note={`±${MIN_ABS_RUNS} run or more with the bat and on the mound`}
            />
            <Slab
              value={worst ? signed(worst.value) : '—'}
              label="Hardest season"
              note={worst ? `${worst.name}${worst.pos ? ` · ${worst.pos}` : ''}` : ''}
            />
          </SlabRow>

          <BroadcastSection title="The board">
            <div className="rpt-controls" role="group" aria-label="Choose who to rank">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`rpt-chip${r.key === role ? ' is-on' : ''}`}
                  aria-pressed={r.key === role}
                  onClick={() => setRole(r.key)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="rpt-controls" role="group" aria-label="Choose which end of the board">
              <button
                type="button"
                className={`rpt-chip${direction === 'desc' ? ' is-on' : ''}`}
                aria-pressed={direction === 'desc'}
                onClick={() => setDirection('desc')}
              >
                Best first
              </button>
              <button
                type="button"
                className={`rpt-chip${direction === 'asc' ? ' is-on' : ''}`}
                aria-pressed={direction === 'asc'}
                onClick={() => setDirection('asc')}
              >
                Worst first
              </button>
            </div>

            <BoardScroller label="Run value leaders">
              <table className="standings rpt rv__board">
                <thead>
                  <tr>
                    <th className="team">Player</th>
                    <th>Total</th>
                    {COMPONENTS.map((c) => (
                      <th key={c.key}>{shortHead(c)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                    >
                      <PlayerNameplate
                        player={r}
                        rank={r.rank}
                        tied={r.tied}
                        sub={r.pos ?? undefined}
                      />
                      <RunCell value={r.value} strong />
                      {COMPONENTS.map((c) => (
                        <RunCell key={c.key} value={r[c.key]} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>

            <dl className="rptkey">
              {COMPONENTS.map((c) => (
                <div key={c.key} className="rptkey__pair">
                  <dt>{c.short}</dt>
                  <dd>{c.label}</dd>
                </div>
              ))}
            </dl>
          </BroadcastSection>

          <BroadcastSection title="Best at one thing">
            <div className="rvleaders">
              {leaders.map((c) => (
                <BoardScroller key={c.key} label={`${c.label} run value leaders`}>
                  <table className="standings rpt rv__board">
                    <thead>
                      <tr>
                        <th className="team">{c.label}</th>
                        <th>Runs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.rows.map((r) => (
                        <tr
                          key={r.id}
                          className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                        >
                          <PlayerNameplate player={r} rank={r.rank} tied={r.tied} />
                          <RunCell value={r.value} strong />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </BoardScroller>
              ))}
            </div>
          </BroadcastSection>

          <BroadcastSection title="By club">
            <BoardScroller label="Run value by club">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Total</th>
                    {COMPONENTS.map((c) => (
                      <th key={c.key}>{shortHead(c)}</th>
                    ))}
                    <th>Players</th>
                  </tr>
                </thead>
                <tbody>
                  {byClub.map((r) => (
                    <tr
                      key={r.teamId}
                      className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                    >
                      <ClubCell
                        teamId={r.teamId}
                        name={clubShort(clubs, r.teamId)}
                        rank={r.rank}
                        tied={r.tied}
                        tab="numbers"
                      />
                      <RunCell value={r.value} strong />
                      {COMPONENTS.map((c) => (
                        <RunCell key={c.key} value={r[c.key]} />
                      ))}
                      <td className="rv__num">{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>
          </BroadcastSection>

          {/* THE SOURCE LINE, not a method essay. Four hundred words of "how
              this was counted" under its own heading is the page explaining
              itself instead of showing itself. What a reader needs from it is
              where the figures came from and the two constraints that change
              how a figure READS — the board's floor, and the rounding that lets
              four printed columns miss the printed total by one. Those are
              facts about the data, so they sit in the data's own caption. */}
          <p className="rptsource">
            Baseball Savant swing/take, fielding and baserunning run value · Context neutral ·
            Stored to 0.1 run and printed whole, so the columns can miss the total by one ·
            Main board floor ±{MIN_ABS_RUNS} run, single-skill boards none · Pitcher or position
            player is decided by which half of a season was the larger
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
