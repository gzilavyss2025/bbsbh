# 08b — Splits: Game lines rise, fold cascade, chevron, hover, press, lab entry

The second half of slice 08 (`spec.md`). 08a added `Part`, the rise, the bar grow
and the fill glide. 08b puts Game lines on `Part`, cascades the rows of a fold the
reader opens, turns the fold chevron, adds the canvas hover and press, and adds the
`/animation-lab` entry.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 08a merged (and so 01a and 01c), 01d merged
  (`src/screens/animlab/PlayerMotionLab.jsx`).
- Parallel with: 02, 03, 05, 06, 07. Not with 09 (same module folder).
- Shares append-only lines with other slices: `src/screens/animlab/PlayerMotionLab.jsx` (entries). The run plan may put
  those slices in one wave. Before you push, merge `main` in, and keep both sides
  of any conflict in those lines.

## Goal

Game lines rises on view like the other parts. When the reader opens a fold (by
month, by weekday, ...), its rows rise one after the next and their bars grow. The
fold chevron turns instead of jumping. Doors, folds and clubs answer a pointer
hover with the canvas colours, a club press shrinks the club a little, and the picked
club prints with the canvas offset shadow.

## Done means

- Game lines is a `Part` (key `<playerId>:splits-<group>:g`), so it rises and its
  bars grow the first time it comes into view.
- A fold the reader taps open shows its rows with a rise, row `i` after
  `i * --stagger-step`, and each row's bar grows after `--dur-fast + i * --stagger-step`.
  The month fold that is open on load does not cascade.
- The fold chevron turns 90° over `--dur-med` on `--ease-out`.
- Under `(hover: hover) and (pointer: fine)` only: a door hover is
  `--surface-inset`, a fold hover is `--border-hairline`, a club hover is
  `--bg-canvas`, a picked club keeps `--surface-inset` on hover.
- A club press is `scale(0.97)` over `--dur-fast` on `--ease-stamp`. A door press
  is `--bg-canvas`.
- The picked club (`aria-pressed='true'`) carries
  `box-shadow: var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)`, the canvas's
  2px offset shadow in ink (added after the plan review of #2073; Gary, 2026-10-14).
- Reduced motion: no cascade, no chevron turn, no press scale.
- `/animation-lab` has a Splits entry with the real classes, in
  `src/screens/animlab/PlayerMotionLab.jsx`.
- `test/player-splits-motion.test.js` and `npm run lint` pass. CI runs the full
  `npm test` and `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/splits/GameLines.jsx` — root onto `Part`; row
   index; the tapped-fold cascade.
2. `src/screens/player/next/modules/splits/parts.css` — chevron turn, cascade,
   hover, press, reduced motion (191 lines today; about 55 added).
3. `test/player-splits-motion.test.js` — add cases (08a made the file).
4. `src/screens/animlab/PlayerMotionLab.jsx` (01d) — `SplitsRiseDemo` and its `Entry`.

Not `motionDemos.jsx`, not `AnimationLab.jsx`: 01d moved every player-motion entry to
`PlayerMotionLab.jsx`, because `AnimationLab.jsx` is at the 600-line cap.
`PlayerMotionLab.jsx` is shared with other slices (05c, 10, 12c, 17a): merge `main`
in before you push, and add your entry after the ones already there.

## Canvas

Boards `Splits` and `PitcherSplits`:

```css
.appear{animation:rise .8s cubic-bezier(.23,1,.32,1) both}
.part.in .fill,.appear .fill{animation:grow .75s cubic-bezier(.23,1,.32,1) backwards}
.door:active{background:#F6EFDC}
.fchev{display:flex;transition:transform .2s ease-out}
.fold[aria-expanded="true"] .fchev{transform:rotate(90deg)}
.club{...;transition:transform .12s ease-out}
.club:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){
.door:hover{background:#FFFDF6}
.fold:hover{background:#DED6C0}
.club:hover{background:#F6EFDC}
.club[aria-pressed="true"]:hover{background:#FFFDF6}}
.club[aria-pressed="true"]{border-color:#0F1822;background:#FFFDF6;box-shadow:2px 2px 0 #0F1822}
@media (prefers-reduced-motion:reduce){
.part.in,.appear,.part.in .fill,.appear .fill{animation:none !important}
.fill,.segbtn,.resetbtn,.door,.fold,.fchev,.club{transition:none !important}}
```

A fold row (board JS): `cls: 'door t-s dr' + (sub ? ' sub appear' : ''), style: sub ? 'animation-delay:' + (i * 55) + 'ms' : ''`,
and its fill `animation-delay: (120 + i * 55)ms`.

Value map (`spec.md` colour map):

| Canvas | Token |
|---|---|
| `#FFFDF6` door hover, picked club hover | `--surface-inset` |
| `#DED6C0` fold hover | `--border-hairline` |
| `#F6EFDC` club hover, door press | `--bg-canvas` |
| `.8s` rise | `calc(var(--dur-rise) * 2)` (as 08a) |
| `.2s ease-out` chevron | `var(--dur-med) var(--ease-out)` (220ms) |
| `.12s ease-out` club press | `var(--dur-fast) var(--ease-stamp)` (new player motion uses `--ease-stamp`) |
| `#0F1822` picked club shadow colour | `--border-stamped` (as the MenuRail picked card, `spec.md`) |
| `2px 2px 0` picked club shadow offset | `var(--bw-heavy) var(--bw-heavy) 0` (`--bw-heavy` is 2px) |

The press stays the canvas `scale(.97)`. Decision 1 (the stamp-press) is for
`Button` and `Pill`; a club is a plain `<button>`, so it keeps the canvas scale press.
Its resting offset shadow shows only on the picked club, as on the canvas. The shadow
does not move on press: the canvas gives `.club:active` only the scale.

## Live today

`GameLines.jsx:15` — `const [folds, setFolds] = useState({ month: true })`.

`GameLines.jsx:47-58` — a stat door (the list door at `:31-45` has no `Cells`):

```jsx
      <BoxLinesDoor
        key={line.key}
        className={`splitsmod__door${sub ? ' is-sub' : ''}`}
        label={`${line.label}: ${doorLine(line.row, labels.get(line.key), group)}`}
        face={
          <span className={`splitsmod__grid splitsmod__grid--${layout} is-dr`}>
            <Cells quiet line={line} layout={layout} />
            <Chevron />
          </span>
        }
        sheet={sheetFor(line.row)}
      />
```

`GameLines.jsx:29` `const door = (line, sub) =>`. `:63` the root
`<section className="splitsmod__part splitsmod__part--wide" aria-label="Game lines">`,
closed at `:101`. `:69` `{s.items.map((item) =>`. `:72-77` the fold button and its
`onClick={() => setFolds({ ...folds, [item.fold.key]: !folds[item.fold.key] })}`.
`:88`:

```jsx
                {folds[item.fold.key] && item.fold.lines.map((l) => door(l, true))}
```

`BoxLinesDoor` (`src/components/boxlines/BoxLinesDoor.jsx:35`) takes `className`
but no `style`, so a door cannot carry its own `--i`. Each fold row gets a wrapper
`<div>` that carries the class and `--i`.

`parts.css:16-33` `.splitsmod__club { ... cursor: pointer; scroll-snap-align: center; }` (no
transition). The picked club, `parts.css:38-41`, has a border and a fill and no shadow:

```css
.splitsmod__club[aria-pressed='true'] {
  border-color: var(--border-stamped);
  background: var(--surface-inset);
}
```

`parts.css:150-158`:

```css
.splitsmod__foldchev {
  display: flex;
  justify-content: center;
  font-size: var(--fs-title-sm);
  line-height: var(--lh-solid);
}
.splitsmod__fold[aria-expanded='true'] .splitsmod__foldchev {
  transform: rotate(90deg);
}
```

`src/styles/boxlines/boxlines.css:339-372`: `.boxlines__door` resets `background:
none`, draws an outline on hover (pointer only) and `background: var(--surface-inset)`
on `:active`. It loads after the host's sheet, so the host's door rules here use
`.splitsmod__door.boxlines__door` (three classes) to win on specificity, not order.
Keep the boxlines hover outline; this slice adds only the background.

**Guard gap.** `parts.css` sits in the module folder, not under `src/styles/`, so
`check-raw-values.mjs`, `check-typography.mjs` and `check-focus-ring.mjs` do not
read it. The test below checks it for raw times and hex instead.

`src/screens/AnimationLab.jsx` is 597 lines (cap 600). Slice 01d added
`src/screens/animlab/PlayerMotionLab.jsx` for every player-motion entry.

## Build

### 1. `GameLines.jsx`

Import `Part`: `import { Cells, Chevron, Flag, Head, Part, Row } from './LineRows.jsx'`.

Add the tapped-fold state under `folds` (line 15):

```jsx
  // The folds the reader opened with a tap. Only those cascade: the month fold is open on load,
  // and its rows are not a change the reader made (docs/motion.md, "The one-shot gate").
  const [tapped, setTapped] = useState({})
```

`door` takes the row index and passes it to `Cells`:

```jsx
  const door = (line, sub, i = 0) =>
  ...
            <Cells quiet line={line} layout={layout} i={i} />
```

Import `viewKey` from `../../../../../lib/motion/inViewOnce.js` (slice 01c). The root
becomes `<Part once={viewKey(bio.id, `splits-${group}:g`)} wide label="Game lines">`
and `</section>` (line 101) becomes `</Part>`.

The items map takes an index: `{s.items.map((item, n) =>`, and the plain door is
`door(item, false, n + 1)`.

The fold button's click marks the fold as tapped:

```jsx
                  onClick={() => {
                    setFolds({ ...folds, [item.fold.key]: !folds[item.fold.key] })
                    setTapped({ ...tapped, [item.fold.key]: true })
                  }}
```

Line 88 becomes:

```jsx
                {folds[item.fold.key] &&
                  item.fold.lines.map((l, i) => (
                    <div key={l.key} className={tapped[item.fold.key] ? 'splitsmod__appear' : undefined} style={{ '--i': i }}>
                      {door(l, true, i)}
                    </div>
                  ))}
```

Closing a fold unmounts its rows, so each open replays the cascade. That is right:
each open is a tap.

### 2. `parts.css`

Add `transition` to the existing `.splitsmod__club` rule (line 16), after
`scroll-snap-align: center;`:

```css
  transition: transform var(--dur-fast) var(--ease-stamp);
```

Add `transition` to the existing `.splitsmod__foldchev` rule (line 150):

```css
  transition: transform var(--dur-med) var(--ease-out);
```

Add the shadow to the existing picked-club rule (`parts.css:38-41`), after `background`:

```css
  box-shadow: var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped);
```

The strip scrolls sideways (`overflow-x: auto`, `parts.css:7-15`), and an overflow box
clips a shadow at its edge. The strip's padding (`var(--space-1h)` at the sides,
`var(--space-2)` below) is wider than the 2px offset, so nothing is clipped. Do not
change the padding.

Add after `.splitsmod__chipfig.is-thin { ... }` (line 64):

```css
.splitsmod__club:active {
  transform: scale(0.97);
}
```

Append at the end of the file:

```css
/* ---- motion: the fold cascade, hover and press (board Splits) ----
   A fold the reader opens (GameLines.jsx) wraps each row in .splitsmod__appear with the row's
   --i: the row rises one --stagger-step after the last, and its bar grows. The keyframes are
   splits.css's splitsmod-rise and splitsmod-grow. Hover is for a fine pointer only: on a phone
   :hover sticks where the last tap was. */
.splitsmod__appear {
  animation: splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) calc(var(--stagger-step) * var(--i, 0)) backwards;
}
.splitsmod__appear .splitsmod__fill {
  animation: splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards;
}
.splitsmod__door.boxlines__door:active {
  background: var(--bg-canvas);
}
@media (hover: hover) and (pointer: fine) {
  .splitsmod__door.boxlines__door:hover {
    background: var(--surface-inset);
  }
  .splitsmod__fold:hover {
    background: var(--border-hairline);
  }
  .splitsmod__club:hover {
    background: var(--bg-canvas);
  }
  .splitsmod__club[aria-pressed='true']:hover {
    background: var(--surface-inset);
  }
}
@media (prefers-reduced-motion: reduce) {
  .splitsmod__appear,
  .splitsmod__appear .splitsmod__fill {
    animation: none;
  }
  .splitsmod__club,
  .splitsmod__foldchev {
    transition: none;
  }
}
```

### 3. `PlayerMotionLab.jsx` (the demo)

In `src/screens/animlab/PlayerMotionLab.jsx` (01d), add at the top with the other
imports:

```jsx
import '../../styles/player-next/both/splits.css'
import '../player/next/modules/splits/parts.css'
import { Row } from '../player/next/modules/splits/LineRows.jsx'
```

Add the demo above `export function PlayerMotionLab()` (invented figures, never a
game). Do not export it: the file exports only `PlayerMotionLab`. The demo does not
use `Part`:
`useInViewOnce` remembers a key for the page visit, so Play could not replay it.
It sets `is-in` itself.

```jsx
// The Splits card's entrance (board Splits): a part rises and its bars grow, one row after the
// next. The real rows of LineRows.jsx with invented figures; `is-in` is set at once, so Play replays.
const DEMO_SPLITS = [
  { key: 'b', label: 'Season', count: 412, avg: '.262', rest: '/.331/.428', ops: '.759', delta: 'base', hr: 14, k: '19%', bb: '9%', fill: { kind: 'base', scale: 0.63 }, tick: 63 },
  { key: 'l', label: 'vs LHP', count: 118, avg: '.281', rest: '/.350/.470', ops: '.820', delta: '+.061', hr: 5, k: '17%', bb: '10%', fill: { kind: 'pos', scale: 0.68 }, tick: 63 },
  { key: 'r', label: 'vs RHP', count: 294, avg: '.254', rest: '/.323/.411', ops: '.734', delta: '-.025', hr: 9, k: '20%', bb: '9%', fill: { kind: 'neg', scale: 0.61 }, tick: 63 },
]
function SplitsRiseDemo() {
  return (
    <div className="splitsmod">
      <section className="splitsmod__part is-in" aria-label="By handedness, invented">
        {DEMO_SPLITS.map((l, i) => (
          <Row key={l.key} base={i === 0} i={i} line={l} layout="slash" />
        ))}
      </section>
    </div>
  )
}
```

### 4. The lab entry

Add this `Entry` inside the fragment that `PlayerMotionLab` returns, after the
entries already there:

```jsx
      <Entry
        title="Splits — a part rises, its bars grow"
        note={
          <>
            The player page&rsquo;s Splits card (board Splits). A part rises 14px as it first comes
            into view, then each bar grows from the left, one row after the next. A fold the reader
            opens runs the same rise on its rows. Off under reduced motion.
          </>
        }
        live={<SplitsRiseDemo />}
      />
```

No frozen strip, so no rule in the `.animlab__frame` freeze list of
`src/styles/46-consent-modal.css` (01d: only a frozen strip needs one). Do not touch
`AnimationLab.jsx` or `motionDemos.jsx`. Do not raise the file-size cap.

### Guards

- `parts.css` is outside the CSS guards (see Live today); the test covers it.
- `check-file-size.mjs`: `parts.css` 191 → about 250; `GameLines.jsx` 103 → about
  115; `PlayerMotionLab.jsx` grows by about 35 lines.
- `check-dir-size.mjs`: no new source file under `src/`.
- `PlayerMotionLab.jsx` exports components only (react-refresh); `DEMO_SPLITS` and
  `SplitsRiseDemo` stay module-private.

## Test first

Add to `test/player-splits-motion.test.js` (08a made it; reuse its `read`, `decl`,
`MOD`, `stripComments` and `ruleBody`). Run it before the change and see the new
cases fail.

```js
const parts = stripComments(read(`${MOD}parts.css`))

test('a fold the reader opens cascades its rows, and their bars grow', () => {
  assert.equal(
    decl(ruleBody(parts, '.splitsmod__appear'), 'animation'),
    'splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) calc(var(--stagger-step) * var(--i, 0)) backwards',
  )
  assert.equal(
    decl(ruleBody(parts, '.splitsmod__appear .splitsmod__fill'), 'animation'),
    'splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards',
  )
  const gl = read(`${MOD}GameLines.jsx`)
  assert.match(gl, /tapped\[item\.fold\.key\] \? 'splitsmod__appear' : undefined/)
  assert.match(gl, /style=\{\{ '--i': i \}\}/)
  assert.match(gl, /<Part once=\{viewKey\(bio\.id, `splits-\$\{group\}:g`\)\}/)
})

test('the fold chevron turns, and a club press shrinks the club', () => {
  assert.equal(decl(ruleBody(parts, '.splitsmod__foldchev'), 'transition'), 'transform var(--dur-med) var(--ease-out)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club'), 'transition'), 'transform var(--dur-fast) var(--ease-stamp)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club:active'), 'transform'), 'scale(0.97)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__door.boxlines__door:active'), 'background'), 'var(--bg-canvas)')
})

test('the picked club prints with the canvas offset shadow', () => {
  const body = ruleBody(parts, ".splitsmod__club[aria-pressed='true']")
  assert.ok(body)
  assert.equal(decl(body, 'box-shadow'), 'var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club') ?? '', 'box-shadow'), undefined, 'an unpicked club has no shadow')
})

test('hover colours, for a fine pointer only', () => {
  const at = parts.indexOf('@media (hover: hover) and (pointer: fine)')
  assert.ok(at > -1)
  const block = parts.slice(at, parts.indexOf('@media (prefers-reduced-motion: reduce)', at))
  assert.match(block, /\.splitsmod__door\.boxlines__door:hover\s*\{\s*background:\s*var\(--surface-inset\)/)
  assert.match(block, /\.splitsmod__fold:hover\s*\{\s*background:\s*var\(--border-hairline\)/)
  assert.match(block, /\.splitsmod__club:hover\s*\{\s*background:\s*var\(--bg-canvas\)/)
  assert.match(block, /\.splitsmod__club\[aria-pressed='true'\]:hover\s*\{\s*background:\s*var\(--surface-inset\)/)
})

test('parts.css: reduced motion stops the cascade and the turns', () => {
  const block = parts.slice(parts.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.splitsmod__appear,\s*\.splitsmod__appear \.splitsmod__fill\s*\{\s*animation:\s*none/)
  assert.match(block, /\.splitsmod__club,\s*\.splitsmod__foldchev\s*\{\s*transition:\s*none/)
})

// parts.css is outside src/styles/, so check-raw-values.mjs never reads it.
test('parts.css: no raw time and no hex', () => {
  for (const m of parts.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    assert.doesNotMatch(m[1].replace(/var\([^)]*\)/g, ''), /\d(?:ms|s)\b/, m[0])
  }
  assert.doesNotMatch(parts, /#[0-9a-f]{3,8}\b/i)
})
```

## Verify

1. `node --test test/player-splits-motion.test.js` and `npm run lint`. Do not run
   the full `npm test` or `npm run build`: CI runs them on your PR.
2. `npm run dev`, batter `/player/brice-turang-668930?nointro`, at 390px and at
   1180px. Scroll to Game lines: it rises and its bars grow. Open "Show more", then
   open the weekday fold: its rows rise one after the next. Close and open it: it
   cascades again. The month fold that is open on load does not cascade.
3. At 1180px with a mouse: hover a door, a fold and a club; check the colours.
   Press a club: it shrinks a little. The fold chevron turns. Pick a club: it shows a
   2px ink shadow down and to the right; pick the first and the last club in the strip
   and check that the shadow is not clipped at the strip's edge.
4. Pitcher `/player/robert-gasser-688107?nointro`: pick "Game lines" in the menu;
   the same.
5. `/animation-lab?nointro`: press Play on the Splits entry.
6. Load once with Playwright `reducedMotion: 'reduce'`: a fold opens at once, with
   no cascade.
7. Send Gary a frame strip of the fold cascade (`SendUserFile`) with the route.

## Out of scope

- The pitcher menu, the rail and the section open (09).
- The Scope `Button`s, Reset and Show more: their press is slice 02.
- A frozen strip for the lab entry (`46-consent-modal.css`).
- Any change to `BoxLinesDoor` or `boxlines.css`.

## Stop if

- 08a is not merged: `Part` is not in `LineRows.jsx`, or `splitsmod-rise` /
  `splitsmod-grow` are not in `splits.css`.
- The quoted code at `GameLines.jsx:29`, `:47-58`, `:63`, `:88` or `parts.css:16-33`,
  `:150-158` differs from this brief.
- `src/screens/animlab/PlayerMotionLab.jsx` does not exist (01d not merged). Do not
  add the entry to `AnimationLab.jsx`.
- An open PR touches `src/screens/player/next/modules/splits/`.
