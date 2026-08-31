import '../../styles/68-around-the-game.css'
import '../../styles/report/chrome.css'
import { useMemo, useState } from 'react'
import {
  fetchAbsChallenges,
  levelsIn,
  summaryFor,
  teamBoard,
  umpireBoard,
  playerBoards,
  roleRows,
  callSplitAnomalies,
  missBands,
  TEAM_SORTS,
  UMPIRE_SORTS,
  ROLE_CALL,
  ROLE_LABEL,
  ROLE_IN_PROSE,
  MIN_UMPIRE_GAMES,
} from '../../api/around-the-game/absChallenges.js'
import { loadClubs, clubName, clubShort } from '../../api/around-the-game/clubs.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { groupLabelFor } from '../../lib/reportPages.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { UmpireLink } from '../../components/umpire/UmpireLink.jsx'
import { BroadcastMasthead, BroadcastSection } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { BarCell } from '../../components/around-the-game/BroadcastBar.jsx'

// THE CHALLENGE SYSTEM — the first season anybody could argue with the plate
// umpire and win on the spot.
//
// 2026 is the ABS Challenge System's first MLB season, after several in
// Triple-A. A club is issued two challenges. A batter can call for one on a
// called strike; a catcher or a pitcher can call for one on a called ball. The
// club keeps the challenge when the call is overturned and loses it when the
// call stands. Nobody publishes what that has added up to across a season, so
// this page does.
//
// THE ARGUMENT THE PAGE MAKES. A success rate on its own is a curiosity. What
// makes the system worth reporting is what it MOVED: every overturn takes the
// umpire's call off the board and puts the correct one back, and that swing
// can be measured in runs with the same run-expectancy table the box score's
// umpire row and the season umpire pages already use. So the runs lead, the
// rate sits beside them, and everything below asks who is good at this.
//
// AND IT MAKES THAT ARGUMENT IN FIGURES, NOT IN PROSE. There is no dek, no note
// under a section heading and no "how this was counted" essay: eight hundred
// words wrapped around six boards buries the boards, and every one of those
// sentences was the page telling a reader what the table beside it already
// showed. What a figure genuinely cannot be read without stays, moved to where
// it is read — a sample floor into the column head it qualifies, the call under
// review into the row header of the man who asked — and the provenance sits in
// one source line at the foot. Anything longer belongs in this comment, in
// scripts/gen-abs-challenges.mjs, or in docs/. Not on the page.
//
// SPOILER-FREE. A challenge is a ball-strike judgment, not a run
// (api/around-the-game/absChallenges.js). Nothing on this page reads a score,
// and no game's result can be read back out of it.
//
// It wears the broadcast package's masthead and boards because it is the same
// kind of page, but it is filed in the menu under "This season" beside Umpire
// Rankings — see src/lib/reportPages.js. The masthead chip reads that group
// back rather than naming the package.

const ABS_PATH = '/abs-challenges'

const pct1 = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`)
const num1 = (x) => (x == null ? '—' : x.toFixed(1))
const num2 = (x) => (x == null ? '—' : x.toFixed(2))
const commas = (n) => (n == null ? '—' : n.toLocaleString('en-US'))
const inches = (x) => (x == null ? '—' : `${x.toFixed(1)} in`)

// The club board's numeric columns, held as data so the header row and the
// body cannot fall out of step.
const TEAM_COLUMNS = [
  { key: 'n', label: 'Called', render: (r) => commas(r.n) },
  { key: 'perGame', label: 'Per game', render: (r) => num2(r.perGame) },
  { key: 'success', label: 'Won', render: (r) => commas(r.success) },
  { key: 'rate', label: 'Success', render: (r) => pct1(r.rate) },
  { key: 'ranOut', label: 'Ran out', render: (r) => commas(r.ranOut) },
]

export function AbsChallengesPage() {
  useDocumentTitle('ABS Challenges')
  const [level, setLevel] = useState('MLB')
  const [teamSort, setTeamSort] = useState('rate')
  const [umpSort, setUmpSort] = useState('rate')
  const { favoriteTeamId } = useFavoriteTeam()

  const { loading, error, data } = useAsync(() => fetchAbsChallenges(), [])
  // MLB and Triple-A both, because both run the system and both are on the
  // board. Club ids never collide across levels, so one lookup covers them.
  const { data: clubs } = useAsync(() => loadClubs([1, 11]), [])

  const levels = useMemo(() => levelsIn(data), [data])
  const shown = levels.some((l) => l.key === level) ? level : (levels[0]?.key ?? 'MLB')
  const summary = summaryFor(data, shown)

  const teams = useMemo(() => (summary ? teamBoard(summary, teamSort) : []), [summary, teamSort])
  const umps = useMemo(() => (summary ? umpireBoard(summary, umpSort) : []), [summary, umpSort])
  const players = useMemo(() => (summary ? playerBoards(summary) : null), [summary])
  const roles = useMemo(() => (summary ? roleRows(summary) : []), [summary])
  const bands = useMemo(() => (summary ? missBands(summary) : []), [summary])
  const anomalies = useMemo(() => (summary ? callSplitAnomalies(summary) : []), [summary])

  const teamSortKey = TEAM_SORTS.find((s) => s.key === teamSort)?.key ?? 'rate'
  const teamValues = teams.map((r) => r[teamSortKey]).filter((v) => v != null)
  const teamMin = teamValues.length ? Math.min(...teamValues) * 0.9 : 0
  const teamMax = teamValues.length ? Math.max(...teamValues) : 1
  const roleMax = roles.reduce((m, r) => (r.rate != null && r.rate > m ? r.rate : m), 0)
  const bandMax = bands.reduce((m, b) => (b.share != null && b.share > m ? b.share : m), 0)
  const big = summary?.biggest ?? null

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        strand={groupLabelFor(ABS_PATH)}
        eyebrow="The Challenge System"
        title="ABS Challenges"
        meta={[
          { label: 'Level', value: shown === 'AAA' ? 'Triple-A' : 'MLB' },
          { label: 'Season', value: data?.season ?? '—' },
          {
            label: 'Through',
            value: summary?.lastDate ? humanDateWithYear(summary.lastDate) : '—',
          },
          { label: 'Games', value: commas(summary?.games) },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={(summary?.total ?? 0) > 0}
        errorMessage="Couldn’t load the challenge board. Try again."
        emptyMessage="No challenges on file for this season yet."
        emptyProse
      />

      {summary && summary.total > 0 && (
        <>
          {levels.length > 1 && (
            <div className="rpt-controls" role="group" aria-label="Choose a level">
              {levels.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className={`rpt-chip${l.key === shown ? ' is-on' : ''}`}
                  aria-pressed={l.key === shown}
                  onClick={() => setLevel(l.key)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          <SlabRow>
            <Slab
              tone="lead"
              value={num1(summary.runsRecovered)}
              label="Runs put back"
              note={`Over ${commas(summary.success)} overturned calls`}
            />
            <Slab
              value={pct1(summary.successRate)}
              label="Challenges won"
              note={`${commas(summary.success)} of ${commas(summary.total)}`}
            />
            <Slab
              value={num2(summary.perGame)}
              label="Challenges per game"
              note={`${pct1(
                summary.games ? summary.gamesWithChallenge / summary.games : null,
              )} of ${commas(summary.games)} games had one`}
            />
            <Slab
              value={big ? num2(big.runs) : '—'}
              label="Biggest single overturn"
              note={big ? `${big.playerName} · ${humanDateWithYear(big.date)}` : '—'}
            />
          </SlabRow>

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
            {/* The anomaly line has to carry its own antecedent now: it used to
                read "do not follow that rule", where "that rule" lived in the
                section note above it. */}
            {anomalies.length > 0 && (
              <p className="hint">
                {commas(anomalies.reduce((n, a) => n + a.n, 0))} challenges sit outside that
                split — the feed recorded a review of a call the challenger’s job cannot ask for.
              </p>
            )}
          </BroadcastSection>

          <BroadcastSection title="The clubs">
            <div className="rpt-controls" role="group" aria-label="Sort the club board">
              {TEAM_SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`rpt-chip${s.key === teamSort ? ' is-on' : ''}`}
                  aria-pressed={s.key === teamSort}
                  onClick={() => setTeamSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <BoardScroller label="Challenge board, every club">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    {TEAM_COLUMNS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((r) => (
                    <tr
                      key={r.teamId}
                      className={r.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                    >
                      <ClubCell
                        teamId={r.teamId}
                        name={clubShort(clubs, r.teamId)}
                        rank={r.rank}
                        tied={r.tied}
                        sub={`${commas(r.games)} games`}
                      />
                      {TEAM_COLUMNS.map((c) =>
                        c.key === teamSortKey ? (
                          <td key={c.key}>
                            <BarCell value={r[c.key]} min={teamMin} max={teamMax}>
                              {c.render(r)}
                            </BarCell>
                          </td>
                        ) : (
                          <td key={c.key}>{c.render(r)}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>
          </BroadcastSection>

          {/* TWO BOARDS, TWO TABLES. These are two independent rankings, and
              they used to be zipped into ONE table by row index — row 3 of the
              count board sharing a <tr> with row 3 of the rate board, which
              relates two men who have nothing to do with each other, and puts
              the first board's Won/Called columns BETWEEN the two names.

              It also broke the sticky column outright. `.rpt th.team` pins the
              row-header cell to left:0 so the figures scroll under it; with a
              second `.team` cell in the same row BOTH pinned to left:0, the
              right-hand board's name column slid on top of the left-hand one on
              any horizontal scroll — at 390px, 146px in, "Best success rate"
              painted over "Most calls overturned" and clipped every name on the
              left board mid-word, with the Won/Called columns hidden underneath.
              One sticky column per table is the invariant; two tables keep it. */}
          {players && (
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
          )}

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
                        a paragraph above the board. */}
                    <th className="team">
                      Umpire
                      <span className="rpt__sub">Minimum {MIN_UMPIRE_GAMES} games</span>
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

          {big && (
            <BroadcastSection title="The biggest overturn of the season">
              <SlabRow>
                <Slab
                  tone="lead"
                  value={num2(big.runs)}
                  label="Runs on one pitch"
                  note={`${inches(big.missInches)} off the edge`}
                />
                <Slab
                  value={`${big.half === 'top' ? 'Top' : 'Bottom'} ${big.inning}`}
                  label="When"
                  note={humanDateWithYear(big.date)}
                />
                <Slab
                  value={clubShort(clubs, big.teamId)}
                  label="Challenged"
                  note={`Against ${clubName(clubs, big.oppId)}`}
                />
                <Slab
                  value={big.callType === 'strike' ? 'Strike' : 'Ball'}
                  label="What was called"
                  note="Overturned"
                />
              </SlabRow>
              {/* The space before the comma was a stray {' '} after the player
                  link, and it printed: "Iván Herrera , the catcher, asked…". */}
              <p className="hint">
                <PlayerLink id={big.playerId} name={big.playerName}>
                  {big.playerName}
                </PlayerLink>
                , {ROLE_IN_PROSE[big.role] ?? 'the club'}, asked for the review, and{' '}
                {big.umpireId ? (
                  <UmpireLink id={big.umpireId} name={big.umpireName}>
                    {big.umpireName}
                  </UmpireLink>
                ) : (
                  'the plate umpire'
                )}
                ’s call did not stand.
              </p>
            </BroadcastSection>
          )}

          {/* THE SOURCE LINE, not a method essay — see RunValuePage for the
              argument. What survives here is the provenance, the scope, and the
              one thing a reader cannot infer from the boards: the run figures
              are run EXPECTANCY, not runs that scored. The feed's corrected-call
              trap and the buffered-zone geometry are the generator's problem,
              written up in scripts/gen-abs-challenges.mjs where the code that
              has to get them right can be read beside them. */}
          <p className="rptsource">
            One row per ABS review, from each completed game’s own feed · Regular season and
            postseason, no All-Star Game · Runs are run expectancy moved, not runs that scored ·
            Distance is measured from the buffered rule-book zone, per batter
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
