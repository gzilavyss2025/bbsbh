# 04d — Swap the player toggles onto `Segmented`: On the mound

Part of slice 04 (split in four; the full verdict table for every toggle on the
player page is in `04a-segmented-swap-logs.md`). This part is on its own because
slice 10 owns the mound files and runs first.

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **03a merged and 10 merged** (10 edits `mound/index.jsx` and
  `pitcher/mound.css`; spec.md's rule is one slice at a time on a shared file).
- Parallel with: anything that does not touch the mound files.

## Goal

The On-the-mound card's Starter / Bullpen tabs become one joined 44px `Segmented`
row, as the MoundCard board draws them (`.mc-btn`), and the `.mound__tabs` flex rule
with its gap goes away.

## Done means

- `mound/index.jsx` renders `<Segmented label="How the card reads">` where the
  `div.mound__tabs` was. No `fill` (the board does not fill).
- `mound.css` has no `.mound__tabs` rule.
- The `Button` import is gone if nothing else in the file uses it.
- `test/segmented-swap-mound.test.js` passes; it fails before the change.
- `npm run lint`, `npm test`, `npm run build` are green.

## Files (3)

| File | Change |
|---|---|
| `src/screens/player/next/modules/mound/index.jsx` | l.38-46: the tab row → `Segmented`; drop the `Button` import (l.5) if unused. |
| `src/styles/player-next/pitcher/mound.css` | Delete l.25-28 (`.mound__tabs`). |
| `test/segmented-swap-mound.test.js` | **new.** |

## Canvas

`MoundCard`:

```
.mc-btn{min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;display:inline-flex;
        align-items:center;font-size:14px;font-weight:700}
.mc-btn:first-child{margin-left:0}
<button class="mc-btn mc-cap" type="button" aria-pressed ...>
```

## Live today (on `95bdd6fb`; slice 10 may move the line numbers)

`mound/index.jsx` l.10 and l.36-47:

```jsx
const TAB_LABEL = { starter: 'Starter', bullpen: 'Bullpen' }
...
    <div className="mound">
      <div className="mound__top">
        {view.tabs.length > 1 && (
          <div role="group" aria-label="How the card reads" className="mound__tabs">
            {view.tabs.map((t) => (
              <Button key={t} size="control" pressed={t === tab} onClick={() => setPicked(t)}>
                {TAB_LABEL[t]}
              </Button>
            ))}
          </div>
        )}
        {view.roleWord !== TAB_LABEL[tab] && <span className="mound__role">{view.roleWord}</span>}
      </div>
```

`Button` is used nowhere else in the file today.

`mound.css` l.18-28:

```css
.mound__top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
}
.mound__tabs {
  display: flex;
  gap: var(--space-2);
}
```

The `.mound__tabs` gap would split the joined buttons, so the rule must go.

## Build

`mound/index.jsx`: add
`import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'`,
remove the `Button` import if nothing else uses it after slice 10, and replace the
tab row (keep `label` first; the test reads it):

```jsx
        {view.tabs.length > 1 && (
          <Segmented
            label="How the card reads"
            value={tab}
            onChange={setPicked}
            options={view.tabs.map((t) => ({ value: t, label: TAB_LABEL[t] }))}
          />
        )}
```

`mound.css`: delete the `.mound__tabs` rule. Keep `.mound__top`. The layout ratchet
counts only column, wrap and grid; `.mound__tabs` was none of those, so no budget
moves.

## Test first

Create `test/segmented-swap-mound.test.js`; run it and see it fail first.

```js
// Slice 04d (#2073): the On-the-mound Starter / Bullpen tabs are the joined Segmented control.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('mound: the tabs are a Segmented, not a row of Buttons', () => {
  const s = src('screens/player/next/modules/mound/index.jsx')
  assert.ok(s.includes("import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"))
  assert.match(s, /<Segmented\s+label="How the card reads"/)
  assert.doesNotMatch(s, /mound__tabs|(?<![-\w])pressed=\{/)
})

test('mound.css: no gap rule splits the joined tabs', () => {
  assert.equal(ruleBody(stripComments(src('styles/player-next/pitcher/mound.css')), '.mound__tabs'), null)
})
```

## Verify

1. `node --test test/segmented-swap-mound.test.js test/player-next-mound.test.js`.
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`, Chromium at 390px and 1180px, pitcher
   `/player/robert-gasser-688107?nointro`, On the mound card. The tabs show only
   when the card has two views (`view.tabs.length > 1`). If Gasser has one, say so
   and check on a pitcher who both started and relieved this season.
4. Check that slice 10's motion (track draw, bar grow) still plays after a tab tap.
5. Send Gary the screenshots with `SendUserFile`, with the route.

## Out of scope

- Anything slice 10 does on this card.

## Stop if

- 03a or 10 is not on `main`.
- Slice 10 changed the tab row (for example, made it its own component or added
  motion to it): report what it did; do not merge the two by hand.
- An open PR edits `mound/index.jsx` or `mound.css`.
