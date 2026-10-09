import { SEGMENTS } from '../../lib/ovr/card.js'

// The attribute rows of the OVR menu (#1703): a name, a 20-segment bar skewed on the
// card's angle, and a number chip in the tier color of that value. `rows` is ovrView's;
// a bar the data does not have is not in it, so it draws no row (the caller draws nothing for an empty list). Draw-only.
export function OvrBars({ rows }) {
  return (
    <ul className="ovrbars">
      {rows.map((r, i) => (
        <li key={r.key} className="ovrbars__row" style={{ '--tier': `var(--ovr-${r.tier.key})`, '--i': i }}>
          <span className="ovrbars__name">{r.label}</span>
          <span className="ovrbars__track" aria-hidden="true">
            <span className="ovrbars__fill" style={{ '--fill': `${(r.filled / SEGMENTS) * 100}%` }} />
          </span>
          <span className="ovrbars__chip">{r.value}</span>
        </li>
      ))}
    </ul>
  )
}
