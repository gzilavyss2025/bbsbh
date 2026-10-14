# 15 — Pitch flight: `<canvas>` trail renderer

## Run

- Model: `claude-sonnet-5-5`. Effort: **high**. The drawing code is written out below, so
  the child ports and checks it; it does not design it. Fallback rung: Sonnet xhigh.
- Depends on: **14 merged** (and so 13).
- Parallel with: any slice outside `modules/arsenal/`. Not with 11–14.

## Goal

The Pitch flight card draws on a `<canvas>`, as the board does, in place of an SVG that
React re-renders each frame. React re-renders only when words on the card change (Play,
Pause, Next, a new pitch). The canvas adds the board's look: a tapered comet trail, the
ball's shadow and drop line, a ripple where a pitch lands, and, In order, the earlier
pitches of the round as faint numbered trails.

## Done means

- The flight card's stage holds one `<canvas role="img" aria-label="…">` at device pixel
  ratio up to 2. It is sharp on a 3x phone and on a 1x screen.
- Trail: 32 segments from release to the ball. Segment k of n (f = k/n): alpha
  `0.08 + 0.85·f^1.6`, width `pxPerFt · 0.121 · wm · (0.3 + 0.7f)` held to 2–9px, an ink
  under-stroke at 0.4 of the alpha and 1.6px wider. The current trail uses `wm` 1.1.
- Ball: a pitch-colour ring, a paper face with an ink edge, an ink shadow ellipse on the
  ground (alpha 0.2) and a dashed drop line from the ball to it (alpha 0.22, dash 2 3).
- Landing: the pitch's mark (`pitchMark` shape and colour; a ring mark is hollow) with a
  ripple ring `r·(1 + age·3.2)` that fades to nothing over 0.7 s.
- In order: the earlier pitches of the round draw as faint trails (alpha 0.32, 24
  segments, `wm` 0.55) with their landing mark and number (the number shows only when the
  mark's radius is over 8px).
- Gravity path (In order, toggle on): the whole gravity-only path dashed (5 4, width 1.3,
  alpha 0.55) and a dashed ghost ball on it at the current time.
- The range and the clock follow the flight without a React render.
- Off screen: no frame paints. Reduced motion: one paint of the landed frame, no ripple;
  the scrubber, drag and keys repaint.
- Every colour comes from `pitchMark` (on each row) or from a CSS token read at run time.
  No hex in the new code.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/arsenal/flightMotion.js` — add the pure trail, ripple and ball sizes.
2. `src/screens/player/next/modules/arsenal/flightPaint.js` — **new**. `flightPalette(el)` and `paintFlight(ctx, frame)`.
3. `src/screens/player/next/modules/arsenal/FlightCard.jsx` — the canvas, the paint loop, the uncontrolled range and clock.
4. `src/styles/player-next/pitcher/arsenal.css` — `.flight__canvas`.
5. `test/player-next-flight-motion.test.js` — add cases.

`FlightScene.jsx` does **not** change: `ArsenalCard.jsx` still draws the flat side view with
it. `modules/arsenal/` goes to 9 files (7 today, +1 in slice 13, +1 here).

## Canvas

Board `PitchFlight.dc.html`, script. Excerpts:

```js
function trail(ctx, cam, p, s, o = {}) {
  const n = o.n || 32, al = o.alpha == null ? 1 : o.alpha; let prev = at(p, 0);
  ctx.lineCap = 'butt';
  for (let k = 1; k <= n; k++) {
    const cur = at(p, s * k / n), f = k / n, a = (0.08 + 0.85 * Math.pow(f, 1.6)) * al, pr = cam.proj(cur);
    const w = pr ? clamp(pr.k * BALL_R * (o.wm || 1) * (0.3 + 0.7 * f), 2, 9) : 2;
    ctx.beginPath(); seg(ctx, cam, prev, cur);
    ctx.globalAlpha = a * 0.4; ctx.strokeStyle = th.ink; ctx.lineWidth = w + 1.6; ctx.stroke();
    ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = w; ctx.stroke();
    prev = cur;
  }
  ctx.globalAlpha = 1;
}
function ballAt(ctx, cam, q, col, a = 1) {
  const pr = cam.proj(q); if (!pr) return null;
  const r = Math.max(3.4, pr.k * BALL_R * 1.3), sp = cam.proj([q[0], 0, q[2]]);
  if (sp) {
    ctx.save(); ctx.globalAlpha = 0.2 * a; ctx.fillStyle = th.ink; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, r * 1.1, Math.max(1, r * 0.32), 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.22 * a; ctx.strokeStyle = th.ink; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(pr.x, pr.y + r); ctx.lineTo(sp.x, sp.y); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(pr.x, pr.y, r + Math.max(1.4, r * 0.2), 0, TAU); ctx.lineWidth = Math.max(1.8, r * 0.26); ctx.strokeStyle = col; ctx.stroke();
  ctx.beginPath(); ctx.arc(pr.x, pr.y, r, 0, TAU); ctx.fillStyle = th.bg; ctx.fill(); ctx.lineWidth = Math.max(1.2, r * 0.16); ctx.strokeStyle = th.ink; ctx.stroke();
  ctx.restore(); return pr;
}
// dotFor(i, num): the landing mark
const r = Math.max(3.4, pr.k * BALL_R * 1.3), age = S.landT[i] > 0 ? S.now - S.landT[i] : 9;
if (age < 0.7) { ctx.save(); ctx.globalAlpha = 1 - age / 0.7; ctx.strokeStyle = P[i].col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pr.x, pr.y, r * (1 + age * 3.2), 0, TAU); ctx.stroke(); ctx.restore(); }
shapePath(ctx, pr.x, pr.y, r, P[i].shape); ctx.fillStyle = P[i].col; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = th.ink; ctx.stroke();
if (r > 8 && num) { ctx.fillStyle = th.ink; ctx.font = `700 ${Math.min(14, r)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), pr.x, pr.y + 0.5); }
// render order
P.forEach((p, i) => { if (S.done[i] && i !== S.i) trail(ctx, cam, p, p.T, { n: 24, alpha: 0.32, wm: 0.55 }); });
// ghost: whole gravity path, 40 steps, dash [5,4], width 1.3, alpha .55; then a dashed [3,3] ring, width 1.6, at grav(p, s)
if (seq) P.forEach((p, i) => { if (S.done[i] && i !== S.i) dotFor(i, true); });
ids.forEach(i => trail(ctx, cam, P[i], Math.min(s, P[i].T), { wm: 1.1 }));
ids.map(...).sort((a, b) => b.z - a.z).forEach(b => { if (!landed(b.i)) ballAt(ctx, cam, b.q, P[b.i].col); });   // far first
ids.forEach(i => { if (landed(i)) dotFor(i, seq); });
// landing time: in step, fly phase
P.forEach((p, i) => { if (prev < p.T && S.s >= p.T) S.landT[i] = now; });
// restart and scrub clear it: S.landT.fill(-1)
// canvas size
const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
E.W = r.width; E.H = r.height; cv.width = Math.round(E.W * dpr); cv.height = Math.round(E.H * dpr);
ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
// the scrubber and the clock, written each frame
if (E.scrub && document.activeElement !== E.scrub) E.scrub.value = Math.round(S.s / end() * 1000);
if (E.clock) E.clock.textContent = S.s.toFixed(2) + ' s';
```
```css
.pf-cv{display:block;width:100%;aspect-ratio:336/300;height:auto;…}
```

`S.done` (In order) is every pitch before the current one in the round: `P.map((_, j) => j < S.i)`.
Live equivalent: `flyers.slice(0, i)`.

Board items **not** in this slice: the ground fill, the batter's boxes, the 10 ft distance
marks, the zone's thirds grid, the in-scene chips (the 23.8 ft line, the gates, "vs.
gravity", the landing chip), the batter stand-in, Freeze at zone.

## Live today (after slices 13 and 14)

Find the code by its text; line numbers move with 13 and 14.

- `FlightCard.jsx` l.5 today: `import { FlightScene } from './FlightScene.jsx'`.
- `useFlightLoop` (slice 13): `snap` state and `eng` ref of `{ loop, cam }`; the rAF
  `frame` calls `setSnap(next)` on **every** step — this is what goes.
- The stage (slice 14): `<div className="flight__stage flight__turn…" ref={fly.stage} tabIndex={0} role="group" aria-label=… onPointerDown… onKeyDown…>`
  holding
  ```jsx
  <FlightScene
    camera={fly.view}
    w={336}
    h={300}
    items={shown}
    s={s}
    ghost={seq && ghost}
    label="The pitches from the mound to the plate, seen from the chosen camera"
  />
  ```
  The text alternative today is that `<svg role="img" aria-label>` (`FlightScene.jsx:15`).
  Keep the same label on the canvas.
- The bar (live l.117–129): Play button; `<input className="flight__range" type="range" min="0" max="1000" aria-label="Time since release" value={…} onChange={…} />`; `<output className="flight__clock">{s.toFixed(2)} s</output>`.
- `FlightScene.jsx` today draws: grid (`.arsenal__ground`, stroke `--border-grid`, 1),
  mound ring (stroke `--text-caption`), rubber (fill `--text-heading`), plate (fill
  `--text-caption`), zone (fill `--surface-inset`, stroke `--text-heading` 1.6), the
  gravity path dashed (ink 1.3, 5 4, 0.55), a halo and a trail, the ball, the landing
  glyph. The SVG rubber and plate are built from `M…L` line pieces, so their fill paints
  nothing today; the canvas fills them as closed polygons, as the board does.
- `flightView.js` exports `PLATE_Z`, `ZONE`, `lineD`, `trailD`, `sceneD`, `project`, `makeCamera`.
- `PitchGlyph.jsx` exports `glyphD(shape, r)` (an SVG path string at the origin). `Path2D`
  takes it as is, arcs included.
- Pitch colour: `row.mark.color`, from `pitchMark(code)` (`src/lib/pitch/pitchTypes.js:48`).
  No guard checks hex in JS (`check-raw-values.mjs` reads `src/styles/` only), but the
  new code still names no colour: paper and ink come from the tokens.
- There is no run-time theme switch in `src/tokens/colors.css` today, so the palette is
  read once per canvas (inferred from a grep for `prefers-color-scheme` and `data-theme`: none).

## Build

### 1. `flightMotion.js` — append

```js
// The trail, the ball and the ripple, sized as the board sizes them. `px` is pixels per foot at a point
// (project(...).k). Pure, so a test pins the board's numbers.
export const TRAIL_N = 32
export const RIPPLE_S = 0.7
export const BALL_FT = 0.121 // the ball's radius, feet

// A ball's radius on screen: never under 3.4px.
export const ballR = (px) => Math.max(3.4, px * BALL_FT * 1.3)

// Segment k of n of a trail: it fades in from the release and grows with distance toward the lens.
// `alpha` dims a whole trail (an earlier pitch); `wm` thins or thickens it. No point on screen: 2px.
export function trailStyle(k, n, px, { alpha = 1, wm = 1 } = {}) {
  const f = k / n
  const width = px == null ? 2 : Math.min(9, Math.max(2, px * BALL_FT * wm * (0.3 + 0.7 * f)))
  return { alpha: (0.08 + 0.85 * f ** 1.6) * alpha, width }
}

// The landing ripple `age` seconds after a pitch lands, for a mark of radius r; null when there is none.
export function rippleAt(age, r) {
  if (!(age >= 0) || age >= RIPPLE_S) return null
  return { r: r * (1 + age * 3.2), alpha: 1 - age / RIPPLE_S }
}
```

### 2. `flightPaint.js` (new)

```js
// The Pitch flight on a <canvas> (#2073, board PitchFlight.dc.html): the park, each path as a tapered
// comet trail, the ball with its shadow, and each landing mark with a ripple. The pitch colour and shape
// are the row's pitchMark (docs/pitch-types.md); paper and ink are the page's tokens (flightPalette).
// The sizes and fades are flightMotion.js's, which a test pins. Not pure: it draws.
import { glyphD } from './PitchGlyph.jsx'
import { TRAIL_N, ballR, rippleAt, trailStyle } from './flightMotion.js'
import { PLATE_Z, ZONE, lineD, makeCamera, project, sceneD, trailD } from './flightView.js'

const TAU = 2 * Math.PI
const { x: ZX, y0: ZY0, y1: ZY1 } = ZONE
const RUBBER = [[-1, 0, 60.25], [1, 0, 60.25], [1, 0, 60.75], [-1, 0, 60.75]]
const PLATE = [[-ZX, 0, PLATE_Z], [ZX, 0, PLATE_Z], [ZX, 0, ZX], [0, 0, 0], [-ZX, 0, ZX]]
const ZONE_FACE = [[-ZX, ZY0, PLATE_Z], [ZX, ZY0, PLATE_Z], [ZX, ZY1, PLATE_Z], [-ZX, ZY1, PLATE_Z]]

// The colours the canvas paints with, read from the tokens on `el` (a canvas cannot read var()).
export function flightPalette(el) {
  const cs = getComputedStyle(el)
  const v = (name) => cs.getPropertyValue(name).trim()
  return {
    paper: v('--surface-card'),
    ink: v('--text-heading'),
    caption: v('--text-caption'),
    grid: v('--border-grid'),
    inset: v('--surface-inset'),
    mono: v('--font-mono'),
  }
}

// A closed shape through `pts`, or false when a corner is behind the lens.
// ponytail: the board clips the shape at the lens. Every preset and every turned view keeps the plate,
// zone and rubber in front, so a corner behind the lens drops the shape instead. Clip only if one vanishes.
function polyPath(ctx, cam, pts) {
  const ps = pts.map((q) => project(cam, q))
  if (ps.some((p) => !p)) return false
  ctx.beginPath()
  ps.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  return true
}

function strokeD(ctx, d, color, width) {
  if (!d) return
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.stroke(new Path2D(d))
}

function park(ctx, cam, pal) {
  const d = sceneD(cam)
  strokeD(ctx, d.grid, pal.grid, 1)
  strokeD(ctx, d.mound, pal.caption, 1)
  if (polyPath(ctx, cam, RUBBER)) {
    ctx.fillStyle = pal.ink
    ctx.fill()
  }
  if (polyPath(ctx, cam, PLATE)) {
    ctx.fillStyle = pal.caption
    ctx.fill()
  }
  if (polyPath(ctx, cam, ZONE_FACE)) {
    ctx.fillStyle = pal.inset
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = pal.ink
    ctx.stroke()
  }
}

// A path from release to `s` seconds as a comet: n pieces, each with an ink under-stroke.
function trail(ctx, cam, path, s, color, pal, o = {}) {
  const n = o.n ?? TRAIL_N
  let prev = path.at(0)
  ctx.lineCap = 'butt'
  for (let k = 1; k <= n; k++) {
    const cur = path.at((s * k) / n)
    const d = lineD(cam, prev, cur)
    prev = cur
    if (!d) continue
    const piece = new Path2D(d)
    const st = trailStyle(k, n, project(cam, cur)?.k, o)
    ctx.globalAlpha = st.alpha * 0.4
    ctx.strokeStyle = pal.ink
    ctx.lineWidth = st.width + 1.6
    ctx.stroke(piece)
    ctx.globalAlpha = st.alpha
    ctx.strokeStyle = color
    ctx.lineWidth = st.width
    ctx.stroke(piece)
  }
  ctx.globalAlpha = 1
}

// The ball in flight: its shadow on the ground and a dashed drop line to it, a ring in the pitch colour,
// a paper face.
function ball(ctx, cam, q, color, pal) {
  const p = project(cam, q)
  if (!p) return
  const r = ballR(p.k)
  const g = project(cam, [q[0], 0, q[2]])
  if (g) {
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.fillStyle = pal.ink
    ctx.beginPath()
    ctx.ellipse(g.x, g.y, r * 1.1, Math.max(1, r * 0.32), 0, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.22
    ctx.strokeStyle = pal.ink
    ctx.lineWidth = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y + r)
    ctx.lineTo(g.x, g.y)
    ctx.stroke()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(p.x, p.y, r + Math.max(1.4, r * 0.2), 0, TAU)
  ctx.lineWidth = Math.max(1.8, r * 0.26)
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(p.x, p.y, r, 0, TAU)
  ctx.fillStyle = pal.paper
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, r * 0.16)
  ctx.strokeStyle = pal.ink
  ctx.stroke()
}

// The gravity-only path, whole and dashed, and a dashed ghost ball on it at `s`.
function ghost(ctx, cam, path, s, pal) {
  ctx.save()
  ctx.strokeStyle = pal.ink
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1.3
  ctx.setLineDash([5, 4])
  const d = trailD(cam, path.grav, path.T, 40)
  if (d) ctx.stroke(new Path2D(d))
  const g = project(cam, path.grav(s))
  if (g) {
    ctx.globalAlpha = 1
    ctx.lineWidth = 1.6
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.arc(g.x, g.y, ballR(g.k), 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

// Where a pitch landed: its mark, a ripple `age` seconds after it landed (null: none), and its number in
// the round when the mark is big enough to hold it.
function mark(ctx, cam, it, pal, num, age) {
  if (!it.landing) return
  const p = project(cam, [it.landing.x, it.landing.h, PLATE_Z])
  if (!p) return
  const r = ballR(p.k)
  const color = it.mark.color
  const rip = age == null ? null : rippleAt(age, r)
  if (rip) {
    ctx.save()
    ctx.globalAlpha = rip.alpha
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(p.x, p.y, rip.r, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
  ctx.save()
  ctx.translate(p.x, p.y)
  const g = new Path2D(glyphD(it.mark.shape, r))
  if (it.mark.ring) {
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.stroke(g)
  } else {
    ctx.fillStyle = color
    ctx.fill(g)
    ctx.lineWidth = 1.6
    ctx.strokeStyle = pal.ink
    ctx.stroke(g)
  }
  ctx.restore()
  if (num && r > 8) {
    ctx.fillStyle = pal.ink
    ctx.font = `700 ${Math.min(14, r)}px ${pal.mono}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), p.x, p.y + 0.5)
  }
}

// One frame. `f`: { W, H, pal, view, s, now, landT, items, done, ghost, num }.
// items: the rows in flight; done: earlier rows of the round (In order); num: the current pitch's number
// (In order) or null; landT: Map of code -> landing time (s, same clock as `now`).
export function paintFlight(ctx, f) {
  const { W, H, pal, s } = f
  const cam = makeCamera(f.view, W, H)
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = pal.paper
  ctx.fillRect(0, 0, W, H)
  park(ctx, cam, pal)
  f.done.forEach((it) => trail(ctx, cam, it.path, it.path.T, it.mark.color, pal, { n: 24, alpha: 0.32, wm: 0.55 }))
  if (f.ghost && f.items[0]) ghost(ctx, cam, f.items[0].path, s, pal)
  f.done.forEach((it, n) => mark(ctx, cam, it, pal, n + 1, null))
  f.items.forEach((it) => trail(ctx, cam, it.path, Math.min(s, it.path.T), it.mark.color, pal, { wm: 1.1 }))
  const landed = (it) => s >= it.path.T - 1e-6
  // Far balls first, so a near one covers them.
  f.items
    .filter((it) => !landed(it))
    .map((it) => ({ it, q: it.path.at(s), p: project(cam, it.path.at(s)) }))
    .filter((b) => b.p)
    .sort((a, b) => a.p.k - b.p.k)
    .forEach((b) => ball(ctx, cam, b.q, b.it.mark.color, pal))
  f.items.forEach((it) => {
    if (!landed(it)) return
    const t = f.landT.get(it.code)
    mark(ctx, cam, it, pal, f.num, t == null ? null : f.now - t)
  })
}
```

Order note: the board draws the ghost before the earlier marks; the code above keeps that.

### 3. `FlightCard.jsx`

Imports:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flightPalette, paintFlight } from './flightPaint.js'
```

Delete `import { FlightScene } from './FlightScene.jsx'`.

Replace `useFlightLoop` with this version (it keeps 13's and 14's API, adds `canvas`,
`scrub`, `clock`, takes `scene`, and drops `s`):

```js
// The flight loop (#2073, board PitchFlight.dc.html): a wait at release, the flight, a hold on the landed
// frame, then again (flightMotion.js), painted on a canvas (flightPaint.js). Each frame paints the canvas
// and writes the scrubber and the clock; React renders only when the Play button's word changes.
// It runs only while the stage is on screen or within 120px of it. A reader who asked for less motion
// gets the landed frame, a camera that snaps, and the scrubber. `onCycle` runs when a hold ends.
// `scene`: { items, done, ghost, num } for paintFlight.
function useFlightLoop({ end, speed, reduced, onCycle, scene }) {
  const stage = useRef(null)
  const canvas = useRef(null)
  const scrub = useRef(null)
  const clock = useRef(null)
  const [snap, setSnap] = useState(() => ({
    loop: reduced ? landedLoop() : startLoop(true),
    cam: stillCam(orbitOf('catcher')),
  }))
  const eng = useRef(snap)
  const cfg = useRef({ end, speed, onCycle, scene })
  const landT = useRef(new Map())
  const box = useRef({ W: 0, H: 0, pal: null })
  useEffect(() => {
    cfg.current = { end, speed, onCycle, scene }
  })
  const put = (next) => {
    eng.current = next
    setSnap(next)
  }

  // Paint the frame as the engine holds it. Reads refs only, so one function serves every effect.
  const paint = useCallback((now) => {
    const cv = canvas.current
    const b = box.current
    if (!cv || !b.W) return
    b.pal ??= flightPalette(cv)
    const { end: e, scene: sc } = cfg.current
    const { loop, cam } = eng.current
    const s = Math.min(loop.s, e)
    const ctx = cv.getContext('2d')
    ctx.setTransform(cv.width / b.W, 0, 0, cv.height / b.H, 0, 0)
    paintFlight(ctx, { W: b.W, H: b.H, pal: b.pal, view: cam.view, s, now, landT: landT.current, ...sc })
    if (scrub.current && document.activeElement !== scrub.current) scrub.current.value = String(Math.round((s / e) * 1000))
    if (clock.current) clock.current.textContent = `${s.toFixed(2)} s`
  }, [])

  // After each render (a pick, a mode, a pause, a drag): paint once.
  useEffect(() => {
    paint(performance.now() / 1000)
  })

  // The canvas backs its CSS size at up to 2 device pixels a pixel.
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return undefined
    const fit = () => {
      const r = cv.getBoundingClientRect()
      if (r.width < 2) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      box.current.W = r.width
      box.current.H = r.height
      cv.width = Math.round(r.width * dpr)
      cv.height = Math.round(r.height * dpr)
      paint(performance.now() / 1000)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [paint])

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
        const { end: e, speed: v, onCycle: cycle, scene: sc } = cfg.current
        const next = { loop: stepLoop(cur.loop, dt, e, v), cam: flyStep(cur.cam, dt) }
        eng.current = next
        const L = next.loop
        if (L.phase === 'pre') landT.current.clear()
        for (const it of sc.items) if (L.prevS < it.path.T && L.s >= it.path.T) landT.current.set(it.code, now / 1000)
        // React renders only when the Play button's word changes.
        if (L.phase !== cur.loop.phase || L.playing !== cur.loop.playing) setSnap(next)
        if (L.cycled) cycle()
        paint(now / 1000)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
    }
  }, [reduced, paint])

  const { loop } = snap
  return {
    stage,
    canvas,
    scrub,
    clock,
    phase: loop.phase,
    playing: loop.playing,
    restart: () => put({ ...eng.current, loop: reduced ? landedLoop() : startLoop(true) }),
    setPlaying: (on) => put({ ...eng.current, loop: { ...eng.current.loop, playing: on } }),
    seek: (s) => {
      landT.current.clear()
      put({ ...eng.current, loop: { ...eng.current.loop, phase: 'fly', timer: 0, s, prevS: s, playing: false } })
    },
    flyTo: (key) => {
      const to = orbitOf(key)
      put({ ...eng.current, cam: reduced ? stillCam(to) : swingCam(eng.current.cam, to) })
    },
    turn: (yaw, pitch) => put({ ...eng.current, cam: turnView(eng.current.cam, yaw, pitch) }),
  }
}
```

A drag still renders `FlightCard` once a move (through `put`); that is the same cost as
slice 14 and is fine. A pause, a seek and a pick render once.

In `FlightCard`, build the scene and pass it:

```js
  const fly = useFlightLoop({
    end,
    speed,
    reduced,
    onCycle: …as in slice 13…,
    // In order, the earlier pitches of the round stay on as faint numbered trails.
    scene: { items: shown, done: seq ? flyers.slice(0, i) : [], ghost: seq && ghost, num: seq ? i + 1 : null },
  })
  const { playing } = fly
```

Replace the `FlightScene` inside the stage with:

```jsx
        <canvas
          ref={fly.canvas}
          className="flight__canvas"
          role="img"
          aria-label="The pitches from the mound to the plate, seen from the chosen camera"
        />
```

The stage div keeps its slice-14 handlers, `tabIndex`, `role="group"` and label.

The bar: the range becomes uncontrolled and the clock is written by `paint`:

```jsx
        <input
          ref={fly.scrub}
          className="flight__range"
          type="range"
          min="0"
          max="1000"
          defaultValue="0"
          aria-label="Time since release"
          onChange={(e) => fly.seek((e.target.value / 1000) * end)}
        />
        <output ref={fly.clock} className="flight__clock" />
```

Remove every other use of `s` and `fly.view` in `FlightCard`.

### 4. `arsenal.css` — in the "Pitch flight card" section

```css
/* The flight draws on a canvas at the board's 336 by 300 shape. */
.flight__canvas {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 336 / 300;
}
```

No guard counts these declarations. The `.arsenal__trail`, `.arsenal__halo`, `.arsenal__ball`
and `.arsenal__gravity` rules stay: `FlightScene` (the Arsenal card) still uses them.

## Test first

Add to `test/player-next-flight-motion.test.js` (merge names into the existing imports).
Run it first; the new cases fail.

```js
import { BALL_FT, RIPPLE_S, TRAIL_N, ballR, rippleAt, trailStyle } from '../src/screens/player/next/modules/arsenal/flightMotion.js'

test('the board trail: 32 pieces, fading in from release', () => {
  assert.equal(TRAIL_N, 32)
  assert.equal(BALL_FT, 0.121)
  close(trailStyle(32, 32, 50).alpha, 0.93)
  close(trailStyle(1, 32, 50).alpha, 0.08 + 0.85 * (1 / 32) ** 1.6)
  let was = 0
  for (let k = 1; k <= 32; k++) {
    const a = trailStyle(k, 32, 50).alpha
    assert.ok(a > was)
    was = a
  }
  close(trailStyle(32, 32, 50, { alpha: 0.32 }).alpha, 0.93 * 0.32)
})

test('the board trail: width grows toward the ball, held to 2..9px', () => {
  close(trailStyle(16, 32, 40, { wm: 1.1 }).width, 40 * 0.121 * 1.1 * (0.3 + 0.35))
  assert.equal(trailStyle(1, 32, 10).width, 2)
  assert.equal(trailStyle(32, 32, 1000).width, 9)
  assert.equal(trailStyle(32, 32, null).width, 2)
})

test('ballR: never under 3.4px', () => {
  assert.equal(ballR(0), 3.4)
  close(ballR(100), 100 * 0.121 * 1.3)
})

test('rippleAt: grows 3.2 radii a second and fades out over 0.7 s', () => {
  assert.equal(RIPPLE_S, 0.7)
  assert.deepEqual(rippleAt(0, 5), { r: 5, alpha: 1 })
  const mid = rippleAt(0.35, 5)
  close(mid.r, 5 * (1 + 0.35 * 3.2))
  close(mid.alpha, 0.5)
  assert.equal(rippleAt(0.7, 5), null)
  assert.equal(rippleAt(-0.1, 5), null)
  assert.equal(rippleAt(NaN, 5), null)
})

test('the flight card draws on a labelled canvas, at the board shape', () => {
  const jsx = readFileSync(new URL('../src/screens/player/next/modules/arsenal/FlightCard.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(jsx, /FlightScene/)
  assert.match(jsx, /<canvas[\s\S]*?role="img"[\s\S]*?aria-label="The pitches from the mound to the plate, seen from the chosen camera"/)
  const css = stripComments(readFileSync(new URL('../src/styles/player-next/pitcher/arsenal.css', import.meta.url), 'utf8'))
  const body = ruleBody(css, '.flight__canvas') ?? ''
  assert.match(body, /display:\s*block;/)
  assert.match(body, /width:\s*100%;/)
  assert.match(body, /aspect-ratio:\s*336 \/ 300;/)
})
```

`paintFlight` itself has no node test (it needs a 2D context). The browser check below covers it.

## Verify

- `node --test test/player-next-flight-motion.test.js` and `npm run lint` (watch
  `check-dead-exports`: every new export has a user). Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `/player/robert-gasser-688107?nointro` at 390px and at 1180px. Compare with the board:
  the comet trail thin and faint at release, thick and solid near the ball; the ball's
  shadow and dashed drop line; the ripple on landing; In order, the earlier pitches faint
  with numbers on their marks at the Catcher view; Gravity path dashed with a ghost ball.
  Try every camera, a drag, and Together.
- React DevTools "highlight updates": the card flashes only at Play/Pause/Next changes,
  not each frame.
- Zoom the browser to 300%: the canvas stays sharp up to 2x (it is meant to soften past 2x).
- Reduced motion (Playwright `reducedMotion: 'reduce'`): the landed frame at once, no
  ripple; the scrubber repaints.
- Send Gary a frame strip of one flight (release, mid-flight, landing ripple, hold) and a
  still of In order after three pitches, with the route.

## Out of scope

- The board items listed at the end of "Canvas" (ground fill, batter's boxes, distance
  marks, zone thirds, in-scene chips, gates, Freeze at zone).
- The Arsenal card's flat side view and `FlightScene.jsx`.
- An `aria-live` line that speaks each pitch (the board has one; the live card does not).
- A theme listener for the palette (no run-time theme exists).

## Stop if

- Slice 14 is not merged, or `useFlightLoop` differs from slice 13 and 14's shape.
- `glyphD` is no longer exported from `PitchGlyph.jsx`, or `lineD`, `trailD`, `sceneD` from `flightView.js`.
- `getComputedStyle(canvas).getPropertyValue('--text-heading')` comes back empty in the
  browser (the tokens are not on that element's cascade).
- The canvas shows nothing on the first paint and the cause is not the size read (`box.W` 0).
- `react-hooks` lint needs more than a one-line disable to pass.
- `modules/arsenal/` would go past 12 files.
