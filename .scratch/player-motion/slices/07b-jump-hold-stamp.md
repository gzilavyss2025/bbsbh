# Slice 07b — Jump bar: hold the target, stamp the section you land on

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 01a merged (`--stagger-step`, `--ease-stamp-in`), **07a merged** (it
  rewrites `Slot.jsx`; this slice adds two props to that version). Slice 02 does not
  block it (02 changes only `jumpbar.css`; this slice changes `HubTabBar.jsx`).
- Parallel with: 02, 03, 05, 06, 08, 10, 13, 20.
- Change from spec.md: slice 07 is split into 07a and 07b (9 files in one). 07b has 5.

## Goal

Decision 3: a jump-bar tap on `/player/{id}` scrolls to its section and holds it there
while slots above it load and grow, until the reader moves. When the scroll has landed,
the cards of that section stamp in one time. Overview replays the hero and the tiles.
A cold load, Back, a return visit and an old `/stats` address do not stamp.

## Done means

- `HubTabBar variant="anchor"` takes two new opt-in props: `hold` (boolean) and
  `onLand(key)`. With neither, the bar works as today. The player page passes both.
  The team page uses `RouteTabBar` (`TeamTabBar.jsx` passes no `variant`), so it cannot
  change; `JumpBarLab` passes neither prop, so it does not change.
- With `hold`, a tap scrolls to the section and re-aims the scroll each time the page
  above it changes size (a `ResizeObserver`), until the reader's own move (`wheel`,
  `touchstart`, `keydown`, `pointerdown`), or `HOLD_MAX_MS` (4000ms), or the next tap.
- `onLand(key)` runs at most once per tap, when the scroll has landed (definition below).
  It does not run if the reader moved first.
- The page stamps the slot cards of that section (Card `stampIn`, one time, staggered by
  `--stagger-step`), or for `overview`, restarts the hero's and the tiles' stamp-in.
- Reduced motion: no stamp and no replay (the page checks `motionIsReduced()`; the CSS
  already sets `animation: none`, `stamp-in.css:28-32`). The hold still runs.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files

| File | Change |
|---|---|
| `src/lib/jumpbar/land.js` | New. `createLanding()` (pure, timers injected) and `replayClass()` (duck-typed DOM). |
| `src/components/chrome/HubTabBar.jsx` | `JumpBar` gets `hold`, `onLand`; `holdTarget()` helper; mount-time listeners. |
| `src/screens/player/next/PlayerNextPage.jsx` | `landed` state; `onLand`; passes `stamp` and `order` to each `Slot`. |
| `src/screens/player/next/Slot.jsx` | `stamp`, `order` props: `stampIn` until the card's `card-stamp-in` ends. |
| `test/jump-bar-land.test.js` | New. |

`src/lib/jumpbar/` holds 1 file today (`spy.js`); 2 after. `HubTabBar.jsx` is 217 lines,
about 280 after (cap 600).

## Canvas

B-phone, B-wide, D2-phone, D2-wide. A jump-bar tap swaps the page class `g1`/`g2`; every
`.stamp` and `.rise` on the page has two keyframes with the same steps, so the swap
replays them all:

```css
.g1 .stamp{animation-name:stamp-a}.g2 .stamp{animation-name:stamp-b}
.stamp{animation-duration:380ms;animation-timing-function:cubic-bezier(.2,.9,.3,1);
       animation-delay:var(--d,0ms);animation-fill-mode:backwards}
@keyframes stamp-a{from{opacity:0;transform:translate(4px,4px);box-shadow:0 0 0 #0F1822}}
```

```js
pick: () => this.setState({ si: i, k: !k })      // the tab's tap
return { goClass: k ? 'g2' : 'g1', tabs: tabs }   // <div class="pg {{goClass}}">
```

Decision 3 narrows this: only the section you land on stamps, and only after the scroll
lands. The house keyframe is `card-stamp-in` (`src/styles/motion/stamp-in.css:16-26`),
the same steps (`--stamped-offset` is `var(--space-1)`, 4px).

## Live today

`src/components/chrome/HubTabBar.jsx:93` — the props:

```jsx
function JumpBar({ tabs, ariaLabel, scrollRoot, offset = 0, className = '' }) {
```

`HubTabBar.jsx:82-90`, rule 3, which this slice keeps:

```js
// 3. Every listener attaches on mount, never in a tap. A window listener that
//    a tap attached would catch that same tap as it bubbles.
```

`HubTabBar.jsx:170-185` — the tap:

```jsx
  const jump = (key) => {
    const el = document.getElementById(key)
    if (!el) return
    setCurrent(key)
    holdRef.current = holdFor()
    // A tap that scrolls nowhere fires no scroll event: ask the spy to measure once the hold ends.
    spyRef.current?.()
    const behavior = motionIsReduced() ? 'auto' : 'smooth'
    const root = scrollRoot?.current
    if (root) {
      const top = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - offset
      root.scrollTo({ top, behavior })
    } else {
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior })
    }
  }
```

`src/screens/player/next/PlayerNextPage.jsx:42-59` — the hold this slice copies (the
old-address landing; leave it as it is):

```js
    if (typeof ResizeObserver === 'undefined') return el.scrollIntoView()
    const hold = new ResizeObserver(() => (el.isConnected ? el.scrollIntoView() : stop()))
    hold.observe(el.parentElement)
    const MOVES = ['wheel', 'touchstart', 'keydown', 'pointerdown']
    const stop = () => { … }
    for (const e of MOVES) window.addEventListener(e, stop, { passive: true })
    const timer = setTimeout(stop, 4000)
```

`PlayerNextPage.jsx:89-115` — Overview, the bar, the sections:

```jsx
          <Stack gap="section" id="overview">
            <PlayerNextHero core={core.data} />
            …
            {rows.map((b) => (<PlayerNextTiles key={b.group} … />))}
            …
          </Stack>
          <HubTabBar variant="anchor" tabs={sections} ariaLabel="Page sections" />
          {sections
            .filter((s) => s.key !== 'overview')
            .map((s) => (
              <Stack key={s.key} as="section" gap="section" id={s.key} className="pnext__section">
                {instances
                  .filter((i) => i.section === s.key && !gone[i.key])
                  .map((i) => (
                    <Slot key={i.key} inst={i} bio={core.data.bio} asOf={asOf} season={core.data.season} onEmpty={markEmpty} />
                  ))}
              </Stack>
            ))}
```

Only `PlayerNextHero` (`PlayerNextHero.jsx:53`) and `StatTile` in `PlayerNextTiles`
(`PlayerNextTiles.jsx:32`) carry `stampIn` in `#overview` (`grep stampIn
src/screens/player/next`).

`Slot.jsx`: as 07a leaves it (07a's Build, step 2). `Card` passes `onAnimationEnd` and
`style` to the element (`Card.jsx:51-53,67-69`).

## "The scroll has landed": the exact rule

A tap starts a landing watch. The watch lands (calls `onLand` once) at the first moment
when BOTH hold:

1. **The scroll has stopped.** Either a `scrollend` event reaches the scroll target, or
   no `scroll` event has come for `QUIET_MS` (150ms). The quiet timer starts at the tap
   (so a tap on the section you are already at, which fires no scroll event, lands
   after 150ms) and restarts on each `scroll` event. A smooth scroll fires a `scroll`
   event every frame (about 16ms), so 150ms of quiet means it has stopped.
2. **The section is there.** `|section top − scroll-area top − offset| <= 2px`, or the
   scroll area is at its end (a short last section can never reach the line; the same
   `atEnd` test as the spy, `HubTabBar.jsx:125-127`).

If (1) happens and (2) does not (a slot above grew, and the hold re-aimed), the watch
waits for the next stop. The watch ends without a landing when the reader moves, at
`HOLD_MAX_MS`, at the next tap, or on unmount.

`scrollend` support: Chrome and Edge 114+, Firefox 109+. Safari: not confirmed in this
prep. WebKit added it late (2025, Safari 26.x, inferred), so older iPhones lack it. The
quiet timer is the full fallback: the rule works with no `scrollend` at all. Do not
feature-test it; listen for it, and the timer covers the rest.

## Build

State rule (react-hooks 7.1.1): `react-hooks/set-state-in-effect` is an ERROR, and the
`refs` rule forbids reading a ref during render. Set state only from a rAF, timer,
observer or event callback, never synchronously in an effect body.

### 1. `src/lib/jumpbar/land.js` (new)

```js
// THE JUMP BAR'S LANDING (#2073, decision 3): when a tap's scroll has landed on its
// section, so the page can stamp that section's cards. The pure half: the timers and the
// position test come in, so node can test it. The DOM half is HubTabBar's holdTarget.
// test/jump-bar-land.test.js pins this file.

// The scroll has stopped once no scroll event came for this long. A smooth scroll fires
// one each frame (about 16ms).
export const QUIET_MS = 150

// A landing watch for one tap. `isThere()` says the section sits at the line (or the
// scroll area is at its end). `onLand()` runs at most once, the first time the scroll
// stops with the section there. A stop is a scrollend (`ended`) or QUIET_MS with no
// scroll (`scrolled` restarts the timer). The timer starts at once: a tap that scrolls
// nowhere fires no scroll event, and still lands.
export function createLanding({ isThere, onLand, quietMs = QUIET_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null
  let over = false
  const settle = () => {
    clearTimer(timer)
    timer = null
    if (over || !isThere()) return
    over = true
    onLand()
  }
  const scrolled = () => {
    if (over) return
    clearTimer(timer)
    timer = setTimer(settle, quietMs)
  }
  const cancel = () => {
    over = true
    clearTimer(timer)
    timer = null
  }
  scrolled()
  return { scrolled, ended: settle, cancel }
}

// Plays a CSS animation again on an element that already has its class: take the class
// off, read a layout value so the browser sees the change, put the class back. A
// finished animation is gone from getAnimations(), so it cannot be restarted there.
export function replayClass(el, cls) {
  if (!el?.classList?.contains(cls)) return
  el.classList.remove(cls)
  void el.offsetWidth
  el.classList.add(cls)
}
```

### 2. `HubTabBar.jsx`

Add the import:

```js
import { createLanding } from '../../lib/jumpbar/land.js'
```

Add, under `holdFor` (line 65):

```js
// The reader's own moves. Any one ends a tap's hold on its section.
const MOVES = ['wheel', 'touchstart', 'keydown', 'pointerdown']
// The longest a tap holds its section (as the page's old-address landing does).
const HOLD_MAX_MS = 4000

// A tap's hold on its section (`hold`, slice 07b): scroll to it, and scroll to it again
// each time the page above it changes size (slots load as the scroll passes them), so it
// lands where the reader asked. `onLand` (or null) gets createLanding's single call. The
// caller feeds `scrolled` and `ended` from listeners it attached on mount (rule 3) and
// calls `stop` on the reader's move.
function holdTarget({ el, root, offset, onLand }) {
  const behavior = motionIsReduced() ? 'auto' : 'smooth'
  const scroller = root ?? document.scrollingElement
  const topOf = () => el.getBoundingClientRect().top - (root ? root.getBoundingClientRect().top : 0)
  const aim = () => {
    if (!el.isConnected) return stop()
    if (root) root.scrollTo({ top: root.scrollTop + topOf() - offset, behavior })
    else window.scrollTo({ top: window.scrollY + topOf() - offset, behavior })
  }
  const atEnd = () => {
    const height = root ? root.clientHeight : window.innerHeight
    return scroller.scrollHeight > height && scroller.scrollTop + height >= scroller.scrollHeight - 2
  }
  const landing = onLand ? createLanding({ isThere: () => Math.abs(topOf() - offset) <= 2 || atEnd(), onLand }) : null
  // timer and ro exist before the first aim(), because aim() may call stop().
  const timer = setTimeout(() => stop(), HOLD_MAX_MS)
  // The observer fires once on observe(): that is the first scroll.
  const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(aim)
  if (ro) ro.observe(el.parentElement)
  else aim()
  function stop() {
    ro?.disconnect()
    clearTimeout(timer)
    landing?.cancel()
  }
  return { scrolled: () => landing?.scrolled(), ended: () => landing?.ended(), stop }
}
```

Change the props (line 93) and add a ref and one effect after `spyRef` (line 98):

```jsx
function JumpBar({ tabs, ariaLabel, scrollRoot, offset = 0, className = '', hold = false, onLand }) {
  …
  const tapRef = useRef(null) // the tap's hold: { scrolled, ended, stop } or null
  // onLand can change each render; the hold reads the latest one.
  const onLandRef = useRef(onLand)
  useEffect(() => {
    onLandRef.current = onLand
  })
```

```jsx
  // The tap's hold (rule 3: these listeners attach on mount, never in a tap). The tap's
  // own pointerdown and keydown come BEFORE its click, so they end the old hold, never
  // the new one.
  useEffect(() => {
    if (!hold) return undefined
    const target = scrollRoot?.current ?? window
    const onScroll = () => tapRef.current?.scrolled()
    const onEnd = () => tapRef.current?.ended()
    const onMove = () => {
      tapRef.current?.stop()
      tapRef.current = null
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    target.addEventListener('scrollend', onEnd)
    for (const e of MOVES) window.addEventListener(e, onMove, { passive: true })
    return () => {
      target.removeEventListener('scroll', onScroll)
      target.removeEventListener('scrollend', onEnd)
      for (const e of MOVES) window.removeEventListener(e, onMove)
      onMove()
    }
  }, [hold, scrollRoot])
```

Change `jump` (lines 177-184). Keep the first five lines; the scroll becomes:

```jsx
    const root = scrollRoot?.current ?? null
    if (hold) {
      tapRef.current?.stop()
      const land = onLandRef.current
      tapRef.current = holdTarget({ el, root, offset, onLand: land ? () => land(key) : null })
      return
    }
    const behavior = motionIsReduced() ? 'auto' : 'smooth'
    if (root) {
      … (unchanged)
```

Add to the props comment (after `className`, line 80):

```js
//   hold        optional. A tap holds its section in place while the page above it
//               grows, until the reader moves (holdTarget). The player page sets it.
//   onLand      optional, with `hold`. Called with the key once the tap's scroll has
//               landed (lib/jumpbar/land.js). Not called if the reader moved first.
```

Check against the React compiler lint (`eslint-plugin-react-hooks` 7.1.1,
`recommended`): the `onLandRef` write is in an effect, not in render. `tapRef` is read
only in handlers and effects.

### 3. `Slot.jsx` (on top of 07a)

Add `stamp = 0` and `order = 0` to the props. `stamp` is a tap count from the page (0 =
never). Add:

```jsx
  // The jump bar's stamp (decision 3): the card stamps in once for each landing on its
  // section. `stamped` is the landing whose stamp has played; the class stays off until
  // the next one. State is derived in render, never set in an effect.
  const [stamped, setStamped] = useState(0)
  const stamping = stamp > 0 && stamp !== stamped
```

On the `Card`:

```jsx
      stampIn={stamping}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'card-stamp-in') setStamped(stamp)
      }}
      style={{
        '--slot-hold': `${phone}px`,
        '--slot-hold-wide': `${wide}px`,
        ...(stamping ? { '--stamp-delay': `calc(var(--stagger-step) * ${order})` } : null),
      }}
```

`e.target === e.currentTarget` matters: the body's rise (07a) ends inside the card and
its `animationend` bubbles up. Under reduced motion the animation never runs, so
`animationend` never comes and the class stays on with `animation: none`. That is
harmless; the page sends no stamp under reduced motion anyway.

### 4. `PlayerNextPage.jsx`

Imports:

```js
import { motionIsReduced } from '../../../hooks/preferences/motionIsReduced.js'
import { replayClass } from '../../../lib/jumpbar/land.js'
```

State, beside `lit` (line 64), before the `AsyncGate` early return:

```jsx
  // The section a jump-bar tap landed on, and how many landings so far (decision 3):
  // its cards stamp in once per landing. Never set on a cold load, Back or an old address.
  const [landed, setLanded] = useState({ key: null, tick: 0 })
```

After `markEmpty` (line 81):

```jsx
  // Overview has no slots: its hero and tiles already carry the stamp-in, so it plays again.
  // Replayed in place, not remounted: a remount would fetch the tiles' rank marks again (the
  // rank lines blink) and turn the Age fact back.
  const onLand = (key) => {
    if (motionIsReduced()) return
    if (key === 'overview') {
      for (const el of document.querySelectorAll('#overview .card--stamp-in')) replayClass(el, 'card--stamp-in')
      return
    }
    setLanded((l) => ({ key, tick: l.tick + 1 }))
  }
```

The bar (line 104):

```jsx
          <HubTabBar variant="anchor" tabs={sections} ariaLabel="Page sections" hold onLand={onLand} />
```

The slots (lines 109-113): pass the order inside the section and the stamp:

```jsx
                {instances
                  .filter((i) => i.section === s.key && !gone[i.key])
                  .map((i, n) => (
                    <Slot
                      key={i.key}
                      inst={i}
                      bio={core.data.bio}
                      asOf={asOf}
                      season={core.data.season}
                      onEmpty={markEmpty}
                      stamp={landed.key === s.key ? landed.tick : 0}
                      order={n}
                    />
                  ))}
```

`order` counts the cards the page draws. A stub module (renders `null`) reports empty
after it mounts and then leaves the list, so for a moment it can hold a place in the
count. That shifts the stagger by one 55ms step at most; leave it.

The module contract (`src/screens/player/next/CLAUDE.md`) lets only slices 06 and 07
touch `Slot.jsx` and the page; this is 07.

## Test first

New `test/jump-bar-land.test.js`. Run it before the change; it fails (no module).

```js
// The jump bar's landing (src/lib/jumpbar/land.js, #2073 decision 3): when a tap's
// scroll has landed, and the replay of a stamp class.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { QUIET_MS, createLanding, replayClass } from '../src/lib/jumpbar/land.js'

// A clock the test drives: setTimer and clearTimer over one pending callback list.
function clock() {
  let now = 0
  let id = 0
  const due = new Map()
  return {
    setTimer: (fn, ms) => (due.set(++id, { fn, at: now + ms }), id),
    clearTimer: (t) => due.delete(t),
    tick(ms) {
      now += ms
      for (const [k, t] of [...due]) if (t.at <= now) (due.delete(k), t.fn())
    },
  }
}

test('a tap that scrolls nowhere lands after the quiet time', () => {
  const c = clock()
  let lands = 0
  createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  c.tick(QUIET_MS - 1)
  assert.equal(lands, 0)
  c.tick(1)
  assert.equal(lands, 1)
})

test('each scroll event restarts the quiet time', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  for (let i = 0; i < 10; i++) {
    c.tick(16)
    w.scrolled()
  }
  c.tick(QUIET_MS - 1)
  assert.equal(lands, 0)
  c.tick(1)
  assert.equal(lands, 1)
})

test('scrollend lands at once, and only once', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  w.scrolled()
  w.ended()
  assert.equal(lands, 1)
  w.ended()
  c.tick(QUIET_MS * 2)
  assert.equal(lands, 1)
})

test('a stop away from the section waits for the next stop', () => {
  const c = clock()
  let there = false
  let lands = 0
  const w = createLanding({ isThere: () => there, onLand: () => lands++, ...c })
  w.ended()
  c.tick(QUIET_MS)
  assert.equal(lands, 0)
  there = true
  w.scrolled()
  c.tick(QUIET_MS)
  assert.equal(lands, 1)
})

test('the reader moving first cancels the landing', () => {
  const c = clock()
  let lands = 0
  const w = createLanding({ isThere: () => true, onLand: () => lands++, ...c })
  w.cancel()
  w.ended()
  c.tick(QUIET_MS)
  assert.equal(lands, 0)
})

test('replayClass takes the class off, reads layout, and puts it back', () => {
  const log = []
  const classes = new Set(['card', 'card--stamp-in'])
  const el = {
    classList: {
      contains: (c) => classes.has(c),
      remove: (c) => (log.push(`-${c}`), classes.delete(c)),
      add: (c) => (log.push(`+${c}`), classes.add(c)),
    },
    get offsetWidth() {
      log.push('read')
      return 0
    },
  }
  replayClass(el, 'card--stamp-in')
  assert.deepEqual(log, ['-card--stamp-in', 'read', '+card--stamp-in'])
  log.length = 0
  replayClass(el, 'not-there')
  assert.deepEqual(log, [])
})

test('the player page opts in; the bar stays opt-in', () => {
  const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
  assert.match(read('src/screens/player/next/PlayerNextPage.jsx'), /<HubTabBar variant="anchor"[^>]* hold onLand=\{onLand\}/)
  assert.match(read('src/components/chrome/HubTabBar.jsx'), /hold = false, onLand \}/)
  assert.doesNotMatch(read('src/screens/team/TeamTabBar.jsx'), /onLand|hold/)
  assert.match(read('src/screens/player/next/Slot.jsx'), /e\.animationName === 'card-stamp-in'/)
})
```

Keep `test/jump-bar.test.js` green (spy.js does not change).

## Verify

- `node --test test/jump-bar-land.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`, 390px and 1180px, `/player/brice-turang-668930?nointro` and
  `/player/robert-gasser-688107?nointro`, in the preinstalled Chromium.
  - From the top, tap History (the farthest section). It lands with the History name
    tab in view, even as slots above load. Then each History card stamps in, one after
    another, 55ms apart. Report `getBoundingClientRect().top` of `#history` at 1s and 3s
    after the tap (both about 0 + the section padding).
  - Tap Overview from far down: the hero, then the tiles, stamp in again (60ms, then
    120ms + 40ms steps, slice 06).
  - Tap a section, then turn the wheel at once: the scroll stops following, and no stamp
    plays.
  - Tap the section you are on: it stamps after about 150ms.
  - A cold load, Back from another page, and `/player/brice-turang-668930/stats?nointro`
    (the old address) stamp nothing extra.
  - `/design-lab` jump bar: works as before (no hold, no stamp).
  - A team page tab bar (`/team/158?nointro`): unchanged.
- Load once with `reducedMotion: 'reduce'`: a tap jumps (no smooth scroll), holds, and
  nothing stamps.
- Send Gary a frame strip of a History tap at 390px with `SendUserFile`, and the route.

## Out of scope

- The old-address landing (`PlayerNextPage.jsx:35-60`) keeps its own hold. Do not merge
  the two in this slice.
- The jump-bar press and ease (slice 02), the hero and tile delays (slice 06).
- The slot's rise and height hold (07a).
- No `/animation-lab` entry: this slice replays the existing `card-stamp-in`.

## Stop if

- 07a is not merged, or `Slot.jsx` differs from 07a's Build step 2.
- `HubTabBar.jsx:93` or `:170-185` differs from the quotes above.
- `TeamTabBar.jsx` or another caller passes `variant="anchor"` (today only
  `PlayerNextPage.jsx:104` and `JumpBarLab.jsx:43` do).
- In Chromium the History tap does not land at the section within 4s on the phone width.
  Report the `top` values; do not raise `HOLD_MAX_MS` on your own.
- The React compiler lint rejects a ref or state pattern above and the fix needs a
  different structure.
