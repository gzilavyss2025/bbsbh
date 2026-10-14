import { SEGMENTS } from '../../lib/ovr/card.js'

// The attribute rows of the OVR menu (#1703): a name, a 20-segment bar skewed on the
// card's angle, and a number chip in the tier color of that value. `rows` is ovrView's;
// a bar the data does not have is not in it, so it draws no row (the caller draws nothing for an empty list).
// With `onPick`, each row is a toggle button (the hero strip's "tap a bar to read its tier", #2009):
// `picked` is the pressed row's key, and onPick gets the tapped key, or null on a second tap.
export function OvrBars({ rows, picked, onPick }) {
  return (
    <ul className="ovrbars">
      {rows.map((r, i) => {
        const parts = (
          <>
            <span className="ovrbars__name">{r.label}</span>
            <span className="ovrbars__track" aria-hidden="true">
              <span className="ovrbars__fill" style={{ '--fill': `${(r.filled / SEGMENTS) * 100}%` }} />
            </span>
            <span className="ovrbars__chip">{r.value}</span>
          </>
        )
        return (
          <li key={r.key} className={onPick ? undefined : 'ovrbars__row'} style={{ '--tier': `var(--ovr-${r.tier.key})`, '--i': i }}>
            {onPick ? (
              <button type="button" className="ovrbars__row ovrbars__pick" aria-pressed={picked === r.key} onClick={() => onPick(picked === r.key ? null : r.key)}>
                {parts}
              </button>
            ) : parts}
          </li>
        )
      })}
    </ul>
  )
}
