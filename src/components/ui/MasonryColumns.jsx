import { Fragment } from 'react'

import { useColumnCount } from '../../hooks/useColumnCount.js'

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
// (+ `gap`), remeasured on resize (see useColumnCount) — the container/column
// flex + gap styling lives in index.css; only the column COUNT is computed
// here, so columnWidth/gap are passed as the numeric twins of that CSS.
export function MasonryColumns({ items, columnWidth, gap, className, columnClassName, children }) {
  const [ref, cols] = useColumnCount(columnWidth, gap)

  const buckets = Array.from({ length: cols }, () => [])
  items.forEach((item, i) => buckets[i % cols].push({ item, i }))

  return (
    <div ref={ref} className={className}>
      {buckets.map((bucket, c) => (
        <div key={c} className={columnClassName}>
          {/* KEYED HERE, NOT BY THE CALLER. `i` is the item's index in the
              original `items` array, so it is unique across every column and
              stable while the list is. Without this every consumer had to
              remember to key the element it returns from children(), nothing
              said so, and the first two calls written against this component
              disagreed about it. */}
          {bucket.map(({ item, i }) => (
            <Fragment key={i}>{children(item, i)}</Fragment>
          ))}
        </div>
      ))}
    </div>
  )
}
