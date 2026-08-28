import '../../styles/68-around-the-game.css'
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
        dek="Every ball-strike challenge of the season: who called for one, who was right, which
             plate umpires get overturned, and how many runs the whole thing has moved. A club is
             issued two, keeps one each time it wins, and loses one each time it does not."
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
              note={`Across ${commas(summary.success)} overturned calls — the run expectancy each
                     one moved off the umpire’s call and onto the correct one, added up.`}
            />
            <Slab
              value={pct1(summary.successRate)}
              label="Challenges won"
              note={`${commas(summary.success)} of ${commas(summary.total)}. Close to a coin
                     flip, which is what a rule that costs a club nothing to lose produces.`}
            />
            <Slab
              value={num2(summary.perGame)}
              label="Challenges per game"
              note={`Over ${commas(summary.games)} games. ${pct1(
                summary.games ? summary.gamesWithChallenge / summary.games : null,
              )} of games saw at least one.`}
            />
            <Slab
              value={big ? num2(big.runs) : '—'}
              label="Biggest single overturn"
              note={
                big
                  ? `${big.playerName}, ${humanDateWithYear(big.date)} — see below.`
                  : 'Not computed yet.'
              }
            />
          </SlabRow>

          <BroadcastSection
            title="Who calls for one"
            note="A batter can only challenge a called STRIKE, and a catcher or a pitcher can only
                  challenge a called BALL — so who asks for the review and which kind of call is
                  under review are one fact, not two. That is the comparison worth having: the
                  hitter saw the pitch from the box, the catcher caught it, and the pitcher was
                  sixty feet away."
          >
            <BoardScroller label="Challenge success rate by who called for it">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Called by</th>
                    <th>Reviewing</th>
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
                      </th>
                      <td>
                        {ROLE_CALL[r.role] === 'strike'
                          ? 'A called strike'
                          : ROLE_CALL[r.role] === 'ball'
                            ? 'A called ball'
                            : '—'}
                      </td>
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
            {anomalies.length > 0 && (
              <p className="hint">
                {commas(anomalies.reduce((n, a) => n + a.n, 0))} challenges this season do not
                follow that rule. The feed recorded a review of a call the challenger’s job should
                not be able to ask for, so the two splits disagree.
              </p>
            )}
          </BroadcastSection>

          <BroadcastSection
            title="The clubs"
            note="Bars are scaled across the league’s own range on the sorted column, not from
                  zero. “Ran out” counts the games a club spent both of its challenges and had
                  none left — the cost of a lost challenge is never the run it did not save, it
                  is the call later in the game it can no longer argue."
          >
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

          {players && (
            <BroadcastSection
              title="The players"
              note={`Two boards, because they answer different questions. The first is who has won
                     the most reviews outright; the second is who is RIGHT most often, and needs a
                     floor — ${players.minChallenges} challenges — or a man who called for one
                     review and won it would top the league. ${commas(players.qualified)} players
                     clear it.`}
            >
              <BoardScroller label="Most overturned calls won, and best success rate">
                <table className="standings rpt">
                  <thead>
                    <tr>
                      <th className="team">Most calls overturned</th>
                      <th>Won</th>
                      <th>Called</th>
                      <th className="team">Best success rate</th>
                      <th>Success</th>
                      <th>Called</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.byCount.map((p, i) => {
                      const q = players.byRate[i]
                      return (
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
                          <td className="team">
                            {q ? (
                              <>
                                <PlayerLink id={q.playerId} name={q.name}>
                                  {q.name}
                                </PlayerLink>
                                <span className="rpt__sub">
                                  {clubShort(clubs, q.teamId)} — {ROLE_LABEL[q.role] ?? q.role}
                                </span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{q ? pct1(q.rate) : '—'}</td>
                          <td>{q ? commas(q.n) : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </BoardScroller>
            </BroadcastSection>
          )}

          <BroadcastSection
            title="The plate umpires"
            note={`Which umpires get overturned, over the ${MIN_UMPIRE_GAMES}-game floor a rate
                   needs to mean anything. THIS IS NOT THE UMPIRE RANKINGS NUMBER. That board
                   scores every called pitch of a man’s season against the zone; this one scores
                   only the pitches somebody thought were wrong, which is a small, self-selected
                   set. A man can sit high on one and low on the other, and neither is mistaken.`}
          >
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
                    <th className="team">Umpire</th>
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

          <BroadcastSection
            title="How close was the call"
            note="Every challenged pitch, measured from the nearest edge of the strike zone. The
                  question is whether the system is catching howlers or coin flips — and the
                  answer is mostly coin flips, which is what the middle of a rule-book zone plus
                  one baseball’s width looks like from the batter’s box."
          >
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
            <BroadcastSection
              title="The biggest overturn of the season"
              note="One call, measured the same way the whole page is: how much run expectancy the
                    correction moved."
            >
              <SlabRow>
                <Slab
                  tone="lead"
                  value={num2(big.runs)}
                  label="Runs on one pitch"
                  note={`${inches(big.missInches)} off the edge of the zone.`}
                />
                <Slab
                  value={`${big.half === 'top' ? 'Top' : 'Bottom'} ${big.inning}`}
                  label="When"
                  note={humanDateWithYear(big.date)}
                />
                <Slab
                  value={clubShort(clubs, big.teamId)}
                  label="Challenged"
                  note={`Against ${clubName(clubs, big.oppId)}.`}
                />
                <Slab
                  value={big.callType === 'strike' ? 'Strike' : 'Ball'}
                  label="What was called"
                  note="…and what the challenge took off the board."
                />
              </SlabRow>
              <p className="hint">
                <PlayerLink id={big.playerId} name={big.playerName}>
                  {big.playerName}
                </PlayerLink>{' '}
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

          <section className="method">
            <h2>How this was counted</h2>
            <p>
              <strong>One row per challenge, from the game’s own feed.</strong> Every completed
              game is read once, and each ABS review it carries becomes a row: who asked, what the
              umpire had called, whether it was overturned, which inning, and which plate umpire.
              MLB’s older manager’s-replay reviews look similar in the feed and carry the same
              club id; they are excluded on the review’s own type code, so nothing here counts a
              pickoff argument as a ball-strike challenge.
            </p>
            <p>
              <strong>Both levels that run the system.</strong> MLB started using the challenge
              system this season. Triple-A has run it for several, and its games are on the board
              as their own level rather than blended into MLB’s — different hitters, different
              catchers, different umpires, and a league that has had years to learn the rule.
              Use the switch above the boards to move between them. Regular season and
              postseason count; the All-Star Game does not.
            </p>
            <p>
              <strong>Runs are run expectancy, not runs that scored.</strong> Every base-out-count
              state in baseball has an average number of runs that follow it. An overturned call
              moves the game from one of those states to another, and the difference is what the
              call was worth. It is the same table and the same arithmetic behind the plate
              umpire’s figure in a box score, so the numbers here and there agree by
              construction. A pitch whose tracking is missing contributes nothing to the run
              total and still counts as a challenge.
            </p>
            <p>
              <strong>What the umpire called is not always what the feed prints.</strong> When a
              challenge succeeds, the feed rewrites the pitch to the corrected call — so the
              printed call is the umpire’s own only when the challenge failed. Every call type on
              this page is flipped back where it needs to be. It is the one trap in this data,
              and getting it wrong would put every batter in the catcher’s column.
            </p>
            <p>
              <strong>Distance is measured from the buffered zone.</strong> A pitch is a strike if
              any part of the ball could clip the rule book’s zone — the plate’s half width plus a
              baseball’s radius on every edge, against that batter’s own zone rather than a league
              constant. “Off the edge” is how far the challenged pitch sat from the nearest of
              those four boundaries.
            </p>
          </section>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
