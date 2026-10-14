# 08a — Splits: rise on view, bars grow, fills glide, club strip scroll

Slice 08 of `spec.md` is split in two to keep each slice at 5 files. 08a is the
entrance (the parts and their bars). 08b is the fold cascade, the hover, the press,
the fold chevron and the `/animation-lab` entry.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 01a merged (tokens `--ease-unfold`, `--dur-rise`, `--dur-grow`,
  `--stagger-step`), 01c merged (the `useInViewOnce` hook).
- Parallel with: 02, 03, 05, 06, 07, 10. Not with 08b or 09 (same module folder).

## Goal

On `/player/{id}` the Splits card's parts (By handedness, Situational, Splits vs
team) rise the first time each comes into view in this page visit, and their bars
grow from almost zero, one row after the next. A bar whose value changes in place
glides to the new length. The club strip scrolls smoothly to a club the reader
picks, and jumps at once on mount.

## Done means

- Each part is invisible until it is 10% in view (01c's fixed threshold). Then it rises 14px and fades in
  over `calc(var(--dur-rise) * 2)` on `--ease-unfold`.
- In a part that rises, each bar grows from `scaleX(0.02)` to its value over
  `--dur-grow`, row `i` after `--dur-fast + i * --stagger-step`.
- A part seen earlier in this page visit (Back, a re-mount, a pitcher who closes
  and opens a section again) shows at once, with no rise and no grow.
- Reduced motion: every part and bar shows at once, drawn.
- A tap on a club scrolls the strip smoothly. The first centre on mount is instant.
- Game lines does not change in 08a (08b moves it onto `Part`).
- `test/player-splits-motion.test.js` and `npm run lint` pass. CI runs the full
  `npm test` and `npm run build` on the PR.

## Files

1. `src/screens/player/next/modules/splits/LineRows.jsx` — add `Part`; add an `i`
   prop to `Row`, `Cells`, `Bar`; put `--i` on the fill.
2. `src/screens/player/next/modules/splits/index.jsx` — the two inline sections
   become `Part`; pass `i` to rows.
3. `src/screens/player/next/modules/splits/VsTeam.jsx` — root becomes `Part`; the
   strip scroll becomes smooth on change.
4. `src/styles/player-next/both/splits.css` — the motion block (462 lines today;
   about 50 lines added).
5. `test/player-splits-motion.test.js` — new.

## Canvas

Boards `Splits` and `PitcherSplits` (the same rules on both):

```css
.part.pre{opacity:0}
.part.in{animation:rise .8s cubic-bezier(.23,1,.32,1) both}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes grow{from{transform:scaleX(.02)}}
.fill{...;transform-origin:left center;transition:transform .75s cubic-bezier(.23,1,.32,1)}
.part.in .fill,.appear .fill{animation:grow .75s cubic-bezier(.23,1,.32,1) backwards}
@media (prefers-reduced-motion:reduce){
.part.pre{opacity:1}
.part.in,.appear,.part.in .fill,.appear .fill{animation:none !important}
.fill,...{transition:none !important}}
```

Per row (board JS): `fillStyle: 'transform:scaleX(' + v + ');animation-delay:' + (120 + i * 55) + 'ms'`.

The board's observer: `IntersectionObserver(..., { threshold: 0.08 })`, one per
part (`p1`..`p4`), each unobserved after its first hit; a 2500ms fallback shows
all parts if the observer never fires. Slice 01c's `useInViewOnce` replaces this, at
its fixed threshold of 0.1 (not 0.08) and with no timer fallback.

Club strip: `center(smooth)` calls `s.scrollTo({ left: b.offsetLeft - s.clientWidth / 2 + b.clientWidth / 2, behavior: smooth && !reducedMotion ? 'smooth' : 'auto' })`.
It runs with `smooth = false` on mount and `smooth = true` when the club changes.

Value map:

| Canvas | Token |
|---|---|
| `.8s` rise | `calc(var(--dur-rise) * 2)` (840ms; no 800ms token, and `--dur-rise` is the rise) |
| `cubic-bezier(.23,1,.32,1)` | `var(--ease-unfold)` |
| `.75s` grow and glide | `var(--dur-grow)` |
| `120ms` grow lead | `var(--dur-fast)` |
| `55ms` per row | `var(--stagger-step)` |
| `14px` rise | `var(--space-3h)` |

The rise uses `backwards`, not `both`: once `is-pre` goes, the rest state is the
natural state, and `both` would hold a `transform` on the part for no gain.

## Live today

`src/screens/player/next/modules/splits/LineRows.jsx:46-51` — the fill takes its
length inline; no motion:

```jsx
function Bar({ line, metric }) {
  const figure = metric === 'era' ? line.era : line.ops
  return (
    <span className="splitsmod__ops">
      <span className={`splitsmod__track${line.none ? ' is-none' : ''}`}>
        {line.fill && <span className={`splitsmod__fill is-${line.fill.kind}`} style={{ transform: `scaleX(${line.fill.scale})` }} />}
```

`LineRows.jsx:63` `export function Cells({ line, layout, quiet }) {`, and the two
`<Bar line={line} metric="era" />` / `<Bar line={line} metric="ops" />` calls at
`:80` and `:91`. `LineRows.jsx:101-107`:

```jsx
export function Row({ line, layout, base, dr }) {
  return (
    <div className={`splitsmod__row splitsmod__grid splitsmod__grid--${layout}${dr ? ' is-dr' : ''}${base ? ' is-base' : ''}`}>
      <Cells line={line} layout={layout} />
    </div>
  )
}
```

`index.jsx:140-173` — two inline parts:

```jsx
        {show('h') && (
          <section className="splitsmod__part" aria-label="By handedness">
            ...
                <Row base line={hand.base} layout="slash" />
                {hand.rows.map((l) => <Row key={l.key} line={l} layout="slash" />)}
        ...
        {show('s') && (
          <section className="splitsmod__part" aria-label="Situational">
            ...
                {sit.base && <Row base line={sit.base} layout="slash" />}
                {sit.groups.filter((g) => sitAll || g.family === 'base').map((g) => (
                  <div key={g.family}>
                    <p className="splitsmod__fam">{g.title}</p>
                    {g.rows.map((l) => <Row key={l.key} line={l} layout="slash" />)}
```

`VsTeam.jsx:20-25` — the centre is always instant:

```jsx
  // Keep the picked club centred in the strip, scrolling the strip itself and not the page.
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (strip && btn) strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2 })
  }, [pick])
```

`VsTeam.jsx:40` — `<section className="splitsmod__part splitsmod__part--wide" aria-label="Splits vs team">`,
closed at `:107`. `VsTeam.jsx:78` — the door face calls `<Cells quiet line={line} layout={layout} />`.

`splits.css:338-342`:

```css
.splitsmod__fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
}
```

Why the grow must wait for view: `Slot` mounts the module once it is within 600px
of the viewport (`hooks/scroll/useNearView.js`). A grow that starts on mount ends
before the reader gets there.

A note on data: `useAsync` drops its data when its deps change
(`src/hooks/useAsync.js:68-72`). So a season or scope change remounts the rows
("Loading…" in between), and in a part that already rose the new rows grow again.
That is a change the reader caused, so it may replay (`spec.md`, one-shot rule). The
`transition` on `.splitsmod__fill` still covers a fill that changes in place.
Do not change `useAsync` or keep old rows during a load (Out of scope).

## Build

### 0. The slice 01c hook (merged; 01c is the source of truth)

`src/hooks/scroll/useInViewOnce.js` exports `useInViewOnce(key)` and returns
`[ref, phase]`. There is no options argument; the threshold is fixed at 0.1
(`IN_VIEW_THRESHOLD`). `phase` is:

- `'wait'`: not yet in view, not seen before. Hold the part hidden (`is-pre`).
- `'play'`: it came into view; play (`is-in`). It stays `'play'` after.
- `'rest'`: seen earlier in this page visit, reduced motion, or no
  IntersectionObserver. Rest drawn (no class).

`viewKey(playerId, slotKey)` in `src/lib/motion/inViewOnce.js` builds the key. The
hook already returns `'rest'` under reduced motion, so `Part` does not read
`motionIsReduced`. There is no timer fallback: the caller must put `ref` on a mounted
element (the `<section>`), or the part stays at opacity 0.

### 1. `LineRows.jsx`

Add the import at the top:

```jsx
import { useInViewOnce } from '../../../../../hooks/scroll/useInViewOnce.js'
```

Add `Part` after the `DASH` line:

```jsx
// One of the card's parts. It rises the first time it comes into view in this page visit, and
// its bars grow then (docs/motion.md, "The one-shot gate"). A part seen earlier, or under reduced
// motion, rests drawn. `once` is the key the hook remembers: `<playerId>:splits-<group>:<part>`.
export function Part({ once, wide, label, children }) {
  const [ref, phase] = useInViewOnce(once)
  const motion = phase === 'wait' ? ' is-pre' : phase === 'play' ? ' is-in' : ''
  return (
    <section ref={ref} className={`splitsmod__part${wide ? ' splitsmod__part--wide' : ''}${motion}`} aria-label={label}>
      {children}
    </section>
  )
}
```

`Bar` takes `i` and puts it on the fill as `--i`:

```jsx
function Bar({ line, metric, i = 0 }) {
  ...
        {line.fill && <span className={`splitsmod__fill is-${line.fill.kind}`} style={{ transform: `scaleX(${line.fill.scale})`, '--i': i }} />}
```

`Cells({ line, layout, quiet, i = 0 })` passes `i` to both `<Bar ... i={i} />`.
`Row({ line, layout, base, dr, i = 0 })` passes it: `<Cells line={line} layout={layout} i={i} />`.

### 2. `index.jsx`

Import `Part` with the rows: `import { Flag, Head, Part, Row } from './LineRows.jsx'`,
and `import { viewKey } from '../../../../../lib/motion/inViewOnce.js'`.
Add one key prefix after `const surname = ...` (line 23):

```jsx
  const once = viewKey(bio.id, `splits-${group}`)
```

Replace the two `<section className="splitsmod__part" aria-label="...">` opens and
their `</section>` closes:

```jsx
        {show('h') && (
          <Part once={`${once}:h`} label="By handedness">
            ...
                <Row base line={hand.base} layout="slash" />
                {hand.rows.map((l, i) => <Row key={l.key} i={i + 1} line={l} layout="slash" />)}
            ...
          </Part>
        )}
        {show('s') && (
          <Part once={`${once}:s`} label="Situational">
            ...
                    {g.rows.map((l, i) => <Row key={l.key} i={i + 1} line={l} layout="slash" />)}
            ...
          </Part>
        )}
```

The base row keeps `i` at its default 0. The stagger restarts in each family. That
is simpler than one count across the families, and it reads the same.

### 3. `VsTeam.jsx`

Import `Part` with the rows, `viewKey` from `lib/motion/inViewOnce.js`, and
`motionIsReduced` from `hooks/preferences/motionIsReduced.js`. Replace lines 20-25:

```jsx
  // Keep the picked club centred in the strip, scrolling the strip itself and not the page. The
  // first centre is instant; a club the reader picks glides there (board Splits, center()).
  const centred = useRef(pick)
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    const glide = centred.current !== pick && !motionIsReduced()
    centred.current = pick
    if (strip && btn) strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2, behavior: glide ? 'smooth' : 'auto' })
  }, [pick])
```

Compare `pick` with a ref, not a "first run" flag: React's StrictMode runs the
effect twice on mount in dev, and a flag would make the second run smooth. The ref
is read and written only inside the effect, never during render (the react-hooks
7.1.1 `refs` rule). The effect sets no state.

Replace the root `<section className="splitsmod__part splitsmod__part--wide" aria-label="Splits vs team">`
with `<Part once={viewKey(bio.id, `splits-${group}:v`)} wide label="Splits vs team">`
and its `</section>` with `</Part>`. The door face (`:78`) becomes
`<Cells quiet line={line} layout={layout} i={1} />`. The base row (`:70`) keeps `i` 0.

### 4. `splits.css`

Add `transition` to the existing `.splitsmod__fill` rule (line 338):

```css
.splitsmod__fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  transition: transform var(--dur-grow) var(--ease-unfold);
}
```

Add this block after `.splitsmod__none, .splitsmod__part .hint { ... }` (line 211),
before "the rows":

```css
/* ---- the entrance (board Splits: .part.pre, .part.in, grow) ----
   Part (LineRows.jsx) sets .is-pre until the part is first in view in this page visit, then
   .is-in. A part seen earlier, or under reduced motion, gets neither and rests drawn. Each bar
   grows after --dur-fast plus one --stagger-step per row; Bar sets the row's --i. */
.splitsmod__part.is-pre {
  opacity: 0;
}
.splitsmod__part.is-in {
  animation: splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) backwards;
}
.splitsmod__part.is-in .splitsmod__fill {
  animation: splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards;
}
@keyframes splitsmod-rise {
  from {
    opacity: 0;
    transform: translateY(var(--space-3h));
  }
}
@keyframes splitsmod-grow {
  from {
    transform: scaleX(0.02);
  }
}
@media (prefers-reduced-motion: reduce) {
  .splitsmod__part.is-pre {
    opacity: 1;
  }
  .splitsmod__part.is-in,
  .splitsmod__part.is-in .splitsmod__fill {
    animation: none;
  }
  .splitsmod__fill {
    transition: none;
  }
}
```

The grow keyframe has no `to`: it ends at the inline `scaleX(...)` of each row.
08b uses `splitsmod-rise` again for the fold rows; keep the name.

### Guards (checked against this CSS)

- `check-raw-values.mjs`: no hex, no radius, no raw time, no shadow. Pass.
- `check-layout-ratchet.mjs`: no `display: grid`, no `flex-wrap`, no column. Pass.
- `check-typography.mjs`, `check-focus-ring.mjs`, `check-component-reuse.mjs`: no
  font, ring or shape declarations. Pass.
- `check-file-size.mjs`: `splits.css` 462 → about 510. `LineRows.jsx` 117 → about
  132. Under 600.
- `check-dir-size.mjs`: no new source file under `src/` (the test is in `test/`).
- ESLint: `ref` as a prop is fine in React 19. The `'--i'` style key is a string key.

## Test first

New file `test/player-splits-motion.test.js`. Run it before the change and see it fail.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// Splits motion (#2073, slice 08a): the parts rise on view and their bars grow, from the
// source text, the way notice-n5.test.js reads a sheet.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const css = stripComments(read('src/styles/player-next/both/splits.css'))
const MOD = 'src/screens/player/next/modules/splits/'
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a part waits unseen, then rises on the unfold curve', () => {
  assert.equal(decl(ruleBody(css, '.splitsmod__part.is-pre'), 'opacity'), '0')
  assert.equal(
    decl(ruleBody(css, '.splitsmod__part.is-in'), 'animation'),
    'splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) backwards',
  )
  assert.match(ruleBody(css, '@keyframes splitsmod-rise'), /translateY\(var\(--space-3h\)\)/)
})

test('the bars grow from 0.02, row by row, only in a part that rises', () => {
  assert.equal(
    decl(ruleBody(css, '.splitsmod__part.is-in .splitsmod__fill'), 'animation'),
    'splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards',
  )
  assert.match(ruleBody(css, '@keyframes splitsmod-grow'), /transform:\s*scaleX\(0\.02\)/)
})

test('a fill that changes in place glides', () => {
  assert.equal(decl(ruleBody(css, '.splitsmod__fill'), 'transition'), 'transform var(--dur-grow) var(--ease-unfold)')
})

test('reduced motion: no rise, no grow, no glide', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.splitsmod__part\.is-pre\s*\{\s*opacity:\s*1/)
  assert.match(block, /\.splitsmod__fill\s*\{\s*transition:\s*none/)
})

test('no raw time in any splits.css animation or transition', () => {
  for (const m of css.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    const bare = m[1].replace(/var\([^)]*\)/g, '')
    assert.doesNotMatch(bare, /\d(?:ms|s)\b/, m[0])
  }
})

test('rows carry their index to the fill, and the parts go through Part', () => {
  const rows = read(`${MOD}LineRows.jsx`)
  assert.match(rows, /export function Part\(/)
  assert.match(rows, /useInViewOnce\(once\)/)
  assert.match(rows, /phase === 'wait' \? ' is-pre' : phase === 'play' \? ' is-in' : ''/)
  assert.match(rows, /'--i': i/)
  const index = read(`${MOD}index.jsx`)
  assert.doesNotMatch(index, /<section className="splitsmod__part"/)
  assert.match(index, /<Part once=\{`\$\{once\}:h`\}/)
  assert.match(index, /<Part once=\{`\$\{once\}:s`\}/)
  assert.match(read(`${MOD}VsTeam.jsx`), /<Part once=/)
})

test('the club strip glides on a pick and jumps on mount', () => {
  const vs = read(`${MOD}VsTeam.jsx`)
  assert.match(vs, /behavior: glide \? 'smooth' : 'auto'/)
  assert.match(vs, /centred\.current !== pick && !motionIsReduced\(\)/)
})
```

Check: `ruleBody` matches a selector only when it starts a line (or follows `;`,
`}`, `{`, `,`). Write every new top-level rule at column 0, as above. The
reduced-motion rules are indented, so the test reads them with a regex on the
`@media` block instead.

## Verify

1. `node --test test/player-splits-motion.test.js` and `npm run lint`. Do not run
   the full `npm test` or `npm run build`: CI runs them on your PR.
2. `npm run dev`. Batter: `/player/brice-turang-668930?nointro`, at 390px and at
   1180px. Scroll down to Splits. Each part rises as it comes in, and the bars grow
   one after the next. Scroll back up and down: nothing replays. Change Season:
   the rows reload and grow again (expected). Pick another club in Splits vs team:
   the strip glides. Reload: the strip is centred at once, with no glide.
3. Pitcher: `/player/robert-gasser-688107?nointro`. Pick "By handedness" in the
   menu: the part rises and its bars grow. Close it and pick it again: it shows at
   once (seen in this visit).
4. Load once with Playwright `reducedMotion: 'reduce'`: all parts and bars show at
   once, drawn.
5. Send Gary a short frame strip of the batter rise (`SendUserFile`) with the route.

## Out of scope

- Game lines (08b moves it onto `Part`), the fold cascade, hover, press, the fold
  chevron, the lab entry (all 08b).
- The pitcher menu and the section open (09, `MenuRail`).
- Keeping old rows on screen during a reload so that the fill glides across a
  season change. That is a data-flow change in `useAsync` or the module.
- The Scope `Button`s and Reset: their press is slice 02.

## Stop if

- 01a or 01c is not merged, or `useInViewOnce` does not return `[ref, phase]` with
  the three phases (`wait`, `play`, `rest`) above.
- `--ease-unfold`, `--dur-rise`, `--dur-grow` or `--stagger-step` is not in
  `src/tokens/effects.css`.
- The quoted code at `LineRows.jsx:46-51`, `:101-107`, `index.jsx:140-173` or
  `VsTeam.jsx:20-25` differs from this brief (someone changed the module).
- An open PR touches `src/screens/player/next/modules/splits/` or `splits.css`.
- A part stays invisible after it is in view (the hook never leaves `wait`).
