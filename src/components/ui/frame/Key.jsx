import { keyModel } from '../../../lib/design/report/classes.js'

// THE KEY (ADR-0112) — the one legend under a chart or a board: a swatch or a
// mark, then what it means. Styled once, in styles/system/report/meter.css.
//
//   items  [{ label, tone }] for a swatch key (tone: good, caution, bad or neutral,
//          the same roles as the Meter), or [{ label, mark }] where `mark` is a
//          node the caller draws (a Pill mark: the clinch letter x). One kind per key.
//
// It fetches and computes nothing.
export function Key({ items, className = '' }) {
  const { look, items: list } = keyModel(items)
  return (
    <ul className={`key ${className}`.trim()}>
      {list.map((it, i) => (
        // Keyed by position: two items may share a label.
        <li className="key__item" key={i}>
          {look === 'swatch' ? <span className={`key__swatch key__swatch--${it.tone}`} aria-hidden="true" /> : it.mark}
          {it.label}
        </li>
      ))}
    </ul>
  )
}
