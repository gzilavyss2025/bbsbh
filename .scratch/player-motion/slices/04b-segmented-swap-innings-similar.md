# 04b — Swap the player toggles onto `Segmented`: Innings by position, Similar

Part of slice 04 (split in four; the full verdict table for every toggle on the
player page is in `04a-segmented-swap-logs.md`).

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **03a merged**.
- Parallel with: 03b, 04a, 04c. Not with 20c: it edits `similar.css` after this lands.

## Goal

The Innings-by-position scope (Season / MLB career) and the Similar card's
Usage / Velocity switch become one joined 44px `Segmented` row that fills its width,
as the canvas draws them. Their hand-written flex rules go away.

## Done means

- `innings/index.jsx` and `similar/index.jsx` render `<Segmented fill>` with the
  caller's class on the group (`pnext-inn__scope`, `simp__switch`).
- `innings.css` keeps the box rule for `.pnext-inn__scope` (width, max-width,
  centring) and loses the child flex rule.
- `similar.css` loses `.simp__switch { display: flex }` and `.simp__switch .btn`, and
  its 740px rule targets the Segmented buttons (they stop filling at that width, as
  the canvas does).
- `test/segmented-swap-innings-similar.test.js` passes; it fails before the change.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (5)

| File | Change |
|---|---|
| `src/screens/player/next/modules/innings/index.jsx` | l.151-157: `Cluster` + `Button`s → `Segmented`. Drop the `Button` (l.10) and `Cluster` (l.11) imports. |
| `src/styles/player-next/both/innings.css` | Delete l.8-10 (`.pnext-inn__scope > *`). |
| `src/screens/player/next/modules/similar/index.jsx` | l.138-146: the `div` + `Button`s → `Segmented`. `Button` stays (the Back button). |
| `src/styles/player-next/both/similar.css` | Delete l.159-165; rewrite l.290-293. |
| `test/segmented-swap-innings-similar.test.js` | **new.** |

`both/` gains no file (spec.md calls it full; it holds 11 today, one under the cap).
`innings.css` is 140 lines and `similar.css` is 294: no size risk.

## Canvas

`InningsByPosition`:

```
<div role="group" aria-label="Scope" style="display: flex">
.ib-sb{min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;flex:1 1 0;...}
```

`SimilarPlayers`:

```
.ll-seg{display:flex}
.ll-segb{...;min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;flex:1}
@container (min-width:640px){.ll-segb{flex:none;min-width:120px}}
```

So both fill (`fill`), and Similar stops filling at its wide step. The live card uses
the page's 740px media step for that already (`similar.css` l.274); keep it.

## Live today

`innings/index.jsx` l.150-157:

```jsx
    <Stack gap="snug">
      {scopes.length > 1 && (
        <Cluster className="pnext-inn__scope" role="group" aria-label="Scope">
          {scopes.map((s) => (
            <Button key={s.key} size="control" pressed={scope === s.key} onClick={() => pick(s.key)}>{s.label}</Button>
          ))}
        </Cluster>
      )}
```

`scopes = scopeOptions(bio)` (l.102) is `[{ key, label }]`; `pick(key)` (l.139) sets
the scope and loads it. `Button` and `Cluster` are used nowhere else in the file.

`innings.css` l.3-10:

```css
.pnext-inn__scope {
  width: 100%;
  max-width: 460px;
  margin-inline: auto;
}
.pnext-inn__scope > * {
  flex: 1 1 0;
}
```

`similar/index.jsx` l.138-146 (inside `Focus`):

```jsx
      {sections.length > 1 && (
        <div className="simp__switch" role="group" aria-label="What the dots show">
          {sections.map((s) => (
            <Button key={s.key} size="tap" pressed={s.key === sec.key} onClick={() => setMode(s.key)}>
              {s.title}
            </Button>
          ))}
        </div>
      )}
```

`similar.css` l.159-165 and l.290-293:

```css
/* layout-exempt: two joined buttons */
.simp__switch {
  display: flex;
}
.simp__switch .btn {
  flex: 1;
}
...
  .simp__switch .btn {          /* inside @media (min-width: 740px), l.274 */
    flex: none;
    min-width: 7.5rem;
  }
```

## Build

`innings/index.jsx`: add the import, drop `Button` and `Cluster`, and replace
l.151-157 (keep `label` as the first prop; the test reads it):

```jsx
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
...
      {scopes.length > 1 && (
        <Segmented
          label="Scope"
          className="pnext-inn__scope"
          fill
          value={scope}
          onChange={pick}
          options={scopes.map((s) => ({ value: s.key, label: s.label }))}
        />
      )}
```

`innings.css`: delete the `.pnext-inn__scope > *` rule (l.8-10). Keep the
`.pnext-inn__scope` box rule as it is. (`.segmented` is `display: flex`, so the box
rule's width and centring still apply to the group.)

`similar/index.jsx`: add the import; replace l.138-146:

```jsx
      {sections.length > 1 && (
        <Segmented
          label="What the dots show"
          className="simp__switch"
          fill
          value={sec.key}
          onChange={setMode}
          options={sections.map((s) => ({ value: s.key, label: s.title }))}
        />
      )}
```

`similar.css`: delete l.159-165 (the marker comment, `.simp__switch`, and
`.simp__switch .btn`). Replace the rule at l.290-293 with:

```css
  .simp__switch.segmented--fill > .segmented__btn {
    flex: none;
    min-width: 7.5rem;
  }
```

Three classes, so it out-ranks `.segmented--fill > .segmented__btn` (two) whatever
order the module sheet loads in. `7.5rem` is the width the rule has today; the
typography and raw-value guards do not count `min-width`.

Guards: `layout/check-layout-ratchet.mjs` counts only column, wrap and grid rules.
The deleted `.simp__switch` rule was `display: flex` with a marker, so no budget in
`scripts/layout/layout-ratchet-budget.json` moves. Run `npm run lint` to confirm; if
the ratchet says a count fell, lower that budget in the same commit.

## Test first

Create `test/segmented-swap-innings-similar.test.js`; run it and see it fail first.

```js
// Slice 04b (#2073): the Innings-by-position scope and the Similar card's Usage /
// Velocity switch are the joined Segmented control, filling the row.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(rel))
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"

test('innings: the scope is a filling Segmented with its box class', () => {
  const s = src('screens/player/next/modules/innings/index.jsx')
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="Scope"\s+className="pnext-inn__scope"\s+fill\b/)
  assert.doesNotMatch(s, /(?<![-\w])pressed=\{/)
  assert.doesNotMatch(s, /import \{ (Button|Cluster) \}/)
})

test('innings.css keeps the box and drops the child flex rule', () => {
  const c = css('styles/player-next/both/innings.css')
  assert.ok(ruleBody(c, '.pnext-inn__scope'), 'the box rule stays')
  assert.equal(ruleBody(c, '.pnext-inn__scope > *'), null)
})

test('similar: Usage / Velocity is a filling Segmented', () => {
  const s = src('screens/player/next/modules/similar/index.jsx')
  assert.ok(s.includes(IMPORT))
  assert.match(s, /<Segmented\s+label="What the dots show"\s+className="simp__switch"\s+fill\b/)
  assert.doesNotMatch(s, /(?<![-\w])pressed=\{/)
})

test('similar.css: no hand-drawn switch; the wide step stops the fill', () => {
  const c = css('styles/player-next/both/similar.css')
  assert.equal(ruleBody(c, '.simp__switch'), null)
  assert.doesNotMatch(c, /\.simp__switch \.btn/)
  // The rule sits inside @media (min-width: 740px), indented, so ruleBody (which needs a
  // newline or brace right before the selector) cannot find it: match the text instead.
  assert.match(c, /\.simp__switch\.segmented--fill > \.segmented__btn \{[^}]*flex:\s*none/)
})
```

## Verify

1. `node --test test/segmented-swap-innings-similar.test.js`.
2. `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
3. `npm run dev`, Chromium, 390px and 1180px:
   - Batter `/player/brice-turang-668930?nointro`: the Innings by position card's
     Season / MLB career row is joined, fills up to 460px and is centred; a tap
     loads the other scope.
   - Pitcher `/player/robert-gasser-688107?nointro`: on the Similar card ("Pitches
     like"), tap a neighbour; the Usage / Velocity row fills the card at 390px and
     sits at its natural width (each button at least 7.5rem) at 1180px.
4. Send Gary the screenshots with `SendUserFile`, with each route.

## Out of scope

- The Similar rows' hover and focus ring (slice 20c).
- Any other card (see the verdict table in 04a).

## Stop if

- 03a is not on `main`, or `Segmented` takes no `className`.
- The quoted blocks differ in shape from the files.
- An open PR edits one of the four product files.
- At 390px the Innings row wraps onto two lines: report the label widths; do not
  shrink the type.
