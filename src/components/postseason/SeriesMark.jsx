// One postseason series mark ("ALDS", "World Series") from
// lib/postseason/seriesMarks.js. Renders nothing for a null mark — a season
// with no art on file — so a caller can splice it in and keep its own words
// as the fallback.
//
// The art is white-on-navy. On a navy band the caller already draws (the
// series page's banner, the slate card's series line) pass no `plate`; on
// paper pass `plate`, and the mark sits on its own navy chip.
//
// `height` is the drawn height in px; width follows each mark's own shape.
// `decorative` hides it from assistive tech where the words beside it
// already name the round.
export function SeriesMark({ mark, height = 32, plate = false, decorative = false, className = '' }) {
  if (!mark) return null
  const img = (
    <img
      src={mark.src}
      alt={decorative ? '' : mark.alt}
      aria-hidden={decorative ? 'true' : undefined}
      className={`seriesmark${plate ? '' : ` ${className}`}`.trim()}
      style={{ height, width: 'auto' }}
      decoding="async"
    />
  )
  if (!plate) return img
  return <span className={`seriesmark-plate ${className}`.trim()}>{img}</span>
}
