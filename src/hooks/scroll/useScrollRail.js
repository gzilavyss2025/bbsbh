import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A setup jump, not a user-visible scroll gesture — bypasses the track's own
// `scroll-behavior: smooth` (index.css) so it lands instantly. Without this,
// the animated glide from position 0 briefly leaves a leading-edge sentinel
// on screen mid-flight, which an IntersectionObserver reads as "scrolled
// back" and grows the window before the user has touched anything.
export function jumpScrollLeft(el, value) {
  const prev = el.style.scrollBehavior
  el.style.scrollBehavior = 'auto'
  el.scrollLeft = value
  el.style.scrollBehavior = prev
}

// The scroll state every `.teamphotos` rail (Highlights and Photos, player and
// team pages) shares: whether the track overflows (`canScroll`, which decides
// if the arrows render), whether it sits at either end (`atStart`/`atEnd`,
// which disable them), the `scroll(dir)` the arrows call, and the newest-on-
// the-right opening snap.
//
// `count` is how many items the track holds — the effects re-run when it
// changes. The track opens snapped to its rightmost (newest) item and keeps
// re-snapping as items land and `canScroll` settles, until the user scrolls
// back: a caller flips `userScrolledBackRef.current` (Photos rails, from their
// sentinel), or passes `flagUserScroll` to have a pointer press or wheel on
// the track flip it (Highlights rails, which have no sentinel).
//
// Call it BEFORE any layout effect of your own that must run after the snap —
// effects run in the order their hooks are called.
export function useScrollRail(count, { flagUserScroll = false } = {}) {
  const trackRef = useRef(null)
  const userScrolledBackRef = useRef(false)
  const [canScroll, setCanScroll] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [count])

  // `canScroll` flipping true shrinks the track to make room for the arrows,
  // moving the true right edge — hence the second dependency.
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el || userScrolledBackRef.current || count === 0) return
    jumpScrollLeft(el, el.scrollWidth)
  }, [count, canScroll])

  useEffect(() => {
    const el = trackRef.current
    if (!el || !flagUserScroll) return
    const flag = () => {
      userScrolledBackRef.current = true
    }
    el.addEventListener('pointerdown', flag)
    el.addEventListener('wheel', flag, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', flag)
      el.removeEventListener('wheel', flag)
    }
  }, [flagUserScroll])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => {
      setAtStart(el.scrollLeft <= 1)
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
    }
    update()
    el.addEventListener('scroll', update)
    return () => el.removeEventListener('scroll', update)
  }, [count, canScroll])

  const scroll = (dir) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return { trackRef, userScrolledBackRef, canScroll, atStart, atEnd, scroll }
}
