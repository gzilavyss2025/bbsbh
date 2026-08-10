import { useCallback, useState } from 'react'
import { AtBatTrail } from './AtBatTrail.jsx'

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
  // Whether the reader tapped "Summary" for the half that just finished —
  // see `held`/`postHalf` below. A deliberate choice, so it only ever moves
  // forward on request, never automatically.
  const [summaryOpen, setSummaryOpen] = useState(false)
  // Whether THIS half (curIdx) has been seen sealed at all since the reader
  // arrived on it — the difference between "I was just stepping through this
  // and it completed" (held, below) and "I jumped straight to an old,
  // already-committed half" (never held). Starts at whatever currentSealed
  // already is, so arriving on a fresh sealed half still counts.
  const [sealedSeen, setSealedSeen] = useState(currentSealed)

  // Reset computed during render (not in an effect) on a half change — the
  // same pattern InningViewer's `runsInProgress` reset and Headshot.jsx use. A
  // cursor and a count both describe the half that just left the screen.
  const [prevIdx, setPrevIdx] = useState(curIdx)
  if (curIdx !== prevIdx) {
    setPrevIdx(curIdx)
    setStep(null)
    setSteps(0)
    setItems([])
    setSummaryOpen(false)
    setSealedSeen(currentSealed)
  } else if (currentSealed && !sealedSeen) {
    setSealedSeen(true)
  }

  // The half just finished revealing while the reader was watching it (3rd
  // out, curIdx unchanged) — `held` keeps focus mode's single-at-bat view on
  // screen (cursor already lands on the final entry, see below) instead of
  // snapping straight to the unfocused page, until they deliberately tap
  // Summary (openSummary). `postHalf` covers both that moment and the
  // summary screen it leads to — the ONE flag the bottom bar keys off to
  // show Summary/next-half controls instead of the ordinary reveal/advance
  // ones, for as long as this half stays the one on screen.
  const held = sealedSeen && !currentSealed && !summaryOpen
  const postHalf = sealedSeen && !currentSealed
  const focused = currentSealed || held
  const openSummary = useCallback(() => setSummaryOpen(true), [])
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

  return {
    focused,
    held,
    postHalf,
    summaryOpen,
    openSummary,
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
// reference band — is ReferencePanel.jsx now: a permanently open, tabbed
// reference column (a chip row and sheet on a phone), rather than a button that
// also switched the feed back to the stacked row layout.
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
