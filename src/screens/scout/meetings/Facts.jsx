// The Meetings section's numbers (#1490, #2319). `Fact` and `ContactFacts` are the pitch modal's
// labelled boxes: the value in mono, a unit like "mph" as a smaller inline <small>, a label under it.
// `MeetingFacts` is the section's 3 x 2 grid and `ContactLine` a plate appearance's one line of
// contact numbers: both are a <dl> of caps labels over plain values.
export const fixed = (v, d) => (v == null ? '—' : v.toFixed(d))
export const xw = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0/, ''))

export function Fact({ value, unit, label }) {
  return (
    <div className="scout__fact">
      <span className="scout__factvalue">{value}{unit && value !== '—' && <small className="scout__factunit"> {unit}</small>}</span>
      <span className="scout__factlabel">{label}</span>
    </div>
  )
}

// The contact boxes for a ball in play: exit velocity, launch angle, xwOBA.
export function ContactFacts({ pitch }) {
  return (
    <div className="scout__facts scout__facts--3">
      <Fact value={fixed(pitch.launchSpeed, 1)} unit="mph" label="Exit velocity" />
      <Fact value={pitch.launchAngle == null ? '—' : `${pitch.launchAngle}°`} label="Launch angle" />
      <Fact value={xw(pitch.xwoba)} label="xwOBA on contact" />
    </div>
  )
}

// One label over one value, the cell both lists below share.
const Pair = ({ label, className, children }) => (
  <div className={className}>
    <dt className="scout__dtlabel">{label}</dt>
    <dd className="scout__dtvalue">{children}</dd>
  </div>
)

// The section's facts: six cells, three across (#2319, V10). `slash` is the "AVG/OBP/SLG" string.
// A cell too narrow for the whole line shows the average alone (".262"), never a broken line:
// meet.css swaps the two spans by the cell's own width.
export function MeetingFacts({ f, kbb, slash }) {
  return (
    <dl className="scout__mfacts">
      <Pair label="Line">{f.h}-for-{f.ab}</Pair>
      <Pair label="Pitches">{f.pitches}</Pair>
      <Pair label="K · BB">{kbb}</Pair>
      <Pair label="Slash" className="scout__slashcell">
        <span className="scout__slashfull">{slash}</span>
        <span className="scout__slashavg">{slash.split('/')[0]}</span>
      </Pair>
      <Pair label="Avg EV">{fixed(f.avgExit, 1)}</Pair>
      <Pair label="xwOBA con">{xw(f.xwobaContact)}</Pair>
    </dl>
  )
}

// A plate appearance's contact numbers on a ball in play, as the canvas draws them.
export function ContactLine({ pitch }) {
  return (
    <dl className="scout__contact">
      <Pair label="Exit velo">{fixed(pitch.launchSpeed, 1)} mph</Pair>
      <Pair label="Launch">{pitch.launchAngle == null ? '—' : `${pitch.launchAngle}°`}</Pair>
      <Pair label="xwOBA">{xw(pitch.xwoba)}</Pair>
    </dl>
  )
}
