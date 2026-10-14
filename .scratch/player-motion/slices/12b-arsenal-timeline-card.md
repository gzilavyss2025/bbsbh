# Slice 12b: Arsenal timeline, part 2: mix bar roll, menu rows, start in view

Part 2 of 3 (12a: the clock and the side view; 12c: speed, scrubber, lab entry).

## Run

- Model: `claude-sonnet-5-5`. Effort: high (it builds on two parts it did not write:
  `MenuRail` from slices 05a/05b and `useInViewOnce` from slice 01c).
- Depends on: 12a merged (and so 01a, 01b, 05a, 05b), 01c merged (`useInViewOnce`).
- Parallel with: 06, 08, 10, 16, 17, 20. Not with 12c, 13, 14, 15.

## Goal

The rest of the canvas beats, from the same clock: the mix bar rolls in from the
left with a moving shadow edge; each mix segment flashes when its pitch lands; the
menu rows enter one by one (fade, flip down, rise, unblur); the mph and % figures
count up; a mint sweep crosses a row when its pitch lands; the row glyph pops. The
timeline starts the first time the card comes into view, not on mount.

## Done means

- The mix bar is clipped by `--roll` (0 → 1, 900ms from 100ms) and a shadow edge
  rides its right side while it moves.
- Each mix segment has a card-paper flash: 0.5 → 0 over 420ms from its landing.
- Each menu row: opacity, `rotateX(-80deg)`, `translateY(10px)` and `blur(3px)`
  ease to none over 520ms from `140 + i*80` ms; a ghost row rests at 0.45.
  `mph` and `%` count up over 700ms from `240 + i*80` ms. On landing, the sweep
  `scaleX` 0 → 1 over 260ms then fades over 700ms, and the glyph pops 1.45 → 1
  over 320ms. Every pick, un-pick and Replay replays all of it, as the canvas does.
- The row entrance uses MenuRail's existing `items[].style` and `items[].className`
  (slice 05a); `MenuRail.jsx` does not change.
- The clock waits on the first frame while `phase` is `'wait'`, plays one time
  when it turns `'play'`, and shows the last frame for `'rest'` (a return visit in
  the same tab, reduced motion, no IntersectionObserver).
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR. The new tests fail before the change.

## Files

1. `src/screens/player/next/modules/arsenal/ArsenalCard.jsx`: the mix wrapper, the
   flash, the row beats, the in-view start.
2. `src/styles/player-next/pitcher/arsenal.css`: the clip, the edge, the flash, the
   sweep, the glyph wrapper.
3. `src/screens/player/next/modules/arsenal/index.jsx`: pass `id={bio.id}`.
4. `test/arsenal-motion.test.js` (from slice 11, grown by 12a): new cases at the end.

## Canvas

ArsenalReveal board. The mix bar and its edge:

```html
<div style="position: relative">
<div style="display: flex; height: 42px; border: 2px solid #0F1822; clip-path: {{mixClip}}">
  …each segment: position: relative; overflow: hidden; background: {{s.c}}
  <i style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: #FBF6E9; opacity: {{s.f}}"></i>
  <b style="position: relative; …">{{s.k}}</b>  <span style="position: relative; …">{{s.use}}%</span>
</div>
<i style="position: absolute; top: 0; bottom: 0; width: 14px; margin-left: -14px;
   background: linear-gradient(90deg, transparent, rgba(15,24,34,.3)); pointer-events: none;
   left: {{rollL}}; opacity: {{rollO}}"></i>
</div>
```

```js
const r0 = eo((t - 100) / 900);
mixClip: 'inset(-6px ' + (1 - r0) * 100 + '% -6px 0)', rollL: r0 * 100 + '%', rollO: r0 > 0 && r0 < 1 ? 1 : 0,
segs: f: landed ? (1 - eo(since / 420)) * 0.5 : 0
```

The menu rows (`.ar-mc` has `position:relative; isolation:isolate; transform-origin:50% 0`;
the menu sits in `<div style="perspective: 700px">`):

```css
.ar-sw{position:absolute;left:0;top:0;right:0;bottom:0;background:rgba(134,190,152,.5);transform-origin:left;z-index:-1}
```

```js
const e = eo((t - (140 + i * 80)) / 520);
const e2 = eo((t - (240 + i * 80)) / 700);
const sw = landed ? eo(since / 260) : 0, swo = landed ? 1 - eo((since - 260) / 700) : 0;
sty: 'opacity:' + e * (ghost ? 0.45 : 1) + ';transform:' + (e < 1 ? 'rotateX(' + -(1 - e) * 80 + 'deg) translateY(' + (1 - e) * 10 + 'px)' : 'none')
     + ';filter:' + (e < 1 ? 'blur(' + (1 - e) * 3 + 'px)' : 'none') + ';',
sw: 'transform:scaleX(' + sw + ');opacity:' + swo + ';',
gt: 'scale(' + (landed ? 1 + 0.45 * (1 - eo(since / 320)) : 1) + ')',     // on the row glyph
sko: 1 - u,                                                                // the row sparkline's dash offset
mp: (p.mph * e2).toFixed(1) + ' mph', pc: Math.round(p.use * e2) + '%'
```

`rgba(15,24,34,.3)` is ink at 30%: `color-mix(in srgb, var(--text-heading) 30%, transparent)`.
`rgba(134,190,152,.5)` is mint at 50%: `color-mix(in srgb, var(--accent-tint) 50%, transparent)`.
`color-mix` is already in use (`src/styles/66-situational-records.css:29`).

All of these numbers are in `beatsAt` (12a): `roll`, `rollEdge`, and per pitch
`flash`, `row.e`, `row.count`, `row.dim`, `sweep.x`, `sweep.o`, `glyph`, `u`.

### Decision: the row entrance goes through MenuRail's `items[].style`, not arsenal CSS

The canvas sets the row entrance from the same clock as everything else, and
replays it on every pick, un-pick and Replay. A CSS keyframe in `arsenal.css`
would need a second start signal and a class swap to restart, and the count-up
needs the clock anyway. So the card computes the style per frame and hands it to
MenuRail's `items[].style`, which slice 05a already passes to the card Button
(`cardProps` → `style: item.style`). The `perspective(700px)` goes inside the
transform, so no wrapper is needed.

One catch: slice 05b gives `.menurail__card.btn` a `transform var(--dur-fast)`
transition (for the press). A per-frame inline transform under that transition
lags 120ms behind the clock. The canvas card has no transform transition. So,
while a row enters, the item also gets `className: 'arsenal__entering'`, and
`arsenal.css` drops `transform` from the transition list for that class only. The
fold (`flex-basis`, `padding`) keeps its glide, because a pick plays the fold and
the entrance at the same time.

## Live today

After 12a, `ArsenalCard.jsx` has `useArsenalClock(total, start)` with `start` one
of `'play' | 'wait' | 'end'` (read only for the first state), and

```jsx
  const clock = useArsenalClock(totalMs(pitches, SPEED), 'play')
  const beats = beatsAt(clock.t, pitches, { S: SPEED, solo: one?.path ? one.code : null })
  const byCode = new Map(beats.pitches.map((b) => [b.code, b]))
```

The mix bar, today `ArsenalCard.jsx:20-31`:

```jsx
      <div className="arsenal__mix" role="img" aria-label={`Pitch mix: ${rows.map((r) => `${r.mark.name} ${Math.round(r.pct)}%`).join(', ')}`}>
        {rows.map((r) => (
          <span
            key={r.code}
            className={`arsenal__seg${r.mark.ring ? ' arsenal__seg--ring' : ''}`}
            style={{ flexGrow: r.pct, '--pitch': r.mark.color }}
          >
            <b>{r.code}</b>
            <span>{Math.round(r.pct)}%</span>
          </span>
        ))}
      </div>
```

The `MenuRail` items after slice 11: `{ key, title, mark: <PitchGlyph mark={r.mark} />,
meta: dash(r.velo, …mph), figures: <><span className="arsenal__figs">{r.pct}%</span>
{r.path && <svg className="arsenal__spark" …><path className="arsenal__sparkline" d={sparkD(r.path)} /></svg>}</> }`.

`src/styles/player-next/pitcher/arsenal.css` (today's line numbers; 11 and 12a
moved them): `.arsenal__mix` `:53-57` (`display: flex; height: var(--space-10);
border: …`), `.arsenal__seg` `:59-73`, `.arsenal__seg span` `:81-84`
(`font-family: var(--font-mono); font-weight: var(--w-bold);`).

`src/screens/player/next/modules/arsenal/index.jsx:31`: `<ArsenalCard rows={rows} />`.

`useInViewOnce` (slice 01c, `src/hooks/scroll/useInViewOnce.js`):
`const [ref, phase] = useInViewOnce(key)`, `phase` is `'rest'` (key already seen
in this bundle, or reduced motion, or no IntersectionObserver), `'wait'` (not in
view yet) or `'play'` (came into view; it stays `'play'`). `key` is
`viewKey(playerId, slotKey)` from `src/lib/motion/inViewOnce.js`. The `ref` must be
on a mounted element, or the phase stays `'wait'` (and here the card would stay on
its first, empty frame). Read the merged files; this is what slice 01c specifies.

`MenuRail.jsx` (slice 05a, `src/components/ui/control/MenuRail.jsx`): the item
shape is `{ key, title, meta, figures, mark, label, disabled, heading, style,
className }`; `cardProps(item, picked)` gives the card Button `className:
'menurail__card' + item.className`, `pressed`, and `style: item.style`. The card
CSS (`src/styles/system/menurail/menurail.css`, `.menurail__card.btn`) already has
`position: relative; isolation: isolate`, so the sweep's `z-index: -1` sits on the
card. Slice 05b's `src/styles/motion/menurail.css` sets:

```css
.menurail__card.btn {
  transition:
    flex-basis var(--dur-unfold) var(--ease-unfold),
    padding var(--dur-unfold) var(--ease-unfold),
    background-color var(--dur-med) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    box-shadow var(--dur-fast) var(--ease-stamp),
    transform var(--dur-fast) var(--ease-stamp);
}
```

Read both merged files; if they differ from this, follow the merged code.

## Build

### 1. `index.jsx`

```jsx
      <ArsenalCard rows={rows} id={bio.id} />
```

### 2. `ArsenalCard.jsx`

Imports:

```jsx
import { useInViewOnce } from '../../../../../hooks/scroll/useInViewOnce.js'
import { viewKey } from '../../../../../lib/motion/inViewOnce.js'
import { beatsAt, countText, totalMs } from './timeline.js'
```

Start from in view:

```jsx
export function ArsenalCard({ rows, id }) {
  // One entrance per page visit: the first time the card comes into view. A key already seen in this tab
  // (Back, a return) shows the last frame (docs/motion.md, "The one-shot gate").
  const [ref, phase] = useInViewOnce(viewKey(id, 'arsenal'))
  …
  const clock = useArsenalClock(totalMs(pitches, SPEED), phase === 'rest' ? 'end' : 'wait')
  // 'play' comes once, from the observer, and stays: this runs one time per mount.
  useEffect(() => {
    if (phase === 'play') clock.play()
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  …
  return (
    <div className="arsenal__card" ref={ref}>
```

The mix bar:

```jsx
      <div className="arsenal__mixwrap" style={{ '--roll': beats.roll.toFixed(4) }}>
        <div className="arsenal__mix" role="img" aria-label={…unchanged…}>
          {rows.map((r) => (
            <span key={r.code} className={…unchanged…} style={{ flexGrow: r.pct, '--pitch': r.mark.color }}>
              <i className="arsenal__flash" aria-hidden="true" style={{ opacity: byCode.get(r.code).flash.toFixed(3) }} />
              <b>{r.code}</b>
              <span>{Math.round(r.pct)}%</span>
            </span>
          ))}
        </div>
        <i className="arsenal__rolledge" aria-hidden="true" style={{ opacity: beats.rollEdge ? 1 : 0 }} />
      </div>
```

The `MenuRail` items:

```jsx
        items={rows.map((r) => {
          const b = byCode.get(r.code)
          const e = b.row.e
          return {
            key: r.code,
            title: r.mark.name,
            // The board's row entrance, set from the clock: a fade, a flip down from -80deg, a 10px rise and
            // a 3px blur. No transform or filter once it ends, so the card's own press is free to move it.
            className: e < 1 ? 'arsenal__entering' : undefined,
            style: {
              transformOrigin: '50% 0',
              opacity: (e * b.row.dim).toFixed(3),
              transform: e < 1 ? `perspective(700px) rotateX(${(-(1 - e) * 80).toFixed(2)}deg) translateY(${((1 - e) * 10).toFixed(2)}px)` : undefined,
              filter: e < 1 ? `blur(${((1 - e) * 3).toFixed(2)}px)` : undefined,
            },
            mark: (
              <>
                <i className="arsenal__sweep" aria-hidden="true" style={{ transform: `scaleX(${b.sweep.x.toFixed(3)})`, opacity: b.sweep.o.toFixed(3) }} />
                <span className="arsenal__pop" style={{ transform: `scale(${b.glyph.toFixed(3)})` }}>
                  <PitchGlyph mark={r.mark} />
                </span>
              </>
            ),
            meta: r.velo == null ? '—' : `${countText(r.velo, b.row.count, 1)} mph`,
            figures: (
              <>
                <span className="arsenal__figs">{countText(r.pct, b.row.count)}%</span>
                {r.path && (
                  <svg className="arsenal__spark" viewBox="0 0 64 28" aria-hidden="true">
                    <path
                      className="arsenal__sparkline"
                      d={sparkD(r.path)}
                      pathLength="1"
                      style={{ strokeDasharray: 1, strokeDashoffset: (1 - b.u).toFixed(4) }}
                    />
                  </svg>
                )}
              </>
            ),
          }
        })}
```

Notes:

- MenuRail's card already has `position: relative; isolation: isolate`, which
  the sweep (`z-index: -1`) needs. If the merged CSS lacks them, add the two keys
  to `style`.
- The `transform` key is `undefined` after the entrance, not `'none'`: an inline
  `none` would beat the stamp-press `:active` transform (slice 02).
- The sweep sits in `mark`, but it is absolute to the whole card.
- `countText(r.velo, …, 1)` ends on `r.velo.toFixed(1)`, and `countText(r.pct, …)`
  ends on `r.pct` as text: the same figures the card shows today.
- The row sparkline draws with its pitch (`1 - u`); a ghost row's line is whole.

### 3. `arsenal.css`

Add `clip-path` to `.arsenal__mix`, `position: relative` to `.arsenal__seg`, and
these rules after `.arsenal__seg span`:

```css
/* The mix rolls in from the left as the card starts (board: 900ms from 100ms), a shadow riding its edge.
   --roll is set each frame by the card's clock (modules/arsenal/timeline.js); with no clock it is 1. */
.arsenal__mixwrap {
  position: relative;
}
.arsenal__mix {
  clip-path: inset(calc(var(--space-2) * -1) calc((1 - var(--roll, 1)) * 100%) calc(var(--space-2) * -1) 0);
}
.arsenal__seg > b,
.arsenal__seg > span {
  position: relative;
}
/* A segment flashes paper when its pitch lands. */
.arsenal__flash {
  position: absolute;
  inset: 0;
  background: var(--surface-card);
  pointer-events: none;
}
.arsenal__rolledge {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(var(--roll, 1) * 100%);
  width: var(--space-3);
  margin-left: calc(var(--space-3) * -1);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-heading) 30%, transparent));
  pointer-events: none;
}
/* A menu card's landing sweep and glyph pop; the card's entrance style comes from the clock. */
.arsenal__sweep {
  position: absolute;
  inset: 0;
  z-index: -1;
  transform-origin: left;
  background: color-mix(in srgb, var(--accent-tint) 50%, transparent);
  pointer-events: none;
}
.arsenal__pop {
  display: inline-flex;
}
/* While a row enters, its transform comes from the clock each frame: take transform out of the card's
   transition list (motion/menurail.css), or the entrance lags the clock. The first five entries keep their
   durations by index; the sixth duration has no property and is dropped. */
.menurail__card.btn.arsenal__entering {
  transition-property: flex-basis, padding, background-color, border-color, box-shadow;
}
```

Write the `clip-path` into the existing `.arsenal__mix` rule (one rule, so
`ruleBody` finds it), not as a second `.arsenal__mix` block.

Guards: no hex (the two `rgba` are `color-mix` on tokens), no time, no radius.
`inset: 0` and `top: 0` are zeros. `z-index: -1` is a local lift (allowed by
`check-z-index.mjs`, -1 to 3). `display: inline-flex` is not counted by the layout
ratchet (it counts column, wrap and grid only). The canvas edge is 14px and its
clip overhang 6px; `--space-3` (12px) and `--space-2` (8px) are the nearest tokens.
No reduced-motion block: these are static looks; the clock shows the last frame
(`--roll: 1`, flash 0, sweep 0).

## Test first

Append to `test/arsenal-motion.test.js` (it already has `read`, `card`, `css`,
`decl`, `ruleBody`). Each case fails before the change.

```js
const mod = read('src/screens/player/next/modules/arsenal/index.jsx')

test('the timeline waits for the card to come into view, once per page visit', () => {
  assert.match(card, /useInViewOnce\(viewKey\(id, 'arsenal'\)\)/)
  assert.match(card, /useArsenalClock\(.*, phase === 'rest' \? 'end' : 'wait'\)/)
  assert.match(card, /if \(phase === 'play'\) clock\.play\(\)/)
  assert.match(mod, /<ArsenalCard rows=\{rows\} id=\{bio\.id\} \/>/)
})

test('the mix bar rolls in under --roll, with a shadow edge riding it', () => {
  assert.equal(
    decl(ruleBody(css, '.arsenal__mix'), 'clip-path'),
    'inset(calc(var(--space-2) * -1) calc((1 - var(--roll, 1)) * 100%) calc(var(--space-2) * -1) 0)',
  )
  const edge = ruleBody(css, '.arsenal__rolledge')
  assert.equal(decl(edge, 'left'), 'calc(var(--roll, 1) * 100%)')
  assert.match(decl(edge, 'background'), /color-mix\(in srgb, var\(--text-heading\) 30%, transparent\)/)
  assert.match(card, /'--roll': beats\.roll/)
})

test('a mix segment flashes paper on landing', () => {
  assert.equal(decl(ruleBody(css, '.arsenal__flash'), 'background'), 'var(--surface-card)')
  assert.match(card, /className="arsenal__flash"[^>]*flash\.toFixed/)
})

test('the menu rows enter from the clock through MenuRail item styles, with no transform lag', () => {
  assert.equal(
    decl(ruleBody(css, '.menurail__card.btn.arsenal__entering'), 'transition-property'),
    'flex-basis, padding, background-color, border-color, box-shadow',
  )
  assert.match(card, /className: e < 1 \? 'arsenal__entering' : undefined/)
  assert.match(card, /perspective\(700px\) rotateX\(/)
  assert.match(card, /blur\(/)
  assert.match(card, /countText\(r\.velo, b\.row\.count, 1\)/)
  assert.match(card, /countText\(r\.pct, b\.row\.count\)/)
})

test('a landing sweeps the row in mint and pops its glyph', () => {
  const sweep = ruleBody(css, '.arsenal__sweep')
  assert.equal(decl(sweep, 'transform-origin'), 'left')
  assert.equal(decl(sweep, 'z-index'), '-1')
  assert.match(decl(sweep, 'background'), /color-mix\(in srgb, var\(--accent-tint\) 50%, transparent\)/)
  assert.match(card, /scaleX\(\$\{b\.sweep\.x/)
  assert.match(card, /className="arsenal__pop"/)
})
```

## Verify

- `node --test test/arsenal-motion.test.js` and `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`, `/player/robert-gasser-688107?nointro` at 390px and 1180px. Load
  the page at the top and scroll down to "Pitch arsenal": nothing plays before the
  card shows; then the bar rolls in with its edge, the rows flip in one by one and
  count up, and each landing flashes its segment and sweeps its row. Pick a pitch:
  the whole sequence replays, with the other rows at 0.45. Go to a team page and
  press Back: the card shows the last frame, with no replay.
- Tap the jump bar's "Pitches" button from the top: the card plays when it lands
  in view. (Slice 07's stamp-on-land is separate; both may show.)
- Send Gary a frame strip at 0, 300, 700, 1200 and 2800ms with `SendUserFile`, and
  name the route.
- Reduced motion (Playwright `reducedMotion: 'reduce'`): every row, figure and the
  full bar show at once.
- Press a menu card after the entrance: the stamp-press still moves it 2px.

## Out of scope

- The speed step, the scrubber and the `/animation-lab` entry (12c).
- The flight-time counter on each menu row (the board's `0.40 s` beside the
  sparkline, `sm`). The live card does not show flight time in the menu.
- Any change to `MenuRail.jsx` or its sheets.

## Stop if

- `useInViewOnce` is not on `main`, or it does not return `[ref, phase]` with
  `'rest' | 'wait' | 'play'` (slice 01c). Report its real API.
- MenuRail's merged `cardProps` does not pass `item.style` and `item.className` to
  the card Button, or `motion/menurail.css` has a different transition list (then
  copy the merged list, minus `transform`, and say so in the PR).
- The inline `transform` blocks the stamp-press on a menu card after the entrance.
- A frame takes over 16ms at 390px on the dev build with the menu entering.
- `ArsenalCard.jsx` passes 250 lines; move the items mapping into a
  `menuItems(rows, byCode)` function in the same file first, and stop if it is
  still over.
