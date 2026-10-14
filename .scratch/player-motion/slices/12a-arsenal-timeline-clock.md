# Slice 12a: Arsenal timeline, part 1: one clock and the side-view beats

Slice 12 is split in three. 12a: the pure timeline module, the clock, and the beats
inside the side view (ring, ball, trail, ripple, scale ticks, inset marks). 12b: the
mix bar roll, the segment flash, the menu rows and the in-view start. 12c: the speed
step, the scrubber and the `/animation-lab` entry.

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 11 merged (and so 01 and 05).
- Parallel with: 06, 08, 10, 16, 17, 20. Not with 12b, 12c, 13, 14, 15 (same
  `modules/arsenal/` files; 13 to 15 also edit `FlightScene.jsx`).

## Goal

One requestAnimationFrame clock drives the Arsenal card's side view. A pure module,
`timeline.js`, turns a time `t` (ms) into every beat of the canvas timeline. The
side view draws from it: the release ring, the ball (scale-in and spin), the trail
behind the ball, the landing ripple, the scale ticks and the catcher-view marks.

## Done means

- `src/screens/player/next/modules/arsenal/timeline.js` exports `LEAD`, `TAIL`,
  `eo`, `totalMs`, `beatsAt` and `countText`, all pure and unit-tested.
- `ArsenalCard` holds one clock (`useArsenalClock`). Replay, a pick and an un-pick
  call `clock.play()`. There is no `key={run}` remount and no `run` state.
- The CSS `arsenal-draw` animation and the slice-11 `arsenal-ghost` animation are
  gone. The JS clock sets every opacity, so no CSS animation can override it.
- Reduced motion: the card shows the last frame at once (`t` is `total`).
- `npm run lint`, `npm test`, `npm run build` pass. The new tests fail before the change.

## Files

1. `src/screens/player/next/modules/arsenal/timeline.js` (new): the pure timeline.
2. `test/arsenal-timeline.test.js` (new): the timeline cases, and the source and
   sheet cases.
3. `src/screens/player/next/modules/arsenal/ArsenalCard.jsx`: the clock hook, the
   beats, the inset marks.
4. `src/screens/player/next/modules/arsenal/FlightScene.jsx`: optional `beats`,
   `ring` and `ticks` props.
5. `src/styles/player-next/pitcher/arsenal.css`: remove the two CSS animations; add
   the ring, ripple, tick, tick label and seam rules.

The `arsenal/` folder goes from 7 to 8 files (`check-dir-size.mjs` caps it at 12;
ADR-0038 asks to subdivide before the 10th). Slices 13 to 15: watch this count.

## Canvas

ArsenalReveal board, script. The clock (ms, 50ms frame cap):

```js
this.state = { t: 0, S: 3, solo: null, fgen: 0 };
this.tick = (now) => {
  const total = this.total();
  this._t = Math.min(total, this._t + Math.min(50, now - this._last)); this._last = now;
  this.setState({ t: this._t });
  if (this._t < total) this._raf = requestAnimationFrame(this.tick);
};
total(S) { ... return Math.round(760 + Math.max.apply(null, this.D.P.map((p) => p.ft * 1000 * s)) + 760); }
play() {
  cancelAnimationFrame(this._raf);
  const reduce = ... matchMedia('(prefers-reduced-motion:reduce)').matches;
  if (reduce) { this._t = this.total(); this.setState({ t: this._t }); return; }
  this._t = 0; this._last = performance.now(); this.setState({ t: 0 });
  this._raf = requestAnimationFrame(this.tick);
}
componentDidMount() { this.play(); }
```

The helpers and the beats (`renderVals`):

```js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eo = (x) => 1 - Math.pow(1 - clamp(x), 4);
const T0 = 760, rel = t - T0;
const r0 = eo((t - 100) / 900);
const ticks = [0..5].map((k) => ({ x: PX - 46.9 * k, d: 1 - eo((t - (120 + k * 40)) / 300), lo: eo((t - (260 + k * 40)) / 400),
                                    lab: k ? String(k * 10) + (k === 5 ? ' ft' : '') : '0' }));
const ringE = eo(rel / 380);
const ring = { r: 3 + 13 * ringE, o: rel > 0 && rel < 380 ? 0.8 * (1 - ringE) : 0 };
D.P.forEach((p, i) => {
  const Dm = p.ft * 1000 * S, land = T0 + Dm, ghost = solo !== null && solo !== i;
  const u = ghost ? 1 : clamp(rel / Dm);
  const landed = !ghost && t >= land, since = t - land;
  const born = eo((t - (T0 - 260)) / 260), gone = eo((t - land) / 140);
  trail:  off: 1 - u,  op: ghost ? 0.22 * eo((t - 300) / 400) : (u <= 0 ? 0 : 1 - 0.55 * eo((t - land) / 500)),
  ripple: rr: 4 + 10 * eo(since / 380), ro: landed && since < 380 ? 0.6 * (1 - eo(since / 380)) : 0,
  ball:   bt: 'translate(bx by) scale(' + (0.85 + 0.15 * born) + ')',  bo: ghost ? 0 : born * (1 - gone),
          spin: 'rotate(' + (-u * 360 * p.rpm / 900) + ')'
  mark:   o: ghost ? 0.3 * eo((t - 600) / 300) : (landed ? Math.min(1, since / 70) : 0),
          s: 'scale(' + (landed ? 1 + 0.7 * (1 - eo(since / 260)) : 1) + ')'
  seg:    f: landed ? (1 - eo(since / 420)) * 0.5 : 0
  row:    e = eo((t - (140 + i * 80)) / 520);  e2 = eo((t - (240 + i * 80)) / 700);
          sw = landed ? eo(since / 260) : 0,  swo = landed ? 1 - eo((since - 260) / 700) : 0;
          opacity: e * (ghost ? 0.45 : 1); transform: rotateX(-(1 - e) * 80 deg) translateY((1 - e) * 10 px); filter: blur((1 - e) * 3 px)
          gt: 'scale(' + (landed ? 1 + 0.45 * (1 - eo(since / 320)) : 1) + ')'
          mp: (p.mph * e2).toFixed(1) + ' mph', pc: Math.round(p.use * e2) + '%'
});
mixClip: 'inset(-6px ' + (1 - r0) * 100 + '% -6px 0)', rollL: r0 * 100 + '%', rollO: r0 > 0 && r0 < 1 ? 1 : 0,
```

The ball (canvas SVG): a circle `r=4.6` and a seam path
`M-3.2 -.9Q0 -3.5 3.2 -.9M-3.2 .9Q0 3.5 3.2 .9` at `stroke-width=".9"`, inside
`<g transform={bt}><g transform={spin}>`. The ripple: `<circle cx=PLATE cy=landing r={rr}
stroke={pitch} stroke-width="1.5" fill="none" opacity={ro}>`. The ring: `<circle cx=release
cy=release r={ring.r} stroke=ink stroke-width="1.5" fill="none" opacity={ring.o}>`. A tick:
`<path pathLength="1" d="M{x} 160v5" stroke=ink stroke-width="1.4" stroke-dashoffset={d}>`,
its label `<text y="174" text-anchor="middle" font-size="6.5px" fill=graphite opacity={lo}>`.
The canvas tick step 46.9px is 10 ft on its 336px view; the live flat camera's
`cam.sx` is 336 × 0.01396 = 4.69 px a foot, so the step is `cam.sx * 10`.

`easeOutQuart` from `src/lib/motion/curves.js` (slice 01) is the canvas `eo`
without the clamp. `timeline.js` adds the clamp.

## Live today

`src/screens/player/next/modules/arsenal/ArsenalCard.jsx` after slice 11 (read it;
the line numbers move). The parts this slice changes:

- `const [run, setRun] = useState(0) // a new key replays the paths' draw-in` and
  `const pick = (code) => { setSolo(code); setRun((n) => n + 1) }`.
- `<div className="arsenal__side" key={run}>` with `<FlightScene camera="flat"
  w={336} h={180} items={flyers} s={Infinity} solo={one?.path ? one.code : null} label=… />`
  (today `ArsenalCard.jsx:33-42`).
- The inset marks, today `ArsenalCard.jsx:46-54`:

```jsx
            {flyers.filter((r) => r.landing).map((r) => (
              <g
                key={r.code}
                opacity={one && one.code !== r.code ? 0.3 : 1}
                transform={`translate(${(40 + r.landing.x * 28).toFixed(1)} ${(41 - (r.landing.h - MID) * 28).toFixed(1)})`}
              >
                <GlyphPath mark={r.mark} r={3.4} />
              </g>
            ))}
```

- `<Button size="control" onClick={() => setRun(run + 1)}>Replay</Button>` (today `:59`).

`src/screens/player/next/modules/arsenal/FlightScene.jsx` (52 lines; after slice 11
line 37 is the `arsenal__path--ghost` class). Today `:19-52`:

```jsx
export function FlightScene({ camera, w, h, items, s, solo = null, ghost = false, label }) {
  const cam = useMemo(() => makeCamera(camera, w, h), [camera, w, h])
  const park = useMemo(() => sceneD(cam), [cam])
  return (
    <svg className="arsenal__scene" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path className="arsenal__ground" d={park.grid} />
      ... mound, rubber, plate, zone ...
      {items.map((it) => {
        const faint = solo != null && solo !== it.code
        const t = faint ? it.path.T : Math.min(s, it.path.T)
        const landed = !faint && s >= it.path.T
        const ball = !faint && !landed ? project(cam, it.path.at(t)) : null
        const dot = landed && it.landing ? project(cam, [it.landing.x, it.landing.h, PLATE_Z]) : null
        const d = trailD(cam, it.path.at, t)
        return (
          <g key={it.code} opacity={faint ? 0.25 : 1}>       // slice 11: className=…ghost
            {ghost && !faint && <path className="arsenal__gravity" d={trailD(cam, it.path.grav, t)} />}
            <path className="arsenal__halo" d={d} pathLength="1" />
            <path className="arsenal__trail" d={d} pathLength="1" style={{ '--pitch': it.mark.color }} />
            {ball && (
              <circle className="arsenal__ball" cx={ball.x} cy={ball.y}
                r={Math.max(3.4, ball.k * BALL * 1.3)} style={{ '--pitch': it.mark.color }} />
            )}
            {dot && ( <g transform={`translate(…) scale(…)`}><GlyphPath mark={it.mark} r={5} /></g> )}
          </g>
        )
      })}
    </svg>
  )
}
```

`trailD(cam, at, s)` already draws the path only up to `s` seconds, so "the trail
revealed behind the ball" needs no dash offset: pass each pitch's own `s = u * T`.
`FlightCard.jsx` uses `FlightScene` with `s`, `ghost` and no `solo`; it must render
exactly as before (no `beats` prop means the old code path).

`src/styles/player-next/pitcher/arsenal.css` after slice 11: the draw block
(today `:142-158`, `.arsenal__side .arsenal__halo, .arsenal__side .arsenal__trail {
stroke-dasharray: 1; animation: arsenal-draw … }`, `@keyframes arsenal-draw`, its
reduced-motion block) and the slice-11 ghost block (`.arsenal__path--ghost`,
the `animation: none` rule for its halo and trail, `@keyframes arsenal-ghost`, its
reduced-motion block).

`src/hooks/preferences/motionIsReduced.js`: `motionIsReduced()`, a plain function
(the in-app setting or the OS query).

`FlightCard.jsx:17-41` has `useFlightClock(end, speed, reduced)`. Do not reuse it: it
is private to `FlightCard.jsx` (slices 13 to 15 own that file), it counts flight
seconds, not timeline ms, and it has no "end" state that survives a length change.
`useArsenalClock` below copies its shape.

## Build

### 1. `timeline.js` (new)

```js
import { easeOutQuart } from '../../../../../lib/motion/curves.js'

// The Arsenal card's timeline (#2073, board ArsenalReveal.dc.html): every beat of the side view, the mix bar
// and the menu, as a pure function of t, the ms since the card started to play. Pure; no clock, no DOM.
// The board's numbers, kept as it has them: a 760ms build-up, then every pitch leaves the one release point
// at the same moment and flies at 1/S of real speed, then a 760ms hold after the last landing.

export const LEAD = 760 // ms before the release (the board's T0)
export const TAIL = 760 // ms held after the last landing

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
// The board's `eo`: an ease-out quart that holds at 0 before its start and at 1 after its end.
export const eo = (x) => easeOutQuart(clamp(x))

// The timeline's length in ms. `pitches` are { code, ft, rpm }; ft (s) is null for a pitch with no path.
export function totalMs(pitches, S = 3) {
  const longest = Math.max(0, ...pitches.filter((p) => p.ft != null).map((p) => p.ft * 1000 * S))
  return Math.round(LEAD + longest + TAIL)
}

// A figure counting up to v as e goes 0 -> 1, with v's own decimals, or d.
export function countText(v, e, d = (String(v).split('.')[1] ?? '').length) {
  return (v * clamp(e)).toFixed(d)
}

// Every beat at t. `solo` is the picked code (only when that pitch has a path): the others are ghosts,
// drawn whole and faint, with no ball. Each pitch's index in `pitches` sets its menu row's stagger.
export function beatsAt(t, pitches, { S = 3, solo = null } = {}) {
  const rel = t - LEAD
  const roll = eo((t - 100) / 900)
  const ringE = eo(rel / 380)
  return {
    roll, // the mix bar's revealed share, 0 -> 1
    rollEdge: roll > 0 && roll < 1, // the moving shadow edge shows while the bar rolls
    ring: { r: 3 + 13 * ringE, o: rel > 0 && rel < 380 ? 0.8 * (1 - ringE) : 0 },
    ticks: [0, 1, 2, 3, 4, 5].map((k) => ({ draw: eo((t - (120 + k * 40)) / 300), label: eo((t - (260 + k * 40)) / 400) })),
    pitches: pitches.map((p, i) => {
      const ghost = solo != null && solo !== p.code
      const flies = p.ft != null
      const land = flies ? LEAD + p.ft * 1000 * S : Infinity
      const u = ghost ? 1 : flies ? clamp(rel / (p.ft * 1000 * S)) : 0
      const landed = !ghost && t >= land
      const since = t - land
      const born = eo((t - (LEAD - 260)) / 260)
      const gone = eo(since / 140)
      return {
        code: p.code,
        ghost,
        u, // the share of the flight drawn: the ball sits at u * T seconds
        landed,
        trail: ghost ? 0.22 * eo((t - 300) / 400) : u <= 0 ? 0 : 1 - 0.55 * eo(since / 500),
        ball: { o: ghost ? 0 : born * (1 - gone), k: 0.85 + 0.15 * born, spin: p.rpm ? (-u * 360 * p.rpm) / 900 : 0 },
        ripple: { r: 4 + 10 * eo(since / 380), o: landed && since < 380 ? 0.6 * (1 - eo(since / 380)) : 0 },
        mark: { o: ghost ? 0.3 * eo((t - 600) / 300) : landed ? Math.min(1, since / 70) : 0, k: landed ? 1 + 0.7 * (1 - eo(since / 260)) : 1 },
        flash: landed ? 0.5 * (1 - eo(since / 420)) : 0,
        row: { e: eo((t - (140 + i * 80)) / 520), count: eo((t - (240 + i * 80)) / 700), dim: ghost ? 0.45 : 1 },
        sweep: { x: landed ? eo(since / 260) : 0, o: landed ? 1 - eo((since - 260) / 700) : 0 },
        glyph: landed ? 1 + 0.45 * (1 - eo(since / 320)) : 1,
      }
    }),
  }
}
```

12a uses `ring`, `ticks` and, per pitch, `ghost`, `u`, `landed`, `trail`, `ball`,
`ripple`, `mark`. 12b uses `roll`, `rollEdge`, `flash`, `row`, `sweep`, `glyph` and
`countText`. All are tested here, so 12b needs no new pure code.

### 2. `ArsenalCard.jsx`

Imports: add `useEffect, useMemo, useRef` to the React import, and

```jsx
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { beatsAt, totalMs } from './timeline.js'
```

Above the component:

```jsx
const SPEED = 3 // the side view plays at one-third of real speed, as the board does

// The side view's clock: ms into the timeline, played by the animation frame, 50ms at most a frame (the
// board's cap). `null` means the end, so a new length never strands the last frame. `start` is 'play'
// (start at once), 'wait' (hold the first frame) or 'end'. A reader who asked for less motion stays on the end.
function useArsenalClock(total, start) {
  const [t, setT] = useState(() => (start === 'end' || motionIsReduced() ? null : 0))
  const [playing, setPlaying] = useState(() => start === 'play' && !motionIsReduced())
  const at = useRef(0)
  useEffect(() => {
    if (!playing) return undefined
    let raf
    let last = performance.now()
    const tick = (now) => {
      at.current = Math.min(total, at.current + Math.min(50, now - last))
      last = now
      setT(at.current)
      if (at.current >= total) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, total])
  const seek = (v, play) => {
    at.current = v ?? total
    setT(v)
    setPlaying(play)
  }
  const play = () => (motionIsReduced() ? seek(null, false) : seek(0, true))
  return { t: t ?? total, playing, play, seek }
}
```

In the component, replace the `run` state and `pick`:

```jsx
  const [solo, setSolo] = useState(null)
  const flyers = rows.filter((r) => r.path)
  const one = rows.find((r) => r.code === solo) ?? null
  const pitches = useMemo(() => rows.map((r) => ({ code: r.code, ft: r.path?.T ?? null, rpm: r.spin })), [rows])
  const clock = useArsenalClock(totalMs(pitches, SPEED), 'play')
  const beats = beatsAt(clock.t, pitches, { S: SPEED, solo: one?.path ? one.code : null })
  const byCode = new Map(beats.pitches.map((b) => [b.code, b]))
  // A pick, a second tap on the picked card (MenuRail sends null) and "All pitches" replay the timeline.
  const pick = (code) => {
    setSolo(code)
    clock.play()
  }
```

The side view: drop `key={run}`, pass the beats:

```jsx
        <div className="arsenal__side">
          <FlightScene
            camera="flat"
            w={336}
            h={180}
            items={flyers}
            s={Infinity}
            beats={byCode}
            ring={beats.ring}
            ticks={beats.ticks}
            label="Side view of the pitches leaving one release point and splitting before the plate"
          />
```

(`solo` is no longer passed: `beats` carries `ghost`.)

The inset marks:

```jsx
            {flyers.filter((r) => r.landing).map((r) => {
              const b = byCode.get(r.code)
              return (
                <g
                  key={r.code}
                  opacity={b.mark.o.toFixed(3)}
                  transform={`translate(${(40 + r.landing.x * 28).toFixed(1)} ${(41 - (r.landing.h - MID) * 28).toFixed(1)})`}
                >
                  <g transform={`scale(${b.mark.k.toFixed(3)})`}>
                    <GlyphPath mark={r.mark} r={3.4} />
                  </g>
                </g>
              )
            })}
```

Replay: `<Button size="control" onClick={clock.play}>Replay</Button>`.

### 3. `FlightScene.jsx`

New props `beats = null` (a `Map` code → pitch beats), `ring = null`, `ticks = null`.
Without `beats` the code path is the old one, so `FlightCard` does not change.

```jsx
const BALL = 0.121 // ft, the ball's radius
const SEAM_R = 4.6 // the board's ball radius, which SEAM is drawn for
const SEAM = 'M-3.2 -.9Q0 -3.5 3.2 -.9M-3.2 .9Q0 3.5 3.2 .9'

// … header comment: add "`beats` (the Arsenal card's timeline, timeline.js) sets, per code, how far each
// path is drawn, its opacity, the ball's scale, spin and fade and the landing ripple; `ring` is the release
// ring and `ticks` the flat camera's distance scale."
export function FlightScene({ camera, w, h, items, s, solo = null, ghost = false, label, beats = null, ring = null, ticks = null }) {
  const cam = useMemo(() => makeCamera(camera, w, h), [camera, w, h])
  const park = useMemo(() => sceneD(cam), [cam])
  // The release point the ring grows from: the middle of the paths' first points.
  const release = useMemo(() => {
    const ps = items.map((it) => project(cam, it.path.at(0))).filter(Boolean)
    return ps.length ? { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length } : null
  }, [cam, items])
  return (
    <svg className="arsenal__scene" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {/* ground, mound, rubber, plate, zone: unchanged */}
      {ticks && cam.flat && ticks.map((k, i) => {
        const x = (cam.ox - cam.sx * 10 * i).toFixed(1)
        return (
          <g key={i}>
            <path className="arsenal__tick" d={`M${x} ${cam.oy.toFixed(1)}v5`} pathLength="1" style={{ strokeDashoffset: (1 - k.draw).toFixed(4) }} />
            <text className="arsenal__ticklabel" x={x} y={(cam.oy + 12).toFixed(1)} textAnchor="middle" fontSize="6.5" opacity={k.label.toFixed(3)}>
              {i ? `${i * 10}${i === 5 ? ' ft' : ''}` : '0'}
            </text>
          </g>
        )
      })}
      {items.map((it) => {
        const b = beats?.get(it.code)
        const faint = b ? b.ghost : solo != null && solo !== it.code
        const t = b ? it.path.T * b.u : faint ? it.path.T : Math.min(s, it.path.T)
        const landed = b ? b.landed : !faint && s >= it.path.T
        const ball = (b ? b.ball.o > 0 : !faint && !landed) ? project(cam, it.path.at(t)) : null
        const dot = landed && it.landing ? project(cam, [it.landing.x, it.landing.h, PLATE_Z]) : null
        const d = trailD(cam, it.path.at, t)
        const r = ball ? Math.max(3.4, ball.k * BALL * 1.3) : 0
        const paint = { '--pitch': it.mark.color }
        return (
          <g key={it.code} className="arsenal__path">
            <g opacity={(b ? b.trail : faint ? 0.22 : 1).toFixed(3)}>
              {ghost && !faint && <path className="arsenal__gravity" d={trailD(cam, it.path.grav, t)} />}
              <path className="arsenal__halo" d={d} pathLength="1" />
              <path className="arsenal__trail" d={d} pathLength="1" style={paint} />
            </g>
            {ball && (
              <g
                transform={`translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})${b ? ` scale(${b.ball.k.toFixed(3)}) rotate(${b.ball.spin.toFixed(1)})` : ''}`}
                opacity={b ? b.ball.o.toFixed(3) : undefined}
                style={paint}
              >
                <circle className="arsenal__ball" r={r} />
                {b && <path className="arsenal__seam" d={SEAM} transform={`scale(${(r / SEAM_R).toFixed(3)})`} />}
              </g>
            )}
            {dot && (
              <g transform={`translate(${dot.x.toFixed(1)} ${dot.y.toFixed(1)}) scale(${Math.max(0.5, (dot.k * BALL) / 2.4).toFixed(2)})`}>
                <GlyphPath mark={it.mark} r={5} />
              </g>
            )}
            {dot && b && b.ripple.o > 0 && (
              <circle className="arsenal__ripple" cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r={b.ripple.r.toFixed(2)} opacity={b.ripple.o.toFixed(3)} style={paint} />
            )}
          </g>
        )
      })}
      {ring && release && ring.o > 0 && (
        <circle className="arsenal__ring" cx={release.x.toFixed(1)} cy={release.y.toFixed(1)} r={ring.r.toFixed(2)} opacity={ring.o.toFixed(3)} />
      )}
    </svg>
  )
}
```

Notes:

- The ball moves from `cx`/`cy` to a `translate`, so the spin and scale have an
  origin. The circle keeps its live look (card fill, pitch ring). The seam only
  draws with `beats`, so `FlightCard`'s ball does not change. Without a seam a
  turning circle shows no spin; the seam is the canvas's.
- The ghost opacity 0.22 now sits in JS (`beats` or the `faint` fallback). Do not
  keep the CSS opacity: a parent `opacity` and a child `opacity` multiply.
- The label `y` is `cam.oy + 12` (about 178 of 180) because the live flat camera's
  ground sits at `cam.oy` ≈ 166, not at the canvas's 160.

### 4. `arsenal.css`

Delete the draw block (the `.arsenal__side .arsenal__halo, .arsenal__side
.arsenal__trail` rule, `@keyframes arsenal-draw` and its reduced-motion block) and the
slice-11 ghost block (`.arsenal__path--ghost`, its `animation: none` rule,
`@keyframes arsenal-ghost`, its reduced-motion block). A CSS animation outranks an
inline style in the cascade, so a kept animation would fight the clock.

Replace them with (after `.arsenal__ball`):

```css
/* The side view's beats are set frame by frame by the card's clock (modules/arsenal/timeline.js), so this
   sheet holds only their look. Reduced motion: the clock shows the last frame; no CSS motion here. */
.arsenal__seam {
  fill: none;
  stroke: var(--pitch, var(--text-caption));
  stroke-width: 0.9;
}
.arsenal__ring {
  fill: none;
  stroke: var(--text-heading);
  stroke-width: 1.5;
}
.arsenal__ripple {
  fill: none;
  stroke: var(--pitch, var(--text-caption));
  stroke-width: 1.5;
}
.arsenal__tick {
  fill: none;
  stroke: var(--text-heading);
  stroke-width: 1.4;
  stroke-dasharray: 1;
}
.arsenal__ticklabel {
  fill: var(--text-caption);
  font-family: var(--font-mono);
}
```

Guards: no hex, no time, no radius, no flex or grid. `check-typography.mjs`: the
tick label sets only `font-family` (the size is the SVG `fontSize` attribute, as
`.arsenal__inset text` does today). The sheet ends near 360 lines.

## Test first

`test/arsenal-timeline.test.js` (new). Run it first: the import fails, so every
case fails.

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { LEAD, TAIL, beatsAt, countText, eo, totalMs } from '../src/screens/player/next/modules/arsenal/timeline.js'
import { ruleBody, stripComments } from './helpers/css.js'

// The Arsenal card's timeline (#2073, slice 12): the board ArsenalReveal's beats as a pure function of t.
// Numbers are the board's; a pitch with no path (ft null) never flies and never lands.
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`)
const P = [
  { code: 'FF', ft: 0.401, rpm: 2233 },
  { code: 'SL', ft: 0.44, rpm: 2500 },
  { code: 'CH', ft: null, rpm: null },
]
const landFF = LEAD + 0.401 * 1000 * 3 // the same float steps as beatsAt
const at = (t, opts) => beatsAt(t, P, opts)
const pitch = (b, code) => b.pitches.find((p) => p.code === code)

test('eo is the board ease-out quart, held at 0 before and 1 after', () => {
  assert.equal(eo(-1), 0)
  assert.equal(eo(0), 0)
  assert.equal(eo(1), 1)
  assert.equal(eo(2), 1)
  close(eo(0.5), 1 - 0.5 ** 4)
})

test('totalMs: 760 lead + the longest flight at 1/S speed + 760 hold; a pitch with no path does not count', () => {
  assert.equal(LEAD, 760)
  assert.equal(TAIL, 760)
  assert.equal(totalMs(P, 3), 2840)
  assert.equal(totalMs(P, 6), 4160)
  assert.equal(totalMs([{ code: 'CH', ft: null }], 3), 1520)
})

test('at t = 0 nothing shows: bar rolled up, no ring, rows hidden, balls at release, no trail, no marks', () => {
  const b = at(0)
  assert.equal(b.roll, 0)
  assert.equal(b.rollEdge, false)
  assert.equal(b.ring.o, 0)
  for (const p of b.pitches) {
    assert.equal(p.row.e, 0)
    assert.equal(p.u, 0)
    assert.equal(p.trail, 0)
    assert.equal(p.mark.o, 0)
  }
})

test('the mix bar rolls in from 100ms over 900ms, with the shadow edge only while it moves', () => {
  assert.equal(at(100).roll, 0)
  const mid = at(550)
  assert.ok(mid.roll > 0 && mid.roll < 1)
  assert.equal(mid.rollEdge, true)
  assert.equal(at(1000).roll, 1)
  assert.equal(at(1000).rollEdge, false)
})

test('the scale ticks draw from 120 + k*40 ms over 300ms; their labels fade from 260 + k*40 ms over 400ms', () => {
  assert.equal(at(120).ticks[0].draw, 0)
  assert.equal(at(420).ticks[0].draw, 1)
  assert.equal(at(320).ticks[5].draw, 0)
  assert.ok(at(330).ticks[5].draw > 0)
  assert.equal(at(260).ticks[0].label, 0)
  assert.equal(at(660).ticks[0].label, 1)
})

test('the release ring grows 3 -> 16 and fades 0.8 -> 0 over the first 380ms of the flight', () => {
  assert.equal(at(LEAD).ring.o, 0)
  const r = at(LEAD + 190).ring
  close(r.r, 3 + 13 * (1 - 0.5 ** 4))
  close(r.o, 0.8 * 0.5 ** 4)
  assert.equal(at(LEAD + 380).ring.o, 0)
})

test('the ball scales in from 0.85 over the 260ms before release, then spins by its rpm', () => {
  const before = pitch(at(LEAD - 260), 'FF')
  assert.equal(before.ball.o, 0)
  close(before.ball.k, 0.85)
  const out = pitch(at(LEAD), 'FF')
  assert.equal(out.ball.o, 1)
  assert.equal(out.ball.k, 1)
  const half = pitch(at(LEAD + 0.401 * 1000 * 3 * 0.5), 'FF')
  close(half.u, 0.5)
  close(half.ball.spin, (-0.5 * 360 * 2233) / 900)
  assert.equal(pitch(at(LEAD + 100), 'CH').ball.spin, 0)
})

test('on landing: ripple 4 -> 14 from 0.6, mark pops from 1.7, segment flashes 0.5, sweep starts, glyph 1.45', () => {
  const p = pitch(at(landFF), 'FF')
  assert.equal(p.landed, true)
  assert.equal(p.u, 1)
  assert.equal(p.ripple.r, 4)
  close(p.ripple.o, 0.6)
  assert.equal(p.mark.o, 0)
  close(p.mark.k, 1.7)
  close(p.flash, 0.5)
  assert.equal(p.sweep.x, 0)
  assert.equal(p.sweep.o, 1)
  close(p.glyph, 1.45)
  assert.equal(pitch(at(landFF + 70), 'FF').mark.o, 1)
  assert.equal(pitch(at(landFF + 140), 'FF').ball.o, 0)
  assert.equal(pitch(at(landFF + 380), 'FF').ripple.o, 0)
  assert.equal(pitch(at(landFF - 1), 'FF').landed, false)
})

test('at the end every flight has landed and settled; the trail rests at 0.45', () => {
  const b = at(totalMs(P, 3))
  assert.equal(b.roll, 1)
  for (const code of ['FF', 'SL']) {
    const p = pitch(b, code)
    assert.equal(p.landed, true)
    assert.equal(p.ripple.o, 0)
    assert.equal(p.mark.o, 1)
    assert.equal(p.mark.k, 1)
    assert.equal(p.flash, 0)
    // The board's sweep fades over 260 + 700ms, but the slowest pitch lands only 760ms before the end:
    // under 1% is left, as on the board.
    assert.ok(p.sweep.o < 0.01, `sweep ${p.sweep.o}`)
    assert.equal(p.glyph, 1)
    close(p.trail, 0.45)
  }
  assert.equal(pitch(b, 'CH').landed, false)
  for (const p of b.pitches) {
    assert.equal(p.row.e, 1)
    assert.equal(p.row.count, 1)
  }
})

test('the menu rows enter 80ms apart from 140ms; the figures count from 240 + i*80 ms', () => {
  assert.ok(at(200).pitches[0].row.e > 0)
  assert.equal(at(220).pitches[1].row.e, 0)
  assert.ok(at(230).pitches[1].row.e > 0)
  assert.equal(at(240).pitches[0].row.count, 0)
  assert.ok(at(300).pitches[0].row.count > 0)
})

test('a pick leaves the others as ghosts: whole, no ball, fading to 0.22, marks to 0.3, rows dimmed', () => {
  const b = at(1000, { solo: 'FF' })
  const sl = pitch(b, 'SL')
  assert.equal(sl.ghost, true)
  assert.equal(sl.u, 1)
  assert.equal(sl.landed, false)
  assert.equal(sl.ball.o, 0)
  close(sl.trail, 0.22)
  close(sl.mark.o, 0.3)
  assert.equal(sl.row.dim, 0.45)
  assert.equal(pitch(at(300, { solo: 'FF' }), 'SL').trail, 0)
  assert.equal(pitch(b, 'FF').ghost, false)
  assert.equal(pitch(b, 'FF').row.dim, 1)
})

test('at 1/6 speed the flight takes twice as long', () => {
  assert.equal(pitch(at(landFF, { S: 6 }), 'FF').landed, false)
  assert.equal(pitch(at(LEAD + 0.401 * 1000 * 6, { S: 6 }), 'FF').landed, true)
})

test('countText counts up with the figure\'s own decimals, or the ones asked for', () => {
  assert.equal(countText(23.3, 1), '23.3')
  assert.equal(countText(23.3, 0), '0.0')
  assert.equal(countText(23, 0.5), '12')
  assert.equal(countText(90, 0.5, 1), '45.0')
  assert.equal(countText(90, 2, 1), '90.0')
})

// ---- the card and the sheet ----
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const card = read('src/screens/player/next/modules/arsenal/ArsenalCard.jsx')
const scene = read('src/screens/player/next/modules/arsenal/FlightScene.jsx')
const css = stripComments(read('src/styles/player-next/pitcher/arsenal.css'))

test('one clock drives the side view: no remount key, no CSS draw or ghost animation', () => {
  assert.match(card, /useArsenalClock\(/)
  assert.match(card, /beatsAt\(clock\.t/)
  assert.doesNotMatch(card, /key=\{run\}/)
  assert.doesNotMatch(css, /arsenal-draw/)
  assert.doesNotMatch(css, /arsenal-ghost/)
  assert.equal(ruleBody(css, '.arsenal__path--ghost'), null)
})

test('the clock checks reduced motion and caps a frame at 50ms', () => {
  assert.match(card, /motionIsReduced\(\)/)
  assert.match(card, /Math\.min\(50, now - last\)/)
})

test('the scene draws the beats: ring, ripple, seam, ticks', () => {
  for (const cls of ['arsenal__ring', 'arsenal__ripple', 'arsenal__seam', 'arsenal__tick', 'arsenal__ticklabel']) {
    assert.match(scene, new RegExp(cls), `FlightScene has no ${cls}`)
    assert.ok(ruleBody(css, `.${cls}`), `arsenal.css has no .${cls} rule`)
  }
})
```

## Verify

- `npm run lint`, `npm test`, `npm run build`.
- `npm run dev`, pitcher route `/player/robert-gasser-688107?nointro`, 390px and
  1180px. Scroll to "Pitch arsenal". The ticks draw in right to left, the ring
  pops at the release point, five balls leave together and spin, the trails draw
  behind them, each landing ripples, the catcher-view mark pops. Press Replay:
  it plays again. Pick a pitch: it flies alone, the others fade up faint.
- Send Gary a frame strip at 0, 500, 900, 1300, 1800 and 2800ms (Playwright
  `page.clock` or screenshots on a timer) with `SendUserFile`, and name the route.
- Reduced motion (Playwright `reducedMotion: 'reduce'`, and the in-app Motion
  setting): the last frame shows at once; Replay and a pick show the last frame.
- `/player/{id}` of a pitcher with no command file: no paths, the card still shows
  the mix and the menu with no error.
- Pitch flight card (FlightCard) looks and plays as before.

## Out of scope

- The mix bar roll, segment flash, menu row entrance, count-up, sweep and glyph pop
  (12b). They are in `beatsAt` already; 12b draws them.
- Starting from in-view (12b). This slice starts the clock on mount, as the live
  CSS draw-in does today.
- The speed step, the scrubber, the `/animation-lab` entry (12c).
- The canvas draw-in of the ground, the zone and the inset frame (`dec` in the
  board). The live scene draws other shapes; a follow-up if Gary wants it.

## Stop if

- `src/lib/motion/curves.js` does not export `easeOutQuart` (slice 01).
- `ArsenalCard.jsx` does not use `MenuRail` yet (slice 11 not merged).
- `FlightScene.jsx` or `FlightCard.jsx` changed in a way that makes `FlightCard`
  pass `beats`, `ring` or `ticks`, or a slice 13 to 15 branch is open on
  `FlightScene.jsx`.
- `react-hooks` lint flags the clock (for example `set-state-in-effect`). Move the
  state change into the rAF callback; if that does not clear it, stop and report.
- A frame takes over 16ms on the dev build at 390px (Chrome performance panel).
