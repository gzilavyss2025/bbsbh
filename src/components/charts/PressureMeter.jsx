import { pressureLabel, pressureTop } from '../../api/tensest/tenseBars.js'

// The Pressure meter (#2939): ten LED bars rising left to right, lit up to
// `bars` (1–10, from tenseBars in api/tensest/tenseBars.js). How tense a play
// was, ranked against the whole season. A play's leverage is score-revealing,
// so `bars` arrives already reveal-gated by the caller (charts/ rule). Null or
// 0 draws nothing: a game's first play has no leverage reading.
//
// Two sizes. Inline (the swing rows, Gary's option A, 2026-11-09): no caption,
// no motion. `big` (Gameday, #3006): the broadcast frame and a caption plate
// ("Pressure · Top 7%"); the bars fill one by one when the value changes and
// the top lit bar pulses, faster at 9–10 (styles/charts/pressure-meter.css,
// off under reduced motion). `big` with no `bars` draws the dark, empty meter.
//
// Inside a control (a swing row is a button, whose own label is all a screen
// reader hears) pass `decorative`: the meter hides itself and the control's
// label carries pressureLabel's words instead.
export function PressureMeter({ bars, cutoffs, decorative = false, big = false }) {
  const lit = Number.isInteger(bars) && bars >= 1 && bars <= 10 ? bars : 0
  if (!lit && !big) return null
  if (big) return <BigMeter bars={lit} cutoffs={cutoffs} />
  const a11y = decorative
    ? { 'aria-hidden': true }
    : { role: 'meter', 'aria-label': pressureLabel(bars, cutoffs), 'aria-valuemin': 0, 'aria-valuemax': 10, 'aria-valuenow': bars }
  return (
    <span className="pressure" {...a11y}>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`pressure__bar${i < bars ? ' is-lit' : ''}`} aria-hidden="true" />
      ))}
    </span>
  )
}

function BigMeter({ bars, cutoffs }) {
  const top = pressureTop(bars, cutoffs)
  return (
    <div className="pressure pressure--big" data-high={bars >= 9 || undefined} aria-hidden="true">
      <span className="pressure__track">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`pressure__bar${i < bars ? ' is-lit' : ''}${i === bars - 1 ? ' is-peak' : ''}`} style={{ '--i': i }} />
        ))}
      </span>
      <span className="pressure__cap">
        <span className="pressure__name">Pressure</span>
        {top != null && <span className="pressure__rank">Top {top}%</span>}
      </span>
    </div>
  )
}
