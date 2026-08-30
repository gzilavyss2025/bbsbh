import '../../styles/68-around-the-game.css'
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
// CONTEXT NEUTRAL, and the masthead says so. Every event is scored off the
// generic run-expectancy table, never off the leverage of the game it happened
// in (see scripts/gen-run-value.mjs). This says how much a player DID, not what
// it happened to be worth to his club's record on the night.
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
// a row), and the legend under the board defines all four in full. So nothing is
// available only as an abbreviation.
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
        dek="Everything a player does, in runs. Baseball Savant scores each swing, each play in
             the field, each time on the bases and each pitch thrown against the runs it moved —
             so a glove, a pair of legs and an arm can finally be added to a bat."
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
              note={best ? `${best.name} — and the four columns below say how.` : ''}
            />
            <Slab
              value={leaders.find((c) => c.key === 'fld')?.rows[0]
                ? signed(leaders.find((c) => c.key === 'fld').rows[0].value)
                : '—'}
              label="Best with the glove"
              note={
                leaders.find((c) => c.key === 'fld')?.rows[0]?.name ??
                'Not computed yet.'
              }
            />
            <Slab
              value={twoWay || '—'}
              label="Players on both sides"
              note="Men worth at least a run with the bat AND on the mound. The one column no
                    other leader board on this site can hold."
            />
            <Slab
              value={worst ? signed(worst.value) : '—'}
              label="Hardest season"
              note={
                worst
                  ? `${worst.name}. A season this far below average is as hard to have as one far
                     above it.`
                  : ''
              }
            />
          </SlabRow>

          <BroadcastSection
            title="The board"
            note="Total first, then the four things it is made of. A component a player has none
                  of reads as a plain zero, not a blank: a designated hitter really did field
                  nothing, and that is part of the answer."
          >
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

            <dl className="rvlegend">
              {COMPONENTS.map((c) => (
                <div key={c.key}>
                  <dt className="rvlegend__term">{c.label}</dt>
                  <dd className="rvlegend__def">{c.about}</dd>
                </div>
              ))}
            </dl>
          </BroadcastSection>

          <BroadcastSection
            title="Best at one thing"
            note="Each of the four on its own, across everybody — the best fielding season in
                  baseball is the best fielding season in baseball, whoever it belongs to. No
                  total floor applies here: a bat a run from average can still lead the league
                  with the glove."
          >
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

          <BroadcastSection
            title="By club"
            note="Every club's men added up, counted for the club that holds each of them today.
                  A player traded in July brings his whole season with him, because Savant carries
                  one current club per player and no split — so read this as a roster, not as a
                  club's season."
          >
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

          <section className="method">
            <h2>How this was counted</h2>
            <p>
              <strong>Four Baseball Savant leaderboards, added on one scale.</strong> Batting and
              pitching both come from the swing/take board — the same pitch-by-pitch scoring read
              from the two sides of the plate, which is why a two-way player is the one man who
              carries both. Defense comes from the fielding run value board: range, arm and double
              plays, and for a catcher framing, blocking and throwing. Baserunning comes from the
              baserunning run value board: taking the extra base, and stealing it. A player missing
              from a board contributes nothing to that column.
            </p>
            <p>
              <strong>The total is summed before it is rounded, so it can differ from the
              columns.</strong> Every figure here is stored to a tenth of a run and printed as a
              whole one. Add the four printed columns of the leader and you may get one less than
              the printed total — that is the rounding, not an error, and it is how the source
              publishes it too.
            </p>
            <p>
              <strong>Context neutral, always.</strong> Savant also publishes a leverage-weighted
              version of the swing/take figures, which weighs a swing by how much the game hung on
              it. This page takes the neutral one on purpose: a leverage-weighted number answers
              how much a season helped one club win, and cannot be compared across the four skills
              or across clubs.
            </p>
            <p>
              <strong>A player has to have moved a run to reach the main board.</strong> Without a
              floor the foot of it fills with September call-ups a fraction of a run from average
              on twenty plate appearances — true, and not what anybody came to read. The floor is
              one run in either direction, and it is stated here rather than applied quietly. The
              four single-skill boards above apply no such floor.
            </p>
            <p>
              <strong>Pitcher or position player is decided by the numbers, not by a
              position.</strong> A man is a pitcher here when his mound work is the larger half of
              what he did. A reliever who has taken an at-bat is still a pitcher; a position player
              who mopped up an inning is still a position player; and a two-way player lands on
              whichever side his own season puts him, which is the only answer that stays right as
              a season moves.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
