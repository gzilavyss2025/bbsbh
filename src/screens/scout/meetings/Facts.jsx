// The Meetings tab's labelled number boxes (#1490): the value in mono, a unit
// like "mph" as a smaller inline <small>, and a plain label under it. Every
// number on the tab and in the pitch modal sits in one of these.
export const fixed = (v, d) => (v == null ? '—' : v.toFixed(d))
export const xw = (v) => (v == null ? '—' : v.toFixed(3).replace(/^0/, ''))

export function Fact({ value, unit, label, sub }) {
  return (
    <div className="scout__fact">
      <span className="scout__factvalue">{value}{unit && value !== '—' && <small className="scout__factunit"> {unit}</small>}</span>
      {sub && <span className="scout__factsub">{sub}</span>}
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
