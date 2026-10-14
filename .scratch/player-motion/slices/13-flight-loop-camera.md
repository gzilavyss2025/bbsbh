# 13 — Pitch flight: loop, off-screen pause, camera tween

## Run

- Model: `claude-sonnet-5-5`. Effort: **high** (a rAF engine and two pure state machines).
- Depends on: **01b merged** (`src/lib/motion/curves.js` with `easeOutQuart`).
- Order: slices 11 and 12 also touch `modules/arsenal/`. If one of them is open and
  touches `flightView.js` or `FlightCard.jsx`, wait for it to merge, then merge `main` in.
- Parallel with: any slice outside `modules/arsenal/`. Not with 11, 12, 14, 15.

## Goal

The Pitch flight card plays like the canvas board. It loops on its own: a short wait at
release, the flight, a hold on the landed frame, then the next pitch (In order) or the same
set again (Together). It stops drawing when the card is off screen. A camera button swings
the camera to the new pose over 0.95 s on an ease-out-quart, in place of the snap today.

## Done means

- In order: pitch 1 waits 0.6 s at release, flies, holds 1.1 s, then pitch 2 starts by
  itself. After the last pitch it goes back to pitch 1. Together: the set restarts.
- Pause stops the loop. Play continues it. On the hold frame the button says **Next** (In
  order, two or more pitches) or **Replay**, and a tap goes on at once.
- Scroll the card more than 120px off screen: no state update runs (React DevTools
  "highlight updates" stays quiet). Scroll back: it continues.
- A camera button swings the view (yaw, pitch, distance, fov, target) over 0.95 s. The
  yaw takes the short way round.
- Reduced motion: no loop, the landed frame shows at once, the camera snaps, the scrubber
  still works. The Play button stays hidden (as today).
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/arsenal/flightMotion.js` — **new**. Pure: the loop
   phase machine and the camera tween. Slices 14 and 15 add to it.
2. `src/screens/player/next/modules/arsenal/flightView.js` — add `orbitOf(name)`; let
   `makeCamera` take an orbit view object as well as a name.
3. `src/screens/player/next/modules/arsenal/FlightCard.jsx` — replace `useFlightClock`
   with `useFlightLoop`; restart from the handlers, not from an effect; `flyTo` on the
   camera buttons.
4. `test/player-next-flight-motion.test.js` — **new**.

No CSS change. `FlightScene.jsx` does not change (it already passes `camera` to
`makeCamera`). Directory count: `modules/arsenal/` holds 7 files today; this slice makes 8.

## Canvas

Board `PitchFlight.dc.html`, script, `pfEngine`. Excerpts:

```js
const PF_PRE = 0.6, PF_HOLD = 1.1;
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 4);
const restart = () => { S.phase = 'pre'; S.timer = 0; S.s = 0; S.landT.fill(-1); };
const nextPitch = () => { S.i = (S.i + 1) % 5; ...; restart(); notify(); };
if (reduce) { S.phase = 'hold'; S.s = P[0].T; }
E.togglePlay = () => {
  if (!S.playing) { if (S.phase === 'hold' || S.s >= end()) { if (S.mode === 'seq') nextPitch(); else restart(); } S.playing = true; } else S.playing = false;
};
E.onScrub = e => { S.phase = 'fly'; S.s = e.target.value / 1000 * end(); S.landT.fill(-1); S.playing = false; };
E.setMode = v => { S.mode = v; ...; restart(); S.playing = true; };
E.onChip = i => { if (S.mode === 'tog') S.on[i] = !S.on[i]; else { S.i = i; ...; restart(); S.playing = true; } };
E.flyTo = key => {
  S.camKey = key; const pose = POSES[...];
  S.from = { T: S.view.T.slice(), yaw: S.view.yaw, pitch: S.view.pitch, dist: S.view.dist, fov: S.view.fov }; S.to = toOrbit(pose); S.tw = 0;
  if (reduce) { S.view = S.to; S.tw = 1; }
};
// step(dt):
if (S.tw < 1) {
  S.tw = Math.min(1, S.tw + dt / 0.95); const u = easeOut(S.tw), a = S.from, b = S.to, v = S.view;
  v.T = lerp3(a.T, b.T, u); v.yaw = a.yaw + wrap(b.yaw - a.yaw) * u; v.pitch = lerp(a.pitch, b.pitch, u); v.dist = lerp(a.dist, b.dist, u); v.fov = lerp(a.fov, b.fov, u);
}
if (S.playing) {
  if (S.phase === 'pre') { S.timer += dt; S.s = 0; if (S.timer >= PF_PRE) { S.phase = 'fly'; ... } }
  else if (S.phase === 'fly') { const prev = S.s; S.s = Math.min(e, S.s + dt * S.speed); ...; if (S.s >= e) { S.phase = 'hold'; S.timer = 0; ... } }
  else { S.timer += dt; if (S.timer >= PF_HOLD) { if (seq) nextPitch(); else restart(); } }
}
// orbit form of a pose:
function toOrbit(o) { const d = [o.pos[0] - o.tgt[0], o.pos[1] - o.tgt[1], o.pos[2] - o.tgt[2]], dist = Math.hypot(...d);
  return { T: o.tgt.slice(), yaw: Math.atan2(d[0], -d[2]), pitch: Math.asin(d[1] / dist), dist, fov: o.fov }; }
const fromOrbit = v => [v.T[0] + v.dist * Math.sin(v.yaw) * Math.cos(v.pitch), v.T[1] + v.dist * Math.sin(v.pitch), v.T[2] - v.dist * Math.cos(v.yaw) * Math.cos(v.pitch)];
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
// frame: dt capped at 0.05 s; step and render only while visible
const frame = now => { const dt = Math.min(0.05, (now - E.last) / 1000); E.last = now; if (E.vis && E.ctx) { step(dt, now / 1000); render(); } E.raf = requestAnimationFrame(frame); };
E.io = new IntersectionObserver(es => { E.vis = es[0].isIntersecting; }, { rootMargin: '120px' });
```

Play label on the board: `S.playing ? 'Pause' : (S.phase === 'hold' ? 'Next' : 'Play')`.
The board autoplays (`autoplay` default true, never under reduced motion).

Decided here, from the board:
- A chip tap in **Together** toggles the pitch and does **not** restart (the board's
  `onChip`). Live restarts today through the effect at `FlightCard.jsx:60`; that goes.
- **Freeze at zone**, the **Batter** camera and the **Batter side** toggle are on the
  board but not on the live card. They stay out (no new control in this slice).

## Live today

`src/screens/player/next/modules/arsenal/FlightCard.jsx`:

- l.15–41 `useFlightClock(end, speed, reduced)`: one rAF loop, `setS` each frame, and
  `if (at.current >= end) setPlaying(false)` at **l.29** — it plays one time and stops.
- l.51 `const [camera, setCamera] = useState('catcher')`.
- l.57–60:
  ```js
  const { s, playing, seek } = useFlightClock(end, speed, reduced)
  const restart = () => (reduced ? seek(end, false) : seek(0, true))
  // A new pitch, mode or selection changes the flight's length: start it over.
  useEffect(restart, [mode, i, on, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  ```
- l.64–69 `onPlay` (pause, resume, or Next / Replay at the end).
- l.81–82 the mode buttons `setMode('seq')` / `setMode('tog')`; l.91–94 the chip handler.
- l.102–104 the camera buttons: `onClick={() => setCamera(key)}` — a snap.
- l.106–116 `<div className="flight__stage"><FlightScene camera={camera} … s={s} …/></div>`.
- l.118 the Play button label `{playing ? 'Pause' : s >= end ? (seq && flyers.length > 1 ? 'Next' : 'Replay') : 'Play'}`.
- l.119–128 the range (`value={Math.round((s / end) * 1000)}`, `onChange` → `seek(…, false)`) and the clock `{s.toFixed(2)} s`.

`src/screens/player/next/modules/arsenal/flightView.js`:

- l.182–187 `const POSES = { catcher: { pos, tgt, fov }, mound, side, park }` (same values as the board).
- l.188 `export const CAMERAS = [['catcher', 'Catcher'], …]`.
- l.191–201 `makeCamera(name, W, H)`: `'flat'` returns the side-view frame; else it reads
  `POSES[name]` and builds `{ pos, f, r, u, W, H, k }`.

`FlightScene.jsx:12` — `const cam = useMemo(() => makeCamera(camera, w, h), [camera, w, h])`.
A new view object each frame gives a new camera each frame, which is what the tween needs.

`src/hooks/scroll/useNearView.js` is one-shot (it disconnects after the first hit), so it
does not fit. Decision: no new hook file. The loop's own effect holds an
`IntersectionObserver` with `rootMargin: '120px'` and keeps visibility in a local
variable, so a visibility change never re-renders.

## Build

State rule (react-hooks 7.1.1): `react-hooks/set-state-in-effect` is an ERROR, and the
`refs` rule forbids reading a ref during render. Set state only from a rAF, timer,
observer or event callback, never synchronously in an effect body.

### 1. `flightMotion.js` (new)

```js
// The Pitch flight's motion (#2073, board PitchFlight.dc.html): the loop of phases each flight runs through,
// and the camera's swing from one pose to the next. Pure; no clock, no DOM. FlightCard runs them in a
// requestAnimationFrame loop.
import { easeOutQuart } from '../../../../../lib/motion/curves.js'

// Seconds of the board's loop: a wait at release, then the flight, then a hold on the landed frame.
export const PRE_S = 0.6
export const HOLD_S = 1.1
// Seconds of a camera swing.
export const FLY_S = 0.95

const lerp = (a, b, u) => a + (b - a) * u

// A loop at release. `playing` false gives a paused start.
export const startLoop = (playing) => ({ phase: 'pre', timer: 0, s: 0, prevS: 0, playing, cycled: false })

// The landed frame, paused: what a reader who asked for less motion sees. `s` is Infinity so it is
// the end of any flight; the caller clamps it to the flight's length.
export const landedLoop = () => ({ phase: 'hold', timer: 0, s: Infinity, prevS: Infinity, playing: false, cycled: false })

// One step of `dt` seconds. `end` is the flight's length (s), `speed` the fraction of real time.
// `prevS` is `s` before the step, so a caller can see a pitch land (prevS < T <= s).
// `cycled` is true on the one step where the hold ends and the loop starts again: the caller then
// moves to the next pitch (In order) or leaves the set as it is (Together).
export function stepLoop(L, dt, end, speed) {
  if (!L.playing) return L
  if (L.phase === 'pre') {
    const timer = L.timer + dt
    return timer >= PRE_S
      ? { ...L, phase: 'fly', timer: 0, s: 0, prevS: 0, cycled: false }
      : { ...L, timer, s: 0, prevS: 0, cycled: false }
  }
  if (L.phase === 'fly') {
    const s = Math.min(end, L.s + dt * speed)
    return s >= end
      ? { ...L, phase: 'hold', timer: 0, s, prevS: L.s, cycled: false }
      : { ...L, s, prevS: L.s, cycled: false }
  }
  const timer = L.timer + dt
  return timer >= HOLD_S ? { ...startLoop(true), cycled: true } : { ...L, timer, prevS: L.s, cycled: false }
}

// An angle in (-PI, PI], so a swing takes the short way round.
export function wrapAngle(a) {
  let v = a
  while (v > Math.PI) v -= 2 * Math.PI
  while (v <= -Math.PI) v += 2 * Math.PI
  return v
}

// The view `u` of the way from orbit view `a` to `b` (u in 0..1, already eased).
// A view is { T: [x, h, z] look-at point, yaw, pitch, dist, fov } (flightView.orbitOf).
export function viewAt(a, b, u) {
  return {
    T: a.T.map((v, i) => lerp(v, b.T[i], u)),
    yaw: a.yaw + wrapAngle(b.yaw - a.yaw) * u,
    pitch: lerp(a.pitch, b.pitch, u),
    dist: lerp(a.dist, b.dist, u),
    fov: lerp(a.fov, b.fov, u),
  }
}

// A camera that rests on `view`.
export const stillCam = (view) => ({ view, from: view, to: view, tw: 1 })

// A camera that starts a swing from where it is now to `to`.
export const swingCam = (cam, to) => ({ view: cam.view, from: cam.view, to, tw: 0 })

// One step of a swing: FLY_S seconds on the ease-out-quart curve. At the end the view is `to` exactly.
export function flyStep(cam, dt) {
  if (cam.tw >= 1) return cam
  const tw = Math.min(1, cam.tw + dt / FLY_S)
  return { ...cam, tw, view: tw >= 1 ? cam.to : viewAt(cam.from, cam.to, easeOutQuart(tw)) }
}
```

`easeOutQuart` is the exact name slice 01b exports from `src/lib/motion/curves.js`
(the quartic ease-out, clamped to [0, 1]). Import that name; do not add a local copy.

### 2. `flightView.js`

Replace l.191–201 (`makeCamera`) with this, and keep `POSES`, `CAMERAS`, `NEAR` as they are:

```js
// A camera pose as an orbit about its look-at point (the board's toOrbit): T the look-at point, yaw and
// pitch the angles of the lens about it (radians), dist the feet between them, fov in degrees. A swing
// and a drag move these, so the camera turns about the scene.
export function orbitOf(name) {
  const { pos, tgt, fov } = POSES[name] ?? POSES.catcher
  const d = pos.map((c, i) => c - tgt[i])
  const dist = Math.hypot(...d)
  return { T: tgt.slice(), yaw: Math.atan2(d[0], -d[2]), pitch: Math.asin(d[1] / dist), dist, fov }
}
const lensOf = (v) => [
  v.T[0] + v.dist * Math.sin(v.yaw) * Math.cos(v.pitch),
  v.T[1] + v.dist * Math.sin(v.pitch),
  v.T[2] - v.dist * Math.cos(v.yaw) * Math.cos(v.pitch),
]

// `view` is a camera name ('flat', or a POSES key) or an orbit view (orbitOf).
export function makeCamera(view, W, H) {
  // The Arsenal card's side view is flat, as the board draws it: distance across (the plate on the right),
  // height up, the height stretched so the paths visibly split.
  if (view === 'flat') return { flat: true, W, H, ox: W * 0.881, sx: W * 0.01396, oy: H * 0.922, sy: H * 0.119 }
  const v = typeof view === 'string' ? orbitOf(view) : view
  const pos = lensOf(v)
  const norm = (q) => q.map((c) => c / (Math.hypot(...q) || 1))
  const f = norm(v.T.map((t, i) => t - pos[i]))
  const r = norm([f[2], 0, -f[0]])
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]
  return { pos, f, r, u, W, H, k: H / 2 / Math.tan((v.fov * Math.PI) / 360) }
}
```

The two existing camera tests in `test/player-next-arsenal.test.js` (l.139–157) must still
pass unchanged: a pose through `orbitOf` and back gives the same lens to float error.

### 3. `FlightCard.jsx`

Imports: change l.1 and l.4, and add the motion import (`useMemo` stays; `flyers` uses it):

```js
import { useEffect, useMemo, useRef, useState } from 'react'
import { CAMERAS, ZONE, orbitOf, towardOf, tunnelView, verdictOf } from './flightView.js'
import { flyStep, landedLoop, startLoop, stepLoop, stillCam, swingCam } from './flightMotion.js'
```

Replace `useFlightClock` (l.15–41) with:

```js
// The flight loop (#2073, board PitchFlight.dc.html): a wait at release, the flight, a hold on the landed
// frame, then again (flightMotion.js). It runs only while the stage is on screen or within 120px of it.
// A reader who asked for less motion gets the landed frame, a camera that snaps, and the scrubber.
// `onCycle` runs when a hold ends: the card moves to the next pitch there.
function useFlightLoop({ end, speed, reduced, onCycle }) {
  const stage = useRef(null)
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
  }, [reduced])

  const { loop, cam } = snap
  return {
    stage,
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
```

Note on lint: `react-hooks` 7.1.1 runs the `refs` rule. The render reads `snap` only, never
`eng.current` or `cfg.current`; the handlers and the effects read the refs. Keep it that way.

In `FlightCard` (l.45 on), replace l.51 and l.56–69:

```js
  const [camera, setCamera] = useState('catcher')
  …
  const end = Math.max(0.01, ...shown.map((r) => r.path.T))
  const fly = useFlightLoop({
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
```

Delete the old `restart` and the `useEffect(restart, …)` line (l.58–60). Restart from the
handlers instead:

- Mode buttons (l.81–82): `onClick={() => { setMode('seq'); fly.restart() }}` and the same for `'tog'`.
- Chip handler (l.91–94):
  ```js
  onClick={() => {
    if (!seq) return setOn((cur) => new Set(cur.has(r.code) ? [...cur].filter((c) => c !== r.code) : [...cur, r.code]))
    setI(n)
    fly.restart()
  }}
  ```
- Camera buttons (l.103): `onClick={() => { setCamera(key); fly.flyTo(key) }}`.
- Stage (l.106–107): `<div className="flight__stage" ref={fly.stage}>` and
  `camera={fly.view}` on `FlightScene` (in place of `camera={camera}`). `camera` state stays:
  it drives `pressed` on the camera buttons.
- Play label (l.118): `{playing ? 'Pause' : held ? (seq && flyers.length > 1 ? 'Next' : 'Replay') : 'Play'}`.
- Range `onChange` (l.126): `onChange={(e) => fly.seek((e.target.value / 1000) * end)}`.

`useEffect` stays imported: `useFlightLoop` uses it.

## Test first

New file `test/player-next-flight-motion.test.js`. Run `node --test
test/player-next-flight-motion.test.js` before any product edit: it fails (the module and
`orbitOf` do not exist).

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FLY_S, HOLD_S, PRE_S, flyStep, landedLoop, startLoop, stepLoop, stillCam, swingCam, viewAt, wrapAngle,
} from '../src/screens/player/next/modules/arsenal/flightMotion.js'
import { makeCamera, orbitOf, project } from '../src/screens/player/next/modules/arsenal/flightView.js'

// The Pitch flight's motion (#2073, board PitchFlight.dc.html): the loop of phases and the camera swing.
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

test('the board values: 0.6 s at release, 1.1 s hold, 0.95 s swing', () => {
  assert.equal(PRE_S, 0.6)
  assert.equal(HOLD_S, 1.1)
  assert.equal(FLY_S, 0.95)
})

test('stepLoop waits at release, then flies', () => {
  const a = stepLoop(startLoop(true), 0.55, 0.4, 1)
  assert.equal(a.phase, 'pre')
  assert.equal(a.s, 0)
  const b = stepLoop(a, 0.1, 0.4, 1)
  assert.equal(b.phase, 'fly')
  assert.equal(b.s, 0)
})

test('stepLoop flies at the chosen speed and holds at the end', () => {
  const fly = { ...startLoop(true), phase: 'fly', s: 0.3 }
  const a = stepLoop(fly, 0.05, 0.4, 1 / 3)
  close(a.s, 0.3 + 0.05 / 3)
  close(a.prevS, 0.3)
  const b = stepLoop({ ...fly, s: 0.39 }, 0.05, 0.4, 1)
  assert.equal(b.phase, 'hold')
  assert.equal(b.s, 0.4)
  close(b.prevS, 0.39)
})

test('stepLoop holds 1.1 s, then starts again and says so once', () => {
  const hold = { ...startLoop(true), phase: 'hold', s: 0.4, prevS: 0.4 }
  const a = stepLoop(hold, 1.0, 0.4, 1)
  assert.equal(a.phase, 'hold')
  assert.equal(a.cycled, false)
  assert.equal(a.s, 0.4)
  const b = stepLoop(a, 0.2, 0.4, 1)
  assert.equal(b.phase, 'pre')
  assert.equal(b.s, 0)
  assert.equal(b.cycled, true)
  assert.equal(stepLoop(b, 0.01, 0.4, 1).cycled, false)
})

test('a paused loop does not move; the landed loop is paused at the end', () => {
  const paused = { ...startLoop(false), phase: 'fly', s: 0.2 }
  assert.equal(stepLoop(paused, 0.05, 0.4, 1), paused)
  const L = landedLoop()
  assert.equal(L.playing, false)
  assert.equal(L.phase, 'hold')
  assert.equal(Math.min(L.s, 0.42), 0.42)
})

test('wrapAngle keeps an angle in (-PI, PI]', () => {
  close(wrapAngle(3 * Math.PI / 2), -Math.PI / 2)
  close(wrapAngle(-3 * Math.PI / 2), Math.PI / 2)
  close(wrapAngle(0.5), 0.5)
})

test('viewAt: the two ends, and the yaw takes the short way round', () => {
  const a = { T: [0, 2, 30], yaw: 3, pitch: 0.2, dist: 40, fov: 27 }
  const b = { T: [0, 2.4, 1], yaw: -3, pitch: 0.1, dist: 65, fov: 13 }
  assert.deepEqual(viewAt(a, b, 0), a)
  const end = viewAt(a, b, 1)
  close(wrapAngle(end.yaw - b.yaw), 0)
  close(end.dist, 65)
  // Half way from 3 to -3 the short way is past PI, not through 0.
  assert.ok(viewAt(a, b, 0.5).yaw > 3)
})

test('flyStep: front-loaded on ease-out-quart, and exactly the target after 0.95 s', () => {
  const from = orbitOf('catcher')
  const to = orbitOf('park')
  const c = swingCam(stillCam(from), to)
  const half = flyStep(c, FLY_S / 2)
  // easeOutQuart(0.5) = 0.9375 of the way.
  close(half.view.dist, from.dist + (to.dist - from.dist) * 0.9375)
  const done = flyStep(half, FLY_S)
  assert.equal(done.tw, 1)
  assert.equal(done.view, to)
  assert.equal(flyStep(done, 0.1), done)
})

test('orbitOf: a pose as an orbit gives the same camera as the pose', () => {
  for (const name of ['catcher', 'mound', 'side', 'park']) {
    const a = makeCamera(name, 336, 300)
    const b = makeCamera(orbitOf(name), 336, 300)
    const pa = project(a, [0, 2.4, 1.417])
    const pb = project(b, [0, 2.4, 1.417])
    close(pa.x, pb.x, 1e-6)
    close(pa.y, pb.y, 1e-6)
  }
})
```

Before the change the file fails at its imports (`flightMotion.js` and `orbitOf` do not
exist), so every case fails first.

## Verify

- `node --test test/player-next-flight-motion.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`, open `/player/robert-gasser-688107?nointro` at 390px and at 1180px. Scroll
  to Pitch arsenal. Watch two full cycles of In order: release wait, flight, hold, next
  pitch, and back to pitch 1 after the last one. Switch to Together: it loops the set.
- Tap Mound, then Park, then Catcher: each swings, no snap. Pause during a swing: the
  swing still ends (the camera tween runs while paused, as on the board).
- Scroll the card off screen and back; confirm with a `console.count` in `frame` (remove it
  after) that no step runs while hidden.
- Playwright with `reducedMotion: 'reduce'`: the landed frame shows at once, the camera
  buttons snap, the scrubber moves the ball.
- Send Gary a short frame strip (`SendUserFile`) of one cycle and one camera swing, and
  name the route.
- No `/animation-lab` entry: this is a JS loop inside one module, with no CSS class to
  demo. Say so in the PR.

## Out of scope

- The `<canvas>` renderer (slice 15) and drag and keys (slice 14).
- Freeze at zone, the Batter camera, the Batter side toggle, the in-scene chips and gates.
- The Arsenal card's side view (`ArsenalCard.jsx`) and `FlightScene.jsx`.
- Any change to the facts text, the speeds, or the Gravity path toggle.

## Stop if

- `src/lib/motion/curves.js` does not exist or does not export `easeOutQuart` (slice 01b not merged).
- `FlightCard.jsx` or `flightView.js` differ from the code quoted in "Live today" in a way
  that changes the plan (for example, slice 11 or 12 moved the clock or the cameras).
- `modules/arsenal/` would go past 12 files.
- `react-hooks` lint flags the hook and the fix needs a ref read in render, or an
  `eslint-disable` beyond one line. Report the rule and the line.
- An existing test in `test/player-next-arsenal.test.js` fails after the `makeCamera` change.
