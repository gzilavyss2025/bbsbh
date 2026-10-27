import { useCallback, useEffect, useState } from 'react'
import { CLOSE_SEQUENCE_MS, STEP_HOLD_MS } from './beats.js'
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { focusWindowed, holdsAdvance, readsBack, stepsAhead } from './focusView.js'

// The innings viewer's play-by-play mode state (InningViewer.jsx). The
// console chrome (the anchored band, the tabbed ReferencePanel) is
// unconditional now — every half gets it, live or historical. What this hook
// decides is only WINDOWED vs. STACKED: every half shows ONE at-bat — the
// step the reader is on — until the reader taps "See the whole half", which
// lays every card of a revealed half out at once (#1539). A half read back
// (revealed before the reader saw it sealed) opens on its FIRST at-bat and
// the bar's "Next at-bat ›" steps it, cursor only; a sealed or live half
// follows the newest, as before.
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
//    reader having paged back, or a half read back starting at 0.
//  • `steps` — how many steps are revealed, reported up from PlayByPlay. A
//    count, never an entry: this hook is spoiler-free and must stay that way,
//    since it is called from the component's top level where a reveal-only
//    derivation may never run (ADR-0001).
//
// Nothing here reveals anything. `steps` only ever counts what the reveal cap
// (ADR-0016's `stepCap`) already permits, and paging is clamped inside it, so
// focus mode adds no second reveal boundary — revealing stays the floating
// bar's "Next at-bat" alone.
export function useFocusMode(curIdx, currentSealed, halfLive) {
  const [step, setStep] = useState(readsBack(currentSealed, halfLive) ? 0 : null)
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
  // trail (FocusControls below), rendered on any revealed windowed half, that
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
  // THE STEP HOLD (beats.js): true for STEP_HOLD_MS after a step lands a half
  // read back on its last at-bat. It rides the bar's `closing` hold below.
  const [stepHeld, setStepHeld] = useState(false)

  // Reset computed during render (not in an effect) on a half change — the
  // same pattern InningViewer's `runsInProgress` reset and Headshot.jsx use. A
  // cursor and a count both describe the half that just left the screen.
  const [prevIdx, setPrevIdx] = useState(curIdx)
  if (curIdx !== prevIdx) {
    setPrevIdx(curIdx)
    setStep(readsBack(currentSealed, halfLive) ? 0 : null)
    setSteps(0)
    setItems([])
    setSealedSeen(currentSealed)
    setSummaryOpen(false)
    setClosePhase('idle')
    setStepHeld(false)
  } else if (currentSealed && !sealedSeen) {
    setSealedSeen(true)
  }

  // The half just finished revealing while the reader was watching it (3rd
  // out, curIdx unchanged) — the single-at-bat view holds on screen (the
  // cursor already lands on the final entry, see below) rather than snapping
  // straight to the stacked whole-half view underneath the play still being
  // written down, for as long as this half stays the one on screen.
  //
  // FOCUS CHROME (the console band, the tabbed reference panel) IS
  // UNCONDITIONAL NOW — it is no longer what this flag decides. `postHalf` is
  // the STATE (the half finished under the reader's eyes and is still on
  // screen) and `windowed` is which of the two PLAY-BY-PLAY MODES is showing:
  // one at-bat at a time (windowed) or every card in the half at once
  // (stacked, `!windowed`). They part ways again exactly where the pre-#685
  // `held` flag did — opening the summary link drops out of the windowed mode
  // while `postHalf` stays true, which is what keeps ConsoleBand's gate and
  // the bar's own states reading the fact rather than the mode.
  const postHalf = sealedSeen && !currentSealed
  const windowed = focusWindowed(currentSealed, summaryOpen)

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

  useEffect(() => {
    if (!stepHeld) return undefined
    const t = setTimeout(() => setStepHeld(false), STEP_HOLD_MS)
    return () => clearTimeout(t)
  }, [stepHeld])

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
  const stepNext = useCallback(() => {
    const next = Math.min(last, cursor + 1)
    setStep(next)
    if (holdsAdvance({ next, steps, sealedSeen })) setStepHeld(true)
  }, [last, cursor, steps, sealedSeen])
  // Jump straight to a step — what a trail chip does (AtBatTrail.jsx), rather
  // than only walking ±1.
  const goToStep = useCallback((n) => setStep(Math.min(last, Math.max(0, n))), [last])
  // Back to following the newest — what revealing a fresh at-bat should do
  // even if the reader had paged back to an earlier one.
  const followLatest = useCallback(() => setStep(null), [])
  // The whole-half link's one action (see the summary note above). A sealed
  // half ignores it — `focusWindowed` keeps a sealed half windowed.
  const openSummary = useCallback(() => setSummaryOpen(true), [])

  return {
    windowed,
    // Read back from at-bat 1: no "live at-bat" to go back to (FocusTrail).
    readBack: readsBack(sealedSeen, halfLive),
    // "See the whole half": any revealed half still one at-bat at a time.
    summaryLink: windowed && !currentSealed,
    // The bar's cursor-only "Next at-bat ›" (InningActionBar.jsx).
    stepAhead: stepsAhead({ windowed, sealedSeen, cursor, steps }),
    // The layout reads `closePhase`; the action bar reads `closing`, which also
    // covers the step hold above. Otherwise two names for one fact, same split as `postHalf`/`windowed` above — one is the
    // state of the animation, the other is whether a control is held.
    closePhase,
    closing: closePhase === 'running' || stepHeld,
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
