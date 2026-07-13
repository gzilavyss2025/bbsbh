import { useRef, useState, useEffect } from 'react'

// Round-robin ("Pinterest") masonry. Distributes `items` across N columns
// left-to-right — item i lands in column (i % N) — so the sequence reads
// ACROSS the first row (rarest milestone top-left, importance flowing
// left-to-right) rather than down a column, while each column still stacks its
// cards tightly with no internal gaps even when the columns end at different
// heights. That combination is why this is JS and not CSS: plain CSS columns
// read top-to-bottom, a CSS grid leaves gaps under short cards, and native
// `grid-template-rows: masonry` isn't in Safari yet (this is an iPhone PWA).
//
// N is derived from the container's own measured width against `columnWidth`
// (+ `gap`), remeasured on resize via ResizeObserver — the container/column
// flex + gap styling lives in index.css; only the column COUNT is computed
// here, so columnWidth/gap are passed as the numeric twins of that CSS.
export function MasonryColumns({ items, columnWidth, gap, className, columnClassName, children }) {
  const ref = useRef(null)
  const [cols, setCols] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      setCols(Math.max(1, Math.floor((w + gap) / (columnWidth + gap))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [columnWidth, gap])

  const buckets = Array.from({ length: cols }, () => [])
  items.forEach((item, i) => buckets[i % cols].push({ item, i }))

  return (
    <div ref={ref} className={className}>
      {buckets.map((bucket, c) => (
        <div key={c} className={columnClassName}>
          {bucket.map(({ item, i }) => children(item, i))}
        </div>
      ))}
    </div>
  )
}
