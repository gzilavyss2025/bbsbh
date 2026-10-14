# Slice 01c: `useInViewOnce`, the one-shot entrance gate

Part 3 of 4 of slice 01 (see 01a for the split).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: none (it reads no new token).
- Parallel with: 01a, 01b, 02a. Slices 07 and the module slices that rise on view
  (08, 10, and others) wait for it.

## Goal

A hook that tells a card when to play its entrance: the first time the card comes
into view in this page visit, and never again in the same JS bundle. It keeps a
module-level `Set` of keys `<playerId>:<slotKey>`, so Back inside the app does not
replay, and a full page load (a new bundle) does.

## Done means

- `src/lib/motion/inViewOnce.js` (pure, no React) holds the `Set` and the phase rule.
- `src/hooks/scroll/useInViewOnce.js` returns `[ref, phase]`, where `phase` is
  `'rest'`, `'wait'` or `'play'`.
- The observer uses `threshold: 0.1` and no `rootMargin`, and disconnects after the
  first hit.
- `docs/motion.md`, "The one-shot gate", names the second gate.
- `test/in-view-once.test.js` passes, and it failed before the change.

## Files

1. `src/lib/motion/inViewOnce.js` (new). If slice 01b has not merged yet, this
   file creates the folder `src/lib/motion/`; 01b adds `curves.js` beside it.
2. `src/hooks/scroll/useInViewOnce.js` (new). `src/hooks/scroll/` goes from 2 to 3
   files.
3. `docs/motion.md`: one new paragraph in "The one-shot gate".
4. `test/in-view-once.test.js` (new).

## Canvas

The canvas plays each entrance on view with an IntersectionObserver that runs one
time per target:

- Splits / PitcherSplits: `new IntersectionObserver((es) => { ... if (e.isIntersecting && !this._seen[e.target.id]) { this._seen[e.target.id] = 1; this.setState({ [map[e.target.id]]: true }); this._io.unobserve(e.target); } }, { threshold: 0.08 });`
- Reduced motion or no observer: `if (this._rm || !('IntersectionObserver' in window)) { all(); return; }` (show everything at once).
- B-phone: `.rise{opacity:0;...}`: a block that will rise is hidden until it plays.

House values (spec.md, "The one-shot rule for entrances"): threshold 0.1, no
`rootMargin`, true one time, a module-level `Set` keyed `${playerId}:${slotKey}`.
The canvas `this._seen` lives in one component instance; the house `Set` lives in
the module, so it survives an unmount and a Back.

## Live today

The nearest hook is `src/hooks/scroll/useNearView.js:8-26`. It is a fetch gate with a
600px margin and per-mount state. Do not change it, and do not reuse it: it has a
`rootMargin`, and it forgets on unmount.

```js
export function useNearView(margin = '600px 0px') {
  const ref = useRef(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const node = ref.current
    if (near || !node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        setNear(true)
        io.disconnect()
      },
      { rootMargin: margin },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [near, margin])
  return [ref, near]
}
```

`src/hooks/preferences/motionIsReduced.js:27-31` reads both the in-app preference
(`data-motion="reduced"`) and the OS query, and returns `false` with no `document`
(node).

`src/hooks/motion/useBecameTrue.js` is the other one-shot gate (a value that went
false to true while mounted). Its header explains the render-phase state update that
this hook also uses for a key change.

`docs/motion.md:46-74` is "The one-shot gate". Line 48 says: "Every one-shot in the
package hangs off `src/hooks/motion/useBecameTrue.js`."

## Build

### 1. `src/lib/motion/inViewOnce.js` (new)

```js
// The one-shot rule for an entrance on the player page (#2073), as pure logic.
// An entrance (a rise, a bar grow, a draw) plays the first time its block comes
// into view in this page visit. It does not play again on a re-render, a poll, a
// data refresh, or Back inside the app in the same tab. It plays again after a
// full page load, because that is a new bundle and a new Set.
//
// hooks/scroll/useInViewOnce.js is the React half. The Set is here, in a plain
// module, so a node test can cover it with no DOM.

const seen = new Set()

// The key for one block: the player, then the slot on that player's page.
export const viewKey = (playerId, slotKey) => `${playerId}:${slotKey}`

export const hasSeen = (key) => seen.has(key)

// Records a block as seen. True only the first time, so a caller can tell a
// first sighting from a repeat.
export function markSeen(key) {
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

// The phase a block starts in.
//   rest  no entrance: already seen, reduced motion, or no IntersectionObserver.
//   wait  the entrance will play when the block comes into view; hold it hidden.
// 'play' is never a first phase: only the observer moves a block to it.
export function firstPhase(key, { canObserve, reduced }) {
  if (!canObserve || reduced || seen.has(key)) return 'rest'
  return 'wait'
}

// The class for a phase, for a block that wears the shared player rise
// (styles/motion/player-rise.css). A block with its own entrance maps the phase
// to its own class instead.
export function riseClass(phase) {
  if (phase === 'wait') return 'player-rise--wait'
  if (phase === 'play') return 'player-rise'
  return ''
}
```

### 2. `src/hooks/scroll/useInViewOnce.js` (new)

```js
import { useEffect, useRef, useState } from 'react'
import { motionIsReduced } from '../preferences/motionIsReduced.js'
import { firstPhase, markSeen } from '../../lib/motion/inViewOnce.js'

// How much of the block must show before its entrance plays: a tenth, so a tall
// card starts as its top edge clears the fold. No rootMargin: the entrance plays
// where the reader can see it, never before.
export const IN_VIEW_THRESHOLD = 0.1

const canObserve = () => typeof IntersectionObserver !== 'undefined'
const startFor = (key) => ({ key, phase: firstPhase(key, { canObserve: canObserve(), reduced: motionIsReduced() }) })

// [ref, phase] for one block on the player page (#2073). Put `ref` on the element
// that wears the entrance class, and pick the class from `phase` ('rest', 'wait'
// or 'play'; riseClass() in lib/motion/inViewOnce.js maps the shared rise).
// `key` is viewKey(playerId, slotKey). The rule and its reasons are in
// lib/motion/inViewOnce.js and docs/motion.md, "The one-shot gate".
export function useInViewOnce(key) {
  const ref = useRef(null)
  const [held, setHeld] = useState(() => startFor(key))

  // A new key (another player on the same mounted page) starts over. State
  // adjusted during render, the same escape hatch hooks/motion/useBecameTrue.js
  // uses, so the committed DOM never carries the old key's phase.
  let { phase } = held
  if (held.key !== key) {
    const next = startFor(key)
    phase = next.phase
    setHeld(next)
  }

  useEffect(() => {
    if (phase !== 'wait') return undefined
    const node = ref.current
    if (!node) return undefined
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        markSeen(key)
        setHeld({ key, phase: 'play' })
      },
      { threshold: IN_VIEW_THRESHOLD },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [key, phase])

  return [ref, phase]
}
```

Notes:
- `phase` stays `'play'` after the entrance ends, so the class is stable and a
  re-render does not restart the animation. A remount of the same key (Back) starts
  at `'rest'`, because the key is in the `Set`.
- The `setHeld` in the observer callback is not a synchronous set-state in an
  effect, so `react-hooks` v7's recommended rules (eslint.config.js:33) accept it.
  The render-phase `setHeld` is the pattern `useBecameTrue.js` already ships.
- The caller must put `ref` on a mounted element. With no element, the phase stays
  `'wait'` and the block stays at opacity 0. Say this in the caller's slice.

### 3. `docs/motion.md`

Change line 48 and add a paragraph after line 62 (the end of the `useBecameTrue`
paragraph):

```md
Every one-shot in the package hangs off one of two gates:
`src/hooks/motion/useBecameTrue.js` for a change the reader sees happen, and
`src/hooks/scroll/useInViewOnce.js` for an entrance on the player page.
```

```md
**`useInViewOnce` is the entrance gate (#2073).** A card on `/player/{id}` plays its
entrance (a rise, a bar grow, a draw) the first time it comes a tenth into view in
this page visit. A module-level `Set` of `<playerId>:<slotKey>` keys
(`src/lib/motion/inViewOnce.js`) lives for the life of the JS bundle, so a re-render,
a poll and Back in the same tab do not replay it, and a full page load does. It
returns a phase: `wait` holds the card hidden until it shows, `play` runs the
entrance, `rest` is the end state (seen, reduced motion, or no
IntersectionObserver). A tap that changes what a card shows (a pick, a filter) is a
change the reader caused, so its motion may play on every tap; that motion does not
go through this gate.
```

## Test first

Write `test/in-view-once.test.js`. Run it and see it fail (the modules do not
exist). Then build.

```js
// The player page's one-shot entrance gate (#2073, slice 01c). The pure half is
// lib/motion/inViewOnce.js; the hook is read through one server render, the way
// test/callout-ledger.test.js reads a hook. No DOM, no observer runs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { firstPhase, hasSeen, markSeen, riseClass, viewKey } from '../src/lib/motion/inViewOnce.js'
import { IN_VIEW_THRESHOLD, useInViewOnce } from '../src/hooks/scroll/useInViewOnce.js'

// The Set lives for the module's life, as it does in the app. Each test uses
// its own keys, so no test depends on another.
const OBSERVE = { canObserve: true, reduced: false }

test('viewKey is <playerId>:<slotKey>', () => {
  assert.equal(viewKey(668930, 'splits'), '668930:splits')
})

test('a block not seen yet waits for the view', () => {
  assert.equal(firstPhase(viewKey(1, 'a'), OBSERVE), 'wait')
})

test('a seen block rests: Back in the same tab does not replay it', () => {
  const key = viewKey(2, 'a')
  assert.equal(markSeen(key), true)
  assert.equal(hasSeen(key), true)
  assert.equal(firstPhase(key, OBSERVE), 'rest')
})

test('markSeen is true only the first time', () => {
  const key = viewKey(3, 'a')
  assert.equal(markSeen(key), true)
  assert.equal(markSeen(key), false)
})

test('the key is per player and per slot', () => {
  markSeen(viewKey(4, 'a'))
  assert.equal(firstPhase(viewKey(4, 'b'), OBSERVE), 'wait')
  assert.equal(firstPhase(viewKey(5, 'a'), OBSERVE), 'wait')
})

test('reduced motion, or no IntersectionObserver, rests at once', () => {
  assert.equal(firstPhase(viewKey(6, 'a'), { canObserve: true, reduced: true }), 'rest')
  assert.equal(firstPhase(viewKey(6, 'b'), { canObserve: false, reduced: false }), 'rest')
})

test('riseClass maps each phase to the shared rise', () => {
  assert.equal(riseClass('wait'), 'player-rise--wait')
  assert.equal(riseClass('play'), 'player-rise')
  assert.equal(riseClass('rest'), '')
})

test('the observer: a tenth in view, no rootMargin', () => {
  assert.equal(IN_VIEW_THRESHOLD, 0.1)
  const src = readFileSync(fileURLToPath(new URL('../src/hooks/scroll/useInViewOnce.js', import.meta.url)), 'utf8')
    .replace(/\/\/.*$/gm, '') // code only: the comments name the option to rule it out
  assert.match(src, /threshold:\s*IN_VIEW_THRESHOLD/)
  assert.doesNotMatch(src, /rootMargin\s*:/, 'no rootMargin option')
})

function phaseOf(key) {
  function Probe() {
    const [, phase] = useInViewOnce(key)
    return createElement('i', { 'data-phase': phase })
  }
  return renderToStaticMarkup(createElement(Probe)).match(/data-phase="(\w+)"/)[1]
}

test('the hook: with no IntersectionObserver (node), the block rests', () => {
  assert.equal(typeof globalThis.IntersectionObserver, 'undefined')
  assert.equal(phaseOf(viewKey(7, 'a')), 'rest')
})

test('the hook: with an observer, a new block waits and a seen one rests', () => {
  globalThis.IntersectionObserver = class {}
  try {
    assert.equal(phaseOf(viewKey(8, 'a')), 'wait')
    markSeen(viewKey(8, 'b'))
    assert.equal(phaseOf(viewKey(8, 'b')), 'rest')
  } finally {
    delete globalThis.IntersectionObserver
  }
})
```

## Verify

1. `node --test test/in-view-once.test.js`
2. `npm run lint` (eslint reads the hook), `npm test`, `npm run build`.
3. No screen calls the hook yet, so there is nothing to render. Do not add a caller
   in this slice.

## Out of scope

- Any caller: Slot (slice 07) and the modules call it.
- The rise CSS (slice 01b). This slice only names its classes in `riseClass`.
- `useNearView`: do not change it.

## Stop if

- `src/hooks/scroll/useInViewOnce.js` or `src/lib/motion/inViewOnce.js` already
  exists.
- `src/hooks/scroll/` holds 12 files.
- `npm run lint` reports a `react-hooks` error on the render-phase `setHeld`. Do not
  disable the rule; report the message. (`useBecameTrue.js` passes with the same
  pattern on this checkout.)
- The probe test needs a DOM to run. It must not; report instead of adding jsdom.
