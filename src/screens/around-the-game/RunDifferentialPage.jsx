import '../../styles/68-around-the-game.css'
import '../../styles/report/chrome.css'
import { useMemo, useState } from 'react'
import {
  fetchRunDifferential,
  buildReport,
  rate,
  THRESHOLDS,
  DEFAULT_THRESHOLD,
} from '../../api/around-the-game/runDifferential.js'
import { groupLabelFor } from '../../lib/reportPages.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import {
  BroadcastMasthead,
  BroadcastSection,
} from '../../components/around-the-game/BroadcastMasthead.jsx'
import { BoardScroller } from '../../components/around-the-game/BoardScroller.jsx'
import { BarCell, ColumnChart, roundTicks } from '../../components/around-the-game/BroadcastBar.jsx'
import { ClubCell } from '../../components/around-the-game/ClubCell.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'

// THE +200 CLUB — what happens to a club that was not lucky, only better.
//
// A club that outscores the league by two hundred runs over a season did not
// get there on one-run wins. It is the best club in baseball by the measure
// least sensitive to luck. The page asks the obvious next question — so does it
// win the World Series — and the answer is no, most of the time, and the REASON
// changes completely depending on which era you ask in. That change is the
// page, and it is why the board goes back to 1901 rather than to 2000.
//
// THE THRESHOLD IS A CONTROL, NOT A CONSTANT. +200 is the round number people
// ask about, so the page opens there, but the finding has to survive being
// poked at: a reader who suspects the answer is an artefact of one bar can move
// the bar and watch it hold. The reader module folds every number on the page
// from the rows at the chosen threshold, so nothing here is precomputed against
// one of them (api/around-the-game/runDifferential.js).
//
// THE ERA TABLE IS THE ARGUMENT, and the order of the sections is the argument's
// order. The board comes first because it is what the reader came for and it is
// where the surprise is — the 2022 Dodgers won 111 games, outscored the league
// by 334, and won a single postseason game. Then the era table says why: each
// round the bracket gained cut the rate again. Then the clubs that never got in
// at all, because that is the same question asked in the era where the bracket
// was so shallow a second-place club had nowhere to go.
//
// A RATE OVER FIVE CLUB SEASONS IS NOT A RATE, and the page says so rather than
// printing it. The 1969-1993 era holds nine club seasons over +200 at the
// default threshold; four of them won it all, which is 44%, which is not
// meaningfully different from 43% or from 25% on that sample. The era table
// prints the counts first and the percent second, and the section note says
// what the sample is, because the honest version of this finding is the shape
// across five eras and not any one of its numbers.

const PATH = '/run-differential'

// How many rows the board opens on. The full board at the default threshold is
// 107 club seasons, which is a scroll nobody asked for before they have decided
// they care; the button under it opens the rest in place.
const OPENING_ROWS = 25

// What became of a club, in the words the board prints. `lostLater` is the one
// outcome with no fixed wording — the board names the actual round from the
// row, because "lost the NLCS" and "lost the World Series" are the difference
// between one more win and four.
const OUTCOME = {
  ring: { label: 'Won the World Series', tone: 'win' },
  lostWS: { label: 'Lost the World Series' },
  lostLater: { label: null },
  firstExit: { label: null },
  missed: { label: 'Never got in', tone: 'miss' },
  none: { label: 'No postseason that year', tone: 'none' },
  pending: { label: 'Still to come', tone: 'none' },
}

// A round's name, shortened for a table cell. The feed spells every round out
// in full ("AL Championship Series"), which is right in a sentence and four
// times too wide in a column beside a club name and five numbers.
function roundShort(round) {
  if (!round) return ''
  return round
    .replace('Championship Series', 'CS')
    .replace('Division Series', 'DS')
    .replace('Wild Card Series', 'Wild Card')
    .replace('Wild Card Game', 'Wild Card')
}

// The line the board prints in its last column: what happened, and the series
// that ended it. A club that went out in a series it played gets that series by
// name and score, because "out in the NLDS" and "out in the NLDS 0-3" are
// different facts about how close it was.
function OutcomeCell({ row }) {
  const fixed = OUTCOME[row.outcome]
  if (fixed?.label) {
    return <span className={`rdiff__out rdiff__out--${fixed.tone ?? 'plain'}`}>{fixed.label}</span>
  }
  const exit = row.exit
  if (!exit) return <span className="rdiff__out">—</span>
  return (
    <span className="rdiff__out">
      Out in the {roundShort(exit.round)}
      <span className="rdiff__series">
        {exit.w}–{exit.l}
      </span>
    </span>
  )
}

// The era table's own chart: the share of clubs over the bar that won it all,
// one column per era, in the order the bracket deepened. An era with nothing
// settled draws no column rather than a zero — the season being played has
// clubs over the bar and no outcomes at all, and a 0% beside them would read as
// a result.
function RingChart({ eras }) {
  const columns = eras
    .filter((era) => era.decided > 0 && era.rounds != null)
    .map((era) => ({
      key: era.key,
      label: era.rounds === 0 ? 'None' : `${era.rounds} round${era.rounds === 1 ? '' : 's'}`,
      value: rate(era.ring, era.decided) ?? 0,
      note: `${rate(era.ring, era.decided)}%`,
    }))
  if (columns.length < 2) return null
  const max = Math.max(50, ...columns.map((c) => c.value))
  return (
    <ColumnChart
      columns={columns}
      max={max}
      ticks={roundTicks(max, 25)}
      label="Share of clubs at or above the bar that won the World Series, by how many rounds the postseason ran"
    />
  )
}

export function RunDifferentialPage() {
  useDocumentTitle('Run Differential')
  const { data, loading, error } = useAsync(fetchRunDifferential, [])
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [showAll, setShowAll] = useState(false)
  const { favoriteTeamId } = useFavoriteTeam()

  const report = useMemo(() => (data ? buildReport(data, threshold) : null), [data, threshold])

  // The control never offers a bar the file was not built deep enough to
  // answer. The generator's floor is carried in the file for exactly this.
  const steps = THRESHOLDS.filter((t) => t >= (data?.floor ?? 0))
  const rows = report?.rows ?? []
  const shown = showAll ? rows : rows.slice(0, OPENING_ROWS)
  const totals = report?.totals
  const widest = rows.length ? rows[0].diff : 0
  // DERIVED, never asserted. "Every one of them before 1969" and "the last of
  // them in 1954" are both true at the default threshold and both stop being
  // true at some other one, so the page reads the year off the rows it is
  // actually showing rather than stating it.
  const lastMissed = report?.missed.length
    ? Math.max(...report.missed.map((r) => r.season))
    : null

  return (
    <div className="screen">
      <SiteHeader />

      <BroadcastMasthead
        eyebrow="Run Differential"
        title="The +200 Club"
        strand={groupLabelFor(PATH)}
        dekFull
        dek="Every club since 1901 that outscored its opponents by a wide margin over a full
             season — and what happened to it in October. Being the best club in baseball has
             never been the same thing as winning, and it has got harder every time the
             postseason gained a round."
        meta={[
          { label: 'Seasons', value: data ? `${data.firstSeason}–${data.lastSeason}` : '—' },
          { label: 'Over the bar', value: totals ? `${totals.n}` : '—' },
          { label: 'Won it all', value: totals ? `${totals.ring}` : '—' },
        ]}
      />

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={rows.length > 0}
        errorMessage="Couldn’t load the run differential board. Try again."
        emptyMessage="No club seasons on file at this margin."
        emptyProse
      />

      {report && rows.length > 0 && (
        <>
          <div className="rpt-controls" role="group" aria-label="Choose the run margin">
            {steps.map((t) => (
              <button
                key={t}
                type="button"
                className={`rpt-chip${t === threshold ? ' is-on' : ''}`}
                aria-pressed={t === threshold}
                onClick={() => {
                  setThreshold(t)
                  setShowAll(false)
                }}
              >
                +{t}
              </button>
            ))}
          </div>

          <SlabRow>
            <Slab
              tone="lead"
              value={totals.n}
              label={`Club seasons at +${threshold} or better`}
              note={`Since ${data.firstSeason}`}
            />
            <Slab
              value={totals.ring}
              label="Won the World Series"
              note={
                totals.decided
                  ? `${rate(totals.ring, totals.decided)}% of the ${totals.decided} that were settled`
                  : '—'
              }
            />
            <Slab
              value={totals.firstExit}
              label="Out in one series"
              note={
                totals.decided
                  ? `${rate(totals.firstExit, totals.decided)}% lost the first round they played`
                  : '—'
              }
            />
            <Slab
              value={totals.missed}
              label="Never got in"
              note={lastMissed ? `The last of them in ${lastMissed}` : 'None at this margin'}
            />
          </SlabRow>

          {/* THE BOARD. Ordered by margin rather than by season on purpose: the
              question is "who was this far ahead", and the answer reads as a
              ranking. The season is a column, so a reader following the era
              argument can still find a year. */}
          <BroadcastSection
            title={`Every club season at +${threshold} or better`}
            note={`${rows.length} of them since ${data.firstSeason}, widest first. Runs per 162
                   games stretches a 154-game season, a strike year and 2020 onto one scale.`}
          >
            <BoardScroller label={`Club seasons at plus ${threshold} runs or better`}>
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Club</th>
                    <th>Season</th>
                    <th>Record</th>
                    <th>Scored</th>
                    <th>Allowed</th>
                    <th>Margin</th>
                    <th>Per 162</th>
                    <th>What happened next</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr
                      key={`${row.season}-${row.teamId}`}
                      className={row.teamId === favoriteTeamId ? 'rpt__row--mine' : undefined}
                    >
                      <ClubCell
                        teamId={row.teamId}
                        name={row.short}
                        sub={row.name}
                      />
                      <td>{row.season}</td>
                      <td>
                        {row.w}–{row.l}
                      </td>
                      <td>{row.rs}</td>
                      <td>{row.ra}</td>
                      <td>
                        <BarCell value={row.diff} min={0} max={widest}>
                          +{row.diff}
                        </BarCell>
                      </td>
                      <td>+{row.per162}</td>
                      <td>
                        <OutcomeCell row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>

            {rows.length > OPENING_ROWS && (
              <div className="rpt-controls">
                <button
                  type="button"
                  className="rpt-chip"
                  onClick={() => setShowAll((open) => !open)}
                >
                  {showAll ? `Show the top ${OPENING_ROWS}` : `Show all ${rows.length}`}
                </button>
              </div>
            )}
          </BroadcastSection>

          {/* THE ARGUMENT. One row per bracket depth, because the depth is the
              thing that changed — grouping by decade would file 1994, which had
              no postseason at all, next to 1993, which had two rounds. */}
          <BroadcastSection
            title="The bracket got deeper"
            note="Grouped by how many series a club had to win to be champion that year, not by
                  decade. Rates are taken over the club seasons whose postseason has been played
                  and settled, and several of these samples are small — the shape across the
                  eras is the finding, not any single percent."
          >
            <RingChart eras={report.eras} />

            <BoardScroller label="Outcomes by how deep the postseason ran">
              <table className="standings rpt">
                <thead>
                  <tr>
                    <th className="team">Era</th>
                    <th>Seasons</th>
                    <th>Club seasons</th>
                    <th>
                      +{threshold} or better
                      <span className="rpt__sub">per 162</span>
                    </th>
                    <th>Won it all</th>
                    <th>Reached the World Series</th>
                    <th>Out in one series</th>
                    <th>Never got in</th>
                  </tr>
                </thead>
                <tbody>
                  {report.eras.map((era) => (
                    <tr key={era.key}>
                      <th scope="row" className="team">
                        <span className="rdiff__era">{era.label}</span>
                        <span className="rpt__sub">{era.span}</span>
                      </th>
                      <td>{era.seasons.length}</td>
                      <td>{era.clubSeasons}</td>
                      <td>
                        {era.over}
                        <span className="rpt__sub">{era.overPer162}</span>
                      </td>
                      <EraRate part={era.ring} decided={era.decided} />
                      <EraRate part={era.ring + era.lostWS} decided={era.decided} />
                      <EraRate part={era.firstExit} decided={era.decided} />
                      <EraRate part={era.missed} decided={era.decided} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </BoardScroller>
          </BroadcastSection>

          {report.missed.length > 0 && (
            <BroadcastSection
              title="The clubs that never got in"
              note={`One pennant per league and no wild card meant the second-best club in
                    baseball simply went home. Every club here reached the bar and did not play
                    a postseason game${lastMissed ? `, and the last of them did it in ${lastMissed}` : ''}.`}
            >
              <BoardScroller label="Clubs over the bar that played no postseason game">
                <table className="standings rpt">
                  <thead>
                    <tr>
                      <th className="team">Club</th>
                      <th>Season</th>
                      <th>Record</th>
                      <th>Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.missed.map((row) => (
                      <tr key={`miss-${row.season}-${row.teamId}`}>
                        <ClubCell teamId={row.teamId} name={row.short} sub={row.name} />
                        <td>{row.season}</td>
                        <td>
                          {row.w}–{row.l}
                        </td>
                        <td>+{row.diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </BoardScroller>
            </BroadcastSection>
          )}

          {/* THE SOURCE LINE. What a reader cannot infer from the boards: where
              the numbers come from, that a season still being played has no
              outcome rather than a bad one, and that 1901, 1902, 1904 and 1994
              held no postseason at all — three states that look identical in a
              blank cell and are not the same fact. */}
          <p className="rptsource">
            Regular-season run totals and postseason series from the MLB Stats API, {' '}
            {data.firstSeason}–{data.lastSeason} · A season’s postseason is counted only once the
            whole bracket is over, so the season being played now shows a margin and no outcome ·
            1901, 1902, 1904 and 1994 held no postseason at all, which is not the same as missing
            one · Per 162 stretches each club’s margin over the games it actually played ·
            Rebuilt by scripts/gen-run-differential.mjs
          </p>
        </>
      )}

      {/* Outside the data gate on purpose: a reader who arrives on a failed
          load still needs somewhere to go next, which is the same call every
          other report page here makes. */}
      <ReportFooter />
    </div>
  )
}

// One era-table cell: the count, with its share of that era's settled club
// seasons under it. A count with no settled sample prints a dash rather than a
// percent taken over nothing — the season being played is exactly that case.
function EraRate({ part, decided }) {
  const share = rate(part, decided)
  return (
    <td>
      {part}
      <span className="rpt__sub">{share == null ? '—' : `${share}%`}</span>
    </td>
  )
}
