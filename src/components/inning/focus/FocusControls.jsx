import { useCallback, useEffect, useState } from 'react'
import { AtBatTrail } from './AtBatTrail.jsx'
import { CLOSE_SEQUENCE_MS } from './beats.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'

// Focus mode's state for the innings viewer (InningViewer.jsx): while the half
// on screen is still sealed, the page shows the linescore and ONE at-bat — the
// step the reader is on — with the reference band living in ReferencePanel.jsx
// instead of the multi-card row layout.
//
// Two pieces of state, no derivations anyone else can get wrong:
//
// (There used to be a third, `railOpen`, driving a Show/Hide flap on the
// reference column. It is gone with the flap: ReferencePanel.jsx is tabbed and
// permanently open at wide width, so there is no open/closed to remember, and
// the reserved grid track — not the state — is what keeps opening a section
// from reflowing the at-bat card. See ADR-0043.)
//
//  • `step` — which at-bat the feed is showing. null FOLLOWS the newest, so a
//    fresh reveal shows itself without the reader chasing it; a number is the
//    reader having paged back.
//  • `steps` — how many steps are revealed, reported up from PlayByPlay. A
//    count, never an entry: this hook is spoiler-free and must stay that way,
//    since it is called from the component's top level where a reveal-only
//    derivation may never run (ADR-0001).
//
// Nothing here reveals anything. `steps` only ever counts what the reveal cap
// (ADR-0016's `stepCap`) already permits, and paging is clamped inside it, so
// focus mode adds no second reveal boundary — revealing stays the floating
// bar's "Next at-bat" alone.
export function useFocusMode(curIdx, currentSealed) {
  const [step, setStep] = useState(null)
  const [steps, setSteps] = useState(0)
  const [items, setItems] = useState([])
  // SUMMARY IS BACK, AS A QUIET LINK — NOT AS THE BAR'S SECOND BUTTON.
  //
  // The original "Summary" shared the post-half bar with the next-half advance:
  // a one-directional `setSummaryOpen(true)` wearing a filled-navy pressed
  // skin, dead on a second press, and a second thing to decide on the one bar
  // that should only ever say "carry on". #685 removed it and sent the half's
  // NUMBERS to the console band instead (HalfTally.jsx), which was right — but
  // it left "how did the half unfold" (the cards laid out, the full stat row)
  // two navigations away: page off the half and come back. That is the wrong
  // price for a question a scorer asks at the end of most halves.
  //
  // So the state returns with a different surface: a paper-pill link under the
  // trail (FocusControls below), rendered only in the post-half hold, that
  // drops THIS half out of the focus layout — the ordinary revealed page, which
  // already exists, laid out exactly as paging away and back would show it.
  // One-directional per visit on purpose (the link disappears with the layout
  // it changed); navigating to any other half resets it, same as every other
  // piece of state here. The action BAR is untouched — still exactly one
  // forward action — which is the half of #685's decision that stands.
  // Whether THIS half (curIdx) has been seen sealed at all since the reader
  // arrived on it — the difference between "I was just stepping through this
  // and it completed" (held, below) and "I jumped straight to an old,
  // already-committed half" (never held). Starts at whatever currentSealed
  // already is, so arriving on a fresh sealed half still counts.
  const [sealedSeen, setSealedSeen] = useState(currentSealed)
  const [summaryOpen, setSummaryOpen] = useState(false)
  // THE CLOSING SEQUENCE (ADR-0046): 'idle' -> 'running' -> 'done', one way,
  // once per visit to a half. 'running' is the ~700ms in which the rule draws
  // and the four figures ink in (HalfClose.jsx) and the bar's forward action
  // is held; 'done' is everything after, which is the ordinary page as it
  // behaves today.
  const [closePhase, setClosePhase] = useState('idle')

  // Reset computed during render (not in an effect) on a half change — the
  // same pattern InningViewer's `runsInProgress` reset and Headshot.jsx use. A
  // cursor and a count both describe the half that just left the screen.
  const [prevIdx, setPrevIdx] = useState(curIdx)
  if (curIdx !== prevIdx) {
    setPrevIdx(curIdx)
    setStep(null)
    setSteps(0)
    setItems([])
    setSealedSeen(currentSealed)
    setSummaryOpen(false)
    setClosePhase('idle')
  } else if (currentSealed && !sealedSeen) {
    setSealedSeen(true)
  }

  // The half just finished revealing while the reader was watching it (3rd
  // out, curIdx unchanged) — focus mode holds its single-at-bat view on screen
  // (the cursor already lands on the final entry, see below) rather than
  // snapping to the unfocused page underneath the play still being written
  // down, for as long as this half stays the one on screen.
  //
  // The two names answer two questions: `postHalf` is the STATE (the half
  // finished under the reader's eyes and is still on screen) and `focused` is
  // the LAYOUT. They part ways again exactly where the pre-#685 `held` flag
  // did — opening the summary link leaves the focus layout while `postHalf`
  // stays true, which is what keeps ConsoleBand's gate and the bar's own
  // states reading the fact rather than the layout.
  const postHalf = sealedSeen && !currentSealed
  const focused = currentSealed || (postHalf && !summaryOpen)

  // THE SEQUENCE STARTS AT THE COMMIT AND NOWHERE ELSE. `postHalf` IS the
  // commit — the half finished under the reader's eyes — so keying the start
  // on it is what keeps the rule from beginning to draw a beat before the 3rd
  // out is the reader's to know (ADR-0046). Not on `steps`, not on the feed,
  // not on anything read out of the play that ended the half.
  //
  // Computed during render like the resets above, not in an effect, so the
  // first frame the rule exists on is already the first frame it is drawing
  // on. Under reduced motion it opens at 'done': the rule and its four figures
  // are simply there, and the forward action is live at once — skipped, never
  // slowed, which is the same choice SealBox's tear makes.
  if (postHalf && closePhase === 'idle') {
    setClosePhase(motionIsReduced() ? 'done' : 'running')
  }

  // The sequence's own clock, plus its interrupt: any tap or key ends it early
  // and the forward action goes live.
  //
  // THE LISTENERS GO ON THE NEXT TASK, NOT THIS ONE, and that is load-bearing.
  // The tap that commits the half ("Next at-bat", or "Rest of half") is still
  // propagating toward `window` when this effect runs — React flushes a
  // discrete event's re-render before the native event finishes bubbling — so
  // a listener attached synchronously here would be fired by the very tap that
  // started the sequence, and the rule would be cut off on its first frame
  // every single time.
  useEffect(() => {
    if (closePhase !== 'running') return undefined
    const finish = () => setClosePhase('done')
    const ran = setTimeout(finish, CLOSE_SEQUENCE_MS)
    const attach = setTimeout(() => {
      window.addEventListener('click', finish)
      window.addEventListener('keydown', finish)
    }, 0)
    return () => {
      clearTimeout(ran)
      clearTimeout(attach)
      window.removeEventListener('click', finish)
      window.removeEventListener('keydown', finish)
    }
  }, [closePhase])

  const last = Math.max(0, steps - 1)
  // What the feed should actually show: the cursor resolved against a count
  // that can shrink under it (a live poll can rebuild a half with fewer
  // entries), so this clamps rather than trusting `step`.
  const cursor = step == null ? last : Math.min(step, last)

  // Stable across renders: InningPage is a memo boundary (see its header), so
  // a handler rebuilt each render would miss on every comparison.
  const reportSteps = useCallback((n, its) => {
    setSteps(n)
    setItems(its || [])
  }, [])
  const stepBack = useCallback(() => setStep((s) => Math.max(0, (s == null ? last : s) - 1)), [last])
  const stepNext = useCallback(() => setStep((s) => Math.min(last, (s == null ? last : s) + 1)), [last])
  // Jump straight to a step — what a trail chip does (AtBatTrail.jsx), rather
  // than only walking ±1.
  const goToStep = useCallback((n) => setStep(Math.min(last, Math.max(0, n))), [last])
  // Back to following the newest — what revealing a fresh at-bat should do
  // even if the reader had paged back to an earlier one.
  const followLatest = useCallback(() => setStep(null), [])
  // The post-half link's one action (see the summary note above). Setting it
  // outside the post-half hold is harmless — `focused` only consults it there.
  const openSummary = useCallback(() => setSummaryOpen(true), [])

  return {
    focused,
    postHalf,
    // The layout reads `closePhase`; the action bar reads `closing`. Two names
    // for one fact, same split as `postHalf`/`focused` above — one is the
    // state of the animation, the other is whether a control is held.
    closePhase,
    closing: closePhase === 'running',
    step,
    steps,
    items,
    cursor,
    reportSteps,
    stepBack,
    stepNext,
    goToStep,
    followLatest,
    openSummary,
  }
}

// Focus mode's at-bat navigator, kept in its own component because it is one
// idea: while a half is still being scored the innings viewer shows the
// linescore and ONE at-bat (InningViewer's `focused`), and this is how the
// reader moves within it. AtBatTrail (below) pages through the steps ALREADY
// revealed — an at-bat plus the announcements bundled with it (ADR-0016's
// stepping) — as a row of chips rather than the old bare ‹ Back / label /
// Next › pager: with several at-bats already scored this half, "everything
// but the current one is hidden" was the actual complaint the pager left
// unaddressed (the trail keeps them all one tap away, not off screen).
// `stepBack`/`stepNext` survive as arrow-key handling on the strip rather
// than being deleted — a keyboard/swipe affordance, not a second UI.
//
// The rest of what used to live here — the fold button that brought back the
// reference band — is ReferencePanel.jsx now: a permanently open, tabbed
// reference column (a chip row and sheet on a phone), rather than a button that
// also switched the feed back to the stacked row layout.
//
// Purely presentational, the same discipline RollingLine/Scorebug keep: every
// value arrives already resolved and already reveal-gated (see PlayByPlay's
// note on `items`). Takes the aria-disabled mid-turn guard every other
// control on this page uses — paging resizes .turnscene, which
// InningPageTurn answers by snapping a turn in flight.
// Renders AtBatTrail directly, with no wrapper element of its own. There used
// to be a bare <div onKeyDown> here holding the arrow-key handling; it had no
// role, no tabIndex and no class, it could only ever receive those keys by
// bubbling from a focused cell inside it, and — because .innings__stage is
// `display: contents` on a phone — it landed in .innings__grid as an
// unstyleable flex item in its own right. The handler moved onto the cell
// container in AtBatTrail, which is the element the keys actually belong to.
export function FocusControls({ focus, turning }) {
  const { focused, postHalf, openSummary, cursor, steps: total, items, step, stepBack, stepNext, goToStep, followLatest } = focus
  // The summary link renders even when the trail doesn't (a one-batter
  // walk-off half has no trail to draw), so the gate is "nothing here at all"
  // rather than the trail's own `total <= 1`.
  if (!focused || (total <= 1 && !postHalf)) return null
  return (
    <>
      {total > 1 && (
        <AtBatTrail
          items={items}
          cursor={cursor}
          following={step == null}
          onSelect={goToStep}
          onStepBack={stepBack}
          onStepNext={stepNext}
          onFollowLatest={followLatest}
          turning={turning}
        />
      )}
      {/* Post-half only: drop this half out of the focus layout and show it
          laid out whole — the ordinary revealed page, in place. A paper pill
          in the trail's own control recipe, NOT a second button on the action
          bar (see useFocusMode's summary note for the #685 history). It
          disappears with the layout it changes; navigating resets. */}
      {postHalf && (
        <button
          type="button"
          className="trailstrip__summarybtn"
          aria-disabled={turning || undefined}
          onClick={openSummary}
        >
          See the whole half
        </button>
      )}
    </>
  )
}
