# Slice 12c: Arsenal timeline, part 3: speed step, scrubber, lab entry

Part 3 of 3 (12a: the clock and the side view; 12b: the bar, the rows, in view).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 12b merged, and 01d merged (`PlayerMotionLab.jsx`, `Frame` in `Entry.jsx`).
- Parallel with: 06, 08, 10, 16, 17, 20. Not with 13, 14, 15 (same `arsenal/`
  folder). Another open slice that adds to `PlayerMotionLab.jsx` is fine: merge
  `main` in; the conflict is one entry beside another.

## Goal

The Arsenal card gets the canvas playback controls: a speed button that switches
between 1/3 and 1/6 of real speed and replays, and a scrubber that stops the clock
and shows any moment of the timeline. `/animation-lab` gets an entry with the card
live and a frozen strip of its frames.

## Done means

- `.arsenal__bar` holds Replay, a range input (`0` to `total`, step 1, the clock's
  `t`), and a speed button (`⅓×` ↔ `⅙×`). Moving the range stops the clock at that
  `t`. The speed button changes `S` and replays.
- The speed persists across picks. A pick still replays at the chosen speed.
- `/animation-lab` shows "Pitch arsenal: the timeline" with the live card (its own
  Replay) and frames at 0, 300, 760, 1100, 1500, 2000ms and the end.
- `npm run lint`, `npm test`, `npm run build` pass. The new tests fail before the change.

## Files

1. `src/screens/player/next/modules/arsenal/ArsenalCard.jsx`: `S` state, the range,
   the speed button; an `at` prop for the lab.
2. `src/styles/player-next/pitcher/arsenal.css`: `.arsenal__range`.
3. `src/screens/animlab/PlayerMotionLab.jsx` (slice 01d): the timeline entry with
   invented rows.
4. `test/arsenal-motion.test.js`: new cases at the end.

`AnimationLab.jsx` and `motionDemos.jsx` do not change (slice 01d: every player
motion entry goes in `PlayerMotionLab.jsx`).

## Canvas

ArsenalReveal board, the control row under the side view:

```html
<div style="display: flex; align-items: center; gap: 10px">
<button type="button" onClick="{{replay}}" …min-height: 44px…>(↻ icon)Replay</button>
<input type="range" min="0" max="{{total}}" step="1" value="{{t}}" onInput="{{scrub}}"
       aria-label="Scrub the pitch animation" style="flex: 1; min-width: 0; height: 44px; margin: 0; accent-color: #0F1822; cursor: ew-resize">
<button type="button" onClick="{{speed}}" aria-label="Playback speed" …>{{spd}}</button>
</div>
```

```js
scrub: (ev) => { cancelAnimationFrame(this._raf); this._t = +ev.target.value; this.setState({ t: this._t }); },
replay: () => this.play(),
speed: () => { this.setState({ S: S === 3 ? 6 : 3 }); setTimeout(() => this.play(), 0); },
spd: S === 3 ? '1/3×' : '1/6×',
```

`S` is the slow-down factor: 3 is one-third speed, 6 is one-sixth. `totalMs(pitches,
S)` already takes it (12a).

## Live today

After 12b, `ArsenalCard.jsx` has:

```jsx
const SPEED = 3 // the side view plays at one-third of real speed, as the board does

function useArsenalClock(total, start) {
  …
  return { t: t ?? total, playing, play, seek }
}

export function ArsenalCard({ rows, id }) {
  …
  const clock = useArsenalClock(totalMs(pitches, SPEED), phase === 'rest' ? 'end' : 'wait')
  const beats = beatsAt(clock.t, pitches, { S: SPEED, solo: one?.path ? one.code : null })
  …
      <div className="arsenal__bar">
        {flyers.length > 0 && <Button size="control" onClick={clock.play}>Replay</Button>}
      </div>
```

`FlightCard.jsx:8` has the speed labels the live app uses: `[1 / 3, '⅓×', 'one-third speed']`.
`arsenal.css` `.flight__range` (today `:321-327`) is the Pitch flight card's range;
do not reuse it (slices 13 to 15 own that card).

After slice 01d: `src/screens/animlab/PlayerMotionLab.jsx` exports
`PlayerMotionLab`, a fragment of `Entry` blocks that `AnimationLab.jsx` renders with
one line. `src/screens/animlab/Entry.jsx` exports `Entry` (`{ title, note, live,
hover, children }`) and `Frame` (`{ label, delayMs, children }`; `delayMs` only
sets `--animlab-delay` for CSS animations, so leave it out for a JS frame). The
frozen strip wrapper is `<div className="animlab__frozen">`, its label
`<span className="animlab__stagelabel">`.

## Build

### 1. `ArsenalCard.jsx`

Delete `const SPEED = 3`. Give the clock an `at` override (the lab's frozen frames):

```jsx
// … `at` (the lab's frozen frames) pins t and wins over the clock.
function useArsenalClock(total, start, at = null) {
  …unchanged…
  return { t: at ?? t ?? total, playing, play, seek }
}
```

In the component:

```jsx
export function ArsenalCard({ rows, id, at = null }) {
  …
  const [S, setS] = useState(3) // 3: one-third of real speed; 6: one-sixth
  const total = totalMs(pitches, S)
  const clock = useArsenalClock(total, phase === 'rest' ? 'end' : 'wait', at)
  const beats = beatsAt(clock.t, pitches, { S, solo: one?.path ? one.code : null })
  const slower = () => {
    setS(S === 3 ? 6 : 3)
    clock.play()
  }
  …
      <div className="arsenal__bar">
        {flyers.length > 0 && (
          <>
            <Button size="control" onClick={clock.play}>Replay</Button>
            <input
              type="range"
              className="arsenal__range"
              min="0"
              max={total}
              step="1"
              value={Math.round(clock.t)}
              onChange={(e) => clock.seek(Number(e.target.value), false)}
              aria-label="Scrub the pitch animation"
            />
            <Button
              size="control"
              onClick={slower}
              aria-label={`Playback speed: ${S === 3 ? 'one-third' : 'one-sixth'}`}
            >
              {S === 3 ? '⅓×' : '⅙×'}
            </Button>
          </>
        )}
      </div>
```

`clock.play()` right after `setS` is safe: `play` only sets `t = 0` and `playing`;
the rAF effect re-runs with the new `total` on the next render. Under reduced
motion `play` sets `t = null`, which reads as the new `total`.

### 2. `arsenal.css`

After the `.arsenal__bar, .flight__bar, .flight__row` rule:

```css
/* The Arsenal card's scrubber: the timeline's ms, stopped where it is moved. */
.arsenal__range {
  flex: 1 1 9rem;
  min-width: 0;
  height: var(--tap-min);
  margin: 0;
  accent-color: var(--text-heading);
  cursor: ew-resize;
}
```

`flex: 1 1 9rem` is not a counted layout rule (the ratchet counts column, wrap,
grid). `9rem` is already used by `.flight__range`; it is not a radius or a time.

### 3. `PlayerMotionLab.jsx`

Imports (beside the ones 01d wrote; `Entry` and `Frame` are already imported):

```jsx
import '../../styles/player-next/pitcher/arsenal.css'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { ArsenalCard } from '../player/next/modules/arsenal/ArsenalCard.jsx'
import { flightPath } from '../player/next/modules/arsenal/flightView.js'
import { LEAD, totalMs } from '../player/next/modules/arsenal/timeline.js'
```

Above `export function PlayerMotionLab()`:

```jsx
// The Arsenal card's timeline (#2073, slice 12): an invented three-pitch arm, the paths built by the real
// flightPath. Each frozen frame pins the card's clock with `at`; the live card plays from its own Replay
// (the lab's Play remounts it, but its in-view key is already seen, so it shows the last frame).
const DEMO_ARM = [
  // code, usage %, mph, rpm, [x0, z0, pfxX, pfxZ, extension, plateTime], landing { x, h } ft
  ['FF', 52, 94.1, 2310, [-1.9, 5.8, -6.5, 9.1, 6.4, 0.41], { x: 0.2, h: 3.0 }],
  ['SL', 30, 85.6, 2540, [-2.0, 5.7, 3.0, 1.0, 6.3, 0.45], { x: 0.5, h: 2.0 }],
  ['CH', 18, 86.2, 1750, [-1.9, 5.7, -7.5, 4.0, 6.3, 0.45], { x: -0.4, h: 1.8 }],
]
const DEMO_ROWS = DEMO_ARM.map(([code, pct, velo, spin, [x0, z0, pfxX, pfxZ, extension, plateTime], landing]) => ({
  code,
  mark: pitchMark(code),
  pitches: 100,
  pct,
  velo,
  spin,
  flight: plateTime,
  whiffPct: null,
  xwoba: null,
  landing,
  path: flightPath({ x0, z0, pfxX, pfxZ, extension, plateTime }, landing),
}))
const DEMO_END = totalMs(DEMO_ROWS.map((r) => ({ code: r.code, ft: r.path.T, rpm: r.spin })), 3)

function ArsenalTimelineEntry() {
  return (
    <Entry
      title="Pitch arsenal: the timeline"
      note={
        <>
          The Arsenal card (#2073, modules/arsenal/timeline.js): one clock draws the mix bar, the menu rows and
          the side view. {LEAD}ms of build-up, then every pitch leaves the one release point at one-third speed.
          Press the card&rsquo;s own Replay. Reduced motion shows the last frame.
        </>
      }
      live={<ArsenalCard rows={DEMO_ROWS} id="animlab" />}
    >
      <span className="animlab__stagelabel">The timeline, 0 → {DEMO_END}ms</span>
      <div className="animlab__frozen">
        {[0, 300, LEAD, 1100, 1500, 2000, DEMO_END].map((ms) => (
          <Frame key={ms} label={`${ms}ms`}>
            <ArsenalCard rows={DEMO_ROWS} id={`animlab-${ms}`} at={ms} />
          </Frame>
        ))}
      </div>
    </Entry>
  )
}
```

Check `flightPath`'s inputs in `flightView.js:40` (`INPUTS = ['x0', 'z0', 'pfxX',
'pfxZ', 'extension', 'plateTime']`): every one is set, so each row has a path. If
the frames are too wide for `.animlab__frozen`, wrap each `ArsenalCard` in a
`<div style={{ width: 336 }}>` (inline, in the lab only).

Then render `<ArsenalTimelineEntry />` as the last child of the fragment that
`PlayerMotionLab` returns.

## Test first

Append to `test/arsenal-motion.test.js`. Each case fails before the change.

```js
const lab = read('src/screens/animlab/PlayerMotionLab.jsx')

test('the speed button switches 1/3 and 1/6 and replays; the timeline length follows it', () => {
  assert.match(card, /useState\(3\)/)
  assert.match(card, /setS\(S === 3 \? 6 : 3\)/)
  assert.match(card, /totalMs\(pitches, S\)/)
  assert.match(card, /'⅓×' : '⅙×'/)
})

test('the scrubber spans the timeline and stops the clock where it is moved', () => {
  assert.match(card, /type="range"/)
  assert.match(card, /max=\{total\}/)
  assert.match(card, /clock\.seek\(Number\(e\.target\.value\), false\)/)
  assert.match(card, /aria-label="Scrub the pitch animation"/)
  const body = ruleBody(css, '.arsenal__range')
  assert.ok(body, 'no .arsenal__range rule')
  assert.match(body, /height: var\(--tap-min\)/)
})

test('the lab shows the timeline live and as pinned frames', () => {
  assert.match(card, /at \?\? t \?\? total/)
  assert.match(lab, /function ArsenalTimelineEntry\(/)
  assert.match(lab, /<ArsenalCard rows=\{DEMO_ROWS\}[^>]*at=\{ms\}/)
  assert.match(lab, /<ArsenalTimelineEntry \/>/)
})
```

## Verify

- `npm run lint`, `npm test`, `npm run build`.
- `npm run dev`, `/player/robert-gasser-688107?nointro` at 390px and 1180px: the
  bar wraps on a phone with no horizontal scroll; drag the range: the scene, the
  bar and the rows follow; press `⅓×`: it reads `⅙×` and the flight replays twice
  as slow. Pick a pitch: it replays at the chosen speed.
- `/animation-lab?nointro`: the new entry shows the live card and seven frames.
- Send Gary a screenshot of the control row on the player page and one of the lab
  frames with `SendUserFile`, and name both routes.
- Reduced motion: the card shows the last frame; the range still moves the scene
  (a drag is the reader's own action).
- Keyboard: the range takes arrow keys; the speed button's name says the speed.

## Out of scope

- The flight card's own controls (`FlightCard.jsx`, slices 13 to 15).
- A canvas-style note under the card ("Shown at 1/3 speed…"). The live card has
  no note; not asked.

## Stop if

- `src/screens/animlab/PlayerMotionLab.jsx` is not on `main` (slice 01d), or it
  would pass 600 lines. Do not raise a budget in `check-file-size.mjs`; stop and
  report.
- `ArsenalCard` passes 250 lines.
- `useArsenalClock` or `beatsAt` differ from 12a's shape.
- The range input fails `check-focus-ring.mjs` or shows no focus ring (it should get
  the house ring from the base styles; check with Tab).
