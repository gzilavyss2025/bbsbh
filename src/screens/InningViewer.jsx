import { useEffect, useMemo, useState } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  selectDelays,
  halfIndex,
} from '../api/select.js'
import { selectWinProbPath } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { safeToShowEntering } from '../api/enteringHalf.js'
import { ordinal } from '../lib/format.js'
import { RefreshButton } from './TeamInfo.jsx'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { RollingLine } from '../components/RollingLine.jsx'
import { StatBox } from '../components/StatBox.jsx'
import { ExtrasBanner } from '../components/ExtrasBanner.jsx'
import { HalfInning } from '../components/HalfInning.jsx'
import { DelayCard } from '../components/DelayCard.jsx'
import { PitchersSection } from '../components/PitchersSection.jsx'
import { DefenseSection, LineupSection } from '../components/EnteringReference.jsx'
import { RosterPanel } from '../components/RosterPanel.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'

// Half-inning-by-half-inning viewer: each page is one half (top of the 1st,
// then the bottom of the 1st, …), a single SealBox whose one tap reveals that
// half's whole stat line at once (§7b). Navigating between halves remounts the
// panel (key on inning+half) so the box re-seals. Which half shows is driven by
// the URL (`inning`/`half` / `onInning`); the reveal high-water mark lives here
// so it survives navigation.
//
// Extra innings never spoil: only `regulation` innings (9, or 7 for short games)
// are shown up front. Each inning past regulation unlocks one at a time, and only
// once the prior inning has been revealed — so the navigator and boxscore never
// hint that a game went to extras before the user gets there.
export function InningViewer({
  feed,
  started,
  sectionNav,
  inning,
  half,
  onInning,
  onBoxScore,
  onReload,
  loading,
  pitcherRoles,
  winProbability,
  prospectsData,
  rookiesData,
  callouts,
  vsTeam,
  highlights,
  runExpectancy,
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Reveal high-water mark, extras-unlock state, and the feed-keyed derived
  // cache — see useRevealProgress. The running line and Pitchers section both
  // read from `revealedThrough`; any half at or below it renders unsealed.
  const { revealedThrough, revealTo, unlocked, getDerived, atBatCountFor, revealAtBat } =
    useRevealProgress(feed, regulation, actualCount)

  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away'), home: selectTeamMeta(feed, 'home') }),
    [feed],
  )

  // In-game delays (rain, etc.), spoiler-free (see selectDelays) — surfaced as a
  // between-half-innings notice on the affected half's page. Almost always empty.
  const delays = useMemo(() => selectDelays(feed), [feed])

  const rosters = useMemo(
    () => ({
      away: {
        name: meta.away.name || 'Away',
        ...splitBullpen(selectBullpen(feed, 'away'), pitcherRoles),
        bench: selectBench(feed, 'away'),
      },
      home: {
        name: meta.home.name || 'Home',
        ...splitBullpen(selectBullpen(feed, 'home'), pitcherRoles),
        bench: selectBench(feed, 'home'),
      },
    }),
    [feed, meta, pitcherRoles],
  )

  // The page being shown, as a half-index clamped to what's unlocked. The last
  // navigable page is the bottom of the last unlocked inning.
  const maxIdx = halfIndex(unlocked, 'bottom')
  const curIdx = Math.min(
    Math.max(0, halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')),
    maxIdx,
  )
  const effInning = Math.floor(curIdx / 2) + 1
  const effHalf = curIdx % 2 === 0 ? 'top' : 'bottom'
  const goTo = (idx) => onInning(Math.floor(idx / 2) + 1, idx % 2 === 0 ? 'top' : 'bottom')

  // The next half within what's unlocked, for the floating advance button (§ the
  // lineup pages' btn--next, carried over to the innings view). Null at the last
  // unlocked half — which is always the bottom of the furthest revealed inning
  // (regulation or an unlocked extra). There the floating button becomes
  // "Box score ›" instead of the next-half label, so the bottom of the 9th
  // never sprouts a "Top 10th ›" that would leak the game going to extras
  // before it's revealed.
  const nextIdx = curIdx < maxIdx ? curIdx + 1 : null
  const nextLabel =
    nextIdx == null
      ? null
      : `${nextIdx % 2 === 0 ? 'Top' : 'Bottom'} ${ordinal(Math.floor(nextIdx / 2) + 1)}`

  // Whether the half being shown is still sealed. When it is, the fixed bottom
  // bar's primary action becomes "Reveal {this half}" (in thumb reach, so you
  // never scroll down past the staging lineups to find the kraft cover); once
  // revealed it flips back to the Next / View-box-score advance. Revealing keeps
  // the viewer exactly where they are — a completed half unlocks in place, no
  // scroll or focus jump (the results appear above the button, which flips to
  // Next right under the thumb).
  const currentSealed = curIdx > revealedThrough
  // At-bat stepping (ADR-0016): the floating bar always offers a sealed half
  // as two side-by-side choices — reveal just the next plate appearance, or
  // the whole half at once. Keyed on the half actually being shown, not a
  // reveal frontier — RollingLine and direct links both let a user jump
  // straight to any unlocked half.
  const curAtBatCount = atBatCountFor(effInning, effHalf)
  const revealWholeHalf = () => revealTo(effInning, effHalf)
  // What the NEXT "reveal next at-bat" tap should pass to revealAtBat — null
  // until HalfInning/PlayByPlay has actually computed the half's entries
  // (nothing to report before the first tap, which just starts at 1).
  const [stepInfo, setStepInfo] = useState(null)
  useEffect(() => setStepInfo(null), [curIdx])
  const revealNextAtBat = () =>
    revealAtBat(effInning, effHalf, curAtBatCount === 0 ? 1 : (stepInfo?.nextCap ?? curAtBatCount + 1))

  // Normalize an out-of-range URL (a mistyped /top12 deep link, a legacy link
  // past what's unlocked) to the half actually being shown, via replaceState so
  // Back never revisits the bogus address. Without this the URL, the stepnav's
  // remembered section, and any re-shared link all keep the phantom inning —
  // and the page would silently jump forward as reveals raise the clamp.
  const urlIdx = halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')
  useEffect(() => {
    if (urlIdx !== curIdx) onInning(effInning, effHalf, { replace: true })
  }, [urlIdx, curIdx, effInning, effHalf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every pitcher who has appeared in a revealed half-inning, with running lines
  // (see api/pitchers.js). Recomputed as the reveal mark advances.
  const pitcherLines = useMemo(
    () => computePitcherLines(feed, revealedThrough),
    [feed, revealedThrough],
  )

  // The win-probability line "so far" — only the plays through the revealed
  // half. Same reveal gate as the running line and Pitchers table (a
  // reveal-only selector clamped to revealedThrough; see api/winprob.js), so
  // nothing sealed is plotted. Empty until at least one half is revealed, and at
  // MiLB parks with no win-prob feed — the chart then renders nothing.
  const winProbPoints = useMemo(
    () => selectWinProbPath(winProbability, { throughHalf: revealedThrough }),
    [winProbability, revealedThrough],
  )

  if (!started) {
    return (
      <div className="innings">
        <p className="hint hint--prose">
          This game hasn’t started yet. Lineups and info are on the previous
          pages; inning totals appear once first pitch is thrown.
        </p>
        <RefreshButton onReload={onReload} loading={loading} />
      </div>
    )
  }

  return (
    <div className="innings">
      {/* The section tabs (LINEUPS / INNINGS / BOX, handed down from GameView)
          and the half-inning navigator share one chrome row on the wide layout,
          stacked on a phone. Refresh no longer sits up here — it moved to the
          floating bottom bar (below) at every width, so refreshing live data is
          always one reach from the Next button. */}
      <div className="inningchrome">
        {sectionNav}
        <nav className="inningnav" aria-label="Half-inning navigator">
          <button
            onClick={() => goTo(Math.max(0, curIdx - 1))}
            disabled={curIdx === 0}
            aria-label="Back one half-inning"
          >
            ‹ Back
          </button>
          <span className="inningnav__label">
            {effHalf === 'top' ? 'Top' : 'Bottom'} {ordinal(effInning)}
          </span>
          <button
            onClick={() => goTo(Math.min(maxIdx, curIdx + 1))}
            disabled={curIdx === maxIdx}
            aria-label="Next half-inning"
          >
            Next ›
          </button>
        </nav>
      </div>

      {/* Extra-innings team-record banner: only shows once the page IS an extra
          inning, which the user can only reach after revealing through
          regulation (extras unlock one at a time — ADR-0008), so it leaks
          nothing. Season W-L splits (spoiler-free); absent for MiLB / un-
          generated games (callouts null). */}
      {effInning > regulation && (
        <ExtrasBanner
          records={callouts?.teamRecords}
          awayName={meta.away.clubName || meta.away.abbreviation}
          homeName={meta.home.clubName || meta.home.abbreviation}
        />
      )}

      {/* A rain/other delay that stopped play during the half being viewed —
          spoiler-free structural info (see selectDelays), rendered like the
          status banner rather than behind a seal. Usually none. */}
      {delays
        .filter((d) => d.inning === effInning && d.half === effHalf)
        .map((d, i) => (
          <DelayCard key={`${d.inning}-${d.half}-${i}`} delay={d} />
        ))}

      {/* On a phone these wrappers are inert divs and everything stacks in the
          same row order as ever: linescore, then the play-by-play (with its
          strike zones) — the most important thing on the page as the scorer
          progresses — then the stat card + WPA chart, then the pitchers /
          lineups / defense reference band, then rosters. From the wide
          breakpoint up the stat card and WPA chart sit side by side. */}
      <div className="innings__grid">
        <RollingLine
          feed={feed}
          regulation={regulation}
          unlocked={unlocked}
          revealedThrough={revealedThrough}
          awayAbbr={meta.away.abbreviation}
          homeAbbr={meta.home.abbreviation}
          awayName={meta.away.clubName}
          homeName={meta.home.clubName}
          curIdx={curIdx}
          onSelect={goTo}
        />

        {/* Row 2: the half's play-by-play (paired with its strike zone on the
            wide layout). key on inning+half → fresh mount; a box at/under the
            reveal mark stays open. */}
        <div className="inning" key={`${effInning}-${effHalf}`}>
          <HalfInning
            feed={feed}
            inning={effInning}
            half={effHalf}
            battingSide={effHalf === 'top' ? 'away' : 'home'}
            label={effHalf === 'top' ? 'Top' : 'Bottom'}
            battingAbbr={effHalf === 'top' ? meta.away.abbreviation : meta.home.abbreviation}
            pitchingAbbr={effHalf === 'top' ? meta.home.abbreviation : meta.away.abbreviation}
            awayName={meta.away.clubName}
            homeName={meta.home.clubName}
            awayId={meta.away.id}
            homeId={meta.home.id}
            revealed={curIdx <= revealedThrough}
            isNextToReveal={curIdx === revealedThrough + 1}
            revealedThrough={revealedThrough}
            onReveal={revealTo}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
            callouts={callouts}
            vsTeam={vsTeam}
            highlights={highlights}
            revealedAtBatCount={curAtBatCount}
            onStepInfo={setStepInfo}
          />
        </div>

        {/* Row 3: the R/H/E/LOB + pitch-stat card for the half being viewed,
            beside the win-probability chart. */}
        <div className="innings__row2">
          <StatBox
            className="innings__statbox"
            placeholder
            feed={feed}
            inning={effInning}
            half={effHalf}
            battingSide={effHalf === 'top' ? 'away' : 'home'}
            pitchingName={effHalf === 'top' ? meta.home.clubName : meta.away.clubName}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            awayLocation={meta.away.locationName || meta.away.abbreviation}
            homeLocation={meta.home.locationName || meta.home.abbreviation}
            getDerived={getDerived}
            revealed={curIdx <= revealedThrough}
            isNextToReveal={curIdx === revealedThrough + 1}
            runExpectancy={runExpectancy}
          />
          <WinProbChart
            points={winProbPoints}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            partial
          />
        </div>

        {/* Reference band. On the wide layout: pitchers + the fielding defense
            on the left, both lineups on the right. On a phone only Pitchers
            shows here — the lineups & defense render inline in the half instead
            (the -lineups / -defense blocks are hidden <740; the inline copies,
            .half__entering, are hidden ≥740). Gated to a reached half — the
            gate itself now lives in defenseEntering/lineupEntering (passed
            revealedThrough below), not re-derived here; this outer check only
            decides whether to print the wrapper/title around them, so a
            further-out half doesn't leave a title-only empty card. */}
        <div className="innings__ref">
          <div className="innings__ref-left">
            <PitchersSection
              teams={[
                { name: rosters.away.name, side: 'away', rows: pitcherLines.away },
                { name: rosters.home.name, side: 'home', rows: pitcherLines.home },
              ]}
              bundle={callouts}
            />
            {safeToShowEntering(revealedThrough, effInning, effHalf) && (
              <div className="innings__ref-defense">
                <DefenseSection
                  feed={feed}
                  inning={effInning}
                  half={effHalf}
                  fieldingSide={effHalf === 'top' ? 'home' : 'away'}
                  fieldingName={effHalf === 'top' ? meta.home.clubName : meta.away.clubName}
                  revealedThrough={revealedThrough}
                />
              </div>
            )}
          </div>
          {safeToShowEntering(revealedThrough, effInning, effHalf) && (
            <div className="innings__ref-lineups">
              <h3 className="innings__reference-title">Lineups</h3>
              <LineupSection
                feed={feed}
                inning={effInning}
                half={effHalf}
                awayName={meta.away.clubName}
                homeName={meta.home.clubName}
                prospectsData={prospectsData}
                rookiesData={rookiesData}
                revealedThrough={revealedThrough}
              />
            </div>
          )}
        </div>

        <div className="innings__rosters">
          <RosterPanel
            title={rosters.away.name}
            roster={rosters.away}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
          />
          <RosterPanel
            title={rosters.home.name}
            roster={rosters.home}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
            rookiesData={rookiesData}
          />
        </div>
      </div>

      {/* Floating bar — the same fixed blue bar the lineup pages page forward
          with, and the same destination-named + trailing-› convention their
          nextLabel buttons use ("Home team ›", "Innings ›") — no "Next:"
          prefix, no arrow glyph. On narrow viewports it carries a duplicate
          Refresh stacked above the primary action, so refreshing live data
          doesn't mean scrolling back up to the toolbar (hidden again on the
          wide layout, where the top toolbar stays reachable). The primary
          action advances to the next half-inning when one is unlocked; at the
          bottom of the furthest revealed inning it becomes "Box score ›"
          instead — so the bottom of the 9th (or any extra) never shows a
          "Top 10th ›" that would leak the game going to extras. Revealing
          that bottom half unlocks the next inning and the button flips back
          to the next-half label. A sealed half offers two side-by-side
          choices instead (ADR-0016): step one plate appearance at a time, or
          reveal the whole half at once — either flips the bar back once the
          half is fully committed. */}
      <div className="pagenav pagenav--innings">
        <RefreshButton onReload={onReload} loading={loading} className="refreshbtn--float" />
        {currentSealed ? (
          <div className="revealsplit">
            <button
              type="button"
              className="btn btn--reveal revealsplit__btn"
              onClick={revealNextAtBat}
              aria-label={`Reveal the next at-bat in the ${effHalf === 'top' ? 'top' : 'bottom'} of the ${ordinal(effInning)} inning`}
            >
              Next at-bat
            </button>
            <button
              type="button"
              className="btn btn--reveal revealsplit__btn"
              onClick={revealWholeHalf}
              aria-label={`Reveal the rest of half — the ${effHalf === 'top' ? 'top' : 'bottom'} of the ${ordinal(effInning)} inning`}
            >
              Rest of half
            </button>
          </div>
        ) : nextIdx != null ? (
          <button className="btn btn--next" onClick={() => goTo(nextIdx)}>
            {nextLabel} ›
          </button>
        ) : (
          <button className="btn btn--next" onClick={onBoxScore}>
            Box score ›
          </button>
        )}
      </div>
    </div>
  )
}

// Splits selectBullpen's card into rotation starters (won't enter once the
// game's underway — see the module docstring) and the actual bullpen, using
// the same season-stats role inference the team page badges pitchers with
// (rosterPitcherRole: gamesStarted ratio / saves — see person.js). A pitcher
// with no resolved role (the roles fetch hasn't landed yet, or a rookie with
// no starts on record) defaults into the bullpen list rather than being ruled
// out as unavailable.
function splitBullpen(bullpen, roles) {
  const starters = bullpen.filter((p) => roles?.[p.id] === 'SP')
  const relief = bullpen.filter((p) => roles?.[p.id] !== 'SP')
  return { starters, bullpen: relief }
}
