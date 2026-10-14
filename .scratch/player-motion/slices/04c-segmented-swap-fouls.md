# 04c — Swap the player toggles onto `Segmented`: the two Foul balls cards

Part of slice 04 (split in four; the full verdict table for every toggle on the
player page is in `04a-segmented-swap-logs.md`).

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **03a merged**.
- Parallel with: 03b, 04a, 04b. (20a edits `batter/fouls.css`, a different file.)

## Goal

On the batter's Foul balls card and the pitcher's, the "Season stat" `Pill`s and the
pitcher's Regular season / Postseason buttons become joined, filling `Segmented`
rows, as the FoulBalls board draws them (`.fe-tab`). The pitcher card's hand-made
two-column grid and two-line labels go away.

## Done means

- `fouls/FoulsCard.jsx`: the Season stat row is `<Segmented label="Season stat" fill>`.
- `pfouls/index.jsx`: the scope row is `<Segmented label="Part of season"
  className="pfouls__scope" fill>` with the games as the count ("41 G"), and the
  Season stat row is `<Segmented label="Season stat" fill>`.
- `pfouls.css`: `.pfouls__scope` keeps only its `margin-bottom`; `.pfouls__opt` and
  `.pfouls__g` are gone.
- Unused imports are gone (`Cluster`, `Pill` in FoulsCard; `Button`, `Cluster`,
  `Pill` in pfouls).
- `test/segmented-swap-fouls.test.js` passes; it fails before the change.
- `npm run lint`, `npm test`, `npm run build` are green.

## Files (4)

| File | Change |
|---|---|
| `src/screens/player/next/modules/fouls/FoulsCard.jsx` | l.50-56 → `Segmented`; drop the `Cluster` (l.5) and `Pill` (l.6) imports. |
| `src/screens/player/next/modules/pfouls/index.jsx` | l.74-85 and l.95-101 → two `Segmented`s; drop the `Cluster` (l.11), `Button` (l.12) and `Pill` (l.14) imports. |
| `src/styles/player-next/pitcher/pfouls.css` | l.4-19: the scope grid and the two-line label → one margin rule. |
| `test/segmented-swap-fouls.test.js` | **new.** |

`pitcher/` holds 7 files; this adds none. `pfouls.css` is 70 lines.

## Canvas

`FoulBalls`:

```
.fe-tab{flex:1 1 0;min-height:44px;padding:0 6px;border:2px solid #0F1822;margin-left:-2px;
        display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
.fe-tab:first-child{margin-left:0}
<button class="fe-tab fe-cap" aria-pressed="{{m.on}}" style="background:{{m.bg}};color:{{m.fg}}">{{m.label}}</button>
m.bg = mi === i ? INK : '#FBF6E9' ; m.fg = mi === i ? CREAM : INK
```

So the metric tabs fill (`fill`). The canvas pads them `0 6px`; Segmented pads
`0 var(--space-3h)` for every use. Do not override the padding here; if a label does
not fit at 390px, see "Stop if".

## Live today

`fouls/FoulsCard.jsx` l.35, l.42 and l.48-56:

```jsx
  const [metric, setMetric] = useState(0)
  ...
  const m = view.baseline[Math.min(metric, view.baseline.length - 1)]
  ...
        <Stack gap="snug" className="fouls__base">
          <span className="fouls__cap">Season baseline</span>
          <Cluster gap="tight" role="group" aria-label="Season stat">
            {view.baseline.map((b, i) => (
              <Pill key={b.key} role="control" fill="paper" pressed={b === m} onClick={() => setMetric(i)}>
                {b.label}
              </Pill>
            ))}
          </Cluster>
```

`pfouls/index.jsx` l.30, l.45-46, l.71 and l.74-101:

```jsx
const SCOPES = [['R', 'Regular season'], ['P', 'Postseason']]
  ...
  const [picked, setPicked] = useState(null)
  const [metric, setMetric] = useState(0)
  ...
  const m = view.baseline[metric]
  return (
    <div className={`fouls pfouls${view.thin ? ' pfouls--thin' : ''}`}>
      {lines.R && lines.P && (
        <div role="group" aria-label="Part of season" className="pfouls__scope">
          {SCOPES.map(([k, label]) => (
            <Button key={k} size="control" pressed={k === scope} onClick={() => setPicked(k)}>
              <span className="pfouls__opt">
                {label}
                <span className="pfouls__g">{lines[k].g} G</span>
              </span>
            </Button>
          ))}
        </div>
      )}
      ...
          <Cluster gap="tight" role="group" aria-label="Season stat">
            {view.baseline.map((b, i) => (
              <Pill key={b.key} role="control" fill="paper" pressed={i === metric} onClick={() => setMetric(i)}>
                {b.label}
              </Pill>
            ))}
          </Cluster>
```

`pfouls.css` l.4-19:

```css
/* layout-exempt: two equal scope buttons across the card */
.pfouls__scope {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
/* layout-exempt: the scope's name over its game count */
.pfouls__opt {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.pfouls__g {
  font-family: var(--font-mono);
  font-size: var(--fs-small);
}
```

## Build

Add `import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'`
to both JSX files. Write `label` as the first prop (the test reads it).

`fouls/FoulsCard.jsx`, replace l.50-56. The value is the clamped index, the same one
`m` uses, so the pressed button always matches the figures shown:

```jsx
          <Segmented
            label="Season stat"
            fill
            value={Math.min(metric, view.baseline.length - 1)}
            onChange={setMetric}
            options={view.baseline.map((b, i) => ({ value: i, label: b.label }))}
          />
```

`pfouls/index.jsx`, replace l.74-85:

```jsx
      {lines.R && lines.P && (
        <Segmented
          label="Part of season"
          className="pfouls__scope"
          fill
          value={scope}
          onChange={setPicked}
          options={SCOPES.map(([k, label]) => ({ value: k, label, count: `${lines[k].g} G` }))}
        />
      )}
```

and l.95-101:

```jsx
          <Segmented
            label="Season stat"
            fill
            value={metric}
            onChange={setMetric}
            options={view.baseline.map((b, i) => ({ value: i, label: b.label }))}
          />
```

The count used to sit under the label (a column); now it sits after it, in the
Segmented count style. That is the canvas shape (`.gl-fbtn` label then count).

`pfouls.css`, replace l.4-19 with:

```css
/* The Regular season / Postseason row (a Segmented): its place on the card. */
.pfouls__scope {
  margin-bottom: var(--space-4);
}
```

Guards: the two deleted rules carried `layout-exempt` markers, so the layout ratchet
did not count them and no budget moves. If `npm run lint` says a count in
`scripts/layout/layout-ratchet-budget.json` fell for `pfouls.css`, lower it in the
same commit, as the message says.

## Test first

Create `test/segmented-swap-fouls.test.js`; run it and see it fail first.

```js
// Slice 04c (#2073): the Foul balls cards' toggles are the joined Segmented control.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"
const FOULS = 'screens/player/next/modules/fouls/FoulsCard.jsx'
const PFOULS = 'screens/player/next/modules/pfouls/index.jsx'

test('batter fouls: the Season stat row is a filling Segmented on the clamped index', () => {
  const s = src(FOULS)
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Season stat"\s+fill\b/)
  assert.match(s, /value=\{Math\.min\(metric, view\.baseline\.length - 1\)\}/)
  assert.doesNotMatch(s, /<Pill\b|(?<![-\w])pressed=\{/)
})

test('pitcher fouls: scope and Season stat are filling Segmenteds; the games ride as the count', () => {
  const s = src(PFOULS)
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Part of season"\s+className="pfouls__scope"\s+fill\b/)
  assert.match(s, /count: `\$\{lines\[k\]\.g\} G`/)
  assert.match(s, /<Segmented\s+label="Season stat"\s+fill\b/)
  assert.doesNotMatch(s, /<Pill\b|<Button\b|(?<![-\w])pressed=\{|pfouls__opt|pfouls__g/)
})

test('pfouls.css: the scope keeps its margin and loses the grid and the two-line label', () => {
  const c = stripComments(src('styles/player-next/pitcher/pfouls.css'))
  const scope = ruleBody(c, '.pfouls__scope')
  assert.ok(scope)
  assert.match(scope, /margin-bottom:\s*var\(--space-4\)/)
  assert.doesNotMatch(scope, /display|grid/)
  assert.equal(ruleBody(c, '.pfouls__opt'), null)
  assert.equal(ruleBody(c, '.pfouls__g'), null)
})
```

## Verify

1. `node --test test/segmented-swap-fouls.test.js test/player-next-fouls.test.js test/player-next-pfouls.test.js`.
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`, Chromium at 390px and 1180px:
   - Batter `/player/brice-turang-668930?nointro`, Foul balls card: the Season stat
     row is joined and fills; a tap changes the figures and the rail below.
   - Pitcher `/player/robert-gasser-688107?nointro`, Foul balls card: the same row.
     The Regular season / Postseason row shows only when he has both lines
     (`lines.R && lines.P`). If he has no postseason line, say so in the PR.
4. Send Gary the screenshots with `SendUserFile`, with each route.

## Out of scope

- The count grid cells (`.fouls__cell`, 52px: slice 20a).
- `batter/fouls.css` (no change needed here).
- Every other card (see the verdict table in 04a).

## Stop if

- 03a is not on `main`, or `Segmented` takes no `className`.
- The quoted blocks differ in shape from the files.
- An open PR edits `FoulsCard.jsx`, `pfouls/index.jsx` or `pfouls.css`.
- At 390px a Season stat label does not fit and the row wraps or clips: report the
  labels and the widths. Do not shrink the type or override the Segmented padding
  in a module sheet.
