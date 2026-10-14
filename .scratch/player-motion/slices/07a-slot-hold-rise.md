# Slice 07a — Slot: hold the height, no loading text, rise in

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 01 merged (`useInViewOnce`, the shared rise class, `--dur-rise`,
  `--ease-stamp`).
- Parallel with: 02, 03, 05, 06, 08, 10, 13, 20. Not with 07b (07b changes `Slot.jsx`
  and `PlayerNextPage.jsx` after this lands).
- Change from spec.md: slice 07 is split. **07a** (this file) is the slot's height and
  entrance. **07b** is the jump-bar hold and the stamp on land. The whole slice needed
  9 files.
- File count: 4 product and test files, plus one doc edit (`src/screens/player/next/CLAUDE.md`).

## Goal

A slot card on `/player/{id}` holds about its real height before its module shows, so
a slot that loads above the reader does not push the page down. The card shows no
"Loading {label}…" text. The module body rises in the first time the card comes into
view in this page visit.

## Done means

- Each entry in `SLOTS` (`sections.js`) has `minH: [phone, wide]`, in px, from the table
  below. A slot with no measure has `[0, 0]`.
- `Slot` draws the card with `.pnext__slot--hold` and `aria-busy="true"` until its module
  shows content. The hold class sets `min-height` from `--slot-hold` (under 740px) or
  `--slot-hold-wide` (740px and up).
- The hold ends when the module has committed and no element inside it has
  `aria-busy="true"`. This is the house convention: 19 modules mark their wait block
  with it (for example `batlog/index.jsx:101`, `mound/index.jsx:31`,
  `percentile/index.jsx:25`, `season/index.jsx:62`). `arsenal/index.jsx:41` does too.
  `pitchlog/StartDetail.jsx:112` uses it for a wait that a tap opens; the observer has
  stopped by then, so it does not matter.
- The Suspense fallback is `null` and the not-near branch draws nothing. The text
  "Loading {inst.label}…" is gone from `Slot.jsx`.
- The body `<div>` gets the shared rise class (slice 01) the first time the card comes
  into view, and only when its content shows. It does not rise again on a re-render, a
  data refresh, or Back in the same tab.
- The module contract's "Height" line in `src/screens/player/next/CLAUDE.md` says the
  new rule.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files

| File | Change |
|---|---|
| `src/screens/player/next/sections.js` | Each `SLOTS` entry gains `minH: [phone, wide]`. The comment above `SLOTS` names the hint. |
| `src/screens/player/next/Slot.jsx` | Hold state; `Probe` reports ready; fallback `null`; rise class; ref merge. |
| `src/styles/player-next/page.css` | `.pnext__slot--hold` min-height, phone and wide. |
| `test/player-next-slot-hold.test.js` | New. |
| `src/screens/player/next/CLAUDE.md` | Doc: the "Height" bullet (one line, same length). |

## Canvas

The canvas boards hold no loading state: each board is drawn with its data, and the
page board (`B-phone`) imports each module with a fixed `hint-size` (for example
`Splits hint-size="100%,2150px"`, `Contact "100%,1900px"`). That is the reason for a
per-slot height hint.

The rise, from the shell of every board (B-phone, B-wide, D2-phone, D2-wide):

```css
.rise{opacity:0;animation-fill-mode:forwards;animation-duration:420ms;
      animation-timing-function:cubic-bezier(.2,.9,.3,1);animation-delay:var(--d,0ms)}
@keyframes rise-a{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.rise,.stamp{animation:none!important;opacity:1}}
```

Slice 01 turns this into the shared rise (`--dur-rise` 420ms on `--ease-stamp`). This
slice only puts its class on the slot body.

## Measured heights (done in this prep, 2026-10-14)

Method: `npm run dev`, Playwright with the preinstalled Chromium
(`executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`; the bundled
headless shell is missing), viewport 390×900 and 1180×900, each route scrolled to the
end twice in 600px steps so every slot loads, then `getBoundingClientRect().height` of
each `.pnext__slot` (the whole card: border and padding included; `box-sizing:
border-box` is global, `01-base.css:8`). Main at `95bdd6fb`.

`minH` is the smaller of the two players, rounded down to 20px. A hint is a floor, not
the real height: the hold ends when the content shows, and the card then takes its real
height. Slots that did not render for either player (all four `tbd-*`, `milestones`)
get `[0, 0]`.

| Slot id | 390 Turang | 390 Gasser | 1180 Turang | 1180 Gasser | `minH` |
|---|---|---|---|---|---|
| season | 567 | 515 | 541 | 489 | [500, 480] |
| percentile | 549 | 459 | 528 | 438 | [440, 420] |
| advanced | 480 | 509 | 274 | 274 | [480, 260] |
| runvalue | 461 | 359 | 440 | 352 | [340, 340] |
| tbd-season | — | — | — | — | [0, 0] |
| splits | 2005 | 1046 | 1524 | 587 | [1040, 580] |
| plate | 2497 | — | 1843 | — | [2480, 1840] |
| contact | 1126 | — | 805 | — | [1120, 800] |
| form | 1451 | — | 1323 | — | [1440, 1320] |
| pform | — | 1467 | — | 1349 | [1460, 1340] |
| batlog | 1773 | — | 955 | — | [1760, 940] |
| pitchlog | — | 1416 | — | 701 | [1400, 700] |
| pfouls | — | 1024 | — | 609 | [1020, 600] |
| fouls | 856 | — | 467 | — | [840, 460] |
| similar | 360 | 360 | 353 | 353 | [360, 340] |
| milestones | — | — | — | — | [0, 0] |
| tbd-gamelog | — | — | — | — | [0, 0] |
| arsenal | — | 1730 | — | 1190 | [1720, 1180] |
| mound | — | 708 | — | 625 | [700, 620] |
| command | — | 935 | — | 547 | [920, 540] |
| target | — | 1199 | — | 533 | [1180, 520] |
| tbd-mound | — | — | — | — | [0, 0] |
| path | 242 | 242 | 242 | 242 | [240, 240] |
| prospects | 242 | — | 224 | — | [240, 220] |
| tbd-career | — | — | — | — | [0, 0] |
| firsts | 380 | 268 | 380 | 268 | [260, 260] |
| innings | 368 | 368 | 547 | 499 | [360, 480] |
| awards | 307 | 324 | 547 | 499 | [300, 480] |
| contract | 398 | 338 | 398 | 338 | [320, 320] |
| teams | 832 | 702 | 778 | 602 | [700, 600] |
| moves | 897 | 783 | 531 | 438 | [780, 420] |
| photos | 420 | 420 | 597 | 611 | [420, 580] |
| highlights | 529 | 529 | 597 | 611 | [520, 580] |
| tbd-history | — | — | — | — | [0, 0] |

At 1180 the pairs (innings + awards, photos + highlights) share one row, so both cards
of a pair have the row's height. Open PR #2071 sets many module notes in mono; heights
can move by a line. The hints are floors, so that does not matter.

## Live today

`src/screens/player/next/Slot.jsx` (49 lines), the whole file matters. Lines 6-13 and
19-48:

```jsx
function Probe({ bodyRef, onEmpty }) {
  useEffect(() => {
    if (!bodyRef.current?.firstChild) onEmpty()
  }, [bodyRef, onEmpty])
  return null
}
…
export function Slot({ inst, bio, asOf, season, onEmpty }) {
  const [ref, near] = useNearView()
  const [Module] = useState(() => lazy(inst.load))
  const [count, setCount] = useState()
  const bodyRef = useRef(null)
  const [report] = useState(() => () => onEmpty(inst.key))
  return (
    <Card frame="stamped" label={inst.label} count={count} ref={ref} className="pnext__slot" data-pair={inst.pair}>
      {near ? (
        <SlotBoundary slotKey={inst.key} onFail={report}>
          <Suspense fallback={<p className="hint">Loading {inst.label}…</p>}>
            <div ref={bodyRef}>
              <Module … onEmpty={report} onCount={setCount} />
            </div>
            <Probe bodyRef={bodyRef} onEmpty={report} />
          </Suspense>
        </SlotBoundary>
      ) : (
        <p className="hint">{' '}</p>
      )}
    </Card>
  )
}
```

`src/screens/player/next/sections.js:41-77`: the `SLOTS` array, one object per line, for
example line 47:

```js
  { id: 'splits', module: 'splits', section: 'splits', label: 'Splits', roles: HP, load: () => import('./modules/splits/index.jsx') },
```

`slotInstances` (`sections.js:101-111`) spreads each entry (`...s`), so `inst.minH`
reaches `Slot` with no other change.

`src/styles/player-next/page.css:160-163`:

```css
/* A section slot: a stamped Card whose name tab hangs above it. */
.pnext__slot {
  margin-top: var(--space-3h);
}
```

`src/screens/player/next/CLAUDE.md`, "The module contract", the Height bullet:

```md
- **Height:** a slot before it is near holds one non-breaking-space line, so it reserves one line; with
  the 600px margin most slots count as near on first paint. A real module reserves its own height (or `Slot` gets a min-height then).
```

`src/hooks/scroll/useNearView.js` returns `[ref, near]`, where `ref` is a `useRef`
object read in an effect.

## Build

### 0. Read slice 01's API first

Slice 01 adds `useInViewOnce` and the shared rise class. This brief assumes (inferred;
slice 01 fixes the names):

- `src/hooks/motion/useInViewOnce.js`: `const [ref, seen] = useInViewOnce(key)`. `ref` is
  a ref object. `seen` is true once the node has come into view, and true at mount when
  the key is already in the module-level `Set` (Back in the same tab).
- The rise class: written below as `RISE` (for example `'rise-in'`). Use the real name.
- Pair it with `useBecameTrue` (`src/hooks/motion/useBecameTrue.js`): it is true only when
  `seen` went false → true while mounted, so Back (seen at mount) does not rise.

Adapt the three lines that use these to the real API. Keep the behaviour.

### 1. `sections.js`

Add `minH` to every `SLOTS` entry, right after `label` (values from the table). Example:

```js
  { id: 'splits', module: 'splits', section: 'splits', label: 'Splits', minH: [1040, 580], roles: HP, load: () => import('./modules/splits/index.jsx') },
```

Add to the comment above `SLOTS` (after the `pair` sentence, line 40):

```js
// `minH` is [phone, wide] in px: the card's height before its module shows, so a slot that
// loads above the reader does not push the page (Slot.jsx). Measured on two players (slice 07a);
// a floor, not the real height. 0 for a slot that is often empty.
```

`sections.js` is 136 lines. The lines get longer; that is fine (no line-length rule;
`check-file-size` counts lines).

### 2. `Slot.jsx`

Replace the file body with this (keep the import of `SlotBoundary` and `Card`):

```jsx
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useNearView } from '../../../hooks/scroll/useNearView.js'
import { useInViewOnce } from '../../../hooks/motion/useInViewOnce.js'
import { useBecameTrue } from '../../../hooks/motion/useBecameTrue.js'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { SlotBoundary } from './SlotBoundary.jsx'

const RISE = 'rise-in' // slice 01's shared rise class (use the real name)

// Runs once the module has mounted. A module that rendered nothing has no data. A module
// that shows content (nothing inside it says aria-busy) is ready: the slot drops its
// height hold. It sits beside the module inside its Suspense boundary, so it commits with it.
function Probe({ bodyRef, onEmpty, onReady }) {
  useEffect(() => {
    const body = bodyRef.current
    if (!body?.firstChild) {
      onEmpty()
      return undefined
    }
    if (typeof MutationObserver === 'undefined') {
      onReady()
      return undefined
    }
    const watch = new MutationObserver(() => check())
    const check = () => {
      if (body.querySelector('[aria-busy="true"]')) return
      watch.disconnect()
      onReady()
    }
    watch.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] })
    check()
    return () => watch.disconnect()
  }, [bodyRef, onEmpty, onReady])
  return null
}

// One slot of the player page (#1884): a stamped Card with its name tab and count tag,
// around a module that loads when the slot comes near. The module owns its data; the slot
// owns the card, the hide-when-empty rule, and the height hold. Until the module shows
// content the card holds `inst.minH` (sections.js) and shows nothing, so the page does
// not jump. The body rises in the first time the card comes into view (spec, the one-shot rule).
export function Slot({ inst, bio, asOf, season, onEmpty }) {
  const [nearRef, near] = useNearView()
  const [viewRef, seen] = useInViewOnce(`${bio.id}:${inst.key}`)
  const entered = useBecameTrue(seen)
  const [Module] = useState(() => lazy(inst.load))
  const [count, setCount] = useState()
  const [held, setHeld] = useState(true)
  const bodyRef = useRef(null)
  const [report] = useState(() => () => onEmpty(inst.key))
  const [ready] = useState(() => () => setHeld(false))
  const [phone, wide] = inst.minH ?? [0, 0]
  return (
    <Card
      frame="stamped"
      label={inst.label}
      count={count}
      ref={(el) => {
        nearRef.current = el
        viewRef.current = el
      }}
      className={`pnext__slot${held ? ' pnext__slot--hold' : ''}`}
      aria-busy={held || undefined}
      style={{ '--slot-hold': `${phone}px`, '--slot-hold-wide': `${wide}px` }}
      data-pair={inst.pair}
    >
      {near && (
        <SlotBoundary slotKey={inst.key} onFail={report}>
          <Suspense fallback={null}>
            <div ref={bodyRef} className={entered && !held ? RISE : undefined}>
              <Module
                bio={bio}
                role={inst.role}
                asOf={asOf}
                season={season}
                section={inst.section}
                onEmpty={report}
                onCount={setCount}
              />
            </div>
            <Probe bodyRef={bodyRef} onEmpty={report} onReady={ready} />
          </Suspense>
        </SlotBoundary>
      )}
    </Card>
  )
}
```

Notes for the child:

- `check` is declared after `watch` and called after `observe`, so the closure reads a
  defined `watch` (no TDZ error).
- The ref callback writes two ref objects; the React compiler lint allows a write in a
  ref callback. If `useInViewOnce` returns a callback ref, call it instead.
- `className` without `RISE` while held: the body is invisible to the eye anyway (the
  card holds empty space only before the module commits; once it commits, `held` drops
  on the same tick or when the wait block goes). The class goes on when both hold.
- The rise class carries `opacity: 0` before it runs only if slice 01 wrote it that way;
  a body that gets the class while on screen starts from its first keyframe. That is the
  intended entrance.
- The rise keyframe runs on the body `<div>`, never on the Card: the Card's own
  `card--stamp-in` (07b) and the rise must not fight over one `animation` property.

### 3. `page.css`

After the `.pnext__slot` rule (line 163):

```css
/* A slot holds its measured height (sections.js `minH`) until its module shows content, so a
   slot that loads above the reader does not push the page. Slot.jsx sets the two numbers. */
.pnext__slot--hold {
  min-height: var(--slot-hold);
}
@media (min-width: 740px) {
  .pnext__slot--hold {
    min-height: var(--slot-hold-wide);
  }
}
```

Guards: no flex or grid, so no `layout-exempt` marker. No raw value
(`min-height` is not a kind `check-raw-values` counts, and it reads var()).
`check-typography` is not touched. `page.css` is 206 lines (06 adds about 6).

### 4. `src/screens/player/next/CLAUDE.md`

Replace the Height bullet with (keep it two lines; `check-claude-md` caps nested files):

```md
- **Height:** `SLOTS` gives each slot `minH: [phone, wide]` (measured, a floor). `Slot` holds that height,
  with no text, until the module shows content (nothing inside says `aria-busy`); then the body rises in once.
```

## Test first

New `test/player-next-slot-hold.test.js`. Run it before the change; it fails.

```js
// Slice 07a of the player-page motion (#2073): a slot holds its height and shows no loading text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SLOTS } from '../src/screens/player/next/sections.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = stripComments(read('src/styles/player-next/page.css'))
const slot = read('src/screens/player/next/Slot.jsx')

test('every slot has a [phone, wide] height hint in px', () => {
  for (const s of SLOTS) {
    assert.ok(Array.isArray(s.minH) && s.minH.length === 2, `${s.id} has minH`)
    for (const n of s.minH) assert.ok(Number.isInteger(n) && n >= 0, `${s.id} minH is whole px`)
  }
})

test('the hints are the measured floors', () => {
  const by = Object.fromEntries(SLOTS.map((s) => [s.id, s.minH]))
  assert.deepEqual(by.splits, [1040, 580])
  assert.deepEqual(by.plate, [2480, 1840])
  assert.deepEqual(by.arsenal, [1720, 1180])
  assert.deepEqual(by.path, [240, 240])
  for (const id of ['tbd-season', 'tbd-gamelog', 'tbd-mound', 'tbd-career', 'tbd-history', 'milestones']) {
    assert.deepEqual(by[id], [0, 0], `${id} holds nothing`)
  }
})

test('the hold class reads the two hints', () => {
  assert.equal(ruleBody(page, '.pnext__slot--hold').trim(), 'min-height: var(--slot-hold);')
  assert.match(page, /@media \(min-width: 740px\)\s*\{\s*\.pnext__slot--hold\s*\{\s*min-height:\s*var\(--slot-hold-wide\);/)
})

test('the slot shows no loading text and sets the hints', () => {
  assert.doesNotMatch(slot, /Loading \{inst\.label\}/)
  assert.match(slot, /fallback=\{null\}/)
  assert.match(slot, /'--slot-hold': `\$\{phone\}px`/)
  assert.match(slot, /'--slot-hold-wide': `\$\{wide\}px`/)
  assert.match(slot, /pnext__slot--hold/)
})

test('the body rises once per player and slot', () => {
  assert.match(slot, /useInViewOnce\(`\$\{bio\.id\}:\$\{inst\.key\}`\)/)
  assert.match(slot, /aria-busy="true"/)
})
```

Also keep `test/player-next-sections.test.js` green (it does not check `minH`).

## Verify

- `npm run lint`, `npm test`, `npm run build`.
- `npm run dev`. At 390px and 1180px, open `/player/brice-turang-668930?nointro` and
  `/player/robert-gasser-688107?nointro`.
  - No "Loading Season…" (or any "Loading {label}…") text shows at any time.
  - Scroll down slowly: each card's body rises in (6px up, fade in) the first time it
    comes into view. Scroll back up and down: it does not rise again.
  - Open a slot's link to another page and press Back: the cards do not rise again.
  - Page-height check (Playwright): read `document.documentElement.scrollHeight` at 1s
    and after a full scroll. Before this slice the height grows by thousands of px; after
    it, it grows much less. Report both numbers.
- Load once with `reducedMotion: 'reduce'`: the content shows at once, no rise.
- Send Gary a short frame strip of one card rising (390px), with the route.

## Out of scope

- The modules' own wait text ("Loading the arsenal…" and others): each module owns it
  (module contract). This slice only removes the Slot's text.
- The jump-bar hold and the stamp on land (07b).
- A module that renders `null` while it loads: today `Probe` reads that as "no data".
  Do not change that rule here.
- No `/animation-lab` entry: the rise is slice 01's, and its lab entry is slice 01's.

## Stop if

- Slice 01 is not on `main`, or `useInViewOnce` cannot report "already seen at mount".
- `Slot.jsx` or the `SLOTS` lines differ from the quotes above (another slice changed
  them).
- A module's first render is empty only while it waits and `Probe` now hides it (check:
  every card that showed before still shows on both players).
- The hold never ends for a card (it stays `aria-busy` with content inside): a module
  leaves `aria-busy="true"` on its content. Report the module; do not edit it.
- `check-claude-md` fails on the nested file's size.
