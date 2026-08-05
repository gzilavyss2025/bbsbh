import { pitchFamily } from '../../api/pitchArsenal.js'

const DASH = '—'

// The player page's "Pitches" body: a one-glance usage bar (each pitch a
// segment, colored by its family — fastball/breaking/offspeed/other, the
// same --arsenal-* inks the design system reserves for pitch families) over
// a per-pitch list of usage share and average velocity. `arsenal` is
// person.js's arsenalView output — already sorted most-thrown first. The bar
// is decorative (aria-hidden): every number it encodes is in the labeled
// rows beneath, with a family chip carrying the color key, so identity is
// never color-alone.
export function PitchMix({ arsenal }) {
  if (!arsenal?.length) return null
  const withUsage = arsenal.filter((p) => p.usage != null && p.usage > 0)
  return (
    <div className="pitchmix">
      {withUsage.length > 1 && (
        <div className="pitchmix__bar" aria-hidden="true">
          {withUsage.map((p) => (
            <span
              key={p.code}
              className={`pitchmix__seg pitchmix__seg--${pitchFamily(p.code)}`}
              style={{ flexGrow: p.usage }}
            />
          ))}
        </div>
      )}
      <ul className="pitchmix__list">
        {arsenal.map((p) => (
          <li className="pitchmix__row" key={p.code}>
            <span
              className={`pitchmix__chip pitchmix__chip--${pitchFamily(p.code)}`}
              aria-hidden="true"
            />
            <span className="pitchmix__name">{p.name}</span>
            <span className="pitchmix__usage">
              {p.usage != null ? `${Math.round(p.usage * 100)}%` : DASH}
            </span>
            <span className="pitchmix__velo">
              {p.velo != null ? <>{p.velo.toFixed(1)} <span className="pitch__unit">mph</span></> : DASH}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
