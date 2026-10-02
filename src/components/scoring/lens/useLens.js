import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { lensFrame, lensOffset, lensZoom } from '../../../lib/scorecard/geometry.js'
import { glideAt } from '../../../lib/scorecard/glide.js'

// The lens's measure-and-seat loop (ADR-0092). ScorecardSheet calls it with
// its pane and table; it returns the zoom to draw the table at and the frame's
// place in the pane, or null while lens mode is off.
//
// MEASURED, NEVER COMPUTED (G2). Every number comes from getBoundingClientRect
// on the real, zoomed table: the rail's right edge, the frontier cell's box
// (the cell that carries `data-frontier`: the seal, or the turn's flip cell),
// the inning header's height. A bat-around column, a rail that stacks a line
// per substitute, or a half that ends on a caught stealing (the flip sits
// under the "CS →" box, G23) then needs no special case. offsetTop is not used:
// browsers disagree on whether it is zoomed.
//
// SCROLL, NEVER TRANSFORM (G1). The pane scrolls so the frontier cell's corner
// meets the frame's. A transform would break the sheet's three sticky edges.
// THE GLIDE (G1, #724 L7). After a reveal tap the scroll GLIDES: a
// requestAnimationFrame tween, --dur-glide on the --ease-out curve
// (lib/scorecard/glide.js), not `scroll-behavior: smooth`, which takes no
// duration and which iOS takes control of. `glide` is the tap's number, or
// null; the seat glides only when that number is new. So a cold load, a poll, a
// return to the lens, a page turn and reduced motion (the page passes null)
// all seat at once. A new glide, or the reader's own touch, wheel or key,
// stops a running one where it is.
//
// Each pass settles one thing and returns, so the loop is stable: the zoom
// first (it changes every measured size), then the frame and the two spacers
// (they change where the rows are), then the seat. The seat runs only when the
// frontier or the frame moved (`seat` plus the frame), so a poll that brings
// nothing new, or a reader who pans to look at an older box, is left alone.
// When it seats, it also brings the pane's top to the window's top: the lens
// is a full-height surface below the app's own chrome.
export function useLens({ on, paneRef, tableRef, seat, max, glide = null }) {
  const [geom, setGeom] = useState(null)
  const seated = useRef(null)
  const glided = useRef(null)
  const stop = useRef(null)
  // A resize (rotation, the browser's toolbar coming and going) re-measures.
  const [, resized] = useReducer((n) => n + 1, 0)

  const measure = useCallback(() => {
    if (!on) {
      seated.current = null
      stop.current?.()
      return
    }
    const pane = paneRef.current
    const table = tableRef.current
    const rail = table?.querySelector('thead .sc-sheet__name')
    const target = table?.querySelector('[data-frontier]')
    const cell = target ?? table?.querySelector('tbody .sc-sheet__cell')
    if (!pane || !rail || !cell) return

    const drawnAt = geom?.zoom ?? 1
    const box = pane.getBoundingClientRect()
    const inner = { top: box.top + pane.clientTop, left: box.left + pane.clientLeft }
    const railRight = rail.getBoundingClientRect().right - inner.left
    const cellRect = cell.getBoundingClientRect()

    const zoom = lensZoom({
      paneWidth: pane.clientWidth,
      railWidth: railRight / drawnAt,
      cellWidth: cellRect.width / drawnAt,
      max,
    })
    if (Math.abs(zoom - drawnAt) > 0.002) {
      setGeom({ zoom, frame: null })
      return
    }

    const frame = lensFrame({
      paneHeight: pane.clientHeight,
      headerHeight: table.tHead.getBoundingClientRect().height,
      railRight,
      cellWidth: cellRect.width,
      cellHeight: cellRect.height,
    })
    const was = geom?.frame
    if (!was || Object.keys(frame).some((k) => Math.abs(frame[k] - was[k]) > 0.5)) {
      setGeom((g) => ({ ...g, frame }))
      return
    }

    // A tap's glide number is spent on the first seat pass that sees it, so a
    // later seat with no tap (a rotation, a poll) never glides.
    const fresh = glide != null && glide !== glided.current
    glided.current = glide
    const key = `${seat}|${was.top}|${was.left}|${was.width}`
    if (!target || seated.current === key) return
    seated.current = key
    const to = lensOffset({
      cellRect,
      paneRect: inner,
      scrollTop: pane.scrollTop,
      scrollLeft: pane.scrollLeft,
      frame: was,
    })
    stop.current?.()
    if (fresh) stop.current = glideTo(pane, to)
    else {
      pane.scrollTop = to.top
      pane.scrollLeft = to.left
    }
    window.scrollTo(0, window.scrollY + box.top)
  }, [on, paneRef, tableRef, seat, max, geom, glide])
  // No dependency list, as ScorecardSheet's own `measure`: a reveal, a new
  // column or a substitute's line moves the boxes without resizing the pane.
  useLayoutEffect(measure)

  useEffect(() => () => stop.current?.(), [])

  useEffect(() => {
    const pane = paneRef.current
    if (!on || !pane || typeof ResizeObserver !== 'function') return undefined
    const ro = new ResizeObserver(resized)
    ro.observe(pane)
    return () => ro.disconnect()
  }, [on, paneRef])

  return on ? geom : null
}

// The tween. Returns the function that stops it. The duration is the CSS
// token, read once per glide, so the two cannot drift apart.
// Exported for the Animation Lab's live demo, which runs this same tween.
const STOPS = ['touchstart', 'wheel', 'pointerdown', 'keydown']
export function glideTo(pane, to) {
  const ms = parseFloat(getComputedStyle(pane).getPropertyValue('--dur-glide')) || 300
  const from = { top: pane.scrollTop, left: pane.scrollLeft }
  // The clock starts at the first frame, not at the call: a slow render after
  // the tap then delays the glide, and does not eat into it.
  let start = null
  let frame = requestAnimationFrame(function step(now) {
    start ??= now
    pane.scrollTop = glideAt(from.top, to.top, now - start, ms)
    pane.scrollLeft = glideAt(from.left, to.left, now - start, ms)
    if (now - start < ms) frame = requestAnimationFrame(step)
    else end()
  })
  function end() {
    cancelAnimationFrame(frame)
    STOPS.forEach((e) => pane.removeEventListener(e, end))
  }
  STOPS.forEach((e) => pane.addEventListener(e, end, { passive: true }))
  return end
}
