// THE YEAR SLIDER — the one control on The Double Dip, and the only
// two-handled one in the app.
//
// WHY TWO NATIVE INPUTS AND NOT A DRAWN WIDGET. A range with two handles is the
// classic place a hand-rolled control loses its keyboard and its screen reader:
// a div with a drag handler answers to a mouse and to nothing else. Two stacked
// `<input type="range">` elements are each a real slider — arrow keys, Home and
// End, an announced value, a focus ring — and the browser has already solved
// every one of those. All this component adds is the shared track under them
// and the clamping that stops the ends crossing.
//
// THE POINTER-EVENTS TRICK, which is the whole reason this is not four lines.
// Two full-width inputs stacked on one track means the top one swallows every
// tap, including taps meant for the bottom one's handle. So the INPUTS take
// `pointer-events: none` and only their THUMBS take it back
// (styles/68-around-the-game.css) — a tap lands on whichever handle is under
// the finger, and a tap on the bare track lands on neither, which is correct:
// there is no single "the value" for a track click to set here.
//
// The handles are still allowed to meet on the same year — a one-season range
// is a legitimate thing to ask for, and it is the range the page is most
// interesting at. What they may not do is cross, which is what the clamps in
// the two change handlers prevent.
export function YearRange({ min, max, from, to, onChange, label = 'Season range' }) {
  const span = Math.max(1, max - min)
  const leftPct = ((from - min) / span) * 100
  const rightPct = ((to - min) / span) * 100

  return (
    <div className="yrange" role="group" aria-label={label}>
      <p className="yrange__readout">
        <span className="yrange__years">
          {from}
          {from === to ? '' : `–${to}`}
        </span>
        <span className="yrange__count">
          {to - from + 1} season{to - from === 0 ? '' : 's'}
        </span>
      </p>

      <div className="yrange__track">
        <div
          className="yrange__fill"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          className="yrange__input yrange__input--from"
          min={min}
          max={max}
          step={1}
          value={from}
          aria-label="First season"
          onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        />
        <input
          type="range"
          className="yrange__input yrange__input--to"
          min={min}
          max={max}
          step={1}
          value={to}
          aria-label="Last season"
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        />
      </div>

      <p className="yrange__ends" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </p>
    </div>
  )
}
