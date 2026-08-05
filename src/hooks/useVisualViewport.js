import { useEffect, useState } from 'react'

// Tracks the VISUAL viewport — the part of the page the on-screen keyboard is
// not covering — for a surface that has to sit above it.
//
// Why this needs an API at all, when CSS has viewport units: an on-screen
// keyboard does not resize the LAYOUT viewport, and `position: fixed` is laid
// out against the layout viewport. So a bottom-docked sheet keeps its bottom
// edge pinned to the bottom of the page, which the keyboard is now covering —
// the sheet is mounted, focused, and completely off screen. `100dvh` does not
// help: the dynamic viewport unit tracks retractable browser CHROME (the URL
// bar), not the keyboard. `window.visualViewport` is the only thing that
// reports the visible rectangle, and only by event.
//
// `height` is that rectangle's height; `offsetTop` is how far down the layout
// viewport it starts, which is non-zero when the browser has scrolled the page
// to bring a focused field into view. A fixed overlay that sets its height to
// the first and translates by the second lands exactly on the visible area,
// keyboard open or closed.
//
// Returns `null` until there's a reading, and stays `null` where
// `visualViewport` is unsupported, so a caller can fall back to plain viewport
// units rather than to a wrong number.
export function useVisualViewport(active = true) {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!active) return undefined
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined

    // Both events matter and for different reasons: `resize` is the keyboard
    // opening or closing, `scroll` is the page being nudged under a focused
    // field (which moves offsetTop without changing height).
    const read = () => {
      setRect((prev) =>
        prev && prev.height === vv.height && prev.offsetTop === vv.offsetTop
          ? prev
          : { height: vv.height, offsetTop: vv.offsetTop },
      )
    }
    read()
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [active])

  return rect
}
