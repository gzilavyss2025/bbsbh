import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  selectInningCount,
  selectRegulationInnings,
  selectTeamMeta,
  selectSkippedBottomHalf,
  selectIsFinal,
  selectFinalHalfIndex,
  halfIndex,
  selectDelays,
} from '../api/select.js'
import { selectHasFirstPitch } from '../api/playbyplay/firstPitch.js'
import { selectLiveHalf } from '../api/liveEdge.js'
import { buildMarginNotes } from '../api/pitcher-callouts.js'
import { ordinal } from '../lib/format.js'
import { RefreshButton } from '../components/ui/control/RefreshButton.jsx'
import { useFocusMode } from '../components/inning/focus/FocusControls.jsx'
import { bookIsClosed } from '../components/inning/focus/beats.js'
import { InningsHeader } from './gameview/InningsHeader.jsx'
import { PregameScoreboard } from '../components/inning/PregameScoreboard.jsx'
import { useRevealProgress } from '../hooks/useRevealProgress.js'
import { effectiveReveal } from '../hooks/revealProgressCore.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { useStampUnseal } from '../hooks/useStamps.js'
import { CalloutLedgerProvider, useCalloutLedgerValue } from '../hooks/useCalloutLedger.js'
import { useHeadshotPrefetch } from '../hooks/useHeadshotPrefetch.js'
import { sameLiveState } from '../lib/scorebug/liveState.js'
import { formatDelay } from '../components/inning/DelayCard.jsx'
import { gamedayNotices } from './gameday/next/notices.js'
import { GamedayNextMount } from './gameday/next/GamedayNextMount.jsx'
import { GamedayEngine } from './gameday/next/engine/GamedayEngine.jsx'
import { CAUGHT_UP, atLiveEdge, canStepIn, followLive, caughtUpAdvance, forwardAdvance, nextSub, openingChangeHeld, readBackAfter, readBackStepOf, replayTap, stepCapAt, stepWords, usePitchMode } from './gameday/next/steps/subStep.js'

// RevealCloudSync.jsx imports @clerk/clerk-react at its top, so it's only
// dynamically imported (and only then does that SDK ever reach a user's
// device) when a deploy actually configures Clerk — see main.jsx's matching
// dynamic import and clerkConfig.js.
const RevealCloudSync = isClerkEnabled
  ? lazy(() => import('../components/sync/RevealCloudSync.jsx').then((m) => ({ default: m.RevealCloudSync })))
  : null

// Stand-in for `revealTo` while this game is stamped (see effectiveReveal's
// `commitReveals`). Module-scope so its identity is stable
// across renders, and a real function rather than undefined because the engine's
// SealBox calls onReveal directly, not via `?.()`.
const noopReveal = () => {}

// Value-equality checks for the other two things GamedayEngine reports back up
// (`runsInProgress`, `stepInfo`), for exactly the reason `sameLiveState` (lib/scorebug/liveState.js)
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
  onLineup,
  gameStatus,
  refreshFailed,
  onReload,
  loading,
  lastUpdated,
  winProbTreatment,
  callouts,
  workload,
  onSketch,
}) {
  const actualCount = useMemo(() => selectInningCount(feed), [feed])
  const regulation = useMemo(() => selectRegulationInnings(feed), [feed])

  // THE HALF THE GAME IS BEING PLAYED IN, or -1 (ADR-0055). Ungated and read at
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
  const { revealedThrough, revealTo, mergeRevealedThrough, unlocked, atBatCountFor, revealAtBat, subFor, revealSub } =
    useRevealProgress(feed, regulation, actualCount)
  const [pitchMode, setPitchMode] = usePitchMode(feed?.gamePk) // Gameday's At-bat | Pitch (ADR-0123)

  // THE ONE OPENER (ADR-0048): the reader's own stamp on this game. A stamp is
  // minted only from inside a revealed box score of a FINAL game and records "I
  // was there", so re-sealing a game they stamped protects them from nothing.
  // It is a render override that unseals every half without ever touching the
  // persisted reveal mark. `revealedThrough` / `unlocked` above stay the real,
  // ratcheted, cloud-synced values — they are what feeds useRevealProgress,
  // RevealCloudSync, and localStorage, and they must never see the override
  // (see effectiveReveal's contract). Everything that only *renders* reads the
  // `render*` values below instead; for an unstamped game they ARE the real
  // values (identity), so the default spoiler-safe path is byte-for-byte
  // unchanged.
  //
  // `commitReveals` is the other half of that contract and must not be dropped:
  // a half rendering revealed mounts its SealBox force-revealed, and SealBox
  // fires onReveal on ANY transition to shown — flag included. Handing revealTo
  // straight down would therefore ratchet the REAL mark for every half viewed
  // on a stamped game (and cloud-sync it). While stamped we hand down a no-op
  // instead; there are no seals to tap, so there is no reveal to record.
  //
  // Why a latch rather than `isStamped` straight: useStampUnseal's own header.
  const stamped = useStampUnseal(feed?.gamePk)

  const { renderRevealedThrough, renderUnlocked, commitReveals } = effectiveReveal({
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
  const gameDate = feed?.gameData?.datetime?.officialDate ?? null
  const firstPitchThrown = useMemo(() => selectHasFirstPitch(feed), [feed])

  // Warm the headshot CDN for both rosters as soon as there's an at-bat feed
  // to step through — see useHeadshotPrefetch's own header.
  useHeadshotPrefetch(feed, firstPitchThrown)

  // The page being shown, as a half-index clamped to what's unlocked. The last
  // navigable page is the bottom of the last unlocked inning.
  const maxIdx = halfIndex(renderUnlocked, 'bottom')
  const curIdx = Math.min(
    Math.max(0, halfIndex(inning || 1, half === 'bottom' ? 'bottom' : 'top')),
    maxIdx,
  )
  const effInning = Math.floor(curIdx / 2) + 1
  const effHalf = curIdx % 2 === 0 ? 'top' : 'bottom'
  // Rain and other stoppages, spoiler-free (selectDelays): the strip under the band names the one in this half.
  const delays = useMemo(() => selectDelays(feed), [feed])
  const goTo = (idx) => onInning(Math.floor(idx / 2) + 1, idx % 2 === 0 ? 'top' : 'bottom')

  // Runs AND hits so far in the half currently being STEPPED through
  // (ADR-0016) — reported up from GamedayEngine (see onRunsSoFar) so the line score's cell and R/H totals build up as you reveal
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

  // The persistent scorebug HUD's live snapshot (components/gamehud/HeaderBug.jsx):
  // batter/pitcher/bases/outs for the half on screen, reported up from
  // GamedayEngine (the entering-fallback baseline before any of a half is
  // revealed, the half report's cap-respecting snapshot once stepping starts). Tagged with the half-index it belongs to
  // (`forIdx`), same `forIdx`-tagged-and-trusted-only-on-match pattern
  // `stepInfo` above already uses for an identical race: `entries` is
  // rebuilt on every report from GamedayEngine, so a
  // composite snapshot object arrives with a new identity every render even
  // when its content hasn't changed — `sameLiveState` below is the value-
  // equality guard that keeps that from turning into a re-render loop
  // (setState only actually replaces state when the CONTENT differs, not
  // just the reference). A half navigation lands on
  // a fresh idx before that half's own effect has fired even once — reading
  // `liveState` through `forIdx === curIdx` below naturally falls back to
  // "nothing to show yet" rather than rendering the half just left behind.
  const [liveState, setLiveState] = useState(null)
  const curLiveState = liveState?.forIdx === curIdx ? liveState.data : null

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
  // stepped as far as the feed goes (ADR-0055). Together these swap the sealed
  // half's reveal PAIR for a single "Next at-bat" — there is no "rest of half"
  // to reveal while the half is still happening — and, at the edge, for a calm
  // live status rather than a tap that would move nothing.
  const currentHalfLive = curIdx === liveHalfIdx
  // The console chrome is unconditional now (every half gets the anchored
  // band + tabbed reference panel); useFocusMode only decides whether the
  // play-by-play windows to one at-bat or shows the whole half stacked.
  const focus = useFocusMode(curIdx, currentSealed, currentHalfLive)

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
  // What the engine and the panels may show: the stored count, moved to the sub-step's own
  // substitutions (stepCapAt: a change shows on its own tap, never with the result before it).
  // Stable across renders like atBatCountFor itself, so the engine's props stay stable.
  const engineCountFor = useCallback((inning, half) => stepCapAt(feed, inning, half, atBatCountFor(inning, half), subFor(inning, half)), [feed, atBatCountFor, subFor])
  // What the NEXT "reveal next at-bat" tap should pass to revealAtBat — null
  // until the half report has actually computed the half's entries
  // (nothing to report before the first tap, which just starts at 1).
  // Tagged with the half-index it was computed for (forIdx) and only trusted
  // when that still matches curIdx, rather than cleared via a separate
  // `useEffect(..., [curIdx])`: that reset raced against the engine's own
  // mount-time report-back effect (a child effect fires before a parent's in
  // the same commit), so navigating back into an already-partially-stepped
  // half could have the freshly-computed, correctly-bundled nextCap
  // immediately clobbered back to null by this component's own reset —
  // silently reintroducing the exact "stranded lone note" bug the half report's
  // effectiveCap fix exists to eliminate, just for the resume case instead of
  // the fresh-first-tap case. Tagging makes a stale value from a half the
  // user has since navigated away from self-invalidate on read, with no
  // separate reset step to race.
  const [stepInfo, setStepInfo] = useState(null)

  // The three things a half-inning page reports back up. Each takes the
  // reporting half's own index as its first argument, so all three can be
  // stable for the life of the component: the old `InningPage` was memoized, and a memo
  // boundary is only worth anything if the props crossing it keep their
  // identity — an arrow rebuilt per render would miss on every render.
  //
  // Each is value-guarded. the half report rebuilds its report object on every render
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
  // (ADR-0055). Only ever true while `currentHalfLive` — GamedayEngine reports it
  // as `capReached && !halfInProgress ? commit : atHalfEdge`, so the two can't
  // disagree — but the `&&` is kept here anyway: this drives a control the
  // reader taps, and a stale report from a half they have since navigated off
  // must not be able to draw a live status over a historical half.
  // The literal `1` for a fresh half's first tap is a starting guess, not a
  // guarantee: this component has no legitimate way to know whether the
  // half's first entry is a leading event note rather than a plate
  // appearance (computeHalfInningFeed is reveal-only, ADR-0001, so it can't
  // be consulted from here ahead of the engine's own render). stepCapAt
  // (engineCountFor) corrects an understated cap forward to the first step's
  // boundary, and the half report keeps it past the first at-bat card — a new
  // stepping entry point that bypasses both must preserve that correction, or
  // the "reveal just a lone note" bug this pairing exists to prevent comes
  // back.
  const atHalfEdge = currentHalfLive && curStepInfo?.atHalfEdge === true

  const revealNextAtBat = () => {
    focus.followLatest() // show the new at-bat even if the reader paged back
    revealAtBat(effInning, effHalf, curAtBatCount === 0 ? 1 : (curStepInfo?.nextCap ?? curAtBatCount + 1))
  }
  // Gameday: one sub-step inside the next at-bat, until the tap that reveals the at-bat (ADR-0123).
  const curSub = subFor(effInning, effHalf)
  const revealNextStep = () => {
    const n = nextSub(feed, effInning, effHalf, curAtBatCount, curSub, pitchMode)
    if (n == null) return revealNextAtBat()
    if (n === CAUGHT_UP) return
    focus.followLatest()
    revealSub(effInning, effHalf, n)
  }
  // A half read back in pitch mode walks each pitch again (Gary, 2026-10-28): a cursor inside the
  // read-back step (focus.cursor), view state only, never stored, reset when the step or half moves.
  const [replay, setReplay] = useState({ idx: curIdx, cursor: focus.cursor, sub: 0 })
  // Stepped in to a batter at the plate before his first pitch: view state for this at-bat only.
  const [steppedIn, setSteppedIn] = useState(null)
  const atBatKey = `${curIdx}:${curAtBatCount}`
  const stepIn = currentSealed && currentHalfLive && steppedIn !== atBatKey && canStepIn(feed, effInning, effHalf, curAtBatCount, curSub)
  const followSub = currentSealed && currentHalfLive ? followLive(feed, effInning, effHalf, curAtBatCount, curSub, pitchMode, steppedIn === atBatKey) : curSub
  useEffect(() => {
    if (followSub > curSub) revealSub(effInning, effHalf, followSub)
  }, [followSub]) // eslint-disable-line react-hooks/exhaustive-deps
  const replaySub = replay.idx === curIdx && replay.cursor === focus.cursor ? replay.sub : 0
  const walkAt = replay.idx === curIdx && replay.cursor === focus.cursor && replay.at != null ? replay.at : focus.cursor // a chip's walk position
  // A trail chip on a half read back moves the read-back cursor to that at-bat, its pitches all shown (2026-10-29).
  const onPick = (abi) => { const n = readBackStepOf(focus.items, abi); if (n != null && curIdx <= renderRevealedThrough) { focus.goToStep(n); setReplay({ idx: curIdx, cursor: n, sub: 0, at: readBackAfter(feed, effInning, effHalf, abi) }) } }
  const replayNext = () => {
    const at = walkAt !== focus.cursor ? walkAt : null // kept as it walks on
    const n = replayTap(feed, effInning, effHalf, walkAt, replaySub)
    if (n == null) {
      setReplay({ idx: curIdx, cursor: focus.cursor + 1, sub: 0, at: at != null ? at + 1 : undefined })
      return focus.stepNext()
    }
    setReplay({ idx: curIdx, cursor: focus.cursor, sub: n, at: at ?? undefined })
  }

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
   
  const marginNotes = useMemo(
    () =>
      buildMarginNotes(feed, renderRevealedThrough, callouts, { away: meta.away.name || 'Away', home: meta.home.name || 'Home' }, {
        workload,
        gameDate: workloadGameDate,
      }),
     
    [feed, renderRevealedThrough, callouts, meta, workload, workloadGameDate],
  )

  // The per-game record of which callout notes this reader has already been
  // shown (src/hooks/useCalloutLedger.js), provided to the whole subtree below.
  // It lives HERE, above every keyed boundary: the old InningPage and BetweenInnings
  // both remounted on each half — exactly when the ledger has to remember — and
  // this component does not. It stores dedupeKeys and half indices, nothing
  // else, and can only ever remove a note from a ranked list.
  const calloutLedger = useCalloutLedgerValue(feed?.gamePk)

  if (!firstPitchThrown) {
    return (
      <div className="innings">
        {cloudSync}
        <InningsHeader started={false} meta={meta} treatment={winProbTreatment} date={gameDate} onSketch={onSketch} />
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

  // The advance: a step in the mode's words, else the next half, "Close the book" or the box score. It
  // keeps its hold: no forward move while the half closes (ADR-0046).
  // The live edge inside an at-bat still being played: a flag only, on a half in play (ADR-0055).
  const edge = atLiveEdge(atHalfEdge, currentHalfLive && currentSealed ? nextSub(feed, effInning, effHalf, curAtBatCount, curSub, pitchMode) : null)
  const advance = focus.stepAhead
    ? { label: stepWords(pitchMode), onClick: () => (pitchMode ? replayNext() : focus.stepNext()), reveal: pitchMode || undefined }
    : currentSealed
      ? stepIn ? { label: 'Step in', onClick: () => { focus.followLatest(); setSteppedIn(atBatKey) } }
      : edge ? caughtUpAdvance(loading, onReload) : { label: stepWords(pitchMode), onClick: revealNextStep, reveal: true }
      : nextIdx != null
        ? forwardAdvance(nextLabel, nextIdx, focus.closing, goTo)
        : { label: bookClosed ? 'Close the book' : 'Box score', disabled: focus.closing, onClick: () => !focus.closing && onBoxScore() }
  return (
    <CalloutLedgerProvider value={calloutLedger}>
      {cloudSync}
      <GamedayNextMount
        sectionNav={sectionNav}
        bug={{
          started, live: curLiveState, feed, unlocked: renderUnlocked, mark: renderRevealedThrough,
          runsInProgress, treatment: winProbTreatment, viewIdx: curIdx, viewInning: effInning, viewHalf: effHalf,
          season: gameDate, stepAtBatIndex: curStepInfo?.lastAtBatIndex ?? null,
        }}
        meta={meta}
        panels={{
          feed, meta, regulation, unlocked: renderUnlocked, mark: renderRevealedThrough, runsInProgress, curIdx,
          onSelect: goTo,
          inning: effInning, half: effHalf, step: curIdx <= renderRevealedThrough ? null : engineCountFor(effInning, effHalf),
          pitcherId: curLiveState?.midHalfPitcherId ?? null, treatment: winProbTreatment,
          openingHeld: currentSealed && openingChangeHeld(feed, effInning, effHalf, curAtBatCount, curSub), open: currentSealed ? { count: curAtBatCount, sub: curSub } : null, onPick, readAt: curIdx <= renderRevealedThrough ? focus.items[focus.cursor]?.atBatIndex ?? null : null, // open: per pitch; onPick/readAt: the read-back
        }}
        checkpoint={curIdx <= renderRevealedThrough && !focus.stepAhead ? { bundle: callouts, marginNotes, workload, gameDate: workloadGameDate } : null}
        engine={<GamedayEngine
          key={`${effInning}-${effHalf}`} feed={feed} inning={effInning} half={effHalf} idx={curIdx}
          revealedThrough={renderRevealedThrough} stepCount={engineCountFor(effInning, effHalf)} halfInProgress={curIdx === liveHalfIdx}
          windowed={focus.windowed} focusStep={focus.step} commitReveal={commitReveal}
          reportStepInfo={reportStepInfo} reportRunsSoFar={reportRunsSoFar} reportLiveState={reportLiveState} reportSteps={focus.reportSteps}
        />}
        advance={advance}
        open={currentSealed ? { count: curAtBatCount, sub: curSub, in: steppedIn === atBatKey || undefined } : focus.stepAhead && replaySub > 0 ? { count: walkAt + 1, sub: replaySub } : null}
        pitch={{ on: pitchMode, set: setPitchMode }}
        onBoxScore={onBoxScore}
        onLineup={onLineup}
        notices={[
          gameStatus?.label && `${gameStatus.label}${gameStatus.reason ? ` — ${gameStatus.reason}` : ''}`,
          ...gamedayNotices({
            format: formatDelay, delays, inning: effInning, half: effHalf, regulation, records: callouts?.teamRecords,
            names: { away: meta.away.clubName || meta.away.abbreviation, home: meta.home.clubName || meta.home.abbreviation },
          }),
          refreshFailed && 'Couldn’t refresh — showing the last update.',
        ].filter(Boolean)}
        refresh={selectIsFinal(feed) ? null : <RefreshButton onReload={onReload} loading={loading} lastUpdated={lastUpdated} />}
      />
    </CalloutLedgerProvider>
  )
}
