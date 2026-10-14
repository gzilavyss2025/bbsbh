# 20b — Small fixes: Season (WAR state, focus rings) and Contract (the history fold)

Part of slice 20 (split in three; see `20a-small-fixes-log-rows.md` for the table).

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **01 merged** (`--ease-stamp`) and **04a merged** (04a edits
  `season/index.jsx`).
- Parallel with: 20a, 20c, and any slice that does not touch these four files.

## Goal

Three small state fixes the canvas draws and the live cards miss:

1. **Season.** The WAR button says when its dialog is open (`aria-expanded`) and
   keeps its tint while it is; the "All columns" link and the dialog's × get a focus
   ring (today they have none: there is no global `:focus-visible` rule,
   `04-site-bar.css` l.308).
2. **Contract.** The "Salary history" fold gets the canvas chevron, which turns
   180° when the fold opens (`--dur-fast` on `--ease-stamp`), a hover on the closed
   bar, and no browser disclosure marker.

## Done means

- `season/index.jsx`: `YearTable` takes `openKey`; the WAR button carries
  `aria-expanded={openKey === r.key}`; the caller passes `openKey={open?.key}`.
- `season.css`: `.seasonmod__war[aria-expanded='true']` joins the tint rule;
  `.seasonmod__link:focus-visible` and `.seasonmod__x:focus-visible` draw the house
  ring (the × sits on the ink head, so it takes the band ring colour).
- `contract/index.jsx`: the summary holds the sub line and an inline SVG chevron in
  one end group.
- `contract.css`: the marker is hidden, the end group is a row, the chevron turns on
  `[open]` with a transition, the closed bar has a hover, and a reduced-motion block
  turns the transition off.
- `test/player-next-season-contract-states.test.js` passes; it fails before the change.
- `npm run lint`, `npm test`, `npm run build` are green.

## Files (5)

| File | Change |
|---|---|
| `src/screens/player/next/modules/season/index.jsx` | l.91-98 (caller), l.108 (signature), l.129-137 (WAR button). |
| `src/styles/player-next/both/season.css` | l.51-54 (tint rule); two focus rules after `.seasonmod__link` (l.62-76) and `.seasonmod__x` (l.99-109). |
| `src/screens/player/next/modules/contract/index.jsx` | l.101-104 (the `<summary>`). |
| `src/styles/player-next/both/contract.css` | Rules after `.cnext__hist[open] > summary` (l.217-220) and `.cnext__histsub` (l.228-231). |
| `test/player-next-season-contract-states.test.js` | **new.** |

`both/` gains no file. `season.css` is 140 lines, `contract.css` 279.

## Canvas

`SeasonStats`:

```
<button class="ss-war ss-m" type="button" aria-haspopup="dialog" aria-expanded="{{c.open}}" ...>
.ss-war:hover,.ss-war[aria-expanded="true"]{background:#DDE7CF}
.ss-war:focus-visible,.ss-x:focus-visible,.ss-link:focus-visible{outline:3px solid #0F1822;outline-offset:2px}
.ss-x{...;color:#F1E7CC;...}   (the × on the ink head)
```

`#DDE7CF` → `--surface-stamped-tint` (already used by `.seasonmod__war:hover`).
The ring: the house ring, not the canvas 3px ink (spec.md).

`Contract`:

```
<button class="ct-acc" aria-expanded="{{c.open}}" style="background-color:{{c.accBg}};color:{{c.accFg}}">
  <span class="ct-cap" style="font-size:18px">Salary history</span>
  <span style="display:inline-flex;align-items:center;gap:10px">
    <span class="ct-m" style="font-size:11px">{{c.accRight}}</span>
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="transform:{{c.chev}}">
      <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"></path></svg>
  </span></button>
c.chev = open ? 'rotate(180deg)' : 'none' ; c.accBg = open ? INK : PAPER
.ct-acc:hover{filter:brightness(.97)}
```

The canvas sets no transition on the chevron; the brief asks for one at
`--dur-fast` on `--ease-stamp` (the house curve for a stamp-like move). 10px gap →
`--space-2h`. The canvas hover darkens paper by 3%: use `--surface-inset`, the step
`.btn` uses for the same job, on the closed bar only.

## Live today

`season/index.jsx` l.91-98 and l.108:

```jsx
        <YearTable
          table={table}
          label={`${role === 'pitching' ? 'Pitching' : 'Batting'} by year, ${scopes.find((s) => s.id === scope).label}`}
          allCols={allCols}
          onAllCols={() => setAllCols(!allCols)}
          note={scope !== 'post' && scope !== 'milb'}
          onCompare={setOpen}
        />
...
function YearTable({ table, label, allCols, onAllCols, note, onCompare }) {
```

`open` (l.27) holds the table row the dialog shows (`setOpen(r)` via `onCompare`), so
`open.key` is that row's `key`. l.129-137:

```jsx
              <button
                key="war"
                type="button"
                className="seasonmod__war"
                aria-haspopup="dialog"
                aria-label={`WAR ${c}, ${r.year}. Compare with the league`}
                onClick={() => onCompare(r)}
              >
```

`season.css` l.50-54 (comment says "the tint on hover and while its dialog is open",
but no rule does the second part):

```css
/* The WAR figure is a button: dotted rule under it, the tint on hover and while its dialog is open. */
...
.seasonmod__war:hover,
.seasonmod__war:focus-visible {
  background: var(--surface-stamped-tint);
}
```

`.seasonmod__link` (l.62-76) and `.seasonmod__x` (l.99-109, on `.seasonmod__pophead`,
which is `--surface-stamped-ink`) have no `:focus-visible` rule.

`contract/index.jsx` l.98-104:

```jsx
function History({ past }) {
  return (
    <details className="cnext__hist">
      <summary>
        <span className="cnext__histname">Salary history</span>
        <span className="cnext__histsub">{past.total} · {past.seasons} {past.seasons === 1 ? 'season' : 'seasons'}</span>
      </summary>
```

`contract.css` l.202-220:

```css
.cnext__hist > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: var(--space-12);
  padding: 0 var(--space-3);
  background: var(--surface-card);
  border: var(--bw-heavy) solid var(--border-stamped);
  cursor: pointer;
}
.cnext__hist > summary:focus-visible {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: var(--bw-heavy);
}
.cnext__hist[open] > summary {
  background: var(--surface-stamped-ink);
  color: var(--text-on-ink);
}
```

The summary is `display: flex`, so Chromium draws no marker today, but Safari still
draws `::-webkit-details-marker`.

## Build

### 1. `season/index.jsx`

```jsx
        <YearTable
          ...
          onCompare={setOpen}
          openKey={open?.key}
        />
...
function YearTable({ table, label, allCols, onAllCols, note, onCompare, openKey }) {
...
              <button
                key="war"
                type="button"
                className="seasonmod__war"
                aria-haspopup="dialog"
                aria-expanded={openKey === r.key}
                aria-label={`WAR ${c}, ${r.year}. Compare with the league`}
                onClick={() => onCompare(r)}
              >
```

### 2. `season.css`

Replace l.51-54:

```css
.seasonmod__war:hover,
.seasonmod__war:focus-visible,
.seasonmod__war[aria-expanded='true'] {
  background: var(--surface-stamped-tint);
}
```

After the `.seasonmod__link` rule:

```css
.seasonmod__link:focus-visible {
  outline: var(--bw-heavy) solid var(--focus-ring);
  outline-offset: var(--bw-heavy);
}
```

After the `.seasonmod__x` rule (the × is on the ink head: the band colour, inside the
head so the ring does not spill onto the dialog body):

```css
.seasonmod__x:focus-visible {
  outline: var(--bw-heavy) solid var(--focus-ring-band);
  outline-offset: calc(var(--bw-heavy) * -1);
}
```

`check-focus-ring.mjs` accepts `var(--focus-ring)` and `var(--focus-ring-band)` in an
outline (`src/styles/situational-records/66a-detail.css` l.248-251 is the same band
form).

### 3. `contract/index.jsx` l.101-104

```jsx
      <summary>
        <span className="cnext__histname">Salary history</span>
        <span className="cnext__histend">
          <span className="cnext__histsub">{past.total} · {past.seasons} {past.seasons === 1 ? 'season' : 'seasons'}</span>
          <svg className="cnext__chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
          </svg>
        </span>
      </summary>
```

### 4. `contract.css`

Add `list-style: none;` to `.cnext__hist > summary` (l.202-212). Then, after
`.cnext__hist[open] > summary` (l.217-220):

```css
.cnext__hist > summary::-webkit-details-marker {
  display: none;
}
@media (hover: hover) {
  .cnext__hist:not([open]) > summary:hover {
    background: var(--surface-inset);
  }
}
```

After `.cnext__histsub` (l.228-231):

```css
.cnext__histend {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2h);
}
.cnext__chev {
  flex: none;
  transition: transform var(--dur-fast) var(--ease-stamp);
}
.cnext__hist[open] .cnext__chev {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .cnext__chev {
    transition: none;
  }
}
```

Guards: `check-raw-values.mjs` counts no time here (both are tokens) and no radius;
`rotate(180deg)` is a transform, not a counted kind. `layout/check-layout-ratchet`
counts column, wrap and grid only: `inline-flex` is none of those. The ink bar's
chevron takes `currentColor`, so it is paper on ink when open and ink on paper when
closed, with no colour rule.

## Test first

Create `test/player-next-season-contract-states.test.js`; run it and see it fail
first.

```js
// Slice 20b (#2073): the Season WAR button says when its dialog is open, the Season
// link and × have focus rings, and the Contract history fold has a turning chevron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles/player-next/both', rel)))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('season: the WAR button carries aria-expanded for its open dialog', () => {
  const s = src('screens/player/next/modules/season/index.jsx')
  assert.match(s, /openKey=\{open\?\.key\}/)
  assert.match(s, /function YearTable\(\{[^}]*openKey \}\)/)
  assert.match(s, /aria-expanded=\{openKey === r\.key\}/)
})

test('season.css: the open WAR keeps the tint; the link and the × have rings', () => {
  const c = css('season.css')
  assert.match(c, /\.seasonmod__war\[aria-expanded='true'\] \{\s*background: var\(--surface-stamped-tint\);/)
  assert.equal(decl(ruleBody(c, '.seasonmod__link:focus-visible') ?? '', 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
  assert.equal(decl(ruleBody(c, '.seasonmod__x:focus-visible') ?? '', 'outline'), 'var(--bw-heavy) solid var(--focus-ring-band)')
})

test('contract: the summary holds the chevron after the sub line', () => {
  const s = src('screens/player/next/modules/contract/index.jsx')
  assert.match(s, /<span className="cnext__histend">\s*<span className="cnext__histsub">/)
  assert.match(s, /<svg className="cnext__chev"[^>]*aria-hidden="true">\s*<path d="M2 5l5 5 5-5"/)
})

test('contract.css: no marker, a turning chevron on the stamp curve, a hover, reduced motion', () => {
  const c = css('contract.css')
  assert.equal(decl(ruleBody(c, '.cnext__hist > summary'), 'list-style'), 'none')
  assert.equal(decl(ruleBody(c, '.cnext__hist > summary::-webkit-details-marker'), 'display'), 'none')
  assert.equal(decl(ruleBody(c, '.cnext__chev'), 'transition'), 'transform var(--dur-fast) var(--ease-stamp)')
  assert.equal(decl(ruleBody(c, '.cnext__hist[open] .cnext__chev'), 'transform'), 'rotate(180deg)')
  assert.match(c, /\.cnext__hist:not\(\[open\]\) > summary:hover \{\s*background: var\(--surface-inset\);/)
  assert.match(c, /@media \(prefers-reduced-motion: reduce\) \{\s*\.cnext__chev \{\s*transition: none;/)
})
```

`ruleBody(c, '.cnext__chev')` finds the first `.cnext__chev {` at the start of a line,
which is the base rule (the `[open]` and media rules have other text before it on
their line, or are indented). Keep that order.

## Verify

1. `node --test test/player-next-season-contract-states.test.js test/player-next-season.test.js test/player-next-contract.test.js`.
2. `npm run lint`, `npm test`, `npm run build`.
3. `npm run dev`, Chromium at 390px and 1180px, batter
   `/player/brice-turang-668930?nointro`:
   - Season card: tap a WAR figure. Behind the scrim the figure keeps its tint. Tab
     to the × (it gets focus on open): a paper ring on the ink head. Close it; Tab to
     "All columns": the ring shows.
   - Contract card: the Salary history bar shows the chevron at the right; point at
     it (tint); tap: the bar goes ink and the chevron turns over 120ms. Take a short
     frame strip of the turn.
   - With reduced motion on (Playwright `reducedMotion: 'reduce'`), the chevron is
     turned at once.
   If Turang's card has no salary history, use any player whose Contract card shows
   "Salary history" and say which.
4. Send Gary the screenshots and the frame strip with `SendUserFile`, with the routes.

## Out of scope

- The Compare dialog's content and its focus handling (it already focuses the ×).
- A ring on `.seasonmod__war` (it already shows focus with its tint; spec.md: add a
  ring only where a control has none).
- Any other Contract change.

## Stop if

- 01 is not on `main` (`--ease-stamp` missing from `src/tokens/effects.css`) or 04a is
  not on `main`.
- The table rows have no `key`, or two rows share one (then `aria-expanded` would mark
  two buttons): report it.
- The `History` markup or the `.cnext__hist` rules differ in shape from the quotes.
- An open PR edits one of the four product files.
