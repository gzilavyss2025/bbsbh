import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectBullpen,
  selectBench,
  selectTeamMeta,
  selectDelays,
  selectSkippedBottomHalf,
  selectIsFinal,
  selectFinalHalfIndex,
  halfIndex,
} from '../api/select.js'
import { selectHasFirstPitch } from '../api/playbyplay/firstPitch.js'
import { selectLiveEdge, shouldFollowLiveEdge } from '../api/liveEdge.js'
import { useCopy } from '../copy/copyContext.js'
import { selectWinProbPath, selectWinProbBigPlays } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { buildMarginNotes } from '../api/pitcher-callouts.js'
import { ordinal } from '../lib/format.js'
import { RefreshButton } from './TeamInfo.jsx'
import { RollingLine } from '../components/gamehud/RollingLine.jsx'
import { ExtrasBanner } from '../components/inning/ExtrasBanner.jsx'
import { FocusControls, useFocusMode } from '../components/inning/focus/FocusControls.jsx'
import { ReferencePanel } from '../components/inning/focus/ReferencePanel.jsx'
import { ReferenceBand, RosterPanels } from '../components/inning/ReferenceBand.jsx'
import { DelayCard } from '../components/inning/DelayCard.jsx'
import { ScorebugMount } from '../components/gamehud/ScorebugMount.jsx'
import { DueUpConsole } from '../components/gamehud/DueUpConsole.jsx'
import { InningPage } from './innings/InningPage.jsx'
import { InningPageTurn } from '../components/page-turn/InningPageTurn.jsx'
import { PregameScoreboard } from '../components/inning/PregameScoreboard.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'
import { effectiveReveal } from '../hooks/revealProgressCore.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'

// RevealCloudSync.jsx imports @clerk/clerk-react at its top, so it's only
// dynamically imported (and only then does that SDK ever reach a user's
// device) when a deploy actually configures Clerk — see main.jsx's matching
// dynamic import and clerkConfig.js.
const RevealCloudSync = isClerkEnabled
  ? lazy(() => import('../components/sync/RevealCloudSync.jsx').then((m) => ({ default: m.RevealCloudSync })))
  : null

// Stand-in for `revealTo` while the Scores Unlocked pass is on (see
// effectiveReveal's `commitReveals`). Module-scope so its identity is stable
// across renders, and a real function rather than undefined because HalfInning
// calls onReveal directly, not via `?.()` — the same reason InningPage.jsx keeps
// its own `noop` for the page-turn preview.
const noopReveal = () => {}

// Value-equality check for the scorebug's live snapshot (see `liveState`
// below) — `entries` is rebuilt fresh every render in PlayByPlay.jsx, so a
// composite object arrives with a new identity every render even when
// nothing in it actually changed; comparing every leaf field is what lets
// the setState call that reports it become a true no-op on an unchanged
// snapshot instead of triggering another render (and another report) forever.
function sameLiveState(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.inning === b.inning &&
    a.half === b.half &&
    a.outs === b.outs &&
    a.bases?.first === b.bases?.first &&
    a.bases?.second === b.bases?.second &&
    a.bases?.third === b.bases?.third &&
    a.batter?.order === b.batter?.order &&
    a.batter?.last === b.batter?.last &&
    a.batter?.line === b.batter?.line &&
    a.pitcher?.last === b.pitcher?.last &&
    a.pitcher?.pitches === b.pitcher?.pitches
  )
}

// Value-equality checks for the other two things PlayByPlay reports back up
// (`runsInProgress`, `stepInfo`), for exactly the reason `sameLiveState` above
// exists: each report arrives as a freshly-built object every time, so a plain
// setState replaced state — and re-rendered this whole tree — even when the
// content was identical. See `reportStepInfo`/`reportRunsSoFar` in the component.
function sameRunsInProgress(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return a.idx === b.idx && a.runs === b.runs && a.hits === b.hits
}

function sameStepInfo(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.forIdx === b.forIdx &&
    a.nextCap === b.nextCap &&
    a.isLastStep === b.isLastStep &&
    a.lastAtBatIndex === b.lastAtBatIndex
  )
}

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
  lastUpdated,
  pitcherRoles,
  winProbability,
  winProbTreatment,
  prospectsData,
  rookiesData,
  callouts,
  vsTeam,
  highlights,
  runExpectancy,
  workload,
  spoilersOff = false,
  passActive = false,
}) {
  const { t: copy } = useCopy()
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // Reveal high-water mark, extras-unlock state, and the feed-keyed derived
  // cache — see useRevealProgress. The running line and Pitchers section both
  // read from `revealedThrough`; any half at or below it renders unsealed.
  const { revealedThrough, revealTo, mergeRevealedThrough, unlocked, getDerived, atBatCountFor, revealAtBat } =
    useRevealProgress(feed, regulation, actualCount)

  // The site-wide spoilers-off pass (ADR-0026), resolved by GameView for THIS
  // game's date and handed down: a render override that unseals every half
  // without ever touching the persisted reveal mark. `revealedThrough` /
  // `unlocked` above stay the real, ratcheted, cloud-synced values — they are
  // what feeds useRevealProgress, RevealCloudSync, and localStorage, and they
  // must never see the override (see effectiveReveal's contract). Everything
  // that only *renders* reads the `render*` values below instead; with spoilers
  // on they ARE the real values (identity), so the default spoiler-safe path is
  // byte-for-byte unchanged.
  //
  // `commitReveals` is the other half of that contract and must not be dropped:
  // a half rendering revealed mounts its SealBox force-revealed, and SealBox
  // fires onReveal on ANY transition to shown — flag included. Handing revealTo
  // straight down would therefore ratchet the REAL mark for every half viewed
  // under the pass (and cloud-sync it). While unlocked we hand down a no-op
  // instead; there are no seals to tap, so there is no reveal to record.
  const { renderRevealedThrough, renderUnlocked, commitReveals } = effectiveReveal({
    scoresUnlocked: spoilersOff,
    revealedThrough,
    unlocked,
    actualCount,
  })
  const commitReveal = commitReveals ? revealTo : noopReveal

  // The spoiler-free identity the cloud scorebook index stores alongside the
  // high-water mark (see api/reveal.js + ContinueScoring.jsx): enough to draw
  // a "pick up your pencil" card on the slate — never a score. Field paths
  // match what selectTeamMeta/selectGameBanner already read off gameData.
  // `finalHalfIndex` is null until the game ends, then the half-index of the
  // last half actually played (selectFinalHalfIndex) — what lets the server
  // know a card has nothing left to pick up once revealedThrough reaches it,
  // and drop it from the index instead of adding it back.
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
      finalHalfIndex: selectFinalHalfIndex(feed),
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
  // Same MLB-vs-MiLB gate TeamInfo.jsx's lineup pages use for RookiePill —
  // a rehab/optioned player still under the rookie limit gets DebutPill on a
  // MiLB roster/lineup surface here, not a second ROOKIE claim (see
  // showRookiePill, api/rookies.js).
  const isMlb = (meta.away.sportId ?? 1) === 1
  const firstPitchThrown = useMemo(() => selectHasFirstPitch(feed), [feed])

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
  const maxIdx = halfIndex(renderUnlocked, 'bottom')
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

  // Runs AND hits so far in the half currently being STEPPED through
  // (ADR-0016) — reported up from PlayByPlay (via HalfInning/InningPage, see
  // onRunsSoFar) so RollingLine's cell and R/H totals build up as you reveal
  // the half, instead of staying blank until it commits. No such signal
  // exists yet for errors (no per-entry classification like HIT_EVENT_TYPES),
  // so E still only moves once revealedThrough advances. Reset on every half
  // change — RollingLine only trusts this for the exact half-index it's
  // keyed to anyway, but there's no reason to hold it a moment longer.
  // Which corner the scorebug dock parks in, once the reader has moved it.
  // Null means "whatever the layout defaults to", so the dock doesn't jump on
  // mount; ScorebugMount owns both the default and the stepping arithmetic.
  // The STATE lives up here because that component is unmounted and remounted
  // every time the reader crosses between a sealed half (focus mode's anchored
  // band) and a revealed one (the floating dock) — its own state would be
  // discarded on each crossing, which is what used to throw the chosen corner
  // away. See ScorebugMount's header.
  const [cornerIdx, setCornerIdx] = useState(null)

  const [runsInProgress, setRunsInProgress] = useState(null)
  // Reset computed during render (not in an effect) on a half change — see
  // Headshot.jsx for the same pattern.
  const [prevCurIdxForRuns, setPrevCurIdxForRuns] = useState(curIdx)
  if (curIdx !== prevCurIdxForRuns) {
    setPrevCurIdxForRuns(curIdx)
    setRunsInProgress(null)
  }

  // The persistent scorebug HUD's live snapshot (src/components/Scorebug.jsx):
  // batter/pitcher/bases/outs for the half on screen, reported up from
  // HalfInning (see its own onLiveState doc — the entering-fallback baseline
  // before any of a half is revealed, PlayByPlay's own cap-respecting
  // snapshot once stepping starts). Tagged with the half-index it belongs to
  // (`forIdx`), same `forIdx`-tagged-and-trusted-only-on-match pattern
  // `stepInfo` above already uses for an identical race: `entries` is
  // rebuilt fresh every render in PlayByPlay.jsx (no memoization), so a
  // composite snapshot object arrives with a new identity every render even
  // when its content hasn't changed — `sameLiveState` below is the value-
  // equality guard that keeps that from turning into a re-render loop
  // (setState only actually replaces state when the CONTENT differs, not
  // just the reference). A page-turn transition or half navigation lands on
  // a fresh idx before that half's own effect has fired even once — reading
  // `liveState` through `forIdx === curIdx` below naturally falls back to
  // "nothing to show yet" rather than rendering the half just left behind.
  const [liveState, setLiveState] = useState(null)
  const curLiveState = liveState?.forIdx === curIdx ? liveState.data : null

  // Mobile placement (< 740px, WIDE_QUERY): the scorebug is fixed top-right
  // but stays invisible until the real linescore (RollingLine) has scrolled
  // out of view — an IntersectionObserver on RollingLine's own <section>
  // (forwarded via `sectionRef`, no wrapping div — see RollingLine.jsx).
  // Desktop (>= 740px) ignores this entirely and stays always-visible via
  // CSS (index.css's `.gamehud-dock` media query), so the observer simply
  // runs harmlessly there too rather than branching on width in JS.
  const rollingRef = useRef(null)
  const [pastLine, setPastLine] = useState(false)
  useEffect(() => {
    const el = rollingRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const obs = new IntersectionObserver(([entry]) => setPastLine(!entry.isIntersecting), {
      threshold: 0,
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // KEEPING UP WITH A LIVE GAME (ADR-0026). While the pass is running, a half
  // turning over for real — the game moving forward while you're actually
  // watching it — pulls the VIEW along with it. Catching yourself up by
  // paging forward through halves you fell behind on is your own navigation
  // and never gets overtaken by a further jump the moment you arrive; see
  // `shouldFollowLiveEdge` (liveEdge.js) for why two refs (not just curIdx)
  // are needed to tell those apart, and the git history on this effect for
  // the "sends you all over" complaint it replaced.
  //
  // This is navigation ONLY. It deliberately does not — and must not — touch the
  // reveal mark: there is nothing for a ratchet to advance, because under the
  // pass every half already renders open via effectiveReveal. That's the whole
  // reason this stopped being a second feature with its own consent. What you
  // watch live is watched under a pass that writes nothing, so your hand-scored
  // mark is exactly where you left it when the pass ends.
  //
  // replace:true so a long night never pollutes the Back button. Gated on
  // `passActive` rather than `spoilersOff`: a day locked in from an earlier
  // consent has no live game left to follow. Both refs reset on deactivation
  // so turning Follow Live back on re-triggers the initial catch-up-to-live
  // jump rather than reusing a stale reading.
  const lastEdgeRef = useRef(null)
  const lastSeenIdxRef = useRef(null)
  useEffect(() => {
    if (!passActive) {
      lastEdgeRef.current = null
      lastSeenIdxRef.current = null
      return
    }
    const edge = selectLiveEdge(feed, passActive)
    if (edge == null || selectIsFinal(feed)) return
    const prevEdge = lastEdgeRef.current
    const prevSeenIdx = lastSeenIdxRef.current
    const follow = shouldFollowLiveEdge(edge, prevEdge, prevSeenIdx, curIdx)
    lastEdgeRef.current = edge
    lastSeenIdxRef.current = follow ? edge : curIdx
    if (follow) {
      onInning(Math.floor(edge / 2) + 1, edge % 2 === 0 ? 'top' : 'bottom', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, passActive])

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
        isMlb={isMlb}
        revealedThrough={renderRevealedThrough}
        onReveal={commitReveal}
        prospectsData={prospectsData}
        rookiesData={rookiesData}
        callouts={callouts}
        workload={workload}
        workloadGameDate={workloadGameDate}
        vsTeam={vsTeam}
        highlights={highlights}
        atBatCountFor={atBatCountFor}
        focusOne={focus.focused}
        focusStep={focus.step}
        focusCursor={focus.cursor}
        onFocusInfo={focus.reportSteps}
        onStepInfo={reportStepInfo}
        onRunsSoFar={reportRunsSoFar}
        onLiveState={reportLiveState}
        getDerived={getDerived}
        runExpectancy={runExpectancy}
        winProbPoints={winProbPoints}
        winProbBigPlays={winProbBigPlays}
        winProbTreatment={winProbTreatment}
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
  // before it's revealed. Also null once the CURRENT half is a fully-revealed
  // top whose bottom half was skipped outright (selectSkippedBottomHalf — the
  // home team was already ahead, so the game ended right there) — there's no
  // "Bottom {n}th" to advance to, so this reads as "you've seen everything;
  // here's the box score" same as the true last half of the game does. Not a
  // spoiler: the gate on `curIdx <= revealedThrough` means this only ever
  // fires once the user has themselves fully revealed that top half.
  const skippedBottomHalf =
    effHalf === 'top' && curIdx <= renderRevealedThrough && selectSkippedBottomHalf(feed, effInning)
  const nextIdx = curIdx < maxIdx && !skippedBottomHalf ? curIdx + 1 : null
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
  const currentSealed = curIdx > renderRevealedThrough
  // Focus mode: a sealed half shows the linescore and ONE at-bat (useFocusMode
  // for the state, 11-innings.css for what folds away).
  const focus = useFocusMode(curIdx, currentSealed)
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

  // The three things a half-inning page reports back up. Each takes the
  // reporting half's own index as its first argument, so all three can be
  // stable for the life of the component: `InningPage` is memoized, and a memo
  // boundary is only worth anything if the props crossing it keep their
  // identity — an arrow rebuilt per render would miss on every render.
  //
  // Each is value-guarded. PlayByPlay rebuilds its report object on every render
  // (its `entries` are a reveal-only derivation, so they cannot be memoized
  // above the seal — ADR-0001), and replacing state on an unchanged report is
  // what turned one report into another render into another report: one
  // "Next at-bat" tap cost 264 renders of this whole tree before React's
  // nested-update ceiling stopped it.
  const reportStepInfo = useCallback((idx, info) => {
    setStepInfo((prev) => {
      const next = { ...info, forIdx: idx }
      return sameStepInfo(prev, next) ? prev : next
    })
  }, [])
  const reportRunsSoFar = useCallback((idx, runs, hits) => {
    setRunsInProgress((prev) => (sameRunsInProgress(prev, { idx, runs, hits }) ? prev : { idx, runs, hits }))
  }, [])
  const reportLiveState = useCallback((idx, data) => {
    setLiveState((prev) =>
      prev && prev.forIdx === idx && sameLiveState(prev.data, data)
        ? prev
        : { forIdx: idx, data: data ?? null },
    )
  }, [])

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
  const revealNextAtBat = () => {
    focus.followLatest() // show the new at-bat even if the reader paged back
    revealAtBat(effInning, effHalf, curAtBatCount === 0 ? 1 : (curStepInfo?.nextCap ?? curAtBatCount + 1))
  }

  // "Caught up to live" (ADR-0026): with the pass running on a game in progress,
  // the half being viewed IS the live frontier — everything played is open and
  // there's no next half yet. In that state the floating bar's forward action
  // ("Next ›" / the reveal split) would point at a half that hasn't happened, so
  // we swap it for a calm live status instead. Uses the SAME consent-gated
  // selectLiveEdge the follow effect does; false the instant the game goes Final
  // (the box-score affordance takes over) or the user pages back off the
  // frontier. Copy is admin-editable (scoresUnlocked.liveEdgeLabel); the
  // {inning} token goes through the registry's own fillTokens — the single
  // substitution choke point — rather than an ad hoc replace here, so an admin
  // who drops the token gets the gap tidied like every other field. The value is
  // the structural label of the half ALREADY on screen, never a score (see
  // registry.js's TOKENS spoiler guard).
  // Memoized like every other derivation on this page: it walks the whole
  // play-by-play backwards, and Follow Live is exactly the state in which this
  // component re-renders most often. The consent argument stays a dependency,
  // so the selector is still called only under a running pass.
  const liveEdgeIdx = useMemo(
    () => (passActive ? selectLiveEdge(feed, passActive) : null),
    [feed, passActive],
  )
  const atLiveEdge = liveEdgeIdx != null && curIdx >= liveEdgeIdx && !selectIsFinal(feed)
  const liveEdgeLabel = atLiveEdge
    ? copy('scoresUnlocked.liveEdgeLabel', {
        inning: `${effHalf === 'top' ? 'Top' : 'Bottom'} ${ordinal(effInning)}`,
      })
    : ''

  // Normalize an out-of-range URL (a mistyped /top12 deep link, a legacy link
  // past what's unlocked) to the half actually being shown, via replaceState so
  // Back never revisits the bogus address. Without this the URL, the stepnav's
  // remembered section, and any re-shared link all keep the phantom inning —
  // and the page would silently jump forward as reveals raise the clamp.
  const urlIdx = halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')
  useEffect(() => {
    if (urlIdx !== curIdx) onInning(effInning, effHalf, { replace: true })
  }, [urlIdx, curIdx, effInning, effHalf]) // eslint-disable-line react-hooks/exhaustive-deps

  // The workload file describes "now" — its availability rules only apply to
  // a slate-current game (same freshness window TeamInfo's bullpen board
  // uses). Null on an archival game, which silently disables the
  // bullpen-thin pre-half note.
  // preserve-manual-memoization below is a React-Compiler dry-run diagnostic:
  // this project has no babel-plugin-react-compiler in its build (checked —
  // vite.config.js has no such plugin), so "could not preserve memoization"
  // has no runtime effect here; it only means a FUTURE compiler adoption
  // wouldn't optimize this useMemo away. Not restructuring this file's
  // memoization to chase compiler-readiness alone — see the spoiler-rule
  // warnings throughout this component before touching any of it.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
  // Same React-Compiler dry-run diagnostic as workloadGameDate above (no
  // babel-plugin-react-compiler in this build — see that comment).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const marginNotes = useMemo(
    () =>
      buildMarginNotes(feed, renderRevealedThrough, callouts, { away: rosters.away.name, home: rosters.home.name }, {
        workload,
        gameDate: workloadGameDate,
      }),
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    [feed, renderRevealedThrough, callouts, rosters, workload, workloadGameDate],
  )

  // The win-probability line "so far" — the plays through the revealed half,
  // PLUS (when the half on screen is being stepped through one at-bat at a
  // time rather than committed whole, ADR-0016) the plays of that one half up
  // to whichever at-bat PlayByPlay has actually rendered. `curStepInfo` is
  // reported back up from inside PlayByPlay's own SealBox reveal function (see
  // its onStepInfo doc) — this component never computes that boundary itself,
  // only relays it, so the reveal-only rule (ADR-0001) still holds.
  //
  // `stepFrontierIdx` gates the step clamp to ONLY the half immediately after
  // the real reveal mark (`curIdx === renderRevealedThrough + 1`) — NOT just
  // whichever half happens to be on screen. ADR-0016's stepping cursor is keyed
  // to whatever half the user is VIEWING, which — per RollingLine's own
  // half-inning navigator — can be any unlocked regulation half regardless of
  // revealedThrough (a user can jump straight to, say, bottom 8 and start
  // stepping it with nothing else revealed). Every other reveal-only surface is
  // fine with that because each half's own data is self-contained, but win
  // probability is CUMULATIVE — a single plotted point from bottom 8 encodes
  // the whole game's trajectory up to that moment, not just that half's own
  // events. api/winprob.js's own `stepHalfIndex === throughHalf + 1` check
  // enforces this same adjacency independently (an earlier draft of this
  // feature relied on the caller alone getting it right and would have
  // plotted a full-game spoiler off a bare "Next at-bat" tap on a non-
  // adjacent half — caught in review before it shipped), so both layers stay
  // in place rather than trusting either one alone. Empty until at least one
  // half is revealed/stepped into in order, and at MiLB parks with no
  // win-prob feed — the chart then renders nothing.
  const stepFrontierIdx = curIdx === renderRevealedThrough + 1 ? curIdx : null
  // Same React-Compiler dry-run diagnostic as workloadGameDate above (no
  // babel-plugin-react-compiler in this build — see that comment).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const winProbPoints = useMemo(
    () =>
      selectWinProbPath(winProbability, {
        throughHalf: renderRevealedThrough,
        stepHalfIndex: stepFrontierIdx,
        throughAtBatIndex: stepFrontierIdx != null ? (curStepInfo?.lastAtBatIndex ?? null) : null,
      }),
    [winProbability, renderRevealedThrough, stepFrontierIdx, curStepInfo],
  )
  // The biggest-swing ledger — same reveal-only selector, same clamp
  // (committed halves plus the in-progress step), so it only ever covers
  // plays already on screen and grows one entry at a time right along with
  // the chart above (never hinting what's ahead).
  // Same React-Compiler dry-run diagnostic as workloadGameDate above (no
  // babel-plugin-react-compiler in this build — see that comment).
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const winProbBigPlays = useMemo(
    () =>
      selectWinProbBigPlays(winProbability, {
        throughHalf: renderRevealedThrough,
        stepHalfIndex: stepFrontierIdx,
        throughAtBatIndex: stepFrontierIdx != null ? (curStepInfo?.lastAtBatIndex ?? null) : null,
      }),
    [winProbability, renderRevealedThrough, stepFrontierIdx, curStepInfo],
  )

  // Every pitcher who has appeared in a revealed half-inning, with running
  // lines (see api/pitchers.js) — plus, same adjacency rule as the win-prob
  // pair above, the partial line for the ONE half currently being stepped
  // through one at-bat at a time, so the table (and the Arms tab) update
  // right along with "Next at-bat" instead of waiting for the half to commit.
  const pitcherLines = useMemo(
    () =>
      computePitcherLines(feed, renderRevealedThrough, {
        stepHalfIndex: stepFrontierIdx,
        throughAtBatIndex: stepFrontierIdx != null ? (curStepInfo?.lastAtBatIndex ?? null) : null,
      }),
    [feed, renderRevealedThrough, stepFrontierIdx, curStepInfo],
  )

  // PitchersSection's own prop, memoized rather than built inline: the section
  // is memoized, and an array literal rebuilt each render would defeat that.
  const pitcherTeams = useMemo(
    () => [
      { name: rosters.away.name, side: 'away', rows: pitcherLines.away },
      { name: rosters.home.name, side: 'home', rows: pitcherLines.home },
    ],
    [rosters, pitcherLines],
  )

  if (!firstPitchThrown) {
    return (
      <div className="innings">
        {cloudSync}
        {/* Keep the LINEUPS / INNINGS / BOX tabs on screen pre-game — a deep
            link straight to an innings URL (e.g. /…/top1) lands here, and
            without the nav there'd be no way to reach the lineup/box pages
            while the scoreboard is waiting for first pitch (only the browser
            Back button). */}
        {sectionNav && <div className="inningchrome">{sectionNav}</div>}
        <PregameScoreboard feed={feed} />
        <div className="pregameboard__refresh">
          <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} />
        </div>
      </div>
    )
  }

  // One prop bag, two consumers: the plain inline band below the reading pane
  // (unfocused), and ReferencePanel's tabbed column/sheet (focused). Same
  // components, same already-gated values either way — only WHERE they render
  // changes. Hoisted rather than spelled out at each call site so the two can
  // never drift apart.
  // Built once, rendered in one of two slots (see .innings__stage below) —
  // above the at-bat on the ordinary page, below the trail in focus mode.
  const rollingLine = (
    <RollingLine
      feed={feed}
      regulation={regulation}
      unlocked={renderUnlocked}
      revealedThrough={renderRevealedThrough}
      awayAbbr={meta.away.abbreviation}
      homeAbbr={meta.home.abbreviation}
      awayName={meta.away.clubName}
      homeName={meta.home.clubName}
      runsInProgress={runsInProgress}
      curIdx={curIdx}
      onSelect={(idx) => (idx > curIdx ? requestForwardHalf(idx) : goTo(idx))}
      disabled={turning}
      sectionRef={rollingRef}
    />
  )

  const refProps = {
    feed,
    callouts,
    marginNotes,
    pitcherTeams,
    effInning,
    effHalf,
    meta,
    treatment: winProbTreatment,
    prospectsData,
    rookiesData,
    isMlb,
    revealedThrough: renderRevealedThrough,
    workload,
    workloadGameDate,
  }

  return (
    <div className={`innings${focus.focused ? ' innings--focus' : ''}`}>
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
            disabled={curIdx === maxIdx || skippedBottomHalf}
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
        {/* The anchored console band — focus mode only. The scorebug as this
            screen's masthead rather than a dock floating over the at-bat card
            (ScorebugMount.jsx, ADR-0043); it spans both grid columns. The
            unfocused page mounts the same component further down instead,
            where it renders the floating dock — never both at once.

            .consolebar wraps it with DueUpConsole: the scorebug narrows back
            to its old dock width at wide widths (24-floating-nav-and-hud.css),
            and the width that frees up in this same row goes to a live
            next-3-batters card rather than sitting empty — DueUpConsole hides
            itself below the wide breakpoint, where the scorebug needs the
            row's full width for its own bumped-up mobile sizing instead. */}
        {focus.focused && (
          <div className="consolebar">
            <ScorebugMount
              started={started}
              live={curLiveState}
              feed={feed}
              unlocked={renderUnlocked}
              revealedThrough={renderRevealedThrough}
              runsInProgress={runsInProgress}
              meta={meta}
              treatment={winProbTreatment}
              focused
            />
            {/* Two conditions, each shutting off a way this card can lie or
                loiter:
                  • `!focus.postHalf` — not once the half is OVER. "Who's due
                    up" is meaningless after the 3rd out.
                  • `focus.steps === 0 || stepFrontierIdx != null` — the card
                    tracks the batting order as the reader steps, and it can
                    only do that with `lastAtBatIndex`, which InningViewer has
                    only for the half immediately after the reveal mark (see
                    the win-prob clamp above). Reach a half via RollingLine's
                    navigator and step it and the arithmetic silently falls
                    back to the PRE-half leadoff slot — the card would name the
                    same three men no matter how far in the reader got, and a
                    card that quietly stops being true is worse than no card.
                    BEFORE the first step, though, that fallback is not a
                    fallback: the pre-half leadoff slot is the right answer for
                    any half, which is the very figure UpNextBatters shows.

                THE OPENING STATE IS THIS CARD'S TOO. It used to start only at
                the first step, leaving the scorebug alone in the row — and
                `.gamehud--console:only-child` then stretched it across the
                whole stage, so a half OPENED on an outsized band with nothing
                beside it, which is the state the reader lands in every half.
                The half's first three batters fill that width instead, and the
                band keeps its 264px dock width throughout. `.upnext` in the
                stage below stands down while this card is up, so the same
                three men are not named twice (styles/focus/stage.css). */}
            {!focus.postHalf && (focus.steps === 0 || stepFrontierIdx != null) && (
              <DueUpConsole
                feed={feed}
                inning={effInning}
                half={effHalf}
                revealedThrough={renderRevealedThrough}
                stepAtBatIndex={curStepInfo?.lastAtBatIndex ?? null}
                teamId={effHalf === 'top' ? meta.away.id : meta.home.id}
              />
            )}
          </div>
        )}

        {/* `.innings__stage` is `display: contents` outside the wide+focused
            grid case (styles/focus/stage.css), so its children flow straight
            into .innings__grid's ordinary flex layout, unchanged. Only under
            `.innings--focus` at wide width does it become a real box in the
            grid's first column — CSS Grid auto-placement cannot otherwise tell
            these children apart from the reference column, which explicitly
            claims column 2, and an item auto-placed after an explicitly
            positioned one can resolve into that same column. One explicit item
            per column removes the ambiguity instead of relying on span math. */}
        <div className="innings__stage">
          {/* Focus mode MOVES the running line below the at-bat rather than
              dropping it (ADR-0043). Demoting it is right — mid-half it
              duplicates the console band's score, and writing R/H/E is a
              between-halves act — but removing it is not: its run cells double
              as the half-inning navigator (see RollingLine.jsx), the only way
              to jump to a half that isn't ±1 away, and e2e/innings-page-turn
              pins that. So it renders either way; only its place in the
              reading order changes. */}
          {!focus.focused && rollingLine}

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

          <FocusControls focus={focus} turning={turning} />

          {/* Focus mode's slot for it — under the trail, so the at-bat and the
              control that pages it stay adjacent and the linescore reads as the
              reference it is here. */}
          {focus.focused && rollingLine}
        </div>

        {/* Reference band. On the wide layout: pitchers + the fielding defense
            on the left, both lineups on the right. On a phone only Pitchers
            shows here — the lineups & defense render inline in the half instead
            (the -lineups / -defense blocks are hidden <740; the inline copies,
            .half__entering, are hidden ≥740). Gated to a reached half — the
            gate itself now lives in defenseEntering/lineupEntering (passed
            revealedThrough below), not re-derived here; this outer check only
            decides whether to print the wrapper/title around them, so a
            further-out half doesn't leave a title-only empty card.

            Focused: the same sections render through ReferencePanel instead —
            a tabbed, permanently-open reserved column at wide widths, or a chip
            row opening a sheet on a phone (ReferencePanel.jsx, ADR-0043). One
            section at a time, so the reader reaches the one they want without
            scrolling past four they don't. */}
        {focus.focused ? (
          <ReferencePanel {...refProps} rosters={rosters} />
        ) : (
          <>
            <ReferenceBand {...refProps} />
            <RosterPanels
              rosters={rosters}
              meta={meta}
              treatment={winProbTreatment}
              revealedThrough={renderRevealedThrough}
              prospectsData={prospectsData}
              rookiesData={rookiesData}
              isMlb={isMlb}
            />
          </>
        )}
      </div>

      {/* The floating scorebug dock, for the ordinary stacked page — desktop
          bottom-right always, mobile top-right once RollingLine has scrolled
          out of view (`pastLine`). Focus mode renders the SAME component
          up in the grid instead, anchored (see the `focus.focused` copy
          above); this one is mounted only when it isn't, so the two can never
          both be on screen. Everything else about it — the pre-game/`live`
          gate, the jersey-reactive marks, the reveal-progress runs arithmetic,
          and the tap-to-step-corners affordance — moved intact into
          ScorebugMount.jsx; see its header. */}
      {!focus.focused && (
        <ScorebugMount
          started={started}
          live={curLiveState}
          feed={feed}
          unlocked={renderUnlocked}
          revealedThrough={renderRevealedThrough}
          runsInProgress={runsInProgress}
          meta={meta}
          treatment={winProbTreatment}
          pastLine={pastLine}
          cornerIdx={cornerIdx}
          setCornerIdx={setCornerIdx}
        />
      )}

      {/* Floating bar — the same fixed blue bar the lineup pages page forward
          with, and the same destination-named + trailing-› convention their
          nextLabel buttons use ("Home team ›", "Innings ›") — no "Next:"
          prefix, no arrow glyph.

          IT CARRIES THE ONLY REFRESH, AT EVERY WIDTH. This used to read as a
          "duplicate … hidden again on the wide layout, where the top toolbar
          stays reachable", describing an arrangement where the toolbar and the
          bar each held a copy and swapped by breakpoint. Neither half of that
          is true any more: Refresh left `.inningchrome` entirely, and nothing
          hides `.refreshbtn--float` at any width (the only other RefreshButton
          on this screen is the pre-game scoreboard's, above). So the bar is
          where you reach for it during a live game, phone and desktop alike —
          which is also why `.pagenav--innings`'s hit-area rules measure around
          a Refresh row that is always there, and why focus mode's one-row bar
          has to shrink it to icon scale rather than drop it (styles/focus).

          Four states: a sealed half offers two reveal choices (ADR-0016) —
          step one at-bat, or the whole half at once; a half that just finished
          (or whose Summary the reader is on, focus.postHalf) offers
          Summary/next-half instead; otherwise it's the plain advance — "Box
          score ›" at the furthest revealed inning (never "Top 10th ›", which
          would leak the game going to extras) or the next-half label once one
          unlocks. */}
      <div className={`pagenav pagenav--innings${focus.focused ? ' pagenav--focus' : ''}`}>
        <RefreshButton
          onReload={onReload}
          loading={loading}
          lastUpdated={lastUpdated}
          className="refreshbtn--float"
        />
        {atLiveEdge ? (
          <div className="liveedge" role="status" aria-live="polite">
            <span className="liveedge__dot" aria-hidden="true" />
            <span className="liveedge__label">{liveEdgeLabel}</span>
          </div>
        ) : focus.postHalf ? (
          // The half just finished (or the reader's on its Summary,
          // focus.summaryOpen) — plain .btn/.btn--next skins, not the
          // kraft-seal .btn--reveal below: nothing here is sealed anymore.
          <div className="revealsplit">
            <button
              type="button"
              className={`btn revealsplit__btn ${focus.summaryOpen ? 'is-active' : ''}`}
              onClick={focus.openSummary}
              aria-current={focus.summaryOpen || undefined}
            >
              Summary
            </button>
            {nextIdx != null ? (
              <button
                className="btn btn--next revealsplit__btn"
                onClick={() => requestForwardHalf(nextIdx)}
                aria-disabled={turning || undefined}
              >
                {nextLabel} ›
              </button>
            ) : (
              <button className="btn btn--next revealsplit__btn" onClick={onBoxScore}>
                Box score ›
              </button>
            )}
          </div>
        ) : currentSealed ? (
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
