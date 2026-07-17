import { useCallback, useEffect, useState } from 'react'

// How many columns a container fits at `(itemWidth + gap)` per column,
// remeasured on resize via ResizeObserver — shared by every grid/masonry
// layout that mirrors this same "JS shadows the CSS auto-fill math" formula
// (MasonryColumns' round-robin distribution, AllStarLegacyPage's leader grid).
//
// Returns a CALLBACK ref, not a plain ref object: a caller whose container
// doesn't exist on first paint (e.g. hidden behind a loading/empty fallback
// until async data resolves) needs the measuring effect to re-run the moment
// the element actually mounts, which a `useRef` + effect-on-mount pair can't
// do — the effect would run once against a still-null ref and never fire
// again. Tracking the node itself in state makes that work for every caller,
// including ones that mount immediately.
export function useColumnCount(itemWidth, gap) {
  const [node, setNode] = useState(null)
  const [cols, setCols] = useState(1)
  const ref = useCallback((el) => setNode(el), [])
  useEffect(() => {
    if (!node) return
    const measure = () => {
      const w = node.clientWidth
      setCols(Math.max(1, Math.floor((w + gap) / (itemWidth + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [node, itemWidth, gap])
  return [ref, cols]
}
