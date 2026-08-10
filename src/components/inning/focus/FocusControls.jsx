import { useCallback, useEffect, useState } from 'react'
import { AtBatTrail } from './AtBatTrail.jsx'

// Focus mode's state for the innings viewer (InningViewer.jsx): while the half
// on screen is still sealed, the page shows the linescore and ONE at-bat — the
// step the reader is on — with the reference band living in ReferenceRail.jsx
// instead of the multi-card row layout.
//
// Three pieces of state, no derivations anyone else can get wrong:
//
//  • `railOpen` — has the reader opened ReferenceRail's lineup/defense panel.
//    Defaults OPEN: a hand-scorer needs that reference while scoring
//    (ADR-0010), so a sealed half shouldn't make them tap for it. Sticky for
//    the life of the screen once toggled, same as before — someone who closes
//    it (for a narrower phone sheet, or more room) wants it closed for the
//    next half too. Unlike the old `restOpen`, this no longer gates `focused`
//    — the rail is reference material now, not "the rest of the page", so
//    opening or closing it never switches the feed back to the stacked row
//    layout.
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
  const [railOpen, setRailOpen] = useState(true)
  const [step, setStep] = useState(null)
  const [steps, setSteps] = useState(0)
  const [items, setItems] = useState([])

  // Reset computed during render (not in an effect) on a half change — the
  // same pattern InningViewer's `runsInProgress` reset and Headshot.jsx use. A
  // cursor and a count both describe the half that just left the screen.
  const [prevIdx, setPrevIdx] = useState(curIdx)
  if (curIdx !== prevIdx) {
    setPrevIdx(curIdx)
    setStep(null)
    setSteps(0)
    setItems([])
  }

  const focused = currentSealed
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
  const openRail = useCallback(() => setRailOpen(true), [])
  const closeRail = useCallback(() => setRailOpen(false), [])

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
    railOpen,
    openRail,
    closeRail,
    step,
    steps,
    items,
    cursor,
    reportSteps,
    stepBack,
    stepNext,
    goToStep,
    followLatest,
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
// reference band — is ReferenceRail.jsx now: a persistent rail rather than a
// button that also switched the feed back to the stacked row layout (see
// useFocusMode's header comment on why `railOpen` no longer gates `focused`).
//
// Purely presentational, the same discipline RollingLine/Scorebug keep: every
// value arrives already resolved and already reveal-gated (see PlayByPlay's
// note on `items`). Takes the aria-disabled mid-turn guard every other
// control on this page uses — paging resizes .turnscene, which
// InningPageTurn answers by snapping a turn in flight.
export function FocusControls({ focus, turning }) {
  const { focused, cursor, steps: total, items, step, stepBack, stepNext, goToStep, followLatest } = focus
  if (!focused || total <= 1) return null
  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      stepBack()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      stepNext()
    }
  }
  return (
    <div onKeyDown={onKeyDown}>
      <AtBatTrail
        items={items}
        cursor={cursor}
        following={step == null}
        onSelect={goToStep}
        onFollowLatest={followLatest}
        turning={turning}
      />
    </div>
  )
}
