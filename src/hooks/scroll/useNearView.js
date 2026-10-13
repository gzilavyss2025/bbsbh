import { useEffect, useRef, useState } from 'react'

// True once the node on `ref` has come within `margin` of the viewport, and true
// from then on. A section that loads its data when it scrolls near (the same
// pattern as StampInRow, screens/team/StampInPage.jsx) calls this and fetches
// when it flips. The generous margin has the data in by the time the section
// arrives. With no IntersectionObserver there is nothing to wait for: true at once.
export function useNearView(margin = '600px 0px') {
  const ref = useRef(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const node = ref.current
    if (near || !node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setNear(true)
        io.disconnect()
      },
      { rootMargin: margin },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [near, margin])
  return [ref, near]
}
