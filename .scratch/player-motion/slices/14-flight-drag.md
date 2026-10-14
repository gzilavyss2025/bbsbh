# 14 — Pitch flight: orbit drag and keys

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **13 merged** (`flightMotion.js`, `useFlightLoop`, `orbitOf`, orbit views in `makeCamera`).
- Parallel with: any slice outside `modules/arsenal/`. Not with 11, 12, 13, 15.

## Goal

The reader turns the Pitch flight view by hand, as on the canvas board: drag on the stage
to orbit, or focus the stage and use the arrow keys. A turn stops a camera swing at once and
clears the camera buttons (no preset is pressed). The loop keeps playing during a drag.

## Done means

- A drag left or right turns the yaw by 0.0085 rad a pixel; up or down turns the pitch by
  0.006 rad a pixel, held between 0.02 and 1.53 rad (never under the ground, never past
  straight down).
- A vertical swipe on a phone still scrolls the page (`touch-action: pan-y`).
- The cursor is `grab`, and `grabbing` during a drag.
- Tab reaches the stage; it shows the house focus ring. Left and Right turn ±0.08 rad,
  Up and Down ∓0.06 rad, and the page does not scroll.
- A drag during a camera swing ends the swing where it is. After a turn no camera button
  is pressed. A camera button after a turn swings from the turned view.
- The loop (slice 13) does not pause for a drag (the board does not pause it).
- A "Drag to rotate" hint sits at the end of the camera row, hidden under 440px.
- Reduced motion: drag and keys still work (the reader moves the view; nothing moves by itself).

## Files

1. `src/screens/player/next/modules/arsenal/flightMotion.js` — add `turnView`, `dragTurn`, `KEY_TURN` and the limits.
2. `src/screens/player/next/modules/arsenal/FlightCard.jsx` — `turn` in `useFlightLoop`; pointer and key handlers on the stage; the hint.
3. `src/styles/player-next/pitcher/arsenal.css` — `.flight__turn`, `.flight__turn--drag`, `.flight__turn:focus-visible`, `.flight__hint`.
4. `test/player-next-flight-motion.test.js` — add cases (the file exists after slice 13).

## Canvas

Board `PitchFlight.dc.html`:

```js
const rotate = (dy, dp) => { S.tw = 1; S.view.yaw += dy; S.view.pitch = clamp(S.view.pitch + dp, 0.02, 1.53); if (S.camKey) { S.camKey = ''; notify(); } };
E.pdown = e => { E.drag = { x: e.clientX, y: e.clientY }; E.dragging = true; notify(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
E.pmove = e => { if (!E.drag) return; rotate(-(e.clientX - E.drag.x) * 0.0085, (e.clientY - E.drag.y) * 0.006); E.drag = { x: e.clientX, y: e.clientY }; };
E.pup = () => { if (E.drag) { E.drag = null; E.dragging = false; notify(); } };
E.kdown = e => {
  const m = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06] }[e.key];
  if (m) { e.preventDefault(); rotate(m[0], m[1]); }
};
```

Markup and CSS on the board:

```html
<span class="pf-hint">Drag to rotate</span>   <!-- last child of the Camera row -->
<canvas class="pf-cv" tabindex="0" role="img" aria-label="3D view of the pitches from the mound to the plate. Use the arrow keys to rotate the view." onPointerDown onPointerMove onPointerUp onPointerCancel="{{pup}}" onKeyDown>
```
```css
.pf-cv{…;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none}
.pf-drag{cursor:grabbing}
.pf-hint{margin-left:auto;font:700 12px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;color:#6B6558}
@container (max-width:440px){ .pf-hint{display:none} }
.pf-cv:focus-visible{outline:3px solid #0F1822;outline-offset:2px}   /* NOT copied: the house ring wins (spec.md) */
```

`S.tw = 1` ends a swing where it is: the view keeps its in-between values. The loop
(`S.playing`) is not touched by a drag.

## Live today (after slice 13)

Line numbers below are inferred from slice 13's code; find the code by its text.

- `FlightCard.jsx`, `useFlightLoop` returns `{ stage, s, phase, playing, view, restart, setPlaying, seek, flyTo }`
  and keeps `{ loop, cam }` in `eng` (ref) and `snap` (state), written by `put(next)`.
- `FlightCard.jsx`, the camera row (live l.101–105 before slice 13):
  ```jsx
  <div className="flight__row" role="group" aria-label="Camera">
    {CAMERAS.map(([key, name]) => (
      <Button key={key} size="control" pressed={camera === key} onClick={() => { setCamera(key); fly.flyTo(key) }}>{name}</Button>
    ))}
  </div>
  ```
- The stage (live l.106–116): `<div className="flight__stage" ref={fly.stage}><FlightScene camera={fly.view} … label="The pitches from the mound to the plate, seen from the chosen camera" /></div>`.
- `arsenal.css` l.87–93: `.arsenal__side, .flight__stage { position: relative; border…; background…; line-height: var(--lh-zero) }` — a shared rule.
  Do not add the new declarations there: `ruleBody(css, '.flight__stage')` returns that
  shared body first. Use the new class `.flight__turn` on the same element.
- `arsenal.css` is 376 lines (cap 600). `.flight__label b` (l.308–314) is the type recipe for the hint.
- `FlightScene` is shared with `ArsenalCard.jsx` (the flat side view), so the handlers do not go on its `<svg>`.

## Build

### 1. `flightMotion.js` — append

```js
// The reader's own turn of the camera (the board's rotate): radians a pixel of drag, radians a key press,
// and the pitch limits — just above the ground to just short of straight down.
export const DRAG_YAW = 0.0085
export const DRAG_PITCH = 0.006
export const PITCH_MIN = 0.02
export const PITCH_MAX = 1.53
export const KEY_TURN = { ArrowLeft: [0.08, 0], ArrowRight: [-0.08, 0], ArrowUp: [0, -0.06], ArrowDown: [0, 0.06] }

// A drag of dx, dy pixels as [yaw, pitch] radians: drag right turns the scene right.
export const dragTurn = (dx, dy) => [-dx * DRAG_YAW, dy * DRAG_PITCH]

// The camera turned by yaw and pitch radians. A turn ends a swing where it is.
export function turnView(cam, yaw, pitch) {
  const v = cam.view
  const view = { ...v, yaw: v.yaw + yaw, pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, v.pitch + pitch)) }
  return { view, from: view, to: view, tw: 1 }
}
```

### 2. `FlightCard.jsx`

Import `KEY_TURN`, `dragTurn`, `turnView` from `./flightMotion.js`.

In `useFlightLoop`'s returned object, add:

```js
    turn: (yaw, pitch) => put({ ...eng.current, cam: turnView(eng.current.cam, yaw, pitch) }),
```

In `FlightCard`, after the `fly` line:

```js
  // Drag or the arrow keys turn the view (the board's orbit). The loop plays on; no camera preset is pressed after.
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const turn = (yaw, pitch) => {
    fly.turn(yaw, pitch)
    setCamera('')
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }
```

The camera row: add the hint after the buttons:

```jsx
        <span className="flight__hint" aria-hidden="true">Drag to rotate</span>
```

(`aria-hidden`: the stage's own label says how to turn it.)

The stage div becomes:

```jsx
      <div
        className={`flight__stage flight__turn${dragging ? ' flight__turn--drag' : ''}`}
        ref={fly.stage}
        tabIndex={0}
        role="group"
        aria-label="Pitch flight view. Drag, or use the arrow keys, to turn it."
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY }
          setDragging(true)
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // An old browser without pointer capture still drags while the pointer stays on the stage.
          }
        }}
        onPointerMove={(e) => {
          const at = drag.current
          if (!at) return
          turn(...dragTurn(e.clientX - at.x, e.clientY - at.y))
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          const m = KEY_TURN[e.key]
          if (!m) return
          e.preventDefault()
          turn(m[0], m[1])
        }}
      >
```

The `FlightScene` inside keeps its `role="img"` and `aria-label`. `setCamera('')` on every
move is cheap (React skips a set to the same value).

### 3. `arsenal.css` — after the `.flight__stage` shared rule's block (l.93), or at the end of the "Pitch flight card" section

```css
/* The stage turns under a drag or the arrow keys (the board's orbit). A vertical swipe still scrolls the page. */
.flight__turn {
  cursor: grab;
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
}
.flight__turn--drag {
  cursor: grabbing;
}
.flight__turn:focus-visible {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: var(--bw-heavy);
}
.flight__hint {
  margin-left: auto;
  color: var(--text-caption);
  font-family: var(--font-display);
  font-size: var(--fs-label);
  letter-spacing: var(--ls-xwide);
}
@media (max-width: 439px) {
  .flight__hint {
    display: none;
  }
}
```

Guards: no hex, no time, no radius, no shadow, no new flex or grid rule, so
`check-raw-values`, `check-layout-ratchet` and `check-component-reuse` see nothing. The
focus rule uses the house form (`check-focus-ring.mjs`). The board's breakpoint is a
container query at 440px; the card has no container today, so this uses the viewport
(the card is the full width at that size). No `text-transform`: `#root *` in
`src/index.css` already sets every page in capitals (`check-caps.mjs`).

## Test first

Add to `test/player-next-flight-motion.test.js` (and `import { ruleBody, stripComments } from './helpers/css.js'`
plus `readFileSync`). Run it first; the new cases fail.

```js
import { readFileSync } from 'node:fs'
import { ruleBody, stripComments } from './helpers/css.js'
import { DRAG_PITCH, DRAG_YAW, KEY_TURN, PITCH_MAX, PITCH_MIN, dragTurn, turnView } from '../src/screens/player/next/modules/arsenal/flightMotion.js'

test('the board turn rates and limits', () => {
  assert.equal(DRAG_YAW, 0.0085)
  assert.equal(DRAG_PITCH, 0.006)
  assert.equal(PITCH_MIN, 0.02)
  assert.equal(PITCH_MAX, 1.53)
  assert.deepEqual(KEY_TURN.ArrowLeft, [0.08, 0])
  assert.deepEqual(KEY_TURN.ArrowRight, [-0.08, 0])
  assert.deepEqual(KEY_TURN.ArrowUp, [0, -0.06])
  assert.deepEqual(KEY_TURN.ArrowDown, [0, 0.06])
})

test('dragTurn: right turns the yaw down, down turns the pitch up', () => {
  const [yaw, pitch] = dragTurn(100, 50)
  close(yaw, -0.85)
  close(pitch, 0.3)
})

test('turnView: holds the pitch inside its limits and ends a swing', () => {
  const swing = swingCam(stillCam(orbitOf('catcher')), orbitOf('park'))
  const a = turnView(swing, 0.5, 10)
  assert.equal(a.tw, 1)
  assert.equal(a.view.pitch, PITCH_MAX)
  close(a.view.yaw, orbitOf('catcher').yaw + 0.5)
  assert.equal(turnView(a, 0, -10).view.pitch, PITCH_MIN)
  // The side pose sits at pitch 0: a turn lifts it to the floor.
  assert.equal(turnView(stillCam(orbitOf('side')), 0, 0).view.pitch, PITCH_MIN)
  // Ended means a step does not move it.
  assert.equal(flyStep(a, 0.1), a)
})

test('the stage takes a drag: grab cursor, vertical scroll kept, the house focus ring', () => {
  const css = stripComments(readFileSync(new URL('../src/styles/player-next/pitcher/arsenal.css', import.meta.url), 'utf8'))
  const turn = ruleBody(css, '.flight__turn')
  assert.ok(turn, '.flight__turn exists')
  assert.match(turn, /cursor:\s*grab;/)
  assert.match(turn, /touch-action:\s*pan-y;/)
  assert.match(ruleBody(css, '.flight__turn--drag') ?? '', /cursor:\s*grabbing;/)
  assert.match(ruleBody(css, '.flight__turn:focus-visible') ?? '', /outline:\s*var\(--bw-heavy\) solid var\(--focus-ring\);/)
})
```

Merge the new names into the file's existing import lines rather than adding duplicate imports.

## Verify

- `node --test test/player-next-flight-motion.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `/player/robert-gasser-688107?nointro` at 1180px: drag the stage left and right, up and
  down; the camera buttons go unpressed; the loop keeps playing. Tap Park: it swings from
  the turned view. Tab to the stage: the house ring shows; the arrows turn it and the page
  does not scroll.
- At 390px in Chromium with touch emulation (Playwright `hasTouch: true`): a horizontal
  drag turns, a vertical swipe scrolls the page. The hint is hidden.
- Reduced motion: drag and keys turn the view; nothing moves by itself.
- Send Gary a two-frame screenshot (before and after a drag) with the route.

## Out of scope

- The `<canvas>` renderer (slice 15). Keep the handlers on the stage div there too.
- Pinch zoom, wheel zoom, inertia after a drag (the board has none).
- Any change to the loop or the swing timing (slice 13).

## Stop if

- Slice 13 is not merged, or `useFlightLoop` / `put` / `eng` are not as quoted.
- `.flight__stage` no longer wraps `FlightScene` in `FlightCard.jsx`.
- A guard (`check-typography`, `check-focus-ring`) fails on the new rules
  and the fix is not a token swap.
- A vertical swipe on the stage no longer scrolls the page in touch emulation.
