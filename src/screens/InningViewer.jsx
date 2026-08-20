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
import { selectLiveEdge, selectLiveHalf, shouldFollowLiveEdge } from '../api/liveEdge.js'
import { useCopy } from '../copy/copyContext.js'
import { selectWinProbPath, selectWinProbBigPlays } from '../api/winprob.js'
import { computePitcherLines } from '../api/pitchers.js'
import { buildMarginNotes } from '../api/pitcher-callouts.js'
import { ordinal } from '../lib/format.js'
import { RefreshButton } from './TeamInfo.jsx'
import { RollingLine } from '../components/gamehud/RollingLine.jsx'
import { ExtrasBanner } from '../components/inning/ExtrasBanner.jsx'
import { FocusControls, FocusTrail, useFocusMode } from '../components/inning/focus/FocusControls.jsx'
import { InningActionBar } from '../components/inning/InningActionBar.jsx'
import { bookIsClosed } from '../components/inning/focus/beats.js'
import { ReferencePanel } from '../components/inning/focus/ReferencePanel.jsx'
import { DueUpNextCard } from '../components/playbyplay/DueUpNextCard.jsx'
import { DelayCard } from '../components/inning/DelayCard.jsx'
import { ConsoleBand } from '../components/gamehud/ConsoleBand.jsx'
import { InningPage } from './innings/InningPage.jsx'
import { InningPageTurn } from '../components/page-turn/InningPageTurn.jsx'
import { PregameScoreboard } from '../components/inning/PregameScoreboard.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'
import { effectiveReveal } from '../hooks/revealProgressCore.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { useStampUnseal } from '../hooks/useStamps.js'
import { CalloutLedgerProvider, useCalloutLedgerValue } from '../hooks/useCalloutLedger.js'

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
    a.atHalfEdge === b.atHalfEdge &&
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
  onScorecard,
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
  // Staging facts, resolved once by GameView and shared with the box score and
  // both lineup pages. Used only by focus mode's EXTRAS tab (ExtrasFacts.jsx)
  // — all three are spoiler-free, none is fetched on this screen's account.
  managers,
  uniforms,
  scorebookWeather,
  spoilersOff = false,
  passActive = false,
}) {
  const { t: copy } = useCopy()
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // THE HALF THE GAME IS BEING PLAYED IN, or -1 (ADR-0054). Ungated and read at
  // render top-level, which every other live reading on this screen is not —
  // `selectLiveHalf` reports an inning number and which half and nothing else
  // (see its header in api/liveEdge.js), and no value from it is rendered: the
  // ONLY things it decides are whether stepping to the last fetched at-bat may
  // commit this half, and which pair of buttons the floating bar draws. Both
  // must come from one reading, or the bar could offer a commit the page below
  // it has already decided to withhold.
  //
  // `-1` for "no half is in progress" rather than null, so the per-page test
  // below compares half-indexes to a half-index, in the same units.
  const liveHalf = useMemo(() => selectLiveHalf(feed), [feed])
  const liveHalfIdx = liveHalf?.inProgress ? liveHalf.idx : -1

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
  // THE THIRD OPENER (ADR-0048): the reader's own stamp on this game. A stamp is
  // minted only from inside a revealed box score of a FINAL game and records "I
  // was there", so re-sealing a game they stamped protects them from nothing.
  //
  // Read HERE rather than handed down beside `spoilersOff`, because the two are
  // different KINDS of fact. `spoilersOff` is a property of the DAY and needs
  // GameView's `officialDate` to resolve; a stamp is a property of this one
  // gamePk, which this screen already holds. Keeping them apart also keeps the
  // day-pass chrome honest — a stamped game must never make the banner announce
  // an unlocked day (see effectiveReveal, which takes them as two inputs).
  //
  // Why a latch rather than `isStamped` straight: useStampUnseal's own header.
  const stamped = useStampUnseal(feed?.gamePk)

  const { renderRevealedThrough, renderUnlocked, commitReveals } = effectiveReveal({
    scoresUnlocked: spoilersOff,
    stamped,
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
  // The half-index of the last half actually played, null until the game ends.
  // Two consumers, one call: the cloud scorebook index below, and focus mode's
  // action-bar label (`bookClosed`, further down).
  const finalHalfIndex = useMemo(() => selectFinalHalfIndex(feed), [feed])

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
      finalHalfIndex,
    }
  }, [feed, regulation, finalHalfIndex])

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
        revealedThrough={renderRevealedThrough}
        onReveal={commitReveal}
        callouts={callouts}
        vsTeam={vsTeam}
        highlights={highlights}
        atBatCountFor={atBatCountFor}
        halfInProgress={idx === liveHalfIdx}
        windowed={focus.windowed}
        focusStep={focus.step}
        onFocusInfo={focus.reportSteps}
        onStepInfo={reportStepInfo}
        onRunsSoFar={reportRunsSoFar}
        onLiveState={reportLiveState}
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
  // The half on screen is the one being played right now, and the reader has
  // stepped as far as the feed goes (ADR-0054). Together these swap the sealed
  // half's reveal PAIR for a single "Next at-bat" — there is no "rest of half"
  // to reveal while the half is still happening — and, at the edge, for a calm
  // live status rather than a tap that would move nothing.
  const currentHalfLive = curIdx === liveHalfIdx
  // The console chrome is unconditional now (every half gets the anchored
  // band + tabbed reference panel); useFocusMode only decides whether the
  // play-by-play windows to one at-bat or shows the whole half stacked.
  const focus = useFocusMode(curIdx, currentSealed)

  // THE BOOK IS CLOSED (ADR-0046): the reader has revealed every half actually
  // played. Two consequences below — the closing rule draws DOUBLE, and the
  // bar's last action is named as an act rather than a destination. Keyed on
  // the reveal mark against `finalHalfIndex` and NEVER on `selectIsFinal`;
  // bookIsClosed's header has the argument. `renderRevealedThrough`, same as
  // every other render consumer here.
  const bookClosed = bookIsClosed(renderRevealedThrough, finalHalfIndex)

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
  // Nothing left in the feed to step to, on a half that is still being played
  // (ADR-0054). Only ever true while `currentHalfLive` — PlayByPlay reports it
  // as `capReached && !halfInProgress ? commit : atHalfEdge`, so the two can't
  // disagree — but the `&&` is kept here anyway: this drives a control the
  // reader taps, and a stale report from a half they have since navigated off
  // must not be able to draw a live status over a historical half.
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
  const atHalfEdge = currentHalfLive && curStepInfo?.atHalfEdge === true

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

  // The per-game record of which callout notes this reader has already been
  // shown (src/hooks/useCalloutLedger.js), provided to the whole subtree below.
  // It lives HERE, above every keyed boundary: InningPage and BetweenInnings
  // both remount on each half — exactly when the ledger has to remember — and
  // this component does not. It stores dedupeKeys and half indices, nothing
  // else, and can only ever remove a note from a ranked list.
  const calloutLedger = useCalloutLedgerValue(feed?.gamePk)

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
  // BUILT FOR EVERY HALF NOW — the reference panel's ARMS tab renders
  // WinProbChart unconditionally (it used to be skipped entirely while
  // focused, InningPage's old `!focusOne` gate, since the chart was never
  // built at all — #686's "don't build what folds" argument). That argument
  // no longer applies: the chart is always on screen somewhere now, so
  // there's nothing left to build for nobody to see. The step-clamped path
  // below (`stepFrontierIdx` non-null) is consequently exercised on every
  // "Next at-bat" tap for the first time since that gate shipped — see this
  // refactor's spoiler-safety verification notes on `api/winprob.js`'s own
  // independent `stepHalfIndex === throughHalf + 1` enforcement, the second
  // layer this doesn't rely on alone.
  //
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

  // Rendered once, below the trail, in .innings__stage (see below) — its run
  // cells double as the half-inning navigator (the only way to reach a half
  // that isn't ±1 away), so it stays on screen at every reveal state.
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
    stepAtBatIndex: curStepInfo?.lastAtBatIndex ?? null,
    managers,
    uniforms,
    scorebookWeather,
    getDerived,
    runExpectancy,
    winProbPoints,
    winProbBigPlays,
    onScorecard,
  }

  return (
    <CalloutLedgerProvider value={calloutLedger}>
    <div className={`innings innings--focus innings--${focus.windowed ? 'windowed' : 'stacked'}`}>
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
        {/* The anchored console band — unconditional now. The scorebug as
            this screen's masthead rather than a dock floating over the at-bat
            card, plus whichever companion card the half's state calls for; it
            spans both grid columns. See ConsoleBand.jsx (ADR-0043) for the
            row's states. There is no floating dock any more — this is the
            scorebug's one placement. */}
        <ConsoleBand
          started={started}
          live={curLiveState}
          feed={feed}
          unlocked={renderUnlocked}
          revealedThrough={renderRevealedThrough}
          runsInProgress={runsInProgress}
          meta={meta}
          treatment={winProbTreatment}
          viewIdx={curIdx}
          viewInning={effInning}
          viewHalf={effHalf}
          getDerived={getDerived}
          currentSealed={currentSealed}
          closePhase={focus.closePhase}
          stepAtBatIndex={curStepInfo?.lastAtBatIndex ?? null}
          bundle={callouts}
          marginNotes={marginNotes}
          workload={workload}
          gameDate={workloadGameDate}
        />

        {/* `.innings__stage` is a real box in the grid's first column at wide
            width (styles/focus/stage.css) — CSS Grid auto-placement cannot
            otherwise tell these children apart from the reference column,
            which explicitly claims column 2, and an item auto-placed after an
            explicitly positioned one can resolve into that same column. One
            explicit item per column removes the ambiguity instead of relying
            on span math. */}
        <div className="innings__stage">
          {/* THE TRAIL, ABOVE THE HERO (ADR-0043's amendment). Every at-bat
              already revealed this half is what shows the half BUILDING — the
              point of watching it live rather than reading it after — landing
              right next to the card it describes, in the reader's normal
              top-to-bottom scan. The post-half "See the whole half" link
              stays under the card, by the bar it hands off to —
              `FocusControls` below still owns that link. */}
          <FocusTrail focus={focus} turning={turning} inning={effInning} half={effHalf} />

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

          {/* A preview of the OTHER side's next half, moved here from the
              ReferencePanel Arms tab: it belongs beside the cards it follows
              on, not tucked behind a tab a reader may not open. Its own gate
              (selectDueUpNext) is what makes this conditional — it renders
              nothing until the half on screen is fully revealed, i.e. right
              as "See the whole half" appears below it. */}
          <DueUpNextCard
            feed={feed}
            inning={effInning}
            half={effHalf}
            revealedThrough={renderRevealedThrough}
            awayId={meta.away.id}
            homeId={meta.home.id}
            awayName={meta.away.clubName}
            homeName={meta.home.clubName}
          />

          <FocusControls focus={focus} turning={turning} />

          {/* Under the trail, so the at-bat and the control that pages it stay
              adjacent and the linescore reads as the reference it is here —
              its run cells double as the half-inning navigator, the only way
              to jump to a half that isn't ±1 away (e2e/innings-page-turn pins
              this). */}
          {rollingLine}
        </div>

        {/* The reference shelf — pitchers, lineups, fielding defense, benches —
            through ReferencePanel: a tabbed, permanently-open reserved column
            at wide widths, or a chip row opening a sheet on a phone
            (ReferencePanel.jsx, ADR-0043). One section at a time, so the
            reader reaches the one they want without scrolling past four they
            don't. Unconditional now — every half gets it, live or historical. */}
        <ReferencePanel {...refProps} rosters={rosters} />
      </div>

      {/* The floating bar (components/inning/InningActionBar.jsx) — the three
          states it renders, the Refresh it always carries, and the hold the
          closing rule puts on its forward action all live in that file's
          header. Everything it needs is resolved here and handed down; it
          decides nothing about the reveal mark itself. */}
      <InningActionBar
        focused={focus.windowed}
        closing={focus.closing}
        turning={turning}
        refresh={
          /* Dropped once the game is over — the feed is complete and a refetch
             returns the same bytes. Same `selectIsFinal` test, for the same
             reason, that already drops the box score's own Refresh
             (screens/BoxScore.jsx). Revealing is unaffected: it reads the feed
             already in hand. */
          selectIsFinal(feed) ? null : (
            <RefreshButton
              onReload={onReload}
              loading={loading}
              lastUpdated={lastUpdated}
              className="refreshbtn--float"
            />
          )
        }
        atLiveEdge={atLiveEdge}
        liveEdgeLabel={liveEdgeLabel}
        currentSealed={currentSealed}
        halfLive={currentHalfLive}
        atHalfEdge={atHalfEdge}
        effInning={effInning}
        effHalf={effHalf}
        onRevealNextAtBat={revealNextAtBat}
        onRevealWholeHalf={revealWholeHalf}
        nextIdx={nextIdx}
        nextLabel={nextLabel}
        onForward={requestForwardHalf}
        bookClosed={bookClosed}
        onBoxScore={onBoxScore}
      />
    </div>
    </CalloutLedgerProvider>
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
