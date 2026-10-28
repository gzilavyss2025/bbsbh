import { useEffect, useRef, useState } from 'react'
import { focusInput, followLatest, moveSnaps, nearestWinProbEvent, snapToMarker } from './explore.js'

// Which plotted play WinProbChart shows, and the slider's pointer and key
// handlers. `plot` is the chart's viewBox geometry: { W, H, left, width }.
// `markers` are the big-swing plays' indices: a click or a mouse hover (not a
// drag) within SNAP viewBox units of one selects it (moveSnaps).
//
// `used` turns true on the reader's first pick, so the chart can drop its
// how-to hint. `input` is 'pointer' or 'key', the last way the chart was
// used, so a tap does not draw the keyboard focus ring. Focus that does not
// follow a pointer down on the slider (Tab, Shift+Tab) is keyboard focus, and
// sets 'key' again (focusInput).
//
// The latest play until the user picks one. A pick persists when the pointer
// leaves, and drops (followLatest) when a reveal or a live poll adds plays.
const SNAP = 8

export function useWinProbSelection(count, plot, markers = []) {
  const [pick, setPick] = useState({ count, idx: null })
  const [used, setUsed] = useState(false)
  const [input, setInput] = useState('key')
  const synced = followLatest(pick, count)
  if (synced !== pick) setPick(synced)
  const activeIdx = synced.idx ?? count - 1
  const select = (idx) => {
    setUsed(true)
    setPick((p) => (p.idx === idx && p.count === count ? p : { count, idx }))
  }

  // The <svg>'s box, read once per hover or touch rather than on every
  // pointermove; a scroll or resize moves it, so both drop the cached box.
  const rectRef = useRef(null)
  // When the last pointer down on the slider happened; onFocus reads and clears it.
  const downAtRef = useRef(null)
  useEffect(() => {
    const drop = () => { rectRef.current = null }
    window.addEventListener('scroll', drop, { capture: true, passive: true })
    window.addEventListener('resize', drop)
    return () => {
      window.removeEventListener('scroll', drop, { capture: true })
      window.removeEventListener('resize', drop)
    }
  }, [])

  const selectAtPointer = (e, snap = false) => {
    rectRef.current ??= e.currentTarget.getBoundingClientRect()
    const rect = rectRef.current
    // Account for xMidYMid meet letterboxing, should the box ever be off-ratio.
    const scale = Math.min(rect.width / plot.W, rect.height / plot.H)
    const left = rect.left + (rect.width - plot.W * scale) / 2
    const fraction = ((e.clientX - left) / scale - plot.left) / plot.width
    select(snap ? snapToMarker(fraction, count, markers, SNAP / plot.width) : nearestWinProbEvent(fraction, count))
  }

  // A mouse or pen selects at once, and so does a finger (Gary, 2026-10-28): a tap lands on the play
  // under it and a drag anywhere on the chart scrubs, in any direction (touch-action: none, winprob.css).
  // The page scrolls from outside the chart.
  const svgHandlers = {
    onKeyDown: (e) => {
      const next = { ArrowLeft: activeIdx - 1, ArrowRight: activeIdx + 1,
        ArrowDown: activeIdx - 1, ArrowUp: activeIdx + 1, Home: 0, End: count - 1 }[e.key]
      if (next == null) return
      e.preventDefault()
      setInput('key')
      select(Math.max(0, Math.min(count - 1, next)))
    },
    onFocus: (e) => {
      setInput(focusInput(downAtRef.current, e.timeStamp))
      downAtRef.current = null
    },
    onPointerEnter: () => { rectRef.current = null },
    onPointerDown: (e) => {
      rectRef.current = null
      downAtRef.current = e.timeStamp
      setInput('pointer')
      e.currentTarget.focus({ preventScroll: true })
      e.currentTarget.setPointerCapture(e.pointerId)
      // A finger is wide: it lands on the play under it rather than snapping to a nearby marker.
      selectAtPointer(e, e.pointerType !== 'touch')
    },
    onPointerMove: (e) => {
      const captured = e.currentTarget.hasPointerCapture(e.pointerId)
      if (e.pointerType === 'mouse' || captured) selectAtPointer(e, moveSnaps(e.pointerType, captured))
    },

  }

  return { activeIdx, select, svgHandlers, used, input }
}
