# 17a — Contact: the dots drop in

Slice 17 of `spec.md` is split in two. 17a is the dot entrance. 17b moves the
batted-ball menu onto `MenuRail`. Reason: with the Animation Lab entry, one slice
needs six files, and the cap is five.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium (the table says high for 17; this half has
  no new part and no JS clock, so medium is enough).
- Depends on: 01 merged (`--ease-stamp`, `--dur-unfold`, `useInViewOnce`).
- Parallel with: any slice that does not touch `src/screens/player/next/modules/contact/*`,
  `src/styles/player-next/batter/contact.css` or `src/screens/AnimationLab.jsx`.
  `motionDemos.jsx` is shared with many slices: merge `main` in before you push.

## Goal

On the batter Contact card, the ball dots on the spray field drop onto the paper the
first time the field comes into view: each dot scales from 2.4 to 1 and fades in,
staggered across the set. A pick of a view (Home runs, Hits, All balls) or of a ball
type plays the drop again. A colour change does not. Back in the same tab does not.

## Done means

- First view of the card in this page visit: the dots drop in, one after another, over
  about 1.1s in total (620ms of stagger plus a 460ms drop).
- A view pick or a type pick replays the drop. "Result" / "Ball type" does not.
- A re-render, a poll, or Back to the page in the same tab shows the dots at rest.
- Reduced motion: the dots show at once, no drop.
- `/animation-lab` has a "Contact — the dots drop in" entry with the real classes.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files

1. `src/screens/player/next/modules/contact/ContactModule.jsx` — the in-view gate, the
   `gen` counter, the `<g>` with the a/b class, the per-dot `--fcontact-f`.
2. `src/styles/player-next/batter/contact.css` (122 lines) — transform box, the drop
   rules and keyframes, the wait state, the reduced-motion block.
3. `test/player-next-contact-motion.test.js` — new.
4. `src/screens/animlab/motionDemos.jsx` (349 lines) — `ContactDropDemo`.
5. `src/screens/AnimationLab.jsx` (597 lines) — one `Entry`. See "Stop if": the file is
   3 lines under the 600-line cap today.

## Canvas

Board `Contact.dc.html`. The dot rule and its two twin keyframes:

```css
.tc-fld .tc-dt{cursor:pointer;transform-box:fill-box;transform-origin:center;
  animation:tc-drop-a 460ms cubic-bezier(.2,.9,.3,1) backwards}
.tc-fld .tc-g2 .tc-dt{animation-name:tc-drop-b}
@keyframes tc-drop-a{from{opacity:0;transform:scale(2.4)}}
@keyframes tc-drop-b{from{opacity:0;transform:scale(2.4)}}
@media (prefers-reduced-motion:reduce){ … .tc-fld .tc-dt{animation:none!important} … }
```

The stagger is set per dot, from the dot's index `i` in a list of `N`:

```js
'animation-delay: ' + Math.round(N > 1 ? i / (N - 1) * 620 : 0) + 'ms'
```

The a/b swap is a generation counter. `halt()` (a view pick, a group pick, "All batted
balls") bumps `gen`; the `<g>` around the dots reads it:

```js
halt(patch) { … this.setState(Object.assign({ sel: -1, playing: false, t: 1e7, gen: this.state.gen + 1 }, patch)) }
fx: st.gen % 2 ? 'tc-g2' : 'tc-g1'
<g class="{{fx}}"><sc-for list="{{dots}}" …><circle class="tc-dt" …></sc-for></g>
```

A colour-mode pick (`this.setState({ mode: k, hl: '' })`) does not bump `gen`, so it
does not replay.

The values in tokens (after slice 01): 460ms = `calc(var(--dur-unfold) * 1.15)`;
620ms = `calc(var(--dur-unfold) * 1.55)`; the curve is `--ease-stamp`.

**What the canvas does NOT do, and this slice does not add:**

- **No highlight fade on the dots.** The canvas `.tc-dt` has no `transition`. Its
  legend highlight (dot opacity .92 vs .12) switches at once. The only 260ms fade on the
  field is the spray wedge (`.tc-fld .tc-wedge{transition:opacity 260ms …}`).
- **No wedge.** The canvas draws a wedge only for its direction groups (Pull, Center,
  Oppo: `WD = { DP: [15, 45], DC: [-15, 15], DO: [-45, -15] }[st.grp]`). The live card
  has no direction groups, and its "Highlight" chips filter by ball type, not dim. A
  wedge needs a new menu group, which is new content. Out of scope.

## Live today

`src/screens/player/next/modules/contact/ContactModule.jsx`:

```jsx
44	export default function ContactModule({ bio, asOf, season, onEmpty, onCount }) {
45	  const { data, error } = useAsync(() => load(bio.id, season), [bio.id, season])
46	  const [pickedView, setView] = useState(null) // null opens on the first view with balls
47	  const [color, setColor] = useState('result')
48	  const [type, setType] = useState(null)
49	  const [sel, setSel] = useState(null)
…
70	  if (empty) return null
71	  if (!card) return <div className="fcontact fcontact--wait"><p className="hint">Loading the contact…</p></div>
…
76	  const pick = (set, v) => { set(v); setSel(null) }
77	  return (
78	    <div className="fcontact">
…
95	          <svg className="fcontact__field" viewBox={VIEWBOX} role="group" aria-label={`Spray field of ${shown.length} balls in play`}>
96	            <g className="spray__art" aria-hidden="true">
…
100	            </g>
101	            {marks.map(({ b, p }, i) => (
102	              <circle
103	                key={i}
104	                className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}`}
105	                cx={p.x}
106	                cy={p.y}
107	                r={b.result === 'hr' ? 11 : 9}
…
113	              />
114	            ))}
115	          </svg>
```

The view chips call `pick(setView, k)` (l.82). The type chips call
`pick(setType, r.key === type ? null : r.key)` (l.118). The colour chips call
`setColor(k)` (l.89).

`src/styles/player-next/batter/contact.css`:

```css
46	.fcontact__dot {
47	  stroke: var(--surface-inset);
48	  stroke-width: 1.5;
49	  cursor: pointer;
50	  fill: var(--text-caption);
51	}
```

No animation on the field today. `src/hooks/motion/useBecameTrue.js` exists: it returns
true only for a value that went false → true while the component was mounted, and stays
true while the value stays true (`docs/motion.md`, "The one-shot gate").

## Build

### 1. The gate in `ContactModule.jsx`

Slice 01 adds `useInViewOnce`. **Read it first.** This brief assumes the shape of
`useNearView` (`src/hooks/scroll/useNearView.js`): `const [ref, seen] =
useInViewOnce(key)`, where `seen` is true at once when the key is already in the
module-level `Set` (inferred: slice 01 fixes the path and the return shape). Adapt the
two lines below to the real API.

Add the imports (path inferred; use slice 01's):

```jsx
import { useBecameTrue } from '../../../../../hooks/motion/useBecameTrue.js'
import { useInViewOnce } from '../../../../../hooks/motion/useInViewOnce.js'
```

Add the state and the gate after l.49, before any early return (hooks must run on
every render):

```jsx
  // The dots drop in the first time the field is in view (spec.md, the one-shot rule), and
  // again on each view or type pick: `gen` swaps the a/b class, which restarts the drop.
  const [gen, setGen] = useState(0)
  const [fieldRef, seen] = useInViewOnce(`${bio.id}:contact`)
  const entered = useBecameTrue(seen)
```

Put `ref={fieldRef}` on the root `<div>` in BOTH returns, l.71 and l.78. React keeps the
one DOM node when the loading div becomes the card (same type, same place), so the
observer watches one node from the first render. Do not put the ref on the `<svg>`: it
does not exist on the first render, and a `useNearView`-shaped hook observes only the
node it saw in its effect.

Change `pick` (l.76) so a view or type pick replays the drop:

```jsx
  const pick = (set, v) => { set(v); setSel(null); setGen((g) => g + 1) }
```

Leave `setColor(k)` (l.89) as it is: a colour pick does not replay.

Compute the class after `pick`:

```jsx
  // Not in view yet: the dots wait unseen. In view this visit, or picked since: they drop.
  // Already played (Back in the same tab): they show at rest.
  const dotsCls = !seen
    ? 'fcontact__dots fcontact__dots--wait'
    : entered || gen
      ? `fcontact__dots fcontact__dots--play fcontact__dots--${gen % 2 ? 'b' : 'a'}`
      : 'fcontact__dots'
```

Wrap the circles (l.101-114) in a group and give each dot its fraction of the stagger:

```jsx
            <g className={dotsCls}>
              {marks.map(({ b, p }, i) => (
                <circle
                  key={i}
                  className={`fcontact__dot fcontact__dot--${markKey(b, color)}${b === cur ? ' fcontact__dot--sel' : ''}`}
                  style={{ '--fcontact-f': marks.length > 1 ? (i / (marks.length - 1)).toFixed(3) : '0' }}
                  …the other props as they are today…
                />
              ))}
            </g>
```

### 2. CSS in `contact.css`

Add two declarations to the `.fcontact__dot` rule at l.46 (the scale grows from the dot
centre):

```css
.fcontact__dot {
  stroke: var(--surface-inset);
  stroke-width: 1.5;
  cursor: pointer;
  fill: var(--text-caption);
  transform-box: fill-box;
  transform-origin: center;
}
```

Add after the `.fcontact__dot--pop` line (l.63):

```css
/* The dots drop in (#2073; the canvas .tc-dt): scale 2.4 to 1 and fade in, staggered
   across the set by --fcontact-f (0 to 1, set per dot). --play rides the a/b pair, so a
   pick that swaps the class restarts the drop with no remount. --wait hides the dots
   until the field is in view, so the drop is not spent off screen. */
.fcontact__dots--wait .fcontact__dot {
  opacity: 0;
}
.fcontact__dots--play .fcontact__dot {
  animation: fcontact-drop-a calc(var(--dur-unfold) * 1.15) var(--ease-stamp) backwards;
  animation-delay: calc(var(--fcontact-f, 0) * var(--dur-unfold) * 1.55);
}
.fcontact__dots--b .fcontact__dot {
  animation-name: fcontact-drop-b;
}
@keyframes fcontact-drop-a {
  from { opacity: 0; transform: scale(2.4); }
}
@keyframes fcontact-drop-b {
  from { opacity: 0; transform: scale(2.4); }
}
@media (prefers-reduced-motion: reduce) {
  .fcontact__dots--play .fcontact__dot { animation: none; }
}
```

Keep the `animation` shorthand BEFORE `animation-delay` in the rule: a shorthand after
it would reset the delay to 0.

Guards: every time is a `calc()` of a token, so `check-raw-values.mjs` counts nothing.
No new flex or grid rule, so no `layout-exempt` marker. No type change.

### 3. The Lab entry

In `src/screens/animlab/motionDemos.jsx`, add the sheet import at the top (beside
`boxlines.css`) and the demo at the end. Invented spots, the real classes:

```jsx
import '../../styles/player-next/batter/contact.css'
…
// The Contact dots drop in (#2073): the real .fcontact__dots and .fcontact__dot classes on
// the card's own viewBox. The spots are invented.
const DROP_DOTS = [
  [250, 330, 'out'], [330, 300, 'single'], [420, 250, 'double'], [190, 260, 'out'],
  [300, 180, 'hr'], [470, 330, 'single'], [140, 340, 'triple'], [380, 160, 'hr'],
]
export function ContactDropDemo() {
  return (
    <svg className="fcontact__field" viewBox="10 40 600 485" aria-hidden="true">
      <g className="fcontact__dots fcontact__dots--play fcontact__dots--a">
        {DROP_DOTS.map(([cx, cy, k], i) => (
          <circle
            key={i}
            className={`fcontact__dot fcontact__dot--${k}`}
            cx={cx}
            cy={cy}
            r={k === 'hr' ? 11 : 9}
            style={{ '--fcontact-f': (i / (DROP_DOTS.length - 1)).toFixed(3) }}
          />
        ))}
      </g>
    </svg>
  )
}
```

In `src/screens/AnimationLab.jsx`, import `ContactDropDemo` in the block at l.13-25
(alphabetical) and add one `Entry` after the stamp-in entry (it ends at l.487). Live
stage only, no frozen strip: a strip needs a new line in the freeze list in
`src/styles/46-consent-modal.css`, which would be a sixth file.

```jsx
      <Entry
        title="Contact — the dots drop in"
        note={<>The batter Contact field (#2073). Each dot scales from 2.4 to 1 and fades in over 460ms on --ease-stamp, staggered across the set over 620ms. Off under reduced motion.</>}
        live={<ContactDropDemo />}
      />
```

## Test first

New file `test/player-next-contact-motion.test.js`. Run it before the change: every
case fails (no rule, no keyframe, no gate).

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// The Contact card's motion (#2073, slices 17a and 17b). Read from the source text, the way
// notice-n5.test.js reads its sheets.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const CSS = stripComments(read('src/styles/player-next/batter/contact.css'))
const JSX = read('src/screens/player/next/modules/contact/ContactModule.jsx')
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a dot scales from its own centre', () => {
  const b = ruleBody(CSS, '.fcontact__dot')
  assert.equal(decl(b, 'transform-box'), 'fill-box')
  assert.equal(decl(b, 'transform-origin'), 'center')
})

test('the dots drop in: 460ms on --ease-stamp, staggered over 620ms by the per-dot fraction', () => {
  const b = ruleBody(CSS, '.fcontact__dots--play .fcontact__dot')
  assert.equal(decl(b, 'animation'), 'fcontact-drop-a calc(var(--dur-unfold) * 1.15) var(--ease-stamp) backwards')
  assert.equal(decl(b, 'animation-delay'), 'calc(var(--fcontact-f, 0) * var(--dur-unfold) * 1.55)')
})

test('the b class runs a twin keyframe, so a pick restarts the drop with no remount', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dots--b .fcontact__dot'), 'animation-name'), 'fcontact-drop-b')
  for (const k of ['fcontact-drop-a', 'fcontact-drop-b']) {
    const m = CSS.match(new RegExp(`@keyframes ${k}\\s*\\{\\s*from\\s*\\{([^}]*)\\}`))
    assert.ok(m, `${k} exists`)
    assert.equal(decl(m[1], 'opacity'), '0')
    assert.equal(decl(m[1], 'transform'), 'scale(2.4)')
  }
})

test('before the field is in view, the dots wait unseen', () => {
  assert.equal(decl(ruleBody(CSS, '.fcontact__dots--wait .fcontact__dot'), 'opacity'), '0')
})

test('reduced motion: no drop', () => {
  assert.match(CSS, /prefers-reduced-motion: reduce\)\s*\{\s*\.fcontact__dots--play \.fcontact__dot\s*\{\s*animation: none;?\s*\}/)
})

test('the module gates the drop on first view and swaps a/b on each view or type pick', () => {
  assert.match(JSX, /useInViewOnce\(`\$\{bio\.id\}:contact`\)/)
  assert.match(JSX, /useBecameTrue\(seen\)/)
  assert.match(JSX, /fcontact__dots--\$\{gen % 2 \? 'b' : 'a'\}/)
  assert.match(JSX, /'--fcontact-f'/)
  assert.match(JSX, /const pick = \(set, v\) => \{ set\(v\); setSel\(null\); setGen\(\(g\) => g \+ 1\) \}/)
})
```

If slice 01 names the hook or its key differently, change the first JSX assertion to
the real call, before you write the code. Do not loosen it to a bare `useInViewOnce`.

## Verify

- `node --test test/player-next-contact-motion.test.js`, then `npm run lint`,
  `npm test`, `npm run build`.
- Chromium at 390px and 1180px: `/player/brice-turang-668930?nointro`. Scroll to the
  Contact card. Take a frame strip (about 0, 200, 500, 800, 1100ms after it comes into
  view). Tap "Hits": the drop plays again. Tap "Ball type": no drop. Navigate to a team
  page and press Back: the dots are at rest.
- Load once with Playwright `reducedMotion: 'reduce'`: the dots show at once.
- `/animation-lab`: the new entry plays on Play.
- Send Gary the strip with `SendUserFile` and name the route.

## Out of scope

- The batted-ball menu on `MenuRail` (17b).
- A highlight fade on the dots (the canvas has none on `.tc-dt`; see Canvas).
- The spray wedge (needs direction groups the live card does not have).
- The view and colour chips (l.80-91). Slice 04 owns in-card toggles. If 04 moved them
  to `Segmented` first, they call the same `pick(setView, k)` and `setColor(k)`; keep
  those calls.
- Ball flight (18) and play-through (19).

## Stop if

- `useInViewOnce` is not on `main`, or it cannot say "already seen at mount" (the Back
  case). Report its real API; do not write a second hook.
- `src/screens/AnimationLab.jsx` cannot take the 5-line entry and stay at or under 600
  lines (it is 597 today). If an earlier slice split the file, add the entry where that
  slice put the others. If nobody split it, stop and report. Do not raise a budget in
  `check-file-size.mjs`.
- The markup at `ContactModule.jsx` l.71-115 differs from the quote above in a way that
  moves the dots out of one `marks.map` (for example, a slice put them in a child
  component).
- `--dur-unfold` or `--ease-stamp` is not defined in `src/tokens/effects.css`.
