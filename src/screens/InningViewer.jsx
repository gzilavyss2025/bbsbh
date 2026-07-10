import { useEffect, useMemo, useRef } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  halfIndex,
} from '../api/select.js'
import { selectWinProbPath } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { safeToShowEntering } from '../api/enteringHalf.js'
import { WinProbChart } from '../components/WinProbChart.jsx'
import { RollingLine } from '../components/RollingLine.jsx'
import { StatBox } from '../components/StatBox.jsx'
import { ExtrasBanner } from '../components/ExtrasBanner.jsx'
import { HalfInning } from '../components/HalfInning.jsx'
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
  inning,
  half,
  onInning,
  onBoxScore,
  onReload,
  loading,
  pitcherRoles,
  winProbability,
  prospectsData,
  callouts,
  vsTeam,
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Reveal high-water mark, extras-unlock state, and the feed-keyed derived
  // cache — see useRevealProgress. The running line and Pitchers section both
  // read from `revealedThrough`; any half at or below it renders unsealed.
  const { revealedThrough, revealTo, unlocked, getDerived } = useRevealProgress(
    feed,
    regulation,
    actualCount,
  )

  const meta = useMemo(
    () => ({ away: selectTeamMeta(feed, 'away'), home: selectTeamMeta(feed, 'home') }),
    [feed],
  )

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
  // (regulation or an unlocked extra). There the floating button becomes "View
  // box score" instead of Next, so the bottom of the 9th never sprouts a "Next:
  // Top 10th" that would leak the game going to extras before it's revealed.
  const nextIdx = curIdx < maxIdx ? curIdx + 1 : null
  const nextLabel =
    nextIdx == null
      ? null
      : `${nextIdx % 2 === 0 ? 'Top' : 'Bottom'} ${ordinal(Math.floor(nextIdx / 2) + 1)}`

  // Whether the half being shown is still sealed. When it is, the fixed bottom
  // bar's primary action becomes "Reveal {this half}" (in thumb reach, so you
  // never scroll down past the staging lineups to find the kraft cover); once
  // revealed it flips back to the Next / View-box-score advance. Revealing from
  // the bar then scrolls the freshly-uncovered results into view, since the
  // layout flips the results up above where the button sits.
  const currentSealed = curIdx > revealedThrough
  const curHalfLabel = `${effHalf === 'top' ? 'Top' : 'Bottom'} ${ordinal(effInning)}`
  const resultsRef = useRef(null)
  const scrollPendingRef = useRef(false)
  const revealCurrent = () => {
    scrollPendingRef.current = true
    revealTo(effInning, effHalf)
  }
  useEffect(() => {
    if (!scrollPendingRef.current) return
    scrollPendingRef.current = false
    const el = resultsRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.focus?.({ preventScroll: true }) // AT parity: land on the results, not <body>
  }, [revealedThrough])

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
        <button className="btn" onClick={onReload} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    )
  }

  return (
    <div className="innings">
      <div className="innings__toolbar">
        <button
          type="button"
          className="refreshbtn"
          onClick={onReload}
          disabled={loading}
          aria-label="Refresh live game data"
        >
          <span className="refreshbtn__icon" aria-hidden="true">
            ↻
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* The half-inning navigator: full width, the same measure as the
          LINEUPS / INNINGS / BOX step buttons above it. */}
      <nav className="inningnav" aria-label="Half-inning navigator">
        <button
          onClick={() => goTo(Math.max(0, curIdx - 1))}
          disabled={curIdx === 0}
          aria-label="Previous half-inning"
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

      {/* On a phone these wrappers are inert divs and everything stacks in the
          same row order as ever: linescore, then the stat card + WPA chart,
          then the play-by-play (with its strike zones), then the pitchers /
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

        {/* Row 2: the R/H/E/LOB + pitch-stat card for the half being viewed,
            beside the win-probability chart. */}
        <div className="innings__row2">
          <StatBox
            className="innings__statbox"
            placeholder
            feed={feed}
            inning={effInning}
            half={effHalf}
            battingSide={effHalf === 'top' ? 'away' : 'home'}
            getDerived={getDerived}
            revealed={curIdx <= revealedThrough}
          />
          <WinProbChart
            points={winProbPoints}
            awayAbbr={meta.away.abbreviation}
            homeAbbr={meta.home.abbreviation}
            partial
          />
        </div>

        {/* Row 3: the half's play-by-play (paired with its strike zone on the
            wide layout). key on inning+half → fresh mount; a box at/under the
            reveal mark stays open. */}
        <div className="inning" key={`${effInning}-${effHalf}`} ref={resultsRef} tabIndex={-1}>
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
            revealed={curIdx <= revealedThrough}
            isNextToReveal={curIdx === revealedThrough + 1}
            revealedThrough={revealedThrough}
            getDerived={getDerived}
            onReveal={revealTo}
            prospectsData={prospectsData}
            callouts={callouts}
            vsTeam={vsTeam}
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
              starterRecords={callouts?.starterRecords}
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
          />
          <RosterPanel
            title={rosters.home.name}
            roster={rosters.home}
            revealedThrough={revealedThrough}
            prospectsData={prospectsData}
          />
        </div>
      </div>

      {/* Floating bar — the same fixed blue bar the lineup pages page forward
          with. On narrow viewports it carries a duplicate Refresh stacked above
          the primary action, so refreshing live data doesn't mean scrolling back
          up to the toolbar (hidden again on the wide layout, where the top
          toolbar stays reachable). The primary action advances to the next
          half-inning when one is unlocked; at the bottom of the furthest
          revealed inning it becomes "View box score" instead — so the bottom of
          the 9th (or any extra) never shows a "Next: Top 10th" that would leak
          the game going to extras. Revealing that bottom half unlocks the next
          inning and the button flips back to Next. */}
      <div className="pagenav pagenav--innings">
        <button
          type="button"
          className="refreshbtn refreshbtn--float"
          onClick={onReload}
          disabled={loading}
          aria-label="Refresh live game data"
        >
          <span className="refreshbtn__icon" aria-hidden="true">
            ↻
          </span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        {currentSealed ? (
          <button
            type="button"
            className="btn btn--reveal"
            onClick={revealCurrent}
            aria-label={`Reveal ${effHalf === 'top' ? 'top' : 'bottom'} of the ${ordinal(effInning)} inning`}
          >
            <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal {curHalfLabel}
          </button>
        ) : nextIdx != null ? (
          <button className="btn btn--next" onClick={() => goTo(nextIdx)}>
            Next: {nextLabel} →
          </button>
        ) : (
          <button className="btn btn--next" onClick={onBoxScore}>
            View box score →
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

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}
