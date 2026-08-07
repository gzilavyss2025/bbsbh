import { ordinal } from '../../lib/ballparkData.js'

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

// Distances run LF -> LC -> CF -> RC -> RF, walls LF -> CF -> RF — the order
// DIMENSIONS already lists them in (ballparkData.js), which is also left to
// right across the fence exactly as BallparkDiagram draws it. Laid out as a
// horizontal strip of posts in that same order rather than a top-to-bottom
// list, so the row reads the way the outfield itself does instead of fighting
// it. `r.key` ('lf'/'lc'/'cf'/'rc'/'rf') doubles as the on-field shorthand.
//
// A bare ordinal can't say which direction it counts — is 3rd the deepest
// three or the shallowest three? So the group states it once, in the title
// ("1st deepest"), rather than repeating a word on every post.
export function RankGroup({ title, rows }) {
  const total = rows[0]?.total
  const extremeWord = rows[0]?.group === 'wall' ? 'tallest' : 'deepest'
  return (
    <section className="rankgrp">
      <h3 className="rankgrp__title">
        <span>{title}</span>
        {total > 0 && <span className="rankgrp__legend">1st {extremeWord} · of {total}</span>}
      </h3>
      <ul className="rankgrp__strip">
        {rows.map((r) => {
          const extreme = r.rank === 1 ? 'is-most' : r.rank === r.total ? 'is-least' : ''
          return (
            <li key={`${r.group}-${r.key}`} className="rankpost" aria-label={`${r.label} ${r.value} feet, ${ordinal(r.rank)} ${extremeWord} of ${r.total}`}>
              <span className="rankpost__pos" aria-hidden="true">{r.key}</span>
              <span className="rankpost__value" aria-hidden="true">{r.value}′</span>
              <span className={`rankpost__rank ${extreme}`} aria-hidden="true">{ordinal(r.rank)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
