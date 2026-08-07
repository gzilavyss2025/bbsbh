import { ordinal } from '../../lib/ballpark/ballparkData.js'

// The two small building blocks of a park's "details" — a labeled built/roof/
// capacity stat, and one ranked dimension family (distances or wall heights).
// Shared between BallparkModal (the lineup page's full sheet) and
// BallparkCard (the team hub's inline pairing with the diagram) so the two
// surfaces can't drift on how a rank reads.
export function Facts({ label, value }) {
  return (
    <div className="bpfact">
      <dt className="bpfact__label">{label}</dt>
      <dd className="bpfact__value">{value || '—'}</dd>
    </div>
  )
}

// A bare ordinal ("21st of 30") isn't a fact anyone holds onto — it needs the
// group header's direction word in view to even parse, and most parks cluster
// near the middle where the rank is just noise. So only the dimensions that
// are genuinely distinctive — top/bottom OUTLIER_WINDOW of the ~30 parks on
// file — get called out at all, worded as a self-contained phrase ("1st
// shortest") rather than a number. Everything else shows just its value.
const OUTLIER_WINDOW = 3

function outlierNote({ rank, total, group }) {
  if (rank <= OUTLIER_WINDOW) {
    return `${ordinal(rank)} ${group === 'wall' ? 'tallest' : 'deepest'}`
  }
  if (rank > total - OUTLIER_WINDOW) {
    return `${ordinal(total - rank + 1)} ${group === 'wall' ? 'shortest' : 'shallowest'}`
  }
  return null
}

// Distances run LF -> LC -> CF -> RC -> RF, walls LF -> CF -> RF — the order
// DIMENSIONS already lists them in (ballparkData.js), which is also left to
// right across the fence exactly as BallparkDiagram draws it. Laid out as a
// horizontal strip of posts in that same order rather than a top-to-bottom
// list, so the row reads the way the outfield itself does instead of fighting
// it. `r.key` ('lf'/'lc'/'cf'/'rc'/'rf') doubles as the on-field shorthand.
export function RankGroup({ title, rows }) {
  return (
    <section className="rankgrp">
      <h3 className="rankgrp__title">{title}</h3>
      <ul className="rankgrp__strip">
        {rows.map((r) => {
          const note = outlierNote(r)
          return (
            <li key={`${r.group}-${r.key}`} className="rankpost" aria-label={`${r.label} ${r.value} feet${note ? `, ${note} in MLB` : ''}`}>
              <span className="rankpost__pos" aria-hidden="true">{r.key}</span>
              <span className="rankpost__value" aria-hidden="true">{r.value}′</span>
              {note && <span className="rankpost__note" aria-hidden="true">{note}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
