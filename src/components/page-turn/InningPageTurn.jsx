import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { PageCurlOverlay } from './PageCurlOverlay.jsx'
import { initialPageTurnState, isEligibleForCurl, reduce, shouldAnimateTurn } from './pageTurnState.js'

// A hard cap on how tall the turning scene can be before a curl is skipped —
// a very long revealed half (lots of play-by-play) makes a full-height
// rotate/clip animation look wrong and costs more to composite. Start
// conservative; tune against a real device once this is live (same footing
// as the CSS token choices in index.css).
const MAX_SCENE_HEIGHT_PX = 3000
const FALLBACK_DURATION_MS = 360 // mirrors --dur-slow, used only if the token can't be read
const FALLBACK_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)' // mirrors --ease-out

function readTurnTiming(el) {
  const style = getComputedStyle(el)
  const durationRaw = parseFloat(style.getPropertyValue('--dur-slow'))
  const easing = style.getPropertyValue('--ease-out').trim()
  return {
    duration: Number.isFinite(durationRaw) ? durationRaw : FALLBACK_DURATION_MS,
    easing: easing || FALLBACK_EASING,
  }
}

// Orchestrates a single forward-navigation page turn: idle -> preparing ->
// turning -> idle (see pageTurnState.js for the reducer this wraps). Renders
// the active half via `renderPage`, and — only for the duration of an actual
// turn — an inert preview of the destination half underneath it plus the
// decorative curl overlay on top, then hands off to `onCommit` exactly once,
// either immediately (ineligible destination, reduced motion, missing
// browser support, oversized scene) or after the WAAPI animation finishes.
//
// Exposes `requestHalf(idx)` via ref — the only entry point callers use for
// a forward jump; backward navigation is expected to keep calling `onCommit`
// (InningViewer's `goTo`) directly and never reach this component at all.
export const InningPageTurn = forwardRef(function InningPageTurn(
  { activeIdx, maxIdx, renderPage, onCommit, onStatusChange },
  ref,
) {
  const [state, dispatch] = useReducer(reduce, initialPageTurnState)
  const stateRef = useRef(state)
  stateRef.current = state
  const sceneRef = useRef(null)
  const runningAnimationsRef = useRef([])
  // index.css's blanket `@media (prefers-reduced-motion: reduce)` rule
  // collapses CSS transitions/animations to ~0ms, but that rule can't reach
  // this component's WAAPI (Element.animate()) timelines — those are driven
  // entirely from JS, outside the CSS cascade. This check is what actually
  // keeps a turn from playing under reduced motion; it's load-bearing, not
  // redundant with the CSS rule.
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useEffect(() => {
    onStatusChange?.(state.status)
  }, [state.status, onStatusChange])

  // Cancels any running WAAPI animations synchronously (before dispatching)
  // so the next render's active layer never inherits a leftover
  // clip-path/opacity from a `fill: 'both'` animation that never got a
  // chance to finish. Shared by snapToTarget and the external-nav interrupt
  // below — both need to tear the in-flight turn down, they just disagree on
  // whether to also commit.
  const cancelTurn = useCallback(() => {
    runningAnimationsRef.current.forEach((a) => a.cancel())
    runningAnimationsRef.current = []
    dispatch({ type: 'CANCEL' })
  }, [])

  // The shared exit for every "can't/shouldn't animate, but nothing else
  // navigated" case: a capability check failing right as a turn is accepted,
  // or a resize invalidating one already in flight. In both cases activeIdx
  // hasn't moved on its own, so finishing the turn ourselves via onCommit is
  // correct here.
  const snapToTarget = useCallback(() => {
    const { targetIdx } = stateRef.current
    cancelTurn()
    if (targetIdx != null) onCommit(targetIdx)
  }, [cancelTurn, onCommit])

  const requestHalf = useCallback(
    (toIdx) => {
      if (!isEligibleForCurl({ fromIdx: activeIdx, toIdx, maxIdx })) {
        // Not a real forward/unlocked destination — just commit, same as the
        // plain goTo path callers use for backward navigation.
        onCommit(toIdx)
        return
      }
      dispatch({ type: 'REQUEST_FORWARD', toIdx })
    },
    [activeIdx, maxIdx, onCommit],
  )

  useImperativeHandle(ref, () => ({ requestHalf }), [requestHalf])

  // If something OTHER than this component's own commit changed which half
  // is active mid-turn (e.g. Back clicked during a forward turn — Back stays
  // clickable throughout a turn, only aria-disabled) — cancel rather than
  // let a stale preview/animation keep racing toward a target that no longer
  // follows from where we're navigating from. This must NOT call
  // snapToTarget: activeIdx has already moved to wherever that external nav
  // decided, so re-committing onto the abandoned forward targetIdx here
  // would clobber it right back to the turn's original destination.
  const prevActiveIdxRef = useRef(activeIdx)
  useEffect(() => {
    if (prevActiveIdxRef.current !== activeIdx && stateRef.current.status !== 'idle') {
      cancelTurn()
    }
    prevActiveIdxRef.current = activeIdx
  }, [activeIdx, cancelTurn])

  // The moment a forward request is accepted: decide animate-or-snap. Every
  // check here is a hard requirement (see shouldAnimateTurn) — any one
  // failing takes the exact same immediate path an ineligible destination
  // does, never a partial/best-effort animation.
  useEffect(() => {
    if (state.status !== 'preparing') return
    const scene = sceneRef.current
    const hasWAAPI = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function'
    const hasResizeObserver = typeof ResizeObserver !== 'undefined'
    const withinHeightCap = !scene || scene.scrollHeight <= MAX_SCENE_HEIGHT_PX
    const animate = shouldAnimateTurn({
      eligible: true, // requestHalf already ran isEligibleForCurl before dispatching REQUEST_FORWARD
      prefersReducedMotion,
      hasWAAPI,
      hasResizeObserver,
      withinHeightCap,
    })
    if (!animate) {
      snapToTarget()
      return
    }
    dispatch({ type: 'START_TURN' })
  }, [state.status, prefersReducedMotion, snapToTarget])

  // The turn itself: animate the outgoing page's clip-path away and the curl
  // overlay's parts in/out via WAAPI, then commit once every animation has
  // actually finished (not cancelled) and this is still the current turn.
  useEffect(() => {
    if (state.status !== 'turning') return
    const myTransactionId = state.transactionId
    const scene = sceneRef.current
    if (!scene) {
      snapToTarget()
      return
    }

    const { duration, easing } = readTurnTiming(scene)
    const outgoing = scene.querySelector('[data-turn-layer="outgoing"]')
    const parts = scene.querySelectorAll('[data-turn-part]')
    const animations = []

    if (outgoing) {
      animations.push(
        outgoing.animate(
          [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }],
          { duration, easing, fill: 'both' },
        ),
      )
    }
    parts.forEach((part) => {
      const kind = part.dataset.turnPart
      const peakOpacity = kind === 'fold' ? 0.9 : kind === 'self-shadow' ? 0.5 : 0.35
      const keyframes =
        kind === 'contact-shadow'
          ? [
              { opacity: 0, transform: 'translateX(0%)' },
              { opacity: peakOpacity, transform: 'translateX(-30%)' },
              { opacity: 0, transform: 'translateX(-100%)' },
            ]
          : [{ opacity: 0 }, { opacity: peakOpacity }, { opacity: 0 }]
      animations.push(part.animate(keyframes, { duration, easing, fill: 'both' }))
    })

    runningAnimationsRef.current = animations
    let settled = false
    Promise.all(animations.map((a) => a.finished)).then(
      () => {
        if (settled) return
        settled = true
        if (stateRef.current.status !== 'turning' || stateRef.current.transactionId !== myTransactionId) return
        animations.forEach((a) => a.cancel())
        runningAnimationsRef.current = []
        onCommit(stateRef.current.targetIdx)
        dispatch({ type: 'COMMIT', transactionId: myTransactionId })
      },
      () => {
        // An animation was cancelled rather than finishing — the code that
        // cancelled it (snapToTarget, or this effect's own cleanup below)
        // already decided what happens next.
      },
    )

    return () => {
      settled = true
      animations.forEach((a) => a.cancel())
      runningAnimationsRef.current = []
    }
  }, [state.status, state.transactionId, onCommit, snapToTarget])

  // Backgrounding the tab mid-turn: cancel rather than resume a WAAPI
  // timeline across an arbitrarily long pause, which would read as a stuck
  // or glitchy turn. No commit — the user can just tap again.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'hidden' && stateRef.current.status !== 'idle') {
        runningAnimationsRef.current.forEach((a) => a.cancel())
        runningAnimationsRef.current = []
        dispatch({ type: 'CANCEL' })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // A resize mid-turn (rotation, on-screen keyboard, devtools) invalidates
  // the geometry the animation started with — snap straight to the target
  // instead of continuing to play a turn that will look broken.
  //
  // ResizeObserver guarantees one callback right after `observe()` reporting
  // the current size, whether or not anything actually resized — and since
  // `onCommit` (InningViewer's `goTo`) is a fresh closure every render,
  // `snapToTarget`'s identity (and so this effect) churns on every render a
  // turn causes, re-subscribing constantly. Without skipping that guaranteed
  // first callback, the very re-render that flips `state.status` to
  // 'turning' re-subscribes the observer, whose immediate callback then reads
  // 'turning' and snaps the turn before it ever gets to animate — every
  // forward turn ends in a same-frame flash instead of playing out.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || typeof ResizeObserver === 'undefined') return
    let isInitialCallback = true
    const ro = new ResizeObserver(() => {
      if (isInitialCallback) {
        isInitialCallback = false
        return
      }
      if (stateRef.current.status === 'turning') snapToTarget()
    })
    ro.observe(scene)
    return () => ro.disconnect()
  }, [snapToTarget])

  const showPreview = state.status === 'turning' && state.targetIdx != null

  return (
    <div className="turnscene" ref={sceneRef}>
      {/* Preview sits underneath, unmounted the instant the turn ends —
          real (possibly still-sealed) content, but presentationOnly so it
          can never itself advance the reveal mark or report a step
          (ADR-0024; SealBox's own gate is what keeps a sealed preview
          spoiler-safe, not this flag). */}
      {showPreview && (
        <div className="turnscene__layer turnscene__layer--preview" aria-hidden="true" inert="">
          {renderPage(state.targetIdx, { presentationOnly: true })}
        </div>
      )}
      <div className="turnscene__layer turnscene__layer--active" data-turn-layer="outgoing">
        {renderPage(activeIdx, { presentationOnly: false })}
      </div>
      {showPreview && <PageCurlOverlay />}
    </div>
  )
})
