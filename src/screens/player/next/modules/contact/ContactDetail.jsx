import { isAirFlight } from './contactFlight.js'
import { useFlight } from './ContactFlight.jsx'

// The Contact detail panel (#2073): the tapped ball's figures. It reads the flight clock, so
// the distance counts up in the air and the last stats rise in after the landing; the
// polite region speaks once, on landing.
export function ContactDetail({ cur, detail }) {
  const { frame } = useFlight()
  const flying = !!frame?.flying
  return (
    <div className={`fcontact__detail${flying ? ' fcontact__detail--fly' : ''}`}>
      <span className="sr-only" aria-live="polite">
        {cur && !flying ? `${detail.eyebrow}${cur.distance == null ? '' : `, ${cur.distance} feet`}, ${detail.when}` : ''}
      </span>
      {detail ? (
        <>
          <span className="fcontact__eyebrow">
            {flying ? (isAirFlight(cur) ? 'In the air' : 'On the ground') : detail.eyebrow}
          </span>
          <span className="fcontact__when">{detail.when}</span>
          <span className="fcontact__big">
            {flying && cur.distance != null ? Math.round(cur.distance * frame.fr) : detail.big}
            <small>{detail.unit}</small>
          </span>
          <dl className="fcontact__stats">
            {detail.stats.map(([k, v], i) =>
              i < 2 ? (
                <div key={k}><dd>{v}</dd><dt>{k}</dt></div>
              ) : (
                <div key={k} className="fcontact__rise" style={{ '--fcontact-i': i - 2 }}><dd>{v}</dd><dt>{k}</dt></div>
              ),
            )}
          </dl>
        </>
      ) : (
        <p className="hint">Tap a ball to see its exit velocity, launch angle and xBA.</p>
      )}
    </div>
  )
}
