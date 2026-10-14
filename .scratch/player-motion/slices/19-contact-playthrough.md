# 19 — Contact: play through the balls

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 18 merged (the flight clock, `shot`, `LEAD_MS`, `SETTLE_MS`).
- Parallel with: any slice outside `modules/contact/*` and `batter/contact.css`.

## Goal

Under the Contact detail panel, a small player steps through the balls of the current
view in date order: Previous, Play/Pause, Next, a "3 of 18" counter, and a season
timeline with one tick per ball that you can drag. Play flies each ball (slice 18),
rests 1150ms after it lands, then flies the next. The balls not played yet fade to .1.

## Done means

- Play: the next ball (or the first) flies; after it lands and rests 1150ms, the next
  one flies; after the last, play stops. Pause stops after the current flight.
- While playing, the dots of the balls after the current one sit at opacity .1, and
  their ticks are light.
- Previous and Next fly the ball before or after; each is disabled at its end. Each
  press moves the button 2px and its shadow goes from 3px to 1px over 120ms.
- The timeline: a fill grows to the current ball's date (width transition 320ms on
  `--ease-stamp`); a tap or drag on it flies the nearest ball; Left/Right arrow keys
  step one ball; the wrapper shows the house focus ring.
- A dot tap, a view pick or a type pick stops play.
- Reduced motion: play still steps (one ball per 1150ms), with no flight and no fill
  transition.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/contact/contactPlay.js` — new, pure: the sequencer
   and the timeline axis.
2. `src/screens/player/next/modules/contact/ContactPlayer.jsx` — new: the buttons, the
   counter, the timeline.
3. `src/screens/player/next/modules/contact/ContactModule.jsx` — date order, `playing`,
   `launch`, the dwell timer, the ahead class, the side column.
4. `src/styles/player-next/batter/contact.css` — the player, the timeline, `--ahead`.
5. `test/player-next-contact-play.test.js` — new.

The contact folder then holds 7 files (cap 12).

## Canvas

Board `Contact.dc.html`. The clock and the sequencer:

```js
this.LEAD = 260; this.DWELL = 1150;
this.tick = (now) => {
  this._t += Math.min(50, now - this._last); this._last = now;
  const st = this.state, L = this.cur(st), b = L[st.sel];
  const end = b ? this.LEAD + this.fl(b).ms : 0;
  if (st.playing && this._t >= end + this.DWELL) {
    if (st.sel < L.length - 1) { this.launch(st.sel + 1, true); return; }
    this._raf = 0; this.setState({ t: this._t, playing: false }); return;
  }
  this.setState({ t: this._t });
  this._raf = (st.playing || this._t < end + 1300) ? requestAnimationFrame(this.tick) : 0;
};
launch(i, playing) { … this._t = this.reduce() ? this.LEAD + this.fl(b).ms : 0; … this.setState({ sel: i, t: this._t, playing: playing }); … }
```

The controls and their state:

```js
const playFrom = sel < 0 || sel >= N - 1 || st.sel < 0 ? 0 : sel + 1;
prev: () => this.launch(Math.max(0, sel - 1), false), next: () => this.launch(Math.min(N - 1, sel + 1), false),
noPrev: sel <= 0, noNext: sel >= N - 1 || sel < 0,
playPause: () => (st.playing ? this.setState({ playing: false }) : (N && this.launch(playFrom, true))),
playLabel: st.playing ? 'Pause' : 'Play through the balls',
playIcon: st.playing ? 'M5 3H8V17H5Z M12 3H15V17H12Z' : 'M5 3L16 10L5 17Z',
counter: N ? (sel + 1) + ' of ' + N : '',
// a dot: const ahead = st.playing && i > sel; … op = … ahead ? 0.1 : …
```

```html
<button class="tc-ic" aria-label="Previous ball" …><svg width="18" height="18" viewBox="0 0 18 18"><path d="M13 3L5 9L13 15Z M3 3H5V15H3Z"/></svg></button>
<button class="tc-ic tc-big" aria-label="{{playLabel}}" …><svg width="22" height="22" viewBox="0 0 20 20"><path d="{{playIcon}}"/></svg></button>
<button class="tc-ic" aria-label="Next ball" …><svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 3L13 9L5 15Z M13 3H15V15H13Z"/></svg></button>
```

```css
.tc-ic{width:48px;height:48px;border:2px solid #0F1822;background:#FBF6E9; … box-shadow:3px 3px 0 #0F1822;
  transition:transform 120ms cubic-bezier(.2,.9,.3,1),box-shadow 120ms}
.tc-ic.tc-big{background:#86BE98}
.tc-ic:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #0F1822}
.tc-ic:disabled{opacity:.4;cursor:default;box-shadow:none}
.tc-scrub{position:absolute;left:-12px;top:0;width:calc(100% + 24px);height:100%;margin:0;opacity:0;cursor:ew-resize;touch-action:pan-y}
.tc-tlwrap:focus-within{outline:3px solid #0F1822;outline-offset:4px}
.tc-tlf{transition:width 320ms cubic-bezier(.2,.9,.3,1)}
@media (prefers-reduced-motion:reduce){ … .tc-tlf … {transition:none} }
```

The timeline (40px tall, 12px side margin): a 2px ink line at top 19px; the fill at
top 18px, 4px tall, mint with 1px ink top and bottom borders, `width: {{tlFill}}%`; one
tick per ball at top 12px, 16px tall, 2px wide (the current one 4px, ink; a ball ahead
while playing `#C9BFA3`; the rest graphite); a month row below (Apr … Sep), 10px
condensed caps. The scrubber is `<input type="range" min="0" max="1000" step="1"
aria-label="Pick a ball by date">`; a change picks the ball nearest by date:

```js
L.forEach((b, i) => { const dd = Math.abs(pos(b) - v); if (dd < bd) { bd = dd; bi = i; } });
this.launch(bi, false);
```

The canvas axis is the fixed season, 2026-03-26 to 2026-10-01. Live has no fixed
season dates, so the axis runs from the first to the last ball date of the card (all
views share it).

Token map: 120ms = `--dur-fast`; 320ms = `calc(var(--dur-unfold) * 0.8)`; 2px =
`--bw-heavy`; 1px = `--bw-hair`; 3px = `calc(var(--bw-heavy) * 1.5)`; 48px =
`calc(var(--tap-min) + var(--space-1))`; mint = `--accent-tint`; `#C9BFA3` →
`--border-hairline` (nearest token; spec.md maps `#DED6C0` there); graphite =
`--text-caption`; ink = `--text-heading`. The canvas 3px focus outline is NOT copied:
the house ring is `var(--bw-heavy) solid var(--focus-ring)` (spec.md, "Focus rings stay
the house ring").

## Live today (after 18)

There is no player today. After 18, `ContactModule.jsx` has (line numbers move; find by
text):

- `const marks = useMemo(() => shown.map((b) => ({ b, p: hitCoordToSvg(b.x, b.y) })).filter((m) => m.p), [shown])`
  — today l.60, in the order of the spray store, not by date.
- `const [shot, setShot] = useState(0)`, `const tap = (b) => { setSel(b); setShot((s) => s + 1) }`,
  `const t = useFlightClock(shot, model)` (18). `useFlightClock` returns Infinity under
  reduced motion and when no ball is picked.
- `const pick = (set, v) => { set(v); setSel(null); setGen((g) => g + 1) }` (17a).
- The grid (today l.93-140): `.fcontact__plot` then `.fcontact__detail`, two children
  of `.fcontact__grid`.

`contactBalls` gives every ball a `date` (`'YYYY-MM-DD'` from the game log, or null).

The 18 clock runs to `LEAD_MS + ms + SETTLE_MS` (1400). `DWELL_MS` (1150) is less, so the
clock is still running when a ball's rest ends. That is why no change to
`ContactFlight.jsx` is needed.

**Lint:** `eslint-plugin-react-hooks` 7.1.1 runs its recommended set, where
`react-hooks/set-state-in-effect` is an ERROR. Do not call a setter in an effect body.
The dwell below calls its setters from a `setTimeout` callback.

## Build

### 1. `contactPlay.js` (new)

```js
// Play through the Contact balls (#2073): the order, the steps, and the season timeline.
// Pure. The flight itself is contactFlight.js; this decides which ball flies next.

export const DWELL_MS = 1150 // the rest after a ball lands, before the next one flies
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 86400000
const dayOf = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

// The marks in season order, the order they play in (and drop in, slice 17a). Stable: two
// balls on one day keep their order. A ball with no date goes last.
export function byDate(marks) {
  return marks
    .map((m, i) => [m, i])
    .sort(([a, i], [b, j]) => (a.b.date ?? '9999').localeCompare(b.b.date ?? '9999') || i - j)
    .map(([m]) => m)
}

// The timeline, first to last ball date: pos(date) is 0-100, months are the first of each
// month between, with their place. Null with no dates.
export function seasonAxis(dates) {
  const days = dates.filter(Boolean).map(dayOf)
  if (!days.length) return null
  const d0 = Math.min(...days)
  const d1 = Math.max(...days)
  const span = d1 - d0
  const pos = (s) => (s && span ? Math.min(100, Math.max(0, ((dayOf(s) - d0) / span) * 100)) : 0)
  const months = []
  if (span) {
    const first = new Date(d0 * DAY_MS)
    let y = first.getUTCFullYear()
    let m = first.getUTCMonth() + 1
    for (;;) {
      if (m > 11) {
        y += 1
        m = 0
      }
      const d = Date.UTC(y, m, 1) / DAY_MS
      if (d > d1) break
      months.push({ t: MONTHS[m], l: ((d - d0) / span) * 100 })
      m += 1
    }
  }
  return { pos, months }
}

// Play starts at the ball after the current one; from the first when none is picked or
// the last one is.
export const playStart = (i, n) => (i < 0 || i >= n - 1 ? 0 : i + 1)
// After a ball's rest: the next index, or null when the run ends.
export const afterDwell = (i, n) => (i < n - 1 ? i + 1 : null)
// A ball not played yet in this run.
export const isAhead = (i, cur, playing) => playing && i > cur
// The ball whose tick is nearest the scrubber value (0-100).
export function nearestBall(positions, v) {
  let best = 0
  positions.forEach((p, i) => {
    if (Math.abs(p - v) < Math.abs(positions[best] - v)) best = i
  })
  return best
}
export const counter = (i, n) => (i < 0 ? `${n} ${n === 1 ? 'ball' : 'balls'}` : `${i + 1} of ${n}`)
```

### 2. `ContactPlayer.jsx` (new)

```jsx
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { counter, isAhead, nearestBall, playStart } from './contactPlay.js'

// The Contact player (#2073): step or play through the balls in date order, or pick one
// on the season timeline. It only calls `onLaunch(i, play)` and `onPause()`; the module
// owns the clock. The range input is invisible over the timeline, so a drag anywhere on
// it picks the nearest ball by date; the arrow keys step one ball.
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
```

Two changes from the canvas, both for the keyboard. (1) The input is controlled to the
current ball's place, so an arrow key's 0.1% move would snap back to the same ball;
`onKeyDown` steps by ball instead. (2) A change that lands on the current ball does not
fly it again (the canvas re-flies it on every input event).

`Button` (`src/components/ui/control/Button.jsx`) passes `disabled` and `aria-label`
through `...rest`, defaults `type="button"`, and wears the slice 02 stamp-press.
`.fcontact__ic` below sets the canvas 3px shadow and its 1px press on top.

### 3. `ContactModule.jsx`

Imports:

```jsx
import { ContactPlayer } from './ContactPlayer.jsx'
import { DWELL_MS, afterDwell, byDate, isAhead, seasonAxis } from './contactPlay.js'
import { LEAD_MS, flightFrame, flightOf } from './contactFlight.js'
```

Put the marks in date order (this also makes the 17a drop stagger run through the
season):

```jsx
  const marks = useMemo(() => byDate(shown.map((b) => ({ b, p: hitCoordToSvg(b.x, b.y) })).filter((m) => m.p)), [shown])
  const axis = useMemo(() => (card ? seasonAxis(card.balls.map((b) => b.date)) : null), [card])
```

State beside `shot`: `const [playing, setPlaying] = useState(false)`.

Replace 18's `tap` with `launch`, and add the dwell, after `t` and `model` (before every
early return):

```jsx
  const idx = cur ? marks.findIndex((m) => m.b === cur) : -1
  // Fly ball i. `play` keeps the run going; any other launch (a dot, prev, next, the
  // timeline) stops it.
  const launch = (i, play) => {
    const m = marks[i]
    if (!m) return
    setSel(m.b)
    setShot((s) => s + 1)
    setPlaying(play)
  }
  // The run: after a ball lands and rests DWELL_MS, the next one flies. The rest is read
  // off the flight clock; under reduced motion there is no clock (t is Infinity), so a
  // plain timer holds each ball. The setters run in the timer callback, never in the
  // effect body (react-hooks/set-state-in-effect).
  const end = model ? LEAD_MS + model.ms : 0
  const wait = !playing || idx < 0 ? null : t === Infinity ? DWELL_MS : t >= end + DWELL_MS ? 0 : null
  useEffect(() => {
    if (wait == null) return undefined
    const id = setTimeout(() => {
      const nx = afterDwell(idx, marks.length)
      if (nx == null) {
        setPlaying(false)
        return
      }
      setSel(marks[nx].b)
      setShot((s) => s + 1)
    }, wait)
    return () => clearTimeout(id)
  }, [wait, idx, marks])
```

Stop the run on a view or type pick (17a's `pick`):

```jsx
  const pick = (set, v) => { set(v); setSel(null); setGen((g) => g + 1); setPlaying(false) }
```

On the dot: `onClick={() => launch(i, false)}` and the same in `onKeyDown` (`i` is the
`marks.map` index, now the date order). Add the ahead class:

```jsx
className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}${b === cur && flying ? ' fcontact__dot--hide' : ''}${isAhead(i, idx, playing) ? ' fcontact__dot--ahead' : ''}`}
```

Wrap the panel and the player in one column, the second child of `.fcontact__grid`:

```jsx
        <div className="fcontact__side">
          <div className={`fcontact__detail${flying ? ' fcontact__detail--fly' : ''}`}>
            …the panel from 18, unchanged…
          </div>
          <ContactPlayer
            marks={marks}
            idx={idx}
            playing={playing}
            axis={axis}
            onLaunch={launch}
            onPause={() => setPlaying(false)}
          />
        </div>
```

Pause on the canvas only clears `playing`: the ball in the air lands. Same here.

### 4. `contact.css`

Add after the `.fcontact__dot--hide` rule from 18:

```css
/* While a run plays, the balls not played yet wait faint (the canvas .1). */
.fcontact__dot--ahead {
  opacity: 0.1;
}
```

Add at the end of the file:

```css
/* The player (#2073; ContactPlayer.jsx): prev, play, next and a counter, then the season
   timeline. The buttons keep the canvas 3px offset shadow; a press moves them 2px and
   the shadow drops to 1px. */
/* layout-exempt: the panel above its player */
.fcontact__side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3h);
  min-width: 0;
}
/* layout-exempt: three buttons and the counter in one row */
.fcontact__controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.fcontact__ic {
  width: calc(var(--tap-min) + var(--space-1));
  height: calc(var(--tap-min) + var(--space-1));
  padding: 0;
  box-shadow: calc(var(--bw-heavy) * 1.5) calc(var(--bw-heavy) * 1.5) 0 var(--border-stamped);
  transition:
    transform var(--dur-fast) var(--ease-stamp),
    box-shadow var(--dur-fast) var(--ease-stamp);
}
.fcontact__ic:active {
  transform: translate(var(--bw-heavy), var(--bw-heavy));
  box-shadow: var(--bw-hair) var(--bw-hair) 0 var(--border-stamped);
}
.fcontact__ic:disabled {
  box-shadow: none;
}
.fcontact__ic--play {
  background: var(--accent-tint);
}
.fcontact__count {
  margin-left: auto;
  color: var(--text-caption);
  font-family: var(--font-mono);
  font-size: var(--fs-small);
}
.fcontact__tl {
  position: relative;
  height: var(--space-10);
  margin: 0 var(--space-3);
}
.fcontact__tl:focus-within {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: var(--space-1);
}
.fcontact__tl-line {
  position: absolute;
  top: calc(var(--space-5) - var(--bw-hair));
  left: 0;
  right: 0;
  height: var(--bw-heavy);
  background: var(--text-heading);
}
.fcontact__tl-fill {
  position: absolute;
  top: calc(var(--space-5) - var(--bw-heavy));
  left: 0;
  height: var(--space-1);
  border-block: var(--bw-hair) solid var(--text-heading);
  background: var(--accent-tint);
  transition: width calc(var(--dur-unfold) * 0.8) var(--ease-stamp);
}
.fcontact__tick {
  position: absolute;
  top: var(--space-3);
  width: var(--bw-heavy);
  height: var(--space-4);
  margin-left: calc(var(--bw-hair) * -1);
  background: var(--text-caption);
}
.fcontact__tick--ahead {
  background: var(--border-hairline);
}
.fcontact__tick--cur {
  width: var(--space-1);
  margin-left: calc(var(--bw-heavy) * -1);
  background: var(--text-heading);
}
.fcontact__scrub {
  position: absolute;
  top: 0;
  left: calc(var(--space-3) * -1);
  width: calc(100% + var(--space-6));
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: ew-resize;
  touch-action: pan-y;
}
.fcontact__months {
  position: relative;
  height: var(--space-4);
  margin: 0 var(--space-3);
}
.fcontact__months span {
  position: absolute;
  top: 0;
  color: var(--text-caption);
  font-family: var(--font-display);
  font-size: var(--fs-label);
  text-transform: uppercase;
}
@media (prefers-reduced-motion: reduce) {
  .fcontact__ic,
  .fcontact__tl-fill { transition: none; }
}
```

Guard notes:

- `check-raw-values.mjs`: every time is a token or a `calc()` of one; the shadows are
  `var()` and `calc(var() * n)` with no unit literal, so they do not count.
- `check-focus-ring.mjs`: the outline is `<w> solid var(--focus-ring)`. The range input
  itself has no visible ring (opacity 0); the wrapper's `:focus-within` is the ring.
- `check-layout-ratchet.mjs`: the two new flex rules carry `layout-exempt`. The
  `position: absolute` rules are not flex or grid.
- `check-typography.mjs`: font sizes are `--fs-small` and `--fs-label`, as in the rest of
  this sheet.
- Cascade: `contact.css` loads in the module's lazy chunk, after `button.css`, so
  `.fcontact__ic:active` (0,2,0) wins over `.btn:active` (0,2,0) by order. Check it in
  the browser. If `.btn:active` still wins, raise the two press rules to
  `.btn.fcontact__ic` and `.btn.fcontact__ic:active`, and update the test selectors to
  match.

## Test first

New file `test/player-next-contact-play.test.js`. The pure cases were run against the
code above in a scratch copy: all pass with it. All fail before the change (no module).

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  DWELL_MS, afterDwell, byDate, counter, isAhead, nearestBall, playStart, seasonAxis,
} from '../src/screens/player/next/modules/contact/contactPlay.js'
import { SETTLE_MS } from '../src/screens/player/next/modules/contact/contactFlight.js'

// Play through the Contact balls (#2073, slice 19).
const m = (date, id) => ({ b: { date, id }, p: { x: 0, y: 0 } })

test('DWELL_MS is the canvas 1150ms, inside the flight clock tail', () => {
  assert.equal(DWELL_MS, 1150)
  assert.ok(DWELL_MS < SETTLE_MS)
})

test('byDate: season order, ties keep their order, an undated ball goes last', () => {
  const out = byDate([m('2026-05-02', 'a'), m(null, 'x'), m('2026-04-01', 'b'), m('2026-05-02', 'c')])
  assert.deepEqual(out.map((x) => x.b.id), ['b', 'a', 'c', 'x'])
})

test('playStart: the next ball, or the first when none is picked or the last one is', () => {
  assert.equal(playStart(-1, 5), 0)
  assert.equal(playStart(1, 5), 2)
  assert.equal(playStart(4, 5), 0)
})

test('afterDwell: the next ball, then the run ends', () => {
  assert.equal(afterDwell(0, 3), 1)
  assert.equal(afterDwell(2, 3), null)
})

test('isAhead: only while playing, only the balls after the current one', () => {
  assert.equal(isAhead(3, 1, true), true)
  assert.equal(isAhead(1, 1, true), false)
  assert.equal(isAhead(3, 1, false), false)
})

test('seasonAxis: first to last ball date, the first of each month between', () => {
  const ax = seasonAxis(['2026-03-26', null, '2026-05-26', '2026-04-25'])
  assert.equal(ax.pos('2026-03-26'), 0)
  assert.equal(ax.pos('2026-05-26'), 100)
  assert.equal(Math.round(ax.pos('2026-04-25')), 49)
  assert.deepEqual(ax.months.map((x) => x.t), ['Apr', 'May'])
  assert.equal(Math.round(ax.months[0].l * 10) / 10, 9.8)
  assert.equal(ax.pos(null), 0)
})

test('seasonAxis: one day has no span; no dates, no axis', () => {
  const ax = seasonAxis(['2026-06-01', '2026-06-01'])
  assert.equal(ax.pos('2026-06-01'), 0)
  assert.deepEqual(ax.months, [])
  assert.equal(seasonAxis([null]), null)
})

test('seasonAxis: a span across a new year rolls the month', () => {
  assert.deepEqual(seasonAxis(['2026-11-20', '2027-02-10']).months.map((x) => x.t), ['Dec', 'Jan', 'Feb'])
})

test('nearestBall: the ball whose tick is nearest the scrubber', () => {
  assert.equal(nearestBall([0, 20, 50, 100], 33), 1)
  assert.equal(nearestBall([0, 20, 50, 100], 36), 2)
})

test('counter: "3 of 9", or the count when no ball is picked', () => {
  assert.equal(counter(2, 9), '3 of 9')
  assert.equal(counter(-1, 9), '9 balls')
  assert.equal(counter(-1, 1), '1 ball')
})

// ---- the sheet and the wiring ----
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('the balls not played yet sit at .1', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dot--ahead'), 'opacity'), '0.1')
})

test('the player buttons: a 3px shadow; a press moves 2px and drops it to 1px over 120ms', () => {
  const b = ruleBody(CSS, '.fcontact__ic')
  assert.equal(decl(b, 'box-shadow'), 'calc(var(--bw-heavy) * 1.5) calc(var(--bw-heavy) * 1.5) 0 var(--border-stamped)')
  assert.match(decl(b, 'transition'), /^transform var\(--dur-fast\) var\(--ease-stamp\),\s*box-shadow var\(--dur-fast\) var\(--ease-stamp\)$/)
  const a = ruleBody(CSS, '.fcontact__ic:active')
  assert.equal(decl(a, 'transform'), 'translate(var(--bw-heavy), var(--bw-heavy))')
  assert.equal(decl(a, 'box-shadow'), 'var(--bw-hair) var(--bw-hair) 0 var(--border-stamped)')
})

test('the timeline fill glides over 320ms; the wrapper wears the house focus ring', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__tl-fill'), 'transition'), 'width calc(var(--dur-unfold) * 0.8) var(--ease-stamp)')
  assert.equal(decl(ruleBody(CSS, '.fcontact__tl:focus-within'), 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__ic,\s*\.fcontact__tl-fill\s*\{\s*transition: none;?\s*\}/)
})

test('the module plays in date order and holds each ball DWELL_MS after it lands', () => {
  assert.match(JSX, /byDate\(/)
  assert.match(JSX, /t >= end \+ DWELL_MS \? 0/)
  assert.match(JSX, /<ContactPlayer/)
  assert.match(JSX, /setPlaying\(false\) \}/)
})
```

## Verify

- `node --test test/player-next-contact-play.test.js`, then `npm run lint`.
  Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- Chromium at 390px and 1180px: `/player/brice-turang-668930?nointro`. Pick "Home runs"
  and press Play. Take a frame strip across two balls: the flight, the rest, the next
  flight; the faint balls ahead; the fill moving. Press Pause mid-flight: the ball lands
  and the run stops. Press Next and Previous; check the press (2px move, shadow 3 → 1).
  Drag on the timeline. Tab to the timeline and use the arrow keys.
- Reduced motion (Playwright `reducedMotion: 'reduce'`): Play steps one ball about every
  1.15s, with no flight.
- Send Gary the strip with `SendUserFile` and the route.

## Out of scope

- An `/animation-lab` entry (five files already; the press is the system press with a
  deeper shadow). Name it as a follow-up in the PR.
- Any change to the flight (18) or the dot drop (17a).
- The canvas default of showing the last ball when none is picked: the live card keeps
  its hint until a tap or Play.
- Auto-scroll or keyboard shortcuts beyond the timeline.

## Stop if

- 18 is not merged, or `useFlightClock` no longer returns Infinity under reduced motion
  (the dwell timer depends on it).
- `SETTLE_MS` is less than `DWELL_MS` (the clock would stop before the rest ends, and a
  run would stall).
- `contactBalls` no longer gives each ball a `date`.
- `npm run lint` reports `react-hooks/set-state-in-effect` on the dwell effect. Report
  the message; do not disable the rule.
- `ContactModule.jsx` would pass 600 lines.
