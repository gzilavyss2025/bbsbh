# 20c — Small fixes: the Similar rows

Part of slice 20 (split in three; see `20a-small-fixes-log-rows.md` for the table).

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium** (a small slice; low would also do).
- Depends on: **01 merged** (`--surface-row-hover`) and **04b merged** (04b edits
  `similar.css`).
- Parallel with: 20a, 20b.

## Goal

The Similar card's neighbour rows ("Pitches like" / "Hits like") take the canvas row
hover colour and get a keyboard focus ring. Today a row tints to the page paper on
hover and shows no ring at all when it has focus.

## Done means

- `.simp__row:hover` reads `--surface-row-hover`, inside `@media (hover: hover)`.
- `.simp__row:focus-visible` draws the house ring, inset (the row spans the card).
- `test/player-next-similar-rows.test.js` passes; it fails before the change.
- `npm run lint`, `npm test`, `npm run build` are green.

## Files (2)

| File | Change |
|---|---|
| `src/styles/player-next/both/similar.css` | l.46-48: the hover rule, wrapped, plus one focus rule. |
| `test/player-next-similar-rows.test.js` | **new.** |

## Canvas

`SimilarPlayers`:

```
.ll-row{appearance:none;font:inherit;background:transparent;border:0;border-top:1px solid #DED6C0;width:100%;
        text-align:left;cursor:pointer;min-height:44px}
.ll-row:hover{background:#F3EBD2}
.ll-row:focus-visible,.ll-back:focus-visible{outline:3px solid #0F1822;outline-offset:-3px}
```

`#F3EBD2` → `--surface-row-hover` (slice 01). The ring: the house ring at
`--bw-heavy`, inset by one heavy width, as `.firsts__row:focus-visible` does
(`both/firsts.css` l.30-33). The Back button is a `Button` and already has the
`.btn` ring.

## Live today

`similar/index.jsx` l.76-85: each neighbour is a `<button type="button"
className="simp__row">` inside `ul.simp__rows`.

`similar.css` l.30-48:

```css
.simp__row {
  display: grid;
  ...
  min-height: var(--tap-min);
  padding: var(--space-3) var(--space-1);
  border: 0;
  background: transparent;
  ...
  cursor: pointer;
}
.simp__row:hover {
  background: var(--bg-canvas);
}
```

No `:focus-visible` rule for `.simp__row` exists anywhere in `src/styles/`.

## Build

Replace l.46-48 with:

```css
@media (hover: hover) {
  .simp__row:hover {
    background: var(--surface-row-hover);
  }
}
.simp__row:focus-visible {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: calc(var(--bw-heavy) * -1);
}
```

Line numbers move after 04b (it deletes l.159-165 and rewrites the 740px rule, both
below this rule), so l.46-48 should still hold; find the rule by its text.

## Test first

Create `test/player-next-similar-rows.test.js`; run it and see it fail first.

```js
// Slice 20c (#2073): the Similar rows take the canvas row hover and a focus ring.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const c = stripComments(readFileSync(join(SRC, 'styles/player-next/both/similar.css'), 'utf8'))

test('a Similar row tints to the row-hover surface, on pointer devices only', () => {
  assert.match(c, /@media \(hover: hover\) \{\s*\.simp__row:hover \{\s*background: var\(--surface-row-hover\);/)
  assert.doesNotMatch(c, /\.simp__row:hover \{\s*background: var\(--bg-canvas\)/)
})

test('a Similar row draws the house ring when it has keyboard focus', () => {
  const ring = ruleBody(c, '.simp__row:focus-visible')
  assert.ok(ring)
  assert.match(ring, /outline: var\(--bw-heavy\) solid var\(--focus-ring\)/)
  assert.match(ring, /outline-offset: calc\(var\(--bw-heavy\) \* -1\)/)
})
```

## Verify

1. `node --test test/player-next-similar-rows.test.js test/player-next-similar.test.js`.
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`, Chromium at 390px and 1180px, pitcher
   `/player/robert-gasser-688107?nointro` ("Pitches like") and batter
   `/player/brice-turang-668930?nointro` ("Hits like"): point at a row (tint), Tab to
   a row (inset ring). Send Gary a screenshot of each with `SendUserFile`.

## Out of scope

- The Usage / Velocity switch (04b).
- Row motion of any kind.

## Stop if

- 01 or 04b is not on `main`.
- `.simp__row` is no longer a `<button>` (the ring would then need a different host).
- An open PR edits `similar.css`.
