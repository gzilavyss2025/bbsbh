# Slice 01d: room on the Animation Lab, and the rise entry

Part 4 of 4 of slice 01 (see 01a for the split).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a and 01b merged (the demo wears `.player-rise`, which reads the
  01a tokens).
- Parallel with: 01c, 02a, 02b.

## Goal

1. Make room on `/animation-lab` for the player motion work. `src/screens/AnimationLab.jsx`
   is 597 lines and the cap is 600 (`scripts/check-file-size.mjs`, no budget entry),
   so no later slice can add an `Entry` there. This slice adds one file,
   `src/screens/animlab/PlayerMotionLab.jsx`, that holds every player-motion entry.
   AnimationLab renders it with one line. Later slices (02a on, see spec.md "Rules
   every slice follows") add their entries to PlayerMotionLab.jsx, not to
   AnimationLab.jsx or motionDemos.jsx.
2. Add the first entry: the player rise from slice 01b, live and in a frozen strip.
3. Fix the stamp-in entry's note, which says 360ms. Since slice 01a it is 380ms.

## Done means

- `Frame` lives in `src/screens/animlab/Entry.jsx` and is exported. AnimationLab.jsx
  imports it, and has no local `Frame` and no `Stack` import.
- `src/screens/animlab/PlayerMotionLab.jsx` exports `PlayerMotionLab`, with the rise
  entry. AnimationLab.jsx renders `<PlayerMotionLab />` after the stamp-in entry.
- The frozen strip freezes the rise at the right moment for each tile (the delay
  is additive, as the stamp-in's is).
- The stamp-in note and strip read 380ms.
- `test/animation-lab-player.test.js` passes, and it failed before the change.
- AnimationLab.jsx is under 600 lines (about 585).

## Files

1. `src/screens/animlab/Entry.jsx`: add the exported `Frame` (moved).
2. `src/screens/AnimationLab.jsx`: remove `Frame` and the `Stack` import; import
   `Frame` and `PlayerMotionLab`; render `<PlayerMotionLab />`; fix the 360ms note.
3. `src/screens/animlab/PlayerMotionLab.jsx` (new). `src/screens/animlab/` goes from
   2 to 3 files.
4. `src/styles/46-consent-modal.css`: one rule in the additive freeze list.
5. `test/animation-lab-player.test.js` (new).

## Canvas

The rise (slice 01b): opacity 0 and 6px down, to rest, 420ms on
`cubic-bezier(.2,.9,.3,1)`; rows one stagger step (55ms) apart. In house terms:
`.player-rise` with `--rise-i` 0, 1, 2. The third tile ends at
420 + 2 x 55 = 530ms.

## Live today

`src/screens/AnimationLab.jsx:10` and `:26`:

```jsx
import { Entry } from './animlab/Entry.jsx'
...
import { Stack } from '../components/ui/layout/Stack.jsx'
```

`Stack` has one reader in that file: `Frame`, at `src/screens/AnimationLab.jsx:542-554`:

```jsx
// One frozen frame: pauses whatever animation(s) `children` renders at
// `delayMs` elapsed (via --animlab-delay, see index.css's ANIMATION LAB
// block) — omit delayMs for a frame with nothing to pause (a plain static
// swatch, like the scoreboard digits below).
function Frame({ label, delayMs, children }) {
  const style = delayMs != null ? { '--animlab-delay': `${-delayMs}ms` } : undefined
  return (
    <Stack gap="tight" className="animlab__frame" style={style}>
      <div className="animlab__framebox">{children}</div>
      <span className="animlab__framelabel">{label}</span>
    </Stack>
  )
}
```

The stamp-in entry, `src/screens/AnimationLab.jsx:468-490`:

```jsx
      <Entry
        title="Stamped card — the stamp-in"
        note={
          <>
            The player page&rsquo;s stamped card and stat tile (#1882, styles/motion/stamp-in.css). It
            appears flat in the place of its own shadow, then comes up 4px as the shadow prints, in
            360ms. Off under reduced motion.
          </>
        }
        live={<StampInDemo />}
      >
        <span className="animlab__stagelabel">The stamp-in, 0 → 360ms</span>
        <div className="animlab__frozen">
          {[0, 60, 120, 240, 360].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <StampInDemo />
            </Frame>
          ))}
        </div>
      </Entry>
    </div>
  )
}
```

`src/screens/animlab/Entry.jsx:1-3` already imports `Stack`; `Entry` is its one export
(line 50).

The additive freeze list, `src/styles/46-consent-modal.css:259-263`:

```css
/* The stamp-in (#1882) staggers a row with its own --stamp-delay. */
.animlab__frame .card--stamp-in {
  animation-play-state: paused;
  animation-delay: calc(var(--stamp-delay, 0s) + var(--animlab-delay, 0s));
}
```

`.animlab__breathrow` (`src/styles/46-consent-modal.css:423-429`) is the Lab's flex
row with a `--space-3` gap. The demo reuses it, so no new layout rule is needed.

## Build

### 1. `src/screens/animlab/Entry.jsx`

At the end of the file, add the moved `Frame`, exported, with its comment:

```jsx
// One frozen frame: pauses whatever animation(s) `children` renders at
// `delayMs` elapsed (via --animlab-delay, see the `.animlab__frame` freeze list
// in styles/46-consent-modal.css). Omit delayMs for a frame with nothing to
// pause (a plain static swatch, like the scoreboard digits). Shared by
// AnimationLab.jsx and PlayerMotionLab.jsx.
export function Frame({ label, delayMs, children }) {
  const style = delayMs != null ? { '--animlab-delay': `${-delayMs}ms` } : undefined
  return (
    <Stack gap="tight" className="animlab__frame" style={style}>
      <div className="animlab__framebox">{children}</div>
      <span className="animlab__framelabel">{label}</span>
    </Stack>
  )
}
```

Both exports are components, so `react-refresh` accepts the module.

### 2. `src/screens/AnimationLab.jsx`

- Line 10: `import { Entry, Frame } from './animlab/Entry.jsx'`
- After the `motionDemos.jsx` import (line 25): `import { PlayerMotionLab } from './animlab/PlayerMotionLab.jsx'`
- Delete line 26 (`import { Stack } ...`) and lines 542-555 (the `Frame` block and
  the blank line after it).
- In the stamp-in entry: `360ms. Off under reduced motion.` becomes
  `380ms. Off under reduced motion.`; the label becomes
  `The stamp-in, 0 → 380ms`; the stops become `[0, 60, 120, 240, 380]`.
- After the stamp-in `</Entry>` (line 487), before `</div>` (line 488), add:

```jsx

      <PlayerMotionLab />
```

### 3. `src/screens/animlab/PlayerMotionLab.jsx` (new)

```jsx
import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Entry, Frame } from './Entry.jsx'

// ---------------------------------------------------------------------------
// THE PLAYER PAGE'S MOTION (#2073) on /animation-lab.
//
// Its own file because AnimationLab.jsx is at the 600-line cap
// (scripts/check-file-size.mjs, ADR-0038). Every slice of the player motion work
// adds its entry HERE, not to AnimationLab.jsx. Each demo wears the real class
// names the player page renders; every figure is invented, never a live feed.
//
// A demo whose animation has its own delay needs a matching rule in the
// additive half of the `.animlab__frame` freeze list
// (styles/46-consent-modal.css), or its frozen strip shows the wrong moment.

const RISE_TILES = [
  ['AVG', '.281'],
  ['HR', '18'],
  ['SB', '24'],
]

// Three stat tiles in the shared player rise (styles/motion/player-rise.css),
// one --stagger-step apart, as a row of cards rises on the page.
function RiseDemo() {
  return (
    <div className="animlab__breathrow">
      {RISE_TILES.map(([label, value], i) => (
        <div key={label} className="player-rise" style={{ '--rise-i': i }}>
          <StatTile label={label} value={value} caption="Invented" />
        </div>
      ))}
    </div>
  )
}

export function PlayerMotionLab() {
  return (
    <>
      <Entry
        title="Player page — the rise"
        note={
          <>
            A card or a row on the player page comes up 6px as it fades in, over 420ms on the stamp
            curve, the first time it comes into view (#2073, styles/motion/player-rise.css). A row
            waits one 55ms step per place. Off under reduced motion.
          </>
        }
        live={<RiseDemo />}
      >
        <span className="animlab__stagelabel">The rise, 0 → 530ms</span>
        <div className="animlab__frozen">
          {[0, 110, 210, 320, 420, 530].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <RiseDemo />
            </Frame>
          ))}
        </div>
      </Entry>
    </>
  )
}
```

`StatTile` signature: `src/components/ui/frame/StatTile.jsx:20`
(`{ label, value, caption, rank, tone = 'plain', stampIn = false, className = '', style }`).

### 4. `src/styles/46-consent-modal.css`

After the `.animlab__frame .card--stamp-in` rule (line 263), add:

```css
/* The player rise (#2073) staggers a row with --rise-i steps of its own. */
.animlab__frame .player-rise {
  animation-play-state: paused;
  animation-delay: calc(var(--stagger-step) * var(--rise-i, 0) + var(--animlab-delay, 0s));
}
```

`.animlab__frame .player-rise` (two classes) outweighs `.player-rise` (one class), so
the order of the two sheets does not matter. Every time is a token, so
`check-raw-values.mjs` does not count it.

## Test first

Write `test/animation-lab-player.test.js`. Run it and see it fail. Then build.

```js
// The Animation Lab's room for the player motion work (#2073, slice 01d).
// AnimationLab.jsx is at the 600-line cap, so the player entries live in
// animlab/PlayerMotionLab.jsx, and Frame moved to animlab/Entry.jsx so both
// files share it. Asserted from the source text: node runs no JSX.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ruleBody, stripComments } from './helpers/css.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')
const lab = src('screens/AnimationLab.jsx')

test('Frame lives in Entry.jsx, and AnimationLab imports it', () => {
  assert.match(src('screens/animlab/Entry.jsx'), /export function Frame\(/)
  assert.doesNotMatch(lab, /function Frame\(/)
  assert.match(lab, /import \{ Entry, Frame \} from '\.\/animlab\/Entry\.jsx'/)
})

test('AnimationLab renders the player motion entries from their own file', () => {
  assert.match(lab, /import \{ PlayerMotionLab \} from '\.\/animlab\/PlayerMotionLab\.jsx'/)
  assert.match(lab, /<PlayerMotionLab \/>/)
  assert.ok(lab.split('\n').length < 600, 'AnimationLab.jsx stays under the 600-line cap')
})

test('the stamp-in entry reads 380ms, the token since slice 01a', () => {
  assert.match(lab, /in\s+380ms\. Off under reduced motion\./)
  assert.match(lab, /The stamp-in, 0 → 380ms/)
  assert.match(lab, /\[0, 60, 120, 240, 380\]/)
  // Other entries (the settle, the count fade) keep their own 360ms. Only the
  // stamp-in's three mentions move.
  assert.doesNotMatch(lab, /The stamp-in, 0 → 360ms|\[0, 60, 120, 240, 360\]/)
})

test('the rise demo wears the real class and steps its rows', () => {
  const demo = src('screens/animlab/PlayerMotionLab.jsx')
  assert.match(demo, /className="player-rise"/)
  assert.match(demo, /'--rise-i': i/)
})

test('a frozen rise adds the frame offset to its own stagger', () => {
  const css = stripComments(src('styles/46-consent-modal.css'))
  const body = ruleBody(css, '.animlab__frame .player-rise')
  assert.ok(body, 'the rise is in the freeze list')
  assert.match(body, /animation-play-state:\s*paused;/)
  assert.match(
    body.replace(/\s+/g, ' '),
    /animation-delay: calc\(var\(--stagger-step\) \* var\(--rise-i, 0\) \+ var\(--animlab-delay, 0s\)\);/,
  )
})
```

Note: `ruleBody` matches a selector that starts a line. The new rule starts a line,
so `ruleBody(css, '.animlab__frame .player-rise')` finds it.

## Verify

1. `node --test test/animation-lab-player.test.js`
2. `npm run lint` (check-file-size: AnimationLab.jsx under 600; check-dir-size;
   eslint `no-unused-vars` for the removed `Stack`), `npm test`, `npm run build`.
3. `npm run dev`, then open `/animation-lab?nointro` in the preinstalled Chromium at
   390px and at 1180px. Scroll to "Player page — the rise". The live stage rests on
   its first frame (three tiles not shown). Press Play: the three tiles rise one
   step apart. The frozen strip shows six frames: at 0ms nothing; at 530ms all
   three at rest. Every older entry still freezes (look at three of them: the
   stamp-in, the lineup cascade, the strike).
4. Send Gary a screenshot of the strip with `SendUserFile` and name the route.

## Out of scope

- The rise on any real player card (slice 07 and the module slices).
- Moving other entries out of AnimationLab.jsx.
- `motionDemos.jsx`: no change. Its header says it holds only demo components;
  the player demos live in PlayerMotionLab.jsx instead.

## Stop if

- `src/screens/AnimationLab.jsx` is not 597 lines, or lines 542-554 / 468-490 differ
  from the quotes (another PR changed the Lab; merge `main` and re-measure).
- `Stack` has another reader in AnimationLab.jsx after the move (then keep the import).
- The frozen strip shows every tile at the same moment (the additive rule did not
  win; report the computed `animation-delay` from DevTools).
