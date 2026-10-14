# 18 — Contact: ball flight on tap

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 17b merged (17a and 17b both edit `ContactModule.jsx` and `contact.css`).
- Parallel with: any slice outside `modules/contact/*` and `batter/contact.css`.

## Goal

A tap on a ball on the Contact spray field flies it: the plate pulses, the ball leaves
the plate, rises and falls along a drag-and-lift arc with its shadow on the ground, and
lands with a ring (two rings for a home run). The detail panel counts the distance up as
the ball flies, and its last stats rise in after the landing. Reduced motion shows the
landed state at once.

## Done means

- Tap or Enter on a dot: after 260ms the ball flies for 700-2800ms (from the model),
  then lands. The tapped dot hides while the ball flies.
- During flight: a dashed ground track and a solid trace follow the ball; the ball grows
  with height; a shadow ellipse and a dotted drop line sit under it.
- At landing: a ring grows r3→15 (canvas units) over 900ms; a home run adds a second
  ring r3→25 over 1100ms, 140ms later; a selection ring shrinks 1.6x→1x over 260ms; the
  trace fades over 1400ms.
- The panel: the eyebrow reads "In the air" or "On the ground" during flight; the big
  distance counts up; xBA and Barrel are hidden in flight and rise in after landing (0
  and 60ms). The screen reader hears the ball once, after it lands.
- A second tap on the same ball flies it again.
- Reduced motion: no flight, no rings; the selection ring and the full panel show at once.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/contact/contactFlight.js` — new, pure: the canvas
   flight model and the frame at time `t`.
2. `src/screens/player/next/modules/contact/ContactFlight.jsx` — new: `useFlightClock`
   (the rAF clock) and `FlightMarks` (the SVG overlay).
3. `src/screens/player/next/modules/contact/ContactModule.jsx` — wire the tap, the
   clock, the overlay and the panel.
4. `src/styles/player-next/batter/contact.css` — the overlay inks, the hidden dot, the
   panel rise.
5. `test/player-next-contact-flight.test.js` — new.

The contact folder then holds 5 files (cap 12).

## Is there a ball-flight model to reuse? No.

`test/ball-flight.test.js` covers `src/lib/ballpark/ballFlight.js`. That module draws a
**plan-view path**: one quadratic from home to the landing point, bowed by
`range × tan(angle) / 4` as a glyph for height (`ballFlightPath`, `bowSagitta`). It has
no time, no height over time, and no drag. Its one caller is
`src/components/charts/BallFlight.jsx`. The canvas flight needs the ground share `sf`
and the height `sz` at 41 time steps. So this slice copies the canvas sim into a new
pure module and does not touch `ballFlight.js`. It does reuse `HOME`
(`ballparkGeometry.js`) and `HIT_COORD_FT_PER_UNIT` (`hitProjection.js`, 2.51 ft per
canvas unit).

## Canvas

Board `Contact.dc.html`. The beats (all inside `_rv()`):

```js
this.LEAD = 260;
const t = st.t, el = t - this.LEAD, ms = fx ? fx.ms : 1;
const u = cl(el / ms), flying = !!cur && t < this.LEAD + ms, since = el - ms;
const H0x = 125.42, H0y = 198.27, ZK = 0.24;
const pq = cl(t / (this.LEAD + 420));
F.pr = f2(3 + pq * 12); F.pop = t < this.LEAD + 420 ? f2(0.8 * (1 - pq)) : 0;
// flying:
F.trackOp = el > 0 ? 0.55 : 0;  F.traceOp = 0.85;
F.srx = f2(2.2 + z / 120); F.sry = f2(1 + z / 300); F.sop = f2(Math.max(0.12, 0.35 - z / 400));
F.drop = z > 4 ? … : ''; F.dropOp = f2(Math.min(0.6, z / 40));
F.br = f2(2.3 + z / 100 * 1.6); F.bop = 1;
// landed:
const a = eo(since / 260);                 // eo = 1 - (1 - x)^3 here (cubic)
F.trackOp = f2(0.55 - 0.15 * cl(since / 600));
F.traceOp = f2(0.85 * (1 - cl(since / 1400)));
const lq = cl(since / 900), lq2 = cl((since - 140) / 1100);
F.lr = f2(3 + lq * 12); F.lop = since < 900 ? f2(0.9 * (1 - lq)) : 0;
F.lr2 = f2(3 + lq2 * 22); F.lop2 = cur.r === 'HR' && since < 1240 ? f2(0.7 * (1 - lq2)) : 0;
sel2 = { r: f2(6.5 * (1 + 0.6 * (1 - a))), op: f2(Math.min(1, since / 160)) };
// the dot of the flying ball:
const op = hide ? 0 : …;   // hide = isSel && flying
```

The clock: `tick` adds `Math.min(50, now - last)` per frame, and runs while
`t < end + 1300` (`end = LEAD + fl(b).ms`). `launch(i)` sets `t = 0`, or, under reduced
motion, `t = LEAD + ms`.

The model, `sim(ev, la, lift)` and `fl(b)`, is copied whole into `contactFlight.js` below
(the drag constants, the 18-step bisection on lift in 0-0.45, the 41 samples, the
fallback hop, `ms: Math.max(700, Math.min(2800, T * 500))`). The canvas note says why:
"The flight is a sketch: a drag model fitted to the measured distance shapes the arc, at
half speed. The page prints no height or hang time from it."

The panel:

```js
eyebrow: flying ? (cur.la != null && cur.la < 10 ? 'On the ground' : 'In the air') : eyebrow,
big: cur.dist == null ? '—' : String(Math.round(cur.dist * (flying ? fr : 1))),
stats: […].map((s, i) => Object.assign(s, { d: ((i - 2) * 60) + 'ms', cls: i < 2 ? '' : 'tc-rise' })),
if (!flying) live = eyebrow + ', ' + (cur.dist == null ? '' : Math.round(cur.dist) + ' feet, ') + np.when;
```

```css
.tc-np .tc-rise{animation:tc-rise 380ms cubic-bezier(.2,.9,.3,1) backwards}
.tc-np.tc-fl .tc-rise{animation:none;opacity:0}
@keyframes tc-rise{from{opacity:0;transform:translateY(6px)}}
```

The canvas description line (`np.des`, rise at 260ms) and pitch line (`np.pitch`) have no
live data: the spray store carries no play text and no pitch. Out of scope.

### Units: canvas to live

The canvas field is 1 unit = about 2.5 ft; the live diagram is 1 unit = 1 ft with dots
of r9 (r11 for a home run), against the canvas r2.1. Three scales, all in
`contactFlight.js`:

- `UNIT = HIT_COORD_FT_PER_UNIT` (2.51) for lengths on the field: the plate pulse.
- `ZK = 0.24 * UNIT` for height (feet up the frame).
- Marks that sit on a dot grow from the live dot: the ball and its shadow scale by
  `dotR / 2.1`; a ring of canvas radius `cr` is `dotR + (cr - 2.1) * UNIT`, so it starts
  just outside the dot, as on the canvas.

## Live today

`src/screens/player/next/modules/contact/ContactModule.jsx` (pre-17 line numbers; 17a
and 17b shift them):

```jsx
49	  const [sel, setSel] = useState(null)
…
59	  const shown = useMemo(() => (card ? pickBalls(card.balls, view, type) : []), [card, view, type])
60	  const marks = useMemo(() => shown.map((b) => ({ b, p: hitCoordToSvg(b.x, b.y) })).filter((m) => m.p), [shown])
…
73	  const cur = sel && shown.includes(sel) ? sel : null
74	  const detail = cur && ballDetail(cur)
…
104	                className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}`}
…
111	                onClick={() => setSel(b)}
112	                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(b) } }}
…
124	        <div className="fcontact__detail" aria-live="polite">
125	          {detail ? (
126	            <>
127	              <span className="fcontact__eyebrow">{detail.eyebrow}</span>
128	              <span className="fcontact__when">{detail.when}</span>
129	              <span className="fcontact__big">{detail.big}<small>{detail.unit}</small></span>
130	              <dl className="fcontact__stats">
131	                {detail.stats.map(([k, v]) => (
132	                  <div key={k}><dd>{v}</dd><dt>{k}</dt></div>
133	                ))}
134	              </dl>
135	            </>
```

`ballDetail` (`contactView.js` l.82-95) gives `stats` in this order: Exit velo, Launch
angle, xBA, Barrel. So xBA and Barrel are the two that rise (the canvas rises its
3rd and 4th, Spray and xBA).

`src/styles/player-next/batter/contact.css`:

```css
52	.fcontact__dot--sel {
53	  stroke: var(--text-heading);
54	  stroke-width: 3;
55	}
```

This static ring stays: it marks the picked ball with no motion. The new selection ring
draws around it.

The ball fields (`decodeSprayBalls`, `src/api/spray.js` l.194-218): `exitVelo`,
`launchAngle`, `distance` (null when missing, never 0), `result` (`'hr'` …). No play
text.

## Build

### 1. `contactFlight.js` (new)

```js
import { HIT_COORD_FT_PER_UNIT } from '../../../../../lib/ballpark/hitProjection.js'

// The Contact card's ball flight (#2073): the canvas drag-and-lift sketch, fitted to the
// measured distance, played at half speed. Only the motion reads it; the card prints no
// height or hang time from it. Pure: no React, no clock. lib/ballpark/ballFlight.js is a
// different thing (a static plan-view bow), so it is not reused here.

export const LEAD_MS = 260 // the plate pulse before the ball leaves
export const SETTLE_MS = 1400 // the longest landed beat (the trace fade); the clock stops after it
export const CANVAS_DOT_R = 2.1 // the canvas dot, the base for marks that sit on a dot
export const UNIT = HIT_COORD_FT_PER_UNIT // one canvas unit, in diagram feet
export const ZK = 0.24 * UNIT // height in feet to diagram units up the frame
const K = 40 // samples per flight

const cl = (x) => Math.min(1, Math.max(0, x))
const eo = (x) => 1 - (1 - cl(x)) ** 3
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100

// One flight: x along the ground and z up, in feet, every 10ms, until it lands.
export function simFlight(ev, la, lift) {
  const G = 32.174, RHO = 0.002284, A = 0.04585, MS = 0.009955, CD = 0.35, dt = 0.01
  const v0 = ev * 1.46667
  const a = (la * Math.PI) / 180
  let x = 0, z = 3, vx = v0 * Math.cos(a), vz = v0 * Math.sin(a), t = 0
  const kd = (0.5 * RHO * A * CD) / MS
  const kl = (0.5 * RHO * A * lift) / MS
  const pts = [[0, 3, 0]]
  while (t < 14) {
    const v = Math.hypot(vx, vz)
    vx += (-kd * v * vx - kl * v * vz) * dt
    vz += (-G - kd * v * vz + kl * v * vx) * dt
    x += vx * dt; z += vz * dt; t += dt
    pts.push([x, z, t])
    if (z <= 0 && t > 0.2) {
      const p = pts[pts.length - 2]
      const f = p[1] / (p[1] - z)
      return { dist: p[0] + (x - p[0]) * f, T: p[2] + dt * f, pts }
    }
  }
  return { dist: x, T: t, pts }
}

// The model of one ball: T (s), sf (share of the ground covered) and sz (height, ft) at
// K + 1 even steps, and ms (the flight on screen). A ball in the air with a speed, an
// angle and a distance is fitted: the lift is bisected until the sim lands at the
// distance. Anything else hops along the ground. `chord` is home to the landing point
// in diagram feet, the stand-in for a missing distance.
export function flightModel(ball, chord) {
  const ev = ball.exitVelo, la = ball.launchAngle, dist = ball.distance || chord
  const sf = [], sz = []
  let T
  if (la != null && la >= 8 && ev != null && ball.distance) {
    let lo = 0, hi = 0.45, s
    if (dist <= simFlight(ev, la, lo).dist) s = lo
    else if (dist >= simFlight(ev, la, hi).dist) s = hi
    else {
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2
        if (simFlight(ev, la, mid).dist < dist) lo = mid
        else hi = mid
      }
      s = (lo + hi) / 2
    }
    const f = simFlight(ev, la, s)
    T = f.T
    let j = 1
    for (let i = 0; i <= K; i++) {
      const t = (T * i) / K
      while (j < f.pts.length - 1 && f.pts[j][2] < t) j++
      const p0 = f.pts[j - 1], p1 = f.pts[j]
      const q = p1[2] === p0[2] ? 0 : (t - p0[2]) / (p1[2] - p0[2])
      sf.push(Math.min(1, (p0[0] + (p1[0] - p0[0]) * q) / f.dist))
      sz.push(Math.max(0, p0[1] + (p1[1] - p0[1]) * q))
    }
    sf[K] = 1
    sz[K] = 0
  } else {
    T = Math.max(1.2, Math.min(3.6, dist / (Math.max(60, ev || 80) * 1.4667 * 0.42)))
    for (let i = 0; i <= K; i++) {
      const u = i / K
      sf.push(1 - (1 - u) ** 1.8)
      sz.push(i === K ? 0 : 3 * (1 - u) * Math.abs(Math.sin(3.4 * Math.PI * u)))
    }
  }
  return { T, sf, sz, ms: Math.max(700, Math.min(2800, T * 500)) }
}

// One model per ball object (the bisection runs ~20 sims; a tap must not repeat it).
const CACHE = new WeakMap()
export function flightOf(ball, chord) {
  let f = CACHE.get(ball)
  if (!f) {
    f = flightModel(ball, chord)
    CACHE.set(ball, f)
  }
  return f
}

const path = (pts) => pts.map(([x, y], j) => `${j ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('')

// Every mark at time t (ms since the tap). t = Infinity is the settled landed state: the
// reduced-motion frame. `home` and `land` are diagram points; `dotR` is the tapped dot's
// radius; `hr` adds the second ring.
export function flightFrame(f, t, { home, land, dotR, hr }) {
  const M = dotR / CANVAS_DOT_R
  const around = (cr) => dotR + (cr - CANVAS_DOT_R) * UNIT
  const el = t - LEAD_MS
  const u = cl(el / f.ms)
  const flying = t < LEAD_MS + f.ms
  const since = el - f.ms
  const last = f.sf.length - 1
  const s = u * last
  const i0 = Math.min(last - 1, Math.floor(s))
  const q = s - i0
  const fr = f.sf[i0] + (f.sf[i0 + 1] - f.sf[i0]) * q
  const z = f.sz[i0] + (f.sz[i0 + 1] - f.sz[i0]) * q
  const at = (g, h) => [home.x + (land.x - home.x) * g, home.y + (land.y - home.y) * g - h * ZK]
  const [gx, gy] = at(fr, 0)
  const pq = cl(t / (LEAD_MS + 420))
  const pulse = { r: r2((3 + pq * 12) * UNIT), op: t < LEAD_MS + 420 ? r2(0.8 * (1 - pq)) : 0 }
  if (flying) {
    const pts = f.sf.slice(0, i0 + 1).map((g, k) => at(g, f.sz[k]))
    pts.push(at(fr, z))
    return {
      flying, fr, pulse,
      track: { d: `M${home.x} ${home.y}L${r1(gx)} ${r1(gy)}`, op: el > 0 ? 0.55 : 0 },
      trace: { d: el > 0 ? path(pts) : '', op: 0.85 },
      shadow: { x: r1(gx), y: r1(gy), rx: r2((2.2 + z / 120) * M), ry: r2((1 + z / 300) * M), op: r2(Math.max(0.12, 0.35 - z / 400)) },
      drop: z > 4 ? { d: `M${r1(gx)} ${r1(gy - z * ZK)}L${r1(gx)} ${r1(gy)}`, op: r2(Math.min(0.6, z / 40)) } : null,
      ball: { x: r1(gx), y: r1(gy - z * ZK), r: r2((2.3 + (z / 100) * 1.6) * M) },
      ring: null, ring2: null, sel: null,
    }
  }
  const a = eo(since / 260)
  const lq = cl(since / 900)
  const lq2 = cl((since - 140) / 1100)
  return {
    flying, fr: 1, pulse,
    track: { d: `M${home.x} ${home.y}L${land.x} ${land.y}`, op: r2(0.55 - 0.15 * cl(since / 600)) },
    trace: { d: path(f.sf.map((g, k) => at(g, f.sz[k]))), op: r2(0.85 * (1 - cl(since / 1400))) },
    ring: { x: land.x, y: land.y, r: r2(around(3 + lq * 12)), op: since < 900 ? r2(0.9 * (1 - lq)) : 0 },
    ring2: { x: land.x, y: land.y, r: r2(around(3 + lq2 * 22)), op: hr && since < 1240 ? r2(0.7 * (1 - lq2)) : 0 },
    sel: { x: land.x, y: land.y, r: r2(around(6.5 * (1 + 0.6 * (1 - a)))), op: r2(Math.min(1, since / 160)) },
    shadow: null, drop: null, ball: null,
  }
}
```

The `eo` here is the canvas Contact one, a cubic. Slice 01b's `easeOutQuart` (in
`src/lib/motion/curves.js`) is the Arsenal and PitchFlight curve; do not swap it in.
01b exports no cubic ease-out (its exports are `cubicBezier`, `EASE_STAMP`,
`EASE_UNFOLD`, `easeStamp`, `easeUnfold`, `easeOutQuart`), so `eo` stays local in
`contactFlight.js`. Do not add it to `curves.js`. The one change from the canvas: the
sample walk keeps `j` across samples (time only grows), so it is linear, not quadratic.
The result is the same.

### 2. `ContactFlight.jsx` (new)

```jsx
import { useEffect, useState } from 'react'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { LEAD_MS, SETTLE_MS } from './contactFlight.js'

// The clock of one flight (#2073): ms since the tap, from rAF, at most 50ms a frame (a
// background tab does not jump the ball to the end). `shot` changes on every tap, so a
// second tap on the same ball flies it again. Reduced motion, or no ball: Infinity, the
// settled frame, and no loop.
export function useFlightClock(shot, model) {
  const [clock, setClock] = useState({ shot: -1, t: Infinity })
  const reduced = motionIsReduced()
  useEffect(() => {
    if (!model || reduced) return undefined
    const end = LEAD_MS + model.ms + SETTLE_MS
    let t = 0
    let last = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      t += Math.min(50, now - last)
      last = now
      setClock({ shot, t })
      if (t < end) id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [shot, model, reduced])
  if (!model || reduced) return Infinity
  // Until the first frame of a new shot, the flight is at its start, not at the last
  // ball's end (no one-frame flash of the landed state).
  return clock.shot === shot ? clock.t : 0
}

// The marks of the flight, drawn over the dots. Decoration: the dot and the panel carry
// the meaning, so the group is hidden from assistive tech and takes no taps.
export function FlightMarks({ frame, home }) {
  const f = frame
  return (
    <g className="fcontact__fx" aria-hidden="true">
      <circle className="fcontact__fx-pulse" cx={home.x} cy={home.y} r={f.pulse.r} opacity={f.pulse.op} />
      <path className="fcontact__fx-track" d={f.track.d} opacity={f.track.op} />
      {f.trace.d && <path className="fcontact__fx-trace" d={f.trace.d} opacity={f.trace.op} />}
      {f.ring && <circle className="fcontact__fx-ring" cx={f.ring.x} cy={f.ring.y} r={f.ring.r} opacity={f.ring.op} />}
      {f.ring2 && <circle className="fcontact__fx-ring2" cx={f.ring2.x} cy={f.ring2.y} r={f.ring2.r} opacity={f.ring2.op} />}
      {f.shadow && <ellipse className="fcontact__fx-shadow" cx={f.shadow.x} cy={f.shadow.y} rx={f.shadow.rx} ry={f.shadow.ry} opacity={f.shadow.op} />}
      {f.drop && <path className="fcontact__fx-drop" d={f.drop.d} opacity={f.drop.op} />}
      {f.ball && <circle className="fcontact__fx-ball" cx={f.ball.x} cy={f.ball.y} r={f.ball.r} />}
      {f.sel && <circle className="fcontact__fx-sel" cx={f.sel.x} cy={f.sel.y} r={f.sel.r} opacity={f.sel.op} />}
    </g>
  )
}
```

`motionIsReduced()` is read in render, which is fine: it reads `<html>` and a media
query, and the tap that starts a flight renders again.

**Lint:** `eslint-plugin-react-hooks` 7.1.1 runs its recommended set, where
`react-hooks/set-state-in-effect` is an ERROR. `setClock` runs only in the rAF callback,
never in the effect body. Keep it that way: do not add a `setClock({ shot, t: 0 })` at
the top of the effect (the `clock.shot === shot ? … : 0` line does that job in render).

### 3. `ContactModule.jsx`

Imports:

```jsx
import { FlightMarks, useFlightClock } from './ContactFlight.jsx'
import { flightFrame, flightOf } from './contactFlight.js'
```

State, beside `sel`: `const [shot, setShot] = useState(0)`.

Move `cur` (today l.73) up, above `const empty = …` and every early return, and add the
model, the clock and the frame there (hooks run on every render):

```jsx
  const cur = sel && shown.includes(sel) ? sel : null
  const curMark = cur ? marks.find((m) => m.b === cur) : null
  const model = useMemo(
    () => (curMark ? flightOf(curMark.b, Math.hypot(curMark.p.x - HOME.x, curMark.p.y - HOME.y)) : null),
    [curMark],
  )
  const t = useFlightClock(shot, model)
  const dotR = (b) => (b.result === 'hr' ? 11 : 9)
  const frame = model ? flightFrame(model, t, { home: HOME, land: curMark.p, dotR: dotR(cur), hr: cur.result === 'hr' }) : null
  const flying = !!frame?.flying
  const tap = (b) => { setSel(b); setShot((s) => s + 1) }
```

On the dot (today l.102-113): `r={dotR(b)}`; `onClick={() => tap(b)}`; in `onKeyDown`,
`tap(b)`; and add the hide class:

```jsx
className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}${b === cur && flying ? ' fcontact__dot--hide' : ''}`}
```

After the dots group (`</g>` from 17a), inside the `<svg>`:

```jsx
            {frame && <FlightMarks frame={frame} home={HOME} />}
```

The panel (today l.124-139) becomes:

```jsx
        <div className={`fcontact__detail${flying ? ' fcontact__detail--fly' : ''}`}>
          <span className="sr-only" aria-live="polite">
            {cur && !flying ? `${detail.eyebrow}${cur.distance == null ? '' : `, ${cur.distance} feet`}, ${detail.when}` : ''}
          </span>
          {detail ? (
            <>
              <span className="fcontact__eyebrow">
                {flying ? (cur.launchAngle != null && cur.launchAngle < 10 ? 'On the ground' : 'In the air') : detail.eyebrow}
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
```

`aria-live` moves off the panel (it would read every count-up frame) onto the
`sr-only` span, which speaks once, on landing. `.sr-only` is in
`src/styles/01-base.css` l.15.

Why the rise replays on each landing: in flight, `--fly` sets `animation: none`; when
the class goes, the animation is set again, and the browser starts it from 0.

### 4. `contact.css`

Add after `.fcontact__dot--sel` (l.52-55):

```css
/* The ball flight (#2073; ContactFlight.jsx). The tapped dot hides while its ball flies.
   The marks are SVG strokes at the canvas widths times 2.5 (the canvas field unit). Their
   opacity and size are per frame, from contactFlight.js. */
.fcontact__dot--hide {
  opacity: 0;
}
.fcontact__fx {
  pointer-events: none;
}
.fcontact__fx-pulse,
.fcontact__fx-ring,
.fcontact__fx-sel {
  fill: none;
  stroke: var(--text-heading);
}
.fcontact__fx-pulse { stroke-width: 2.5; }
.fcontact__fx-ring { stroke-width: 3; }
.fcontact__fx-sel { stroke-width: 4.5; }
.fcontact__fx-ring2 {
  fill: none;
  stroke: var(--award-ink);
  stroke-width: 5;
}
.fcontact__fx-track {
  fill: none;
  stroke: var(--text-heading);
  stroke-width: 2;
  stroke-dasharray: 5 6;
}
.fcontact__fx-trace {
  fill: none;
  stroke: var(--text-heading);
  stroke-width: 3.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.fcontact__fx-shadow { fill: var(--text-heading); }
.fcontact__fx-drop {
  fill: none;
  stroke: var(--text-heading);
  stroke-width: 1.5;
  stroke-dasharray: 3 3;
}
.fcontact__fx-ball {
  fill: var(--surface-card);
  stroke: var(--text-heading);
  stroke-width: 2.75;
}
```

The second ring uses `--award-ink`, the live home-run dot colour (l.59), not the canvas
green.

Add after `.fcontact__stats dt` (l.110-113):

```css
/* After the landing, the last two stats rise in, 60ms apart (--fcontact-i is 0 or 1).
   In flight they wait unseen. */
.fcontact__rise {
  animation: fcontact-rise var(--dur-stamp-in) var(--ease-stamp) backwards;
  animation-delay: calc(var(--fcontact-i, 0) * var(--dur-fast) / 2);
}
.fcontact__detail--fly .fcontact__rise {
  animation: none;
  opacity: 0;
}
@keyframes fcontact-rise {
  from { opacity: 0; transform: translateY(var(--space-1h)); }
}
@media (prefers-reduced-motion: reduce) {
  .fcontact__rise { animation: none; }
}
```

380ms = `--dur-stamp-in` (slice 01a); 60ms = `--dur-fast / 2`; 6px = `--space-1h`.
`stroke-width` and `stroke-dasharray` are not counted by `check-raw-values.mjs` (it
counts hex, radius, motion times and shadows). No new flex or grid rule.

## Test first

New file `test/player-next-contact-flight.test.js`. The pure cases were run against the
code above in a scratch copy: all pass with it, all fail without it (the module does
not exist).

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  CANVAS_DOT_R, LEAD_MS, SETTLE_MS, UNIT, ZK, flightFrame, flightModel, flightOf, simFlight,
} from '../src/screens/player/next/modules/contact/contactFlight.js'

// The Contact ball flight (#2073, slice 18): the canvas drag-and-lift sketch and its frame.
const HOME = { x: 310, y: 505 }
const LAND = { x: 420, y: 140 }
const HR = { exitVelo: 105, launchAngle: 28, distance: 410, result: 'hr' }
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} is not near ${b}`)

test('simFlight: more lift carries the same swing further; it starts 3 ft up and lands', () => {
  assert.ok(simFlight(105, 28, 0.45).dist > simFlight(105, 28, 0).dist + 50)
  const f = simFlight(105, 28, 0.2)
  assert.equal(f.pts[0][1], 3)
  near(f.pts.at(-1)[1], 0, 2)
})

test('flightModel: a fly ball is fitted to its distance and sampled at 41 steps', () => {
  const f = flightModel(HR, 380)
  assert.equal(f.sf.length, 41)
  assert.equal(f.sz.length, 41)
  assert.equal(f.sf[0], 0)
  assert.equal(f.sf[40], 1)
  assert.equal(f.sz[40], 0)
  for (let i = 1; i <= 40; i++) assert.ok(f.sf[i] >= f.sf[i - 1], `sf rises at ${i}`)
  near(f.T, 4.854, 0.01)
  near(f.ms, f.T * 500, 0.01)
  near(Math.max(...f.sz), 81.6, 0.5)
})

test('flightModel: a ground ball (under 8°) hops low and takes the 700ms floor', () => {
  const f = flightModel({ exitVelo: 87, launchAngle: 5, distance: 74 }, 74)
  assert.equal(f.ms, 700)
  assert.ok(Math.max(...f.sz) <= 3)
  assert.equal(f.sz[40], 0)
})

test('flightModel: with no speed, angle or distance, the chord stands in', () => {
  near(flightModel({ exitVelo: null, launchAngle: null, distance: null }, 120).ms, 1217.5, 0.5)
})

test('flightModel: a flight lasts 2800ms at most', () => {
  assert.equal(flightModel({ exitVelo: 110, launchAngle: 30, distance: 480 }, 480).ms, 2800)
})

test('flightOf: one model per ball object', () => {
  const b = { ...HR }
  assert.equal(flightOf(b, 380), flightOf(b, 380))
})

test('scales: canvas units to diagram feet', () => {
  assert.equal(UNIT, 2.51)
  near(ZK, 0.24 * 2.51, 1e-9)
  assert.equal(CANVAS_DOT_R, 2.1)
})

const frame = (t, o = {}) => flightFrame(flightModel(HR, 380), t, { home: HOME, land: LAND, dotR: 11, hr: true, ...o })

test('frame at 0: the plate pulse starts at r3, no trace yet, the ball at the plate', () => {
  const f = frame(0)
  assert.equal(f.flying, true)
  assert.equal(f.pulse.r, 7.53)
  assert.equal(f.pulse.op, 0.8)
  assert.equal(f.trace.d, '')
  assert.equal(f.track.op, 0)
  assert.equal(f.ball.x, HOME.x)
  assert.equal(f.ring, null)
})

test('frame mid-flight: the ball is up, its shadow on the ground, a drop line between', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms / 2)
  assert.equal(f.flying, true)
  assert.ok(f.fr > 0.4 && f.fr < 0.8)
  assert.ok(f.ball.y < f.shadow.y)
  assert.ok(f.drop)
  assert.ok(f.trace.d.startsWith('M310 503.2L'))
  assert.equal(f.track.op, 0.55)
  assert.equal(f.pulse.op, 0)
})

test('frame at landing: rings at r3, the selection ring at 1.6x and not yet shown', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms)
  assert.equal(f.flying, false)
  assert.equal(f.fr, 1)
  assert.equal(f.ring.r, 13.26)
  assert.equal(f.ring.op, 0.9)
  assert.equal(f.ring2.op, 0.7)
  assert.equal(f.sel.r, 31.83)
  assert.equal(f.sel.op, 0)
  assert.equal(f.ball, null)
})

test('the second ring is for a home run only', () => {
  const m = flightModel(HR, 380)
  assert.equal(frame(LEAD_MS + m.ms, { hr: false }).ring2.op, 0)
})

test('settled (t = Infinity, the reduced-motion frame): no rings, no trace, selection ring at 1x', () => {
  const f = frame(Infinity)
  assert.equal(f.ring.op, 0)
  assert.equal(f.ring2.op, 0)
  assert.equal(f.trace.op, 0)
  assert.equal(f.track.op, 0.4)
  assert.equal(f.sel.r, 22.04)
  assert.equal(f.sel.op, 1)
  assert.equal(f.pulse.op, 0)
})

test('every landed beat ends inside SETTLE_MS, so the clock may stop there', () => {
  const m = flightModel(HR, 380)
  const f = frame(LEAD_MS + m.ms + SETTLE_MS)
  assert.equal(f.ring.op, 0)
  assert.equal(f.ring2.op, 0)
  assert.equal(f.trace.op, 0)
})

// ---- the sheet and the wiring ----
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the last stats rise in after the landing, 60ms apart, and wait unseen in flight', () => {
  const b = ruleBody(CSS, '.fcontact__rise')
  assert.equal(decl(b, 'animation'), 'fcontact-rise var(--dur-stamp-in) var(--ease-stamp) backwards')
  assert.equal(decl(b, 'animation-delay'), 'calc(var(--fcontact-i, 0) * var(--dur-fast) / 2)')
  const fly = ruleBody(CSS, '.fcontact__detail--fly .fcontact__rise')
  assert.equal(decl(fly, 'animation'), 'none')
  assert.equal(decl(fly, 'opacity'), '0')
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__rise\s*\{\s*animation: none;?\s*\}/)
})

test('the flying dot hides; the overlay takes no taps', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dot--hide'), 'opacity'), '0')
  assert.equal(decl(ruleBody(CSS, '.fcontact__fx'), 'pointer-events'), 'none')
})

test('the module flies the tapped ball and speaks once, on landing', () => {
  assert.match(JSX, /useFlightClock\(shot, model\)/)
  assert.match(JSX, /<FlightMarks frame=\{frame\} home=\{HOME\} \/>/)
  assert.match(JSX, /fcontact__dot--hide/)
  assert.match(JSX, /<span className="sr-only" aria-live="polite">/)
  assert.doesNotMatch(JSX, /className="fcontact__detail" aria-live/)
})
```

## Verify

- `node --test test/player-next-contact-flight.test.js`, then `npm run lint`.
  Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- Chromium at 390px and 1180px: `/player/brice-turang-668930?nointro`. Tap a home run.
  Take a frame strip at about 0, 260, 900, 1500ms, landing, landing + 300ms, landing +
  1400ms. Check: the pulse at the plate, the ball growing at the top of its arc, the
  shadow and drop line, the count-up, both rings, xBA and Barrel rising in. Tap a
  ground ball: a short low hop. Tap the same ball again: it flies again. Use Enter on a
  focused dot.
- Reduced motion (Playwright `reducedMotion: 'reduce'`): a tap shows the landed panel
  and the selection ring at once; no rAF runs (check with a performance trace, or log
  from `useFlightClock` while you test, then remove the log).
- Send Gary the strip with `SendUserFile` and the route.

## Out of scope

- The canvas description line (`np.des`) and pitch line (`np.pitch`): no live data.
- The canvas "Spray" stat (Pull / Center / Oppo): the live panel keeps its four stats.
- Play-through, prev/next and the timeline (19).
- An `/animation-lab` entry: the flight is a JS clock with a ball, not a class the Lab
  can freeze, and the slice is at five files. Name it as a follow-up in the PR.
- Any change to `src/lib/ballpark/ballFlight.js` or `BallFlight.jsx`.

## Stop if

- 17a or 17b is not merged, or the dots are no longer drawn in one `marks.map` in
  `ContactModule.jsx`.
- `ballDetail` no longer returns the stats in the order Exit velo, Launch angle, xBA,
  Barrel.
- `HIT_COORD_FT_PER_UNIT` is no longer 2.51, or `hitCoordToSvg` no longer maps feet 1:1
  off `HOME` (the scales above assume both).
- A test value above (4.854 s, 81.6 ft, 13.26, 31.83, 22.04) does not come out with the
  code as written. Do not edit the number to match: find the difference from the code
  in this brief, and report it.
- `ContactModule.jsx` would pass 600 lines.
- `npm run lint` reports a `react-hooks/*` error on `useFlightClock` or on the `model`
  memo. Report the message; do not disable the rule.
