import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { CAMERAS, ZONE, towardOf, tunnelView, verdictOf } from './flightView.js'
import { FlightScene } from './FlightScene.jsx'
import { PitchGlyph } from './PitchGlyph.jsx'

const SPEEDS = [[1, '1×', 'real speed'], [1 / 3, '⅓×', 'one-third speed'], [1 / 4, '¼×', 'one-quarter speed']]
const inches = (v, d = 1) => `${Math.abs(v).toFixed(d)} in`
const MID = (ZONE.y0 + ZONE.y1) / 2
// A missing figure is a dash with no unit.
const mph = (v) => (v == null ? '—' : `${v.toFixed(1)} mph`)
const rpm = (v) => (v == null ? '—' : `${v.toLocaleString('en-US')} rpm`)

// The flight clock: seconds into the flight, played by the animation frame. `end` is the flight's length,
// `speed` the fraction of real time. A reader who asked for less motion gets the landed frame and a scrubber.
function useFlightClock(end, speed, reduced) {
  const [s, setS] = useState(reduced ? end : 0)
  const [playing, setPlaying] = useState(!reduced)
  const at = useRef(s)
  useEffect(() => {
    if (!playing) return undefined
    let raf
    let last = performance.now()
    const tick = (now) => {
      at.current = Math.min(end, at.current + Math.min(0.05, (now - last) / 1000) * speed)
      last = now
      setS(at.current)
      if (at.current >= end) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, end, speed])
  const seek = (v, play) => {
    at.current = v
    setS(v)
    setPlaying(play)
  }
  return { s, playing, seek }
}

// The Pitch flight card (#1892, board PitchFlight.dc.html): each pitch type's average path from the mound,
// one at a time or all together, from one of four cameras. `rows` are arsenal rows; only those with a path fly.
export function FlightCard({ rows, season, throws }) {
  const flyers = useMemo(() => rows.filter((r) => r.path), [rows])
  const reduced = motionIsReduced()
  const [mode, setMode] = useState('seq')
  const [i, setI] = useState(0)
  const [on, setOn] = useState(() => new Set(flyers.map((r) => r.code)))
  const [camera, setCamera] = useState('catcher')
  const [speed, setSpeed] = useState(1 / 3)
  const [ghost, setGhost] = useState(true)
  const seq = mode === 'seq'
  const shown = seq ? [flyers[i]] : flyers.filter((r) => on.has(r.code))
  const end = Math.max(0.01, ...shown.map((r) => r.path.T))
  const { s, playing, seek } = useFlightClock(end, speed, reduced)
  const restart = () => (reduced ? seek(end, false) : seek(0, true))
  // A new pitch, mode or selection changes the flight's length: start it over.
  useEffect(restart, [mode, i, on, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = seq ? flyers[i] : null
  const tunnel = seq ? null : tunnelView(shown)
  const onPlay = () => {
    if (playing) return seek(s, false)
    if (s < end) return seek(s, true)
    if (seq && flyers.length > 1) setI((i + 1) % flyers.length)
    else restart()
  }
  const label = seq
    ? `${p.code} · ${mph(p.velo)} · ${p.path.T.toFixed(2)} s`
    : shown.length ? `${shown.map((r) => r.code).join(' · ')} · together` : 'No pitch selected'
  const left = rows.length - flyers.length
  return (
    <div className="flight">
      <div className="flight__label">
        <b>Pitch flight</b>
        <em>{label}</em>
      </div>
      <div className="flight__row" role="group" aria-label="Show">
        <button type="button" className="pnext-pick" aria-pressed={seq} onClick={() => setMode('seq')}>In order</button>
        <button type="button" className="pnext-pick" aria-pressed={!seq} onClick={() => setMode('tog')}>Together</button>
      </div>
      <div className="flight__row" role="group" aria-label="Pitches">
        {flyers.map((r, n) => (
          <Button
            key={r.code}
            size="control"
            pressed={seq ? n === i : on.has(r.code)}
            aria-label={r.velo == null ? r.mark.name : `${r.mark.name}, ${mph(r.velo)}`}
            onClick={() => {
              if (seq) setI(n)
              else setOn((cur) => new Set(cur.has(r.code) ? [...cur].filter((c) => c !== r.code) : [...cur, r.code]))
            }}
          >
            <PitchGlyph mark={r.mark} size={14} />
            {r.code}
          </Button>
        ))}
      </div>
      <div className="flight__row" role="group" aria-label="Camera">
        {CAMERAS.map(([key, name]) => (
          <button key={key} type="button" className="pnext-pick" aria-pressed={camera === key} onClick={() => setCamera(key)}>{name}</button>
        ))}
      </div>
      <div className="flight__stage">
        <FlightScene
          camera={camera}
          w={336}
          h={300}
          items={shown}
          s={s}
          ghost={seq && ghost}
          label="The pitches from the mound to the plate, seen from the chosen camera"
        />
      </div>
      <div className="flight__bar">
        {!reduced && <Button size="control" onClick={onPlay}>{playing ? 'Pause' : s >= end ? (seq && flyers.length > 1 ? 'Next' : 'Replay') : 'Play'}</Button>}
        <input
          className="flight__range"
          type="range"
          min="0"
          max="1000"
          aria-label="Time since release"
          value={Math.round((s / end) * 1000)}
          onChange={(e) => seek((e.target.value / 1000) * end, false)}
        />
        <output className="flight__clock">{s.toFixed(2)} s</output>
      </div>
      <div className="flight__bar">
        {seq && <button type="button" className="pnext-pick" aria-pressed={ghost} onClick={() => setGhost(!ghost)}>Gravity path</button>}
        <div className="flight__row" role="group" aria-label="Speed">
          {SPEEDS.map(([v, name]) => (
            <button key={name} type="button" className="pnext-pick" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{name}</button>
          ))}
        </div>
      </div>
      {seq ? <Sequence p={p} throws={throws} /> : <Together t={tunnel} />}
      <p className="flight__note">
        Each path uses his average release point, speed and movement from {rows.reduce((n, r) => n + r.pitches, 0).toLocaleString('en-US')}{' '}
        pitches in {season} regular-season games. Shown at {SPEEDS.find(([v]) => v === speed)[2]}.
        {left > 0 && ` ${left} ${left === 1 ? 'type has' : 'types have'} too few tracked pitches to fly.`}
      </p>
    </div>
  )
}

const Fact = ({ name, value, note }) => (
  <div className="flight__fact">
    <b>{name}</b>
    <em>{value}</em>
    {note && <small>{note}</small>}
  </div>
)

function Sequence({ p, throws }) {
  const { path, landing } = p
  const dx = landing ? landing.x * 12 : null
  const dy = landing ? (landing.h - MID) * 12 : null
  const inZone = landing && Math.abs(landing.x) <= ZONE.x && landing.h >= ZONE.y0 && landing.h <= ZONE.y1
  return (
    <div className="flight__info">
      <p className="flight__ask">{p.mark.name}</p>
      <p className="flight__note">{verdictOf(path, throws)} Thrown {p.pct}% of the time.</p>
      <div className="flight__facts">
        <Fact name="Speed and spin" value={mph(p.velo)} note={`${rpm(p.spin)} · ${path.T.toFixed(2)} s to the plate`} />
        <Fact
          name="Rise vs. gravity-only"
          value={`${path.lift >= 0 ? '+' : '−'}${inches(path.lift)}`}
          note={`Gravity alone would drop it ${inches(path.fall)}. It drops ${inches(path.fall - path.lift)}.`}
        />
        <Fact
          name="Side break"
          value={inches(path.side)}
          note={Math.abs(path.side) < 2 ? 'Almost no side break.' : `Toward ${towardOf(path.side, throws)}.`}
        />
        <Fact
          name="Average landing"
          value={landing ? (inZone ? 'In the zone' : 'Out of the zone') : '—'}
          note={
            landing
              ? `${inches(dx)} ${dx < 0 ? 'left' : 'right'} of center from the catcher's seat, ${inches(dy)} ${dy < 0 ? 'below' : 'above'} the middle. The average zone, and an average path.`
              : 'No location on file for this pitch.'
          }
        />
      </div>
    </div>
  )
}

function Together({ t }) {
  return (
    <div className="flight__info">
      <p className="flight__ask">How far apart do they stay?</p>
      <p className="flight__note">
        All pitches leave from the same spot at once. Gaps are between average paths. A hitter also reads spin and release, so a small gap is not a guarantee.
      </p>
      {t ? (
        <div className="flight__facts">
          <Fact name="Apart at release" value={inches(t.release)} />
          <Fact name="Apart 23.8 ft out" value={inches(t.out)} note="About 175 ms before the plate." />
          <Fact name="Apart at the plate" value={inches(t.plate)} />
          <Fact name="Closest pair, 23.8 ft out" value={t.closest.names} note={`${inches(t.closest.out)} there, ${inches(t.closest.plate)} at the plate`} />
          <Fact name="Widest pair, 23.8 ft out" value={t.widest.names} note={`${inches(t.widest.out)} there, ${inches(t.widest.plate)} at the plate`} />
        </div>
      ) : (
        <p className="flight__note">Select at least two pitches to compare.</p>
      )}
    </div>
  )
}
