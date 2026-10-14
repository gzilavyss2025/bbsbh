# 20a — Small fixes: game-log rows and the Foul balls count cells

Slice 20 is split in three by file count and by which slice last touched each file:

| Part | Fixes | Files |
|---|---|---|
| **20a** (this file) | game-log rows (hover, focus ring, open row); Foul balls cells 52px | 4 product + 1 test |
| 20b | Season (WAR state, two focus rings); Contract (chevron, hover, marker) | 4 product + 1 test |
| 20c | Similar rows (hover token, focus ring) | 1 product + 1 test |

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **01 merged** (the two row tokens) and **04a merged** (04a edits
  `pitchlog/index.jsx`).
- Parallel with: 20b, 20c, and any slice that does not touch these four files.

## Goal

Make the game-log rows answer the pointer and the keyboard as the canvas rows do,
without turning a row into a button: the whole row tints while the pointer is on its
date door, the whole row draws the focus ring while the door has keyboard focus, and
the game whose detail is open keeps a selected fill. Also make the Foul balls count
cells 52px tall, as the board draws them.

## Done means

- `LogTable` takes an optional `currentKey`; the row with that key carries
  `aria-current="true"`.
- The pitcher log passes `currentKey={open}` (the game in the detail dialog).
- `logtable.css`: a hover tint (`--surface-row-hover`) on a row whose link or button
  is hovered (pointer devices only), the house focus ring on a row that holds the
  keyboard focus, and the selected fill (`--surface-row-selected`) with a 2px stamped
  edge on the current row. The row is still a `<tr>`; only the door acts.
- `fouls.css`: `.fouls__cell` is `min-height: calc(var(--tap-min) + var(--space-2))`
  (52px).
- `test/player-next-rows.test.js` passes; it fails before the change.
- `npm run lint`, `npm test`, `npm run build` are green.

## Files (5)

| File | Change |
|---|---|
| `src/screens/player/next/parts/LogTable.jsx` | `currentKey` prop; `aria-current` on the matching `<tr>` (l.15, l.38). |
| `src/styles/player-next/both/logtable.css` | Three rules after `.logtable__div .mono` (after l.44), before the `@container` at l.49. |
| `src/screens/player/next/modules/pitchlog/index.jsx` | l.207: pass `currentKey={open}`. |
| `src/styles/player-next/batter/fouls.css` | l.76: the cell's `min-height`. |
| `test/player-next-rows.test.js` | **new.** |

`both/` gains no file. `logtable.css` is 127 lines, `fouls.css` 267.

## Canvas

`GameLog` and `BatterGameLog` (the same rules on both):

```
.gl-row{...;border-bottom:1px solid #DED6C0;padding:0 8px;min-height:52px}
.gl-row:hover{background:#F3EBD2}
.gl-row:focus-visible{outline:3px solid #0F1822;outline-offset:-3px}
<button class="gl-row gl-cols" onClick="{{r.pick}}" style="box-shadow:{{r.sh}};background-color:{{r.bg}}">
r.sh = sel === x.i ? 'inset 0 0 0 2px #0F1822' : 'none'
r.bg = sel === x.i ? '#EFE6C8' : 'transparent'
```

Token map: `#F3EBD2` → `--surface-row-hover`, `#EFE6C8` → `--surface-row-selected`
(both added by slice 01), `#0F1822` → `--border-stamped`. The canvas row is a
`<button>`; **the live row stays a `<tr>`** (the brief says do not turn rows into
buttons). So the hover keys on the door inside the row, and the canvas 3px ink ring
becomes the house ring (`--focus-ring` at `--bw-heavy`, spec.md "Focus rings stay the
house ring").

`FoulBalls`: `.fe-cell{...;min-height:52px;border:2px solid #0F1822;margin:-1px;...}`.
52px = `--tap-min` (44px) + `--space-2` (8px).

## Live today

`parts/LogTable.jsx` l.15 and l.38-45:

```jsx
export function LogTable({ columns, rows, caption }) {
...
              <tr key={r.key}>
                {columns.map((c) => (
                  <td key={c.key} className={`logtable__${c.card} ${c.className ?? ''}`.trim()}>
                    {c.card === 'cell' && <span className="logtable__lab">{c.label}</span>}
                    {c.cell ? c.cell(r) : r[c.key]}
                  </td>
                ))}
              </tr>
```

A data row's `key` is the game's `gamePk` (`pitchlog/pitchlogView.js` l.101-102:
`{ ...r, key: r.gamePk }`); a divider row's key is a string (`div-…`, `season-…`).

The live rows: the **pitcher** log's Game cell holds a `Door` with no `href`, which
renders `<button type="button" class="door door--inline pitchlog__open">`
(`pitchlog/index.jsx` l.63-65; `ui/control/Door.jsx` l.27-31). A tap on it opens the
`StartDetail` modal `<dialog>` (`pitchlog/index.jsx` l.177, l.230-246; `open` is the
game's `gamePk`, l.135). The **batter** log's rows hold no link or button (the date
is a `<b>`, `batlog/index.jsx` l.39), so the hover rule below does not fire there,
which is right: nothing in those rows acts.

`pitchlog/index.jsx` l.207:

```jsx
      <LogTable columns={COLUMNS} rows={lines} caption={`Game log, ${span}`} />
```

`logtable.css` l.27-47 (table look; the `@container` card look starts at l.49):

```css
.logtable__grid td {
  padding: var(--space-2);
  border-bottom: var(--bw-hair) solid var(--border-hairline);
  vertical-align: middle;
  font-size: var(--fs-small);
}
...
.logtable__div .mono {
  margin-inline-start: var(--space-2);
  letter-spacing: var(--ls-none);
}
```

No cell in `.logtable` sets a background (`system/table.css` sets one only on
`thead th` and on a sticky first column; `LogTable` passes `frame="bare"` and no
`sticky`), so a background on the `<tr>` shows in both looks.

`fouls.css` l.66-80:

```css
/* layout-exempt: centres the count name over its visit share */
.fouls__cell {
  appearance: none;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: var(--tap-min);
  margin: calc(var(--bw-hair) * -1);
  ...
```

## Build

### 1. `parts/LogTable.jsx`

Add one line to the header comment's prop list, the prop, and the attribute:

```jsx
//   currentKey  the key of the row whose game is open elsewhere (the pitcher log's
//            detail dialog). That row says aria-current="true" and keeps the selected
//            fill. Optional.
export function LogTable({ columns, rows, caption, currentKey }) {
...
              <tr key={r.key} aria-current={currentKey != null && r.key === currentKey ? 'true' : undefined}>
```

### 2. `pitchlog/index.jsx` l.207

```jsx
      <LogTable columns={COLUMNS} rows={lines} caption={`Game log, ${span}`} currentKey={open} />
```

### 3. `logtable.css`, after `.logtable__div .mono` (after l.44), before `@container`

```css
/* A row answers its door (GameLog board). The row is not a button: only the door in
   it acts, so the tint shows while the pointer is on a link or button in the row,
   on pointer devices only, and the row draws the house ring while that control has
   the keyboard focus. The open game's row (aria-current, the detail dialog) keeps the
   selected fill and a stamped edge. The focus rule comes last so its ring wins over
   the selected edge on the same row. */
@media (hover: hover) {
  .logtable__grid tbody tr:not([aria-current='true']):has(:is(a, button):hover) {
    background: var(--surface-row-hover);
  }
}
.logtable__grid tbody tr[aria-current='true'] {
  background: var(--surface-row-selected);
  outline: var(--bw-heavy) solid var(--border-stamped);
  outline-offset: calc(var(--bw-heavy) * -1);
}
.logtable__grid tbody tr:has(:focus-visible) {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: calc(var(--bw-heavy) * -1);
}
```

Why an outline and not the canvas `box-shadow: inset 0 0 0 2px`: a `<tr>` in the
table look is `display: table-row`, and a box-shadow on a table row does not paint
reliably (inferred; Chromium has dropped it on rows with `border-collapse`). An
outline does paint on a row (inferred; check it in the screenshot, and see "Stop if").

Guards:

- `check-focus-ring.mjs` reads only rules whose selector contains `:focus-visible`:
  the third rule, `outline: var(--bw-heavy) solid var(--focus-ring)`, passes. The
  selected rule's outline is not a focus rule, so the guard skips it.
- `check-raw-values.mjs`: no hex, time, radius or shadow.
- The door keeps its own ring (`.door:focus-visible`, `system/door.css` l.57-60).
  spec.md says do not remove a house ring. The row ring is the outer frame.
- No transition and no animation, so no reduced-motion block is needed.

### 4. `fouls.css` l.76

```css
  min-height: calc(var(--tap-min) + var(--space-2));
```

Leave the `layout-exempt` comment on l.66 where it is: the layout ratchet reads the
comment directly before the rule.

## Test first

Create `test/player-next-rows.test.js`; run it and see it fail first.

```js
// Slice 20a (#2073): the game-log rows answer their door (hover, focus, the open game),
// and the Foul balls count cells are 52px, as the canvas draws them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles/player-next', rel)))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('LogTable marks the open game\'s row with aria-current', () => {
  const s = src('screens/player/next/parts/LogTable.jsx')
  assert.match(s, /export function LogTable\(\{ columns, rows, caption, currentKey \}\)/)
  assert.match(s, /aria-current=\{currentKey != null && r\.key === currentKey \? 'true' : undefined\}/)
  assert.doesNotMatch(s, /<button|role="button"/, 'a row is never a button')
})

test('the pitcher log passes the open game as the current row', () => {
  assert.match(src('screens/player/next/modules/pitchlog/index.jsx'), /<LogTable [^>]*currentKey=\{open\}/)
})

test('logtable.css: hover tint, the selected row, and the focus ring', () => {
  const c = css('both/logtable.css')
  assert.match(
    c,
    /@media \(hover: hover\) \{\s*\.logtable__grid tbody tr:not\(\[aria-current='true'\]\):has\(:is\(a, button\):hover\) \{\s*background: var\(--surface-row-hover\);/,
  )
  const sel = ruleBody(c, ".logtable__grid tbody tr[aria-current='true']")
  assert.ok(sel)
  assert.equal(decl(sel, 'background'), 'var(--surface-row-selected)')
  assert.equal(decl(sel, 'outline'), 'var(--bw-heavy) solid var(--border-stamped)')
  const ring = ruleBody(c, '.logtable__grid tbody tr:has(:focus-visible)')
  assert.ok(ring)
  assert.equal(decl(ring, 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.ok(c.indexOf(':has(:focus-visible)') > c.indexOf("tr[aria-current='true'] {"), 'the ring rule comes after the selected rule')
})

test('fouls.css: a count cell is 52px, the tap minimum plus one step', () => {
  const cell = ruleBody(css('batter/fouls.css'), '.fouls__cell')
  assert.equal(decl(cell, 'min-height'), 'calc(var(--tap-min) + var(--space-2))')
})
```

## Verify

1. `node --test test/player-next-rows.test.js test/player-next-pitchlog.test.js test/player-next-batlog.test.js test/player-next-fouls.test.js test/player-next-pfouls.test.js`.
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`, Chromium at 390px (card look) and 1180px (table look), pitcher
   `/player/robert-gasser-688107?nointro`, Game log card:
   - Point at a date: the whole row tints. Point at the logo or a figure: no tint.
   - Tab to a date: the row draws the ring (the door keeps its own ring inside).
   - Open a game, then press Escape: the row of that game is no longer current. Open
     a game and step with Earlier / Later: behind the scrim, the current row moves.
     Take a screenshot with the dialog open and the row visible behind it.
   - Batter `/player/brice-turang-668930?nointro`: the batter log rows do not tint
     (they hold no control). The Foul balls cells are 52px (measure one in DevTools).
4. Send Gary the screenshots with `SendUserFile`, with each route.

## Out of scope

- Making the whole row clickable, or a row `onClick`. Only the door acts.
- The batter log's rows (no control in them; a later issue may add a door).
- The Season, Contract and Similar fixes (20b, 20c).

## Stop if

- 01 is not on `main` (`--surface-row-hover` or `--surface-row-selected` is missing
  from `src/tokens/colors.css`), or 04a is not on `main`.
- The live rows now hold a different control (for example the batter log gained a
  date link): the hover still works, but report it.
- Chromium draws no outline on a `<tr>` in the table look at 1180px: report it with a
  screenshot. Do not switch to a box-shadow on the cells without asking.
- `test/` already has a `player-next-rows.test.js`.
