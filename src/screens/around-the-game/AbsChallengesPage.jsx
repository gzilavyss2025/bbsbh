import '../../styles/68-around-the-game.css'
import '../../styles/report/chrome.css'
import { useMemo, useState } from 'react'
import {
  fetchAbsChallenges,
  levelsIn,
  summaryFor,
} from '../../api/around-the-game/absChallenges.js'
import { loadClubs } from '../../api/around-the-game/clubs.js'
import { humanDateWithYear } from '../../lib/dates.js'
import { groupLabelFor } from '../../lib/reportPages.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { BroadcastMasthead } from '../../components/around-the-game/BroadcastMasthead.jsx'
import { Slab, SlabRow } from '../../components/around-the-game/StatSlab.jsx'
import { commas, num1, num2, pct1 } from './abs/format.js'
import { WhoCalls } from './abs/WhoCalls.jsx'
import { WhenTheyCall } from './abs/WhenTheyCall.jsx'
import { ClubBoard } from './abs/ClubBoard.jsx'
import { RanOut } from './abs/RanOut.jsx'
import { PlayerBoards } from './abs/PlayerBoards.jsx'
import { UmpireBoard } from './abs/UmpireBoard.jsx'
import { MissBands } from './abs/MissBands.jsx'
import { BiggestOverturn } from './abs/BiggestOverturn.jsx'

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
// EACH SECTION IS ITS OWN COMPONENT, in src/screens/around-the-game/abs/, and
// every one of them reads the `summary` it is HANDED rather than the file. That
// one rule is what makes the level chip below work: flipping to Triple-A hands
// every section a different summary and the whole page follows, with no section
// needing to know the chip exists. A section that reached back to
// fetchAbsChallenges for itself would keep showing MLB, and nobody would notice
// until a reader did. What is left in this file is the chrome the sections sit
// in — the masthead, the level chips, the slab row, the two fetches and the
// source line.
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

export function AbsChallengesPage() {
  useDocumentTitle('ABS Challenges')
  const [level, setLevel] = useState('MLB')

  const { loading, error, data } = useAsync(() => fetchAbsChallenges(), [])
  // MLB and Triple-A both, because both run the system and both are on the
  // board. Club ids never collide across levels, so one lookup covers them.
  const { data: clubs } = useAsync(() => loadClubs([1, 11]), [])

  const levels = useMemo(() => levelsIn(data), [data])
  const shown = levels.some((l) => l.key === level) ? level : (levels[0]?.key ?? 'MLB')
  const summary = summaryFor(data, shown)

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

          {/* THE BOARDS. Each one is handed the summary the level chip chose;
              none of them reads the file. See the header.

              WHO ASKS COMES BEFORE WHEN THEY ASK, and both come before who is
              good at it: the roles table defines the three jobs the inning
              chart then splits, so reading it the other way round meets a
              catcher panel before anything has said a catcher can challenge.

              OUT OF CHALLENGES FOLLOWS THE CLUB BOARD because it is that
              board's "Ran out" column opened up: the column counts each club's
              emptied games, and the section under it names the nights. */}
          <WhoCalls summary={summary} />
          <WhenTheyCall summary={summary} />
          <ClubBoard summary={summary} clubs={clubs} />
          <RanOut summary={summary} clubs={clubs} />
          <PlayerBoards summary={summary} clubs={clubs} />
          <UmpireBoard summary={summary} />
          <MissBands summary={summary} />
          <BiggestOverturn summary={summary} clubs={clubs} />

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
            Distance is measured from the buffered rule-book zone, per batter · An umpire’s rate
            here is off challenged pitches only, a small self-selected set, so it is not the
            Umpire Rankings figure, which scores every called pitch against the zone
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
