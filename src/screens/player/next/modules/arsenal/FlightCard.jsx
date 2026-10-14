import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { CAMERAS, ZONE, orbitOf, towardOf, tunnelView, verdictOf } from './flightView.js'
import { flyStep, landedLoop, startLoop, stepLoop, stillCam, swingCam } from './flightMotion.js'
import { FlightScene } from './FlightScene.jsx'
import { PitchGlyph } from './PitchGlyph.jsx'

const SPEEDS = [[1, '1×', 'real speed'], [1 / 3, '⅓×', 'one-third speed'], [1 / 4, '¼×', 'one-quarter speed']]
const inches = (v, d = 1) => `${Math.abs(v).toFixed(d)} in`
const MID = (ZONE.y0 + ZONE.y1) / 2
// A missing figure is a dash with no unit.
const mph = (v) => (v == null ? '—' : `${v.toFixed(1)} mph`)
const rpm = (v) => (v == null ? '—' : `${v.toLocaleString('en-US')} rpm`)

// The flight loop (#2073, board PitchFlight.dc.html): a wait at release, the flight, a hold on the landed
// frame, then again (flightMotion.js). It runs only while the stage is on screen or within 120px of it.
// A reader who asked for less motion gets the landed frame, a camera that snaps, and the scrubber.
// `stage` is the ref of the element it watches. `onCycle` runs when a hold ends: the card moves to the next pitch there.
function useFlightLoop({ stage, end, speed, reduced, onCycle }) {
  const [snap, setSnap] = useState(() => ({
    loop: reduced ? landedLoop() : startLoop(true),
    cam: stillCam(orbitOf('catcher')),
  }))
  // The engine's state for the frame loop and the handlers; `snap` is the same state for the render.
  const eng = useRef(snap)
  const cfg = useRef({ end, speed, onCycle })
  useEffect(() => {
    cfg.current = { end, speed, onCycle }
  })
  const put = (next) => {
    eng.current = next
    setSnap(next)
  }

  useEffect(() => {
    if (reduced) return undefined
    let vis = true
    const node = stage.current
    const io =
      node && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((es) => { vis = es.some((e) => e.isIntersecting) }, { rootMargin: '120px' })
        : null
    if (io) io.observe(node)
    let raf
    let last = performance.now()
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const cur = eng.current
      if (vis && (cur.loop.playing || cur.cam.tw < 1)) {
        const { end: e, speed: v, onCycle: cycle } = cfg.current
        const next = { loop: stepLoop(cur.loop, dt, e, v), cam: flyStep(cur.cam, dt) }
        eng.current = next
        setSnap(next)
        if (next.loop.cycled) cycle()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
    }
  }, [reduced, stage])

  const { loop, cam } = snap
  return {
    s: Math.min(loop.s, end),
    phase: loop.phase,
    playing: loop.playing,
    view: cam.view,
    restart: () => put({ ...eng.current, loop: reduced ? landedLoop() : startLoop(true) }),
    setPlaying: (on) => put({ ...eng.current, loop: { ...eng.current.loop, playing: on } }),
    seek: (s) => put({ ...eng.current, loop: { ...eng.current.loop, phase: 'fly', timer: 0, s, prevS: s, playing: false } }),
    flyTo: (key) => {
      const to = orbitOf(key)
      put({ ...eng.current, cam: reduced ? stillCam(to) : swingCam(eng.current.cam, to) })
    },
  }
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
  const stage = useRef(null)
  const fly = useFlightLoop({
    stage,
    end,
    speed,
    reduced,
    // A hold ended: In order moves to the next pitch. The loop has already started over.
    onCycle: () => {
      if (seq && flyers.length > 1) setI((n) => (n + 1) % flyers.length)
    },
  })
  const { s, playing } = fly
  const held = fly.phase === 'hold'
  const p = seq ? flyers[i] : null
  const tunnel = seq ? null : tunnelView(shown)
  const onPlay = () => {
    if (playing) return fly.setPlaying(false)
    if (!held) return fly.setPlaying(true)
    if (seq && flyers.length > 1) setI((i + 1) % flyers.length)
    fly.restart()
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
        <button type="button" className="pnext-pick" aria-pressed={seq} onClick={() => { setMode('seq'); fly.restart() }}>In order</button>
        <button type="button" className="pnext-pick" aria-pressed={!seq} onClick={() => { setMode('tog'); fly.restart() }}>Together</button>
      </div>
      <div className="flight__row" role="group" aria-label="Pitches">
        {flyers.map((r, n) => (
          <Button
            key={r.code}
            size="control"
            pressed={seq ? n === i : on.has(r.code)}
            aria-label={r.velo == null ? r.mark.name : `${r.mark.name}, ${mph(r.velo)}`}
            onClick={() => {
              if (!seq) return setOn((cur) => new Set(cur.has(r.code) ? [...cur].filter((c) => c !== r.code) : [...cur, r.code]))
              setI(n)
              fly.restart()
            }}
          >
            <PitchGlyph mark={r.mark} size={14} />
            {r.code}
          </Button>
        ))}
      </div>
      <div className="flight__row" role="group" aria-label="Camera">
        {CAMERAS.map(([key, name]) => (
          <button key={key} type="button" className="pnext-pick" aria-pressed={camera === key} onClick={() => { setCamera(key); fly.flyTo(key) }}>{name}</button>
        ))}
      </div>
      <div className="flight__stage" ref={stage}>
        <FlightScene
          camera={fly.view}
          w={336}
          h={300}
          items={shown}
          s={s}
          ghost={seq && ghost}
          label="The pitches from the mound to the plate, seen from the chosen camera"
        />
      </div>
      <div className="flight__bar">
        {!reduced && <Button size="control" onClick={onPlay}>{playing ? 'Pause' : held ? (seq && flyers.length > 1 ? 'Next' : 'Replay') : 'Play'}</Button>}
        <input
          className="flight__range"
          type="range"
          min="0"
          max="1000"
          aria-label="Time since release"
          value={Math.round((s / end) * 1000)}
          onChange={(e) => fly.seek((e.target.value / 1000) * end)}
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
