import { Button } from '../../../../../components/ui/control/Button.jsx'
import { counter, isAhead, nearestBall, playStart } from './contactPlay.js'

// The Contact player (#2073): step or play through the balls in date order, or pick one
// on the season timeline. It only calls `onLaunch(i, play)` and `onPause()`; the
// flight clock is `FlightClock`'s (ContactFlight.jsx). The range input is invisible over the
// timeline, so a drag anywhere on it picks the nearest ball by date; the arrow keys step one ball.
const PREV = 'M13 3L5 9L13 15Z M3 3H5V15H3Z'
const NEXT = 'M5 3L13 9L5 15Z M13 3H15V15H13Z'
const PLAY = 'M5 3L16 10L5 17Z'
const PAUSE = 'M5 3H8V17H5Z M12 3H15V17H12Z'

const Glyph = ({ d, big }) => (
  <svg width={big ? 22 : 18} height={big ? 22 : 18} viewBox={big ? '0 0 20 20' : '0 0 18 18'} aria-hidden="true">
    <path d={d} fill="currentColor" />
  </svg>
)

export function ContactPlayer({ marks, idx, playing, axis, onLaunch, onPause }) {
  const n = marks.length
  const pos = marks.map((m) => (axis ? axis.pos(m.b.date) : 0))
  const at = idx >= 0 ? pos[idx] : 0
  const step = (e) => {
    const to = { ArrowLeft: idx - 1, ArrowDown: idx - 1, ArrowRight: idx + 1, ArrowUp: idx + 1, Home: 0, End: n - 1 }[e.key]
    if (to == null) return
    e.preventDefault()
    if (to >= 0 && to < n && to !== idx) onLaunch(to, false)
  }
  return (
    <div className="fcontact__player">
      <div className="fcontact__controls">
        <Button className="fcontact__ic" aria-label="Previous ball" disabled={idx <= 0} onClick={() => onLaunch(idx - 1, false)}>
          <Glyph d={PREV} />
        </Button>
        <Button
          className="fcontact__ic fcontact__ic--play"
          aria-label={playing ? 'Pause' : 'Play through the balls'}
          disabled={!n}
          onClick={() => (playing ? onPause() : onLaunch(playStart(idx, n), true))}
        >
          <Glyph d={playing ? PAUSE : PLAY} big />
        </Button>
        <Button className="fcontact__ic" aria-label="Next ball" disabled={idx >= n - 1} onClick={() => onLaunch(idx + 1, false)}>
          <Glyph d={NEXT} />
        </Button>
        <span className="fcontact__count">{counter(idx, n)}</span>
      </div>
      {axis && n > 0 && (
        <>
          <div className="fcontact__tl">
            <span className="fcontact__tl-line" />
            <span className="fcontact__tl-fill" style={{ width: `${at.toFixed(1)}%` }} />
            {pos.map((l, i) => (
              <span
                key={i}
                className={`fcontact__tick${i === idx ? ' fcontact__tick--cur' : isAhead(i, idx, playing) ? ' fcontact__tick--ahead' : ''}`}
                style={{ left: `${l.toFixed(2)}%` }}
              />
            ))}
            <input
              className="fcontact__scrub"
              type="range"
              min="0"
              max="1000"
              step="1"
              value={Math.round(at * 10)}
              aria-label="Pick a ball by date"
              aria-valuetext={counter(idx, n)}
              onKeyDown={step}
              onChange={(e) => {
                const i = nearestBall(pos, Number(e.target.value) / 10)
                if (i !== idx) onLaunch(i, false)
              }}
            />
          </div>
          <div className="fcontact__months" aria-hidden="true">
            {axis.months.map((mo) => (
              <span key={mo.t} style={{ left: `${mo.l.toFixed(1)}%` }}>{mo.t}</span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
