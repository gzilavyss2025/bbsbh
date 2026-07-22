import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  selectDelays,
  halfIndex,
} from '../api/select.js'
import { selectWinProbPath, selectWinProbBigPlays } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { buildMarginNotes } from '../api/pitcher-callouts.js'
import { safeToShowEntering } from '../api/enteringHalf.js'
import { ordinal } from '../lib/format.js'
import { RefreshButton } from './TeamInfo.jsx'
import { RollingLine } from '../components/RollingLine.jsx'
import { ExtrasBanner } from '../components/ExtrasBanner.jsx'
import { DelayCard } from '../components/DelayCard.jsx'
import { InningPage } from './innings/InningPage.jsx'
import { InningPageTurn } from '../components/page-turn/InningPageTurn.jsx'
import { PitchersSection } from '../components/PitchersSection.jsx'
import { MarginNotes } from '../components/MarginNotes.jsx'
import { DefenseSection, LineupSection } from '../components/EnteringReference.jsx'
import { RosterPanel } from '../components/RosterPanel.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'

// RevealCloudSync.jsx imports @clerk/clerk-react at its top, so it's only
// dynamically imported (and only then does that SDK ever reach a user's
// device) when a deploy actually configures Clerk — see main.jsx's matching
// dynamic import and clerkConfig.js.
const RevealCloudSync = isClerkEnabled
  ? lazy(() => import('../components/RevealCloudSync.jsx').then((m) => ({ default: m.RevealCloudSync })))
  : null

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
  workload,
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Reveal high-water mark, extras-unlock state, and the feed-keyed derived
  // cache — see useRevealProgress. The running line and Pitchers section both
  // read from `revealedThrough`; any half at or below it renders unsealed.
  const { revealedThrough, revealTo, mergeRevealedThrough, unlocked, getDerived, atBatCountFor, revealAtBat } =
    useRevealProgress(feed, regulation, actualCount)

  // The spoiler-free identity the cloud scorebook index stores alongside the
  // high-water mark (see api/reveal.js + ContinueScoring.jsx): enough to draw
  // a "pick up your pencil" card on the slate — never a score. Field paths
  // match what selectTeamMeta/selectGameBanner already read off gameData.
  const gameSnapshot = useMemo(() => {
    const gd = feed?.gameData
    if (!gd) return null
    return {
      date: gd.datetime?.officialDate ?? '',
      away: gd.teams?.away?.abbreviation ?? '',
      home: gd.teams?.home?.abbreviation ?? '',
      awayName: gd.teams?.away?.clubName ?? gd.teams?.away?.teamName ?? '',
      homeName: gd.teams?.home?.clubName ?? gd.teams?.home?.teamName ?? '',
      gameNumber: gd.game?.gameNumber ?? 1,
      regulation,
    }
  }, [feed, regulation])

  // Only mounted when multi-device sync is configured (see clerkConfig.js) —
  // a conditionally-rendered component rather than a conditionally-called
  // hook, since Clerk's hooks require a ClerkProvider ancestor that only
  // exists when this flag is true (see main.jsx). Renders nothing; see
  // RevealCloudSync.jsx for what it does.
  const cloudSync = RevealCloudSync && (
    <Suspense fallback={null}>
      <RevealCloudSync
        gamePk={feed?.gamePk}
        revealedThrough={revealedThrough}
        mergeRevealedThrough={mergeRevealedThrough}
        game={gameSnapshot}
      />
    </Suspense>
  )

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

  // The page-turn transition (see InningPageTurn.jsx) for forward navigation
  // only — backward always keeps calling goTo directly above. requestHalf
  // itself falls back to an immediate goTo for anything that isn't a genuine
  // forward/unlocked destination, so routing every forward call site through
  // it is safe even at the edges (e.g. nextIdx null-guarded below anyway).
  // turnStatus drives aria-disabled on the nav while a turn is in flight —
  // it's advisory only (the reducer's own first-request-wins guard is what
  // actually prevents a second turn from starting).
  const pageTurnRef = useRef(null)
  const [turnStatus, setTurnStatus] = useState('idle')
  const turning = turnStatus !== 'idle'
  const requestForwardHalf = (idx) => pageTurnRef.current?.requestHalf(idx)

  // Builds one InningPage instance for a given half-index — shared by the
  // active (interactive) render and, mid-turn, the inert preview render.
  // Keyed on the half itself so navigating (or the turn committing) forces
  // the fresh remount SealBox's re-sealing depends on (ADR-0002); presentation-
  // only-ness is left entirely to InningPage/HalfInning to enforce (ADR-0024).
  const renderInningPage = (idx, { presentationOnly }) => {
    const pageInning = Math.floor(idx / 2) + 1
    const pageHalf = idx % 2 === 0 ? 'top' : 'bottom'
    return (
      <InningPage
        key={`${pageInning}-${pageHalf}`}
        feed={feed}
        inning={pageInning}
        half={pageHalf}
        meta={meta}
        revealedThrough={revealedThrough}
        onReveal={revealTo}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        callouts={callouts}
        workload={workload}
        workloadGameDate={workloadGameDate}
        vsTeam={vsTeam}
        highlights={highlights}
        atBatCountFor={atBatCountFor}
        onStepInfo={(info) => setStepInfo({ ...info, forIdx: idx })}
        onSteppedThrough={scrollToStatBox}
        getDerived={getDerived}
        runExpectancy={runExpectancy}
        winProbPoints={winProbPoints}
        winProbBigPlays={winProbBigPlays}
        statBoxRef={statBoxRef}
        presentationOnly={presentationOnly}
      />
    )
  }

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
  // Tagged with the half-index it was computed for (forIdx) and only trusted
  // when that still matches curIdx, rather than cleared via a separate
  // `useEffect(..., [curIdx])`: that reset raced against PlayByPlay's own
  // mount-time report-back effect (a child effect fires before a parent's in
  // the same commit), so navigating back into an already-partially-stepped
  // half could have the freshly-computed, correctly-bundled nextCap
  // immediately clobbered back to null by this component's own reset —
  // silently reintroducing the exact "stranded lone note" bug PlayByPlay's
  // effectiveCap fix exists to eliminate, just for the resume case instead of
  // the fresh-first-tap case. Tagging makes a stale value from a half the
  // user has since navigated away from self-invalidate on read, with no
  // separate reset step to race.
  const [stepInfo, setStepInfo] = useState(null)
  const curStepInfo = stepInfo?.forIdx === curIdx ? stepInfo : null
  // The literal `1` for a fresh half's first tap is a starting guess, not a
  // guarantee: this component has no legitimate way to know whether the
  // half's first entry is a leading event note rather than a plate
  // appearance (computeHalfInningFeed is reveal-only, ADR-0001, so it can't
  // be consulted from here ahead of PlayByPlay's own render). PlayByPlay.jsx
  // silently corrects an understated cap forward to the first genuine at-bat
  // boundary on its own — a new stepping entry point that bypasses PlayByPlay
  // (or calls it in some other way) must preserve that correction itself, or
  // the "reveal just a lone note" bug this pairing exists to prevent comes
  // back.
  const revealNextAtBat = () =>
    revealAtBat(effInning, effHalf, curAtBatCount === 0 ? 1 : (curStepInfo?.nextCap ?? curAtBatCount + 1))

  // Where the R/H/E/LOB totals land (Row 3 below) — scrolled into view once
  // a user finishes stepping through a half one at-bat at a time (see
  // HalfInning's onSteppedThrough), since by then PlayByPlay's own per-step
  // scroll (ADR-0016) has carried them well past this row.
  const statBoxRef = useRef(null)
  const scrollToStatBox = () => statBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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

  // The workload file describes "now" — its availability rules only apply to
  // a slate-current game (same freshness window TeamInfo's bullpen board
  // uses). Null on an archival game, which silently disables the
  // bullpen-thin pre-half note.
  const workloadGameDate = useMemo(() => {
    const d = feed?.gameData?.datetime?.officialDate ?? null
    const asOf = workload?.asOf ?? null
    if (!d || !asOf) return null
    const diff = Math.abs(new Date(`${d}T00:00:00Z`) - new Date(`${asOf}T00:00:00Z`))
    return diff <= 3 * 86400000 ? d : null
  }, [feed, workload])

  // The Margin Notes digest (api/pitcher-callouts.js): every pitcher who's
  // appeared so far this game, ranked by worthiness and capped, folding in
  // both the season-aggregate notes (streak, home/away split, workload,
  // leverage) and the in-game health reads (laboring, velo decay —
  // pitcherHealth.js, ADR-0009 footing, same reveal clamp as pitcherLines).
  // Recomputed as the reveal mark advances, same dependency shape as
  // pitcherLines itself.
  const marginNotes = useMemo(
    () =>
      buildMarginNotes(feed, revealedThrough, callouts, { away: rosters.away.name, home: rosters.home.name }, {
        workload,
        gameDate: workloadGameDate,
      }),
    [feed, revealedThrough, callouts, rosters, workload, workloadGameDate],
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
  // The biggest-swing ledger — same reveal-only selector, same
  // revealedThrough clamp, so it only ever covers revealed halves and grows
  // one entry per reveal (never hinting what's ahead).
  const winProbBigPlays = useMemo(
    () => selectWinProbBigPlays(winProbability, { throughHalf: revealedThrough }),
    [winProbability, revealedThrough],
  )

  if (!started) {
    return (
      <div className="innings">
        {cloudSync}
        {/* Keep the LINEUPS / INNINGS / BOX tabs on screen pre-game — a deep
            link straight to an innings URL (e.g. /…/top1) lands here, and
            without the nav there'd be no way to reach the lineup/box pages
            the hint points at (only the browser Back button). */}
        {sectionNav && <div className="inningchrome">{sectionNav}</div>}
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
      {cloudSync}
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
            aria-disabled={turning || undefined}
            aria-label="Back one half-inning"
          >
            ‹ Back
          </button>
          <span className="inningnav__label">
            {effHalf === 'top' ? 'Top' : 'Bottom'} {ordinal(effInning)}
          </span>
          <button
            onClick={() => requestForwardHalf(Math.min(maxIdx, curIdx + 1))}
            disabled={curIdx === maxIdx}
            aria-disabled={turning || undefined}
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
          onSelect={(idx) => (idx > curIdx ? requestForwardHalf(idx) : goTo(idx))}
          disabled={turning}
        />

        {/* The half's play-by-play (paired with its strike zone on the wide
            layout) plus the R/H/E/LOB + pitch-stat/WPA row beneath it — see
            InningPage.jsx. InningPageTurn owns the active render (key on
            inning+half → fresh mount; a box at/under the reveal mark stays
            open) plus, only mid-turn, the inert preview + curl overlay for a
            forward navigation (see InningPageTurn.jsx). */}
        <InningPageTurn
          ref={pageTurnRef}
          activeIdx={curIdx}
          maxIdx={maxIdx}
          renderPage={renderInningPage}
          onCommit={goTo}
          onStatusChange={setTurnStatus}
        />

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
            <MarginNotes notes={marginNotes} feed={feed} bundle={callouts} />
            <PitchersSection
              teams={[
                { name: rosters.away.name, side: 'away', rows: pitcherLines.away },
                { name: rosters.home.name, side: 'home', rows: pitcherLines.home },
              ]}
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
          <button
            className="btn btn--next"
            onClick={() => requestForwardHalf(nextIdx)}
            aria-disabled={turning || undefined}
          >
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
