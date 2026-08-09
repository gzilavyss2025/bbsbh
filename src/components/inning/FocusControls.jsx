import { useCallback, useEffect, useState } from 'react'

// Focus mode's state for the innings viewer (InningViewer.jsx): while the half
// on screen is still sealed, the page shows the linescore and ONE at-bat — the
// step the reader is on — with everything else folded away behind a button.
//
// Three pieces of state, no derivations anyone else can get wrong:
//
//  • `restOpen` — has the reader folded the rest of the page back open. Sticky
//    for the life of the screen on purpose: someone who wants the lineups open
//    wants them open for the next half too.
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
  const [restOpen, setRestOpen] = useState(false)
  const [step, setStep] = useState(null)
  const [steps, setSteps] = useState(0)

  // Reset computed during render (not in an effect) on a half change — the
  // same pattern InningViewer's `runsInProgress` reset and Headshot.jsx use. A
  // cursor and a count both describe the half that just left the screen.
  const [prevIdx, setPrevIdx] = useState(curIdx)
  if (curIdx !== prevIdx) {
    setPrevIdx(curIdx)
    setStep(null)
    setSteps(0)
  }

  const focused = currentSealed && !restOpen
  const last = Math.max(0, steps - 1)
  // What the feed should actually show: the cursor resolved against a count
  // that can shrink under it (a live poll can rebuild a half with fewer
  // entries), so this clamps rather than trusting `step`.
  const cursor = step == null ? last : Math.min(step, last)

  // Stable across renders: InningPage is a memo boundary (see its header), so
  // a handler rebuilt each render would miss on every comparison.
  const reportSteps = useCallback((n) => setSteps(n), [])
  const stepBack = useCallback(() => setStep((s) => Math.max(0, (s == null ? last : s) - 1)), [last])
  const stepNext = useCallback(() => setStep((s) => Math.min(last, (s == null ? last : s) + 1)), [last])
  // Back to following the newest — what revealing a fresh at-bat should do
  // even if the reader had paged back to an earlier one.
  const followLatest = useCallback(() => setStep(null), [])
  const toggleRest = useCallback(() => setRestOpen((v) => !v), [])

  // Bring the at-bat to the top of the screen whenever it changes — a fresh
  // reveal or a page back/forward. Without this the single card still opens
  // wherever the chrome above it happens to end, which on a phone is below the
  // fold: the whole point of showing one at-bat is that it is the thing you
  // are looking at. `start`, not `center`: the card's own navigator and the
  // fold button sit underneath it, and centring the card put those two inside
  // the floating bar's fade. .pbp carries the scroll-margin (11-innings.css).
  //
  // Queries the feed by class rather than threading a ref down through
  // InningPage -> HalfInning -> SealBox -> PlayByPlay: four components would
  // have to carry a prop that only this effect uses, and the seal must keep
  // owning when that subtree exists at all (ADR-0002). Missing is fine — a
  // sealed half has no .pbp yet, and this simply does nothing.
  useEffect(() => {
    if (!focused || steps === 0) return
    const el = document.querySelector('.pbp')
    if (!el) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  }, [focused, cursor, steps])

  return {
    focused,
    restOpen,
    toggleRest,
    step,
    steps,
    cursor,
    reportSteps,
    stepBack,
    stepNext,
    followLatest,
  }
}

// Focus mode's two controls, kept together because they are one idea: while a
// half is still being scored the innings viewer shows the linescore and ONE
// at-bat (InningViewer's `focused`), and these are how the reader moves within
// it and gets the rest of the page back.
//
//  • The at-bat navigator pages through the steps ALREADY revealed — an at-bat
//    plus the announcements bundled with it (ADR-0016's stepping). It never
//    reveals: revealing stays the floating bar's "Next at-bat" alone, so this
//    adds no second reveal boundary. Deliberately mirrors .inningnav (the
//    half-inning navigator above the feed) — same ‹ Back / label / Next ›
//    shape, one level quieter, so paging within a half reads as the same kind
//    of move as paging between halves.
//  • The fold button brings back the stat/WPA row, the reference band and the
//    rosters (see 11-innings.css). Quiet paper-and-rule .btn rather than a
//    filled one: a way to see more of the page, not the page's primary action.
//
// Purely presentational, the same discipline RollingLine/Scorebug keep: every
// value arrives already resolved and already reveal-gated. `total` is a COUNT
// of revealed steps; nothing here can reach past it. Both take the
// aria-disabled mid-turn guard every other control on this page uses —
// toggling either resizes .turnscene, which InningPageTurn answers by snapping
// a turn in flight.
export function FocusControls({ focus, sealed, turning }) {
  const { focused, cursor: step, steps: total, restOpen, stepBack, stepNext, toggleRest } = focus
  return (
    <>
      {focused && total > 1 && (
        <nav className="abstep" aria-label="At-bat navigator">
          <button
            type="button"
            onClick={stepBack}
            disabled={step <= 0}
            aria-disabled={turning || undefined}
            aria-label="Previous at-bat"
          >
            ‹ Back
          </button>
          <span className="abstep__label">
            At-bat <span className="abstep__n">{step + 1}</span> of <span className="abstep__n">{total}</span>
          </span>
          <button
            type="button"
            onClick={stepNext}
            disabled={step >= total - 1}
            aria-disabled={turning || undefined}
            aria-label="Next at-bat already revealed"
          >
            Next ›
          </button>
        </nav>
      )}
      {sealed && (
        <button
          type="button"
          className="btn innings__foldbtn"
          aria-expanded={restOpen}
          aria-disabled={turning || undefined}
          onClick={toggleRest}
        >
          {restOpen ? 'Hide the rest of the page' : 'Show the rest of the page'}
        </button>
      )}
    </>
  )
}
