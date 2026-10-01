import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SHEET_FRACTION,
  detentOffsets,
  releaseDetent,
  rubberband,
  scrimAlpha,
  settleMs,
  velocityFrom,
} from './dockPhysics.js'
import { IconButton } from '../control/IconButton.jsx'

// THE PHONE'S BOTTOM DOCK — the sheet shell, with no content of its own.
//
// It was born as the wire dock (transactions/WireDock.jsx, ADR-0061) and was
// lifted out when a second feed needed the same place: in the postseason the
// MLB slate's dock holds the bracket instead of the wire (BracketDock.jsx).
// Both docks are this one file, so the feel cannot drift between them. The
// class names stay `.wiredock__*` for that reason: they name the dock, and
// 04a-wire-dock.css and e2e/wire-dock.spec.js both read them.
//
// The problem it solves is one of billing. The slate is what the reader opened
// the app for; a dock is what they will glance at between innings. Rendered in
// the flow, the feed would stand ABOVE the games — on a 390pt phone, most of
// the first screen. So it leaves the flow and docks to the bottom edge, where
// the four-button tab bars of other apps live. It rests as a one-line rail and
// pulls up over the slate.
//
// Three positions (dockPhysics.js owns the arithmetic):
//
//   RAIL  the resting peek, ~62px. The slate pads its bottom by exactly this
//         height, so no game card ever hides under it.
//   HALF  the working height. The body scrolls; the slate is still visible
//         and still tappable behind it, and there is deliberately NO scrim —
//         a sheet at its working height sits BESIDE the page, not over it.
//   FULL  the whole body, with a scrim that fades in across the half→full
//         stretch only, because at this height the dock HAS become the page.
//
// Spoilers: the dock covers a scoring surface, so it may never cover a seal
// control — that is what the slate's measured bottom padding is for, and what
// e2e/wire-dock.spec.js measures. What a dock SHOWS is its caller's business.
//
// Motion, and where each rule came from. Every value is deliberate:
//   * Drag tracks the pointer 1:1 from the grab offset, and the transform is
//     written STRAIGHT onto the element rather than through a CSS custom
//     property — a var invalidates inherited style across the whole subtree
//     every frame, which is the documented way to make a long list drag badly.
//   * A release does not snap to the nearest detent from where the finger let
//     go; it projects the momentum forward first (Apple's deceleration curve,
//     WWDC 2018) and snaps to whatever detent that projected point is nearest.
//     A small flick therefore throws the sheet, which is the whole feel.
//   * A drag past the tallest detent rubber-bands rather than stopping dead.
//   * A settle is interruptible: pointerdown mid-animation reads the LIVE
//     on-screen transform and drags on from there, never from the target.
//   * The body drags the sheet only DOWNWARD and only from scrollTop 0. Upward
//     it always scrolls. That one rule removes the whole scroll-versus-drag
//     ambiguity without a timer, because at scrollTop 0 a downward drag has no
//     native scrolling to compete with (`overscroll-behavior: contain` takes
//     care of the page bounce behind it).
//   * Reduced motion keeps the 1:1 drag — direct manipulation is not
//     decoration — and drops only the settle, which becomes a cut.
//
// The caller mounts this only when it has something to show, and reports its
// own presence to the slate: an empty rail pinned across the bottom of the
// page would cost a permanent strip of screen to say nothing.

const FULL = 0
const HALF = 1
const RAIL = 2
const STATE_NAME = ['full', 'half', 'rail']

// The iOS sheet curve, by way of Ionic and Vaul. Not --ease-out: that curve is
// tuned for a short one-shot entrance, and over a 400px throw it arrives with a
// visible slow tail. This one leaves fast and lands flat, which is what a
// thrown object does.
const SETTLE_CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)'

// Movement before a drag from the BODY is taken as a drag rather than a tap or
// the start of a scroll. The handle needs no threshold — a pointer down on a
// grabber is unambiguous — but a finger resting on a row to read it must be
// allowed a few pixels of tremor before the sheet moves under it.
const LIST_DRAG_THRESHOLD = 8

// Under this much travel a gesture on the rail was a TAP, not a drag. It has to
// be handled here rather than left to the button's own click: the pointer is
// captured the moment the rail is pressed (which is what makes the drag track
// through the gutters and off the element), and a captured pointer does not
// reliably deliver a click to the element under it. Every control inside the
// rail that is NOT the tap target therefore carries `data-nodrag`, and a press
// on one of those never starts a gesture at all.
const TAP_SLOP = 6

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function liveOffset(el, fallback) {
  try {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return Number.isFinite(matrix.m42) ? matrix.m42 : fallback
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------

// `collapsed` is what the resting rail shows inside its one expand button.
// `title` and `note` are the open sheet's head, drawn in the same box and
// cross-faded with it. `children` is the body; `bodyAs` is its element ('ul'
// for a ledger, 'div' for anything else). `measureKey` is anything whose
// change can resize the rail (the wire passes its story count).
export function SheetDock({
  label,
  bodyId,
  bodyAs: Body = 'ul',
  collapsed,
  collapsedLabel,
  title,
  note,
  closeLabel,
  className = '',
  style,
  measureKey,
  children,
}) {
  const rootRef = useRef(null)
  const sheetRef = useRef(null)
  const railRef = useRef(null)
  const listRef = useRef(null)
  const scrimRef = useRef(null)
  const collapsedRef = useRef(null)
  const expandedRef = useRef(null)

  const [index, setIndex] = useState(RAIL)
  const [detents, setDetents] = useState(() => detentOffsets(0, 0))
  const [dragging, setDragging] = useState(false)

  // The gesture's own state. A ref rather than React state on purpose: a drag
  // that re-rendered 35 rows on every pointermove would not be a drag, it would
  // be a slideshow. Nothing in here is ever read during render.
  const drag = useRef({
    active: false,
    pointerId: null,
    startY: 0,
    startOffset: 0,
    samples: [],
    fromList: false,
    armed: false,
  })

  // -------------------------------------------------------------- painting
  // Four direct style writes per frame, every one of them a compositor
  // property. Deliberately not a custom property (see the header) and
  // deliberately not React state.
  const paint = useCallback((offset, ms) => {
    const sheet = sheetRef.current
    if (!sheet) return
    sheet.style.transition = ms > 0 ? `transform ${ms}ms ${SETTLE_CURVE}` : 'none'
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`

    const fade = ms > 0 ? `opacity ${ms}ms ${SETTLE_CURVE}` : 'none'
    if (scrimRef.current) {
      scrimRef.current.style.transition = fade
      scrimRef.current.style.opacity = String(scrimAlpha(offset, detents))
    }
    // The rail's one-line headline and the open sheet's section head occupy the
    // SAME box and cross-fade as the sheet rises, so the header re-labels itself
    // continuously instead of swapping at a boundary. The two ramps overlap by
    // design — a gap between them would flash an empty header mid-drag.
    const rise = detents.length === 3 && detents[RAIL] !== detents[HALF]
      ? Math.max(0, Math.min(1, (detents[RAIL] - offset) / (detents[RAIL] - detents[HALF])))
      : 0
    if (collapsedRef.current) {
      collapsedRef.current.style.transition = fade
      collapsedRef.current.style.opacity = String(Math.max(0, 1 - rise / 0.45))
    }
    if (expandedRef.current) {
      expandedRef.current.style.transition = fade
      expandedRef.current.style.opacity = String(Math.max(0, Math.min(1, (rise - 0.25) / 0.45)))
    }
  }, [detents])

  // ------------------------------------------------------------- measuring
  // The sheet's height is published from here rather than written as `92dvh` in
  // the stylesheet, so the number JS snaps to and the number CSS lays out are
  // the same number by construction. `--wire-rail-h` goes on the document
  // element because its other consumer is the SLATE, which pads its bottom by
  // exactly the rail's height — a constant that disagreed would hide a card.
  const measure = useCallback(() => {
    if (typeof window === 'undefined') return
    const vh = window.innerHeight
    const sheetH = Math.round(vh * SHEET_FRACTION)
    // CEILED, and from the rect rather than offsetHeight: the rail's real
    // height is fractional (a 62.5px band reports 62), and this number is the
    // slate's FLOOR. Rounding down leaves half a pixel of the page under the
    // dock; rounding up spends half a pixel of padding. Only one of those two
    // errors can hide a control.
    const railH = Math.ceil(railRef.current?.getBoundingClientRect().height ?? 0)
    const root = rootRef.current
    if (root) root.style.setProperty('--wire-sheet-h', `${sheetH}px`)
    if (railH > 0) document.documentElement.style.setProperty('--wire-rail-h', `${railH}px`)
    const next = detentOffsets(vh, railH)
    setDetents((prev) => (prev.every((v, i) => v === next[i]) ? prev : next))
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure, measureKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    // The window is not the only thing that can change the rail's height, and
    // the rail's height is the slate's FLOOR — a stale one puts a game card, or
    // the Reveal all results bar, under the dock. A font swapping in, a count
    // chip gaining a digit, or a club mark arriving all resize it without a
    // resize event, so watch the element itself rather than inferring it from
    // the viewport.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (observer && railRef.current) observer.observe(railRef.current)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', measure)
      observer?.disconnect()
    }
  }, [measure])

  // The slate's padding token is this component's to publish and this
  // component's to withdraw — a dock that unmounted (a date step off today, a
  // feed that came back empty) must not leave the slate padding for a rail
  // nobody can see.
  useEffect(() => () => {
    document.documentElement.style.removeProperty('--wire-rail-h')
  }, [])

  // A committed detent change repaints with a settle; a detent RECALCULATION
  // (a resize, a rotation) repaints without one, because nothing moved from the
  // reader's point of view — the geometry did.
  const settling = useRef(false)
  useEffect(() => {
    const target = detents[index]
    if (drag.current.active) return
    const sheet = sheetRef.current
    const from = sheet ? liveOffset(sheet, target) : target
    const ms = settling.current && !prefersReducedMotion() ? settleMs(target - from) : 0
    paint(target, ms)
    settling.current = true
  }, [detents, index, paint])

  // ---------------------------------------------------------------- gesture
  const beginDrag = useCallback((event, fromList) => {
    const sheet = sheetRef.current
    if (!sheet) return
    const state = drag.current
    state.active = true
    state.pointerId = event.pointerId
    state.startY = event.clientY
    state.startOffset = liveOffset(sheet, detents[index])
    state.samples = [{ y: event.clientY, t: event.timeStamp }]
    state.fromList = fromList
    // Freeze the sheet where it actually IS, not where it was heading — this is
    // the whole of interruptibility, and skipping it is what makes a grabbed
    // animation jump.
    paint(state.startOffset, 0)
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* a mouse that left the window mid-press; the move handler still fires */
    }
  }, [detents, index, paint])

  const onHandleDown = useCallback((event) => {
    if (event.button != null && event.button !== 0) return
    // A control that owns its own press (the collapse chevron) never starts a
    // gesture — capturing the pointer here would eat its click.
    if (event.target?.closest?.('[data-nodrag]')) return
    beginDrag(event, false)
  }, [beginDrag])

  // A pointer down on the body ARMS a drag without starting one: whether this
  // is a scroll, a tap on a link, or a pull-down on the sheet is not knowable
  // yet, and guessing is how a link stops opening.
  const onListDown = useCallback((event) => {
    if (event.button != null && event.button !== 0) return
    const state = drag.current
    state.armed = true
    state.startY = event.clientY
    state.samples = [{ y: event.clientY, t: event.timeStamp }]
  }, [])

  const onListMove = useCallback((event) => {
    const state = drag.current
    if (state.active || !state.armed) return
    const dy = event.clientY - state.startY
    if (dy <= LIST_DRAG_THRESHOLD) {
      // Upward, or still inside the tremor band. Upward is always the body's:
      // disarm so a scroll that later passes back through the start point
      // cannot retroactively become a drag.
      if (dy < -LIST_DRAG_THRESHOLD) state.armed = false
      return
    }
    if ((listRef.current?.scrollTop ?? 0) > 0) {
      state.armed = false
      return
    }
    state.armed = false
    beginDrag(event, true)
  }, [beginDrag])

  const onPointerMove = useCallback((event) => {
    const state = drag.current
    if (!state.active || event.pointerId !== state.pointerId) return
    const open = detents[FULL]
    const closed = detents[RAIL]
    const raw = state.startOffset + (event.clientY - state.startY)
    // Past the tallest detent the sheet resists instead of stopping; past the
    // rail it is simply pinned, because there is nothing below the rail to
    // suggest and a sheet that slid off the screen would take the slate's
    // bottom padding's reason for existing with it.
    const offset = raw < open ? open + rubberband(raw - open, closed - open) : Math.min(raw, closed)
    state.samples.push({ y: event.clientY, t: event.timeStamp })
    if (state.samples.length > 8) state.samples.shift()
    paint(offset, 0)
  }, [detents, paint])

  const endDrag = useCallback((event) => {
    const state = drag.current
    state.armed = false
    if (!state.active || (event && event.pointerId !== state.pointerId)) return
    state.active = false
    state.pointerId = null
    setDragging(false)
    const sheet = sheetRef.current
    if (!sheet) return
    const offset = liveOffset(sheet, detents[index])
    settling.current = true

    // A press that went nowhere is a tap, and a tap on the rail opens the dock
    // one step. Fitts's law rather than decoration: the whole 62px strip is the
    // target, not the chevron drawn at the end of it.
    if (!state.fromList && Math.abs(offset - state.startOffset) < TAP_SLOP) {
      const stepped = Math.max(FULL, index - 1)
      if (stepped !== index) setIndex(stepped)
      else paint(detents[index], prefersReducedMotion() ? 0 : settleMs(detents[index] - offset))
      return
    }

    const next = releaseDetent(offset, velocityFrom(state.samples), detents, { from: index })
    if (next === index) {
      // Same detent, but the sheet is not sitting on it — the settle effect
      // only runs on a CHANGE, so settle it here or it stays wherever the
      // finger left it.
      paint(detents[next], prefersReducedMotion() ? 0 : settleMs(detents[next] - offset))
    } else {
      setIndex(next)
    }
  }, [detents, index, paint])

  // Escape collapses one step, the same as the chevron. A dock is not a modal —
  // it takes no focus trap and steals no scroll — so this listens on the
  // document rather than on the sheet, which would need focus to be inside it.
  useEffect(() => {
    if (index === RAIL) return
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setIndex((current) => Math.min(RAIL, current + 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index])

  const state = STATE_NAME[index]

  return (
    <div
      ref={rootRef}
      className={`wiredock${dragging ? ' wiredock--dragging' : ''}${className ? ` ${className}` : ''}`}
      data-state={state}
      style={style}
    >
      {/* Present at every detent so it can fade continuously with the drag, and
          inert below FULL so a tap at the working height reaches the slate —
          which is the difference between a dock and a modal. */}
      <div
        ref={scrimRef}
        className="wiredock__scrim"
        onClick={() => setIndex(RAIL)}
        aria-hidden="true"
      />

      <section
        ref={sheetRef}
        className="wiredock__sheet"
        aria-label={label}
        // The rail band is the drag surface: touch-action none, because the
        // browser must not claim a vertical gesture that starts here.
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div ref={railRef} className="wiredock__rail" onPointerDown={onHandleDown}>
          <span className="wiredock__grabber" aria-hidden="true" />

          <div className="wiredock__headbox">
            {/* Resting state: the caller's one line, with the whole strip as
                one expand control. */}
            <button
              ref={collapsedRef}
              type="button"
              className="wiredock__latest"
              aria-label={collapsedLabel}
              aria-expanded={index !== RAIL}
              aria-controls={bodyId}
              onClick={() => setIndex(HALF)}
              tabIndex={index === RAIL ? 0 : -1}
              aria-hidden={index !== RAIL ? 'true' : undefined}
            >
              {collapsed}
            </button>

            {/* Open state: the sheet's own head, in the same box. */}
            <div
              ref={expandedRef}
              className="wiredock__head"
              aria-hidden={index === RAIL ? 'true' : undefined}
            >
              <h2 className="wiredock__title">{title}</h2>
              <span className="wiredock__note">{note}</span>
              <IconButton
                mark="md"
                className="wiredock__close"
                data-nodrag=""
                onClick={() => setIndex(RAIL)}
                tabIndex={index === RAIL ? -1 : 0}
                label={closeLabel}
              >
                ⌄
              </IconButton>
            </div>
          </div>
        </div>

        <Body
          id={bodyId}
          ref={listRef}
          className="wiredock__list"
          onPointerDown={onListDown}
          onPointerMove={onListMove}
        >
          {children}
        </Body>
      </section>
    </div>
  )
}
