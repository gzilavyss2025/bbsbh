# Slice 16: Plate approach onto `MenuRail`; rise on each pick

## Run

- Model: `claude-sonnet-5-5`. Effort: high.
- Depends on: 05a merged, 05b merged (05 is split in three; see `05a-menurail-part.md`).
  05c (the lab entries) is not needed.
- Parallel with: 09, 11, 17 (each in its own module folder), 05c, and any slice that does not
  touch `src/screens/player/next/modules/plate/`, `src/styles/player-next/batter/plate.css`
  or `test/player-next-plate.test.js`.

## Goal

Swap the batter Plate approach's pitch-mix table (`StretchTable`) for the shared
`MenuRail`, as canvas PlateApproach draws it: a card per pitch type; tap one and the menu
folds into a rail and a focus panel opens with that pitch; the panel body rises on every
pick. The zone map, the reading box and the hand chips stay where they are. Every number the
module shows today stays on screen. No data change.

**One change from the brief, on purpose.** The orchestrator's brief said "the focus panel
holds the zone map + reading". The canvas does NOT do that, and doing it would hide data:

- Canvas PlateApproach keeps the map in its own card, "Where it lands" (`.tp-zone`, left
  column), and the reading box (`.tp-card2`, `aria-live`) under it, in EVERY state. The
  menu (`.tp-menu`) and its panel (`.tp-pn`) are in the second card, "Pitch mix". The panel
  holds the picked pitch's figures (name, `xx seen`, Avg MPH, Whiff, In zone, the outcome
  bar, then Pitches / Swings / In the zone).
- The map today also shows "All pitches" (no pick). A map inside the panel would only show
  while a pitch is picked, so the all-pitches map would disappear.

So this slice follows the canvas: the map and the reading stay in `.fplate__zone`; the
MenuRail and its panel replace the table in `.fplate__mix`.

## Done means

- `.fplate__mix` shows a `MenuRail` (`label="Pitch type"`, `backLabel="All pitches"`), one
  card per pitch type in `pitchRows` order. `picked` is today's `code` (null = all pitches).
- A card shows: the pitch glyph, the name, the pitch count (meta), "MPH x · Whiff y", the
  five-outcome bar with its labels, and the two sides ("66% hitter's", "21% pitcher's").
  Its `aria-label` is today's row aria, word for word.
- The panel shows the picked pitch: the glyph (30px), the name, "FF · 1,234 pitches", the
  bar and the two sides. It rises on every pick (05b).
- With no pick, the reading box shows the all-pitches bar and sides (they were the "All
  pitches" row of the table). The bar key ("Hitter's side" / "Pitcher's side" over the five
  outcome names) stays under the menu.
- Tapping the picked card, or "← All pitches", returns to all pitches (today: the "All
  pitches" row, `i === 0`). Every pick clears the picked map cell (today: `setCell(-1)`).
- `StretchTable.jsx` and `formchart.css` are unchanged. Form trend (batter and pitcher)
  looks as before.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files (5)

| File | Change |
|---|---|
| `src/screens/player/next/modules/plate/PlateModule.jsx` | the table becomes a `MenuRail`; a glyph, a bar and a key component; the read box gets the all-pitches bar |
| `src/screens/player/next/modules/plate/plateView.js` | `fmtMph` and `outcomeFigures` (the pure part of today's `tableRow`) |
| `src/styles/player-next/batter/plate.css` | the glyph, the card's figure line, the panel head (178 lines today; about 225 after) |
| `src/screens/player/next/modules/plate/index.jsx` | import `both/formchart.css` (the bar classes; today it arrives through `StretchTable.jsx:1`, which Plate stops importing) |
| `test/player-next-plate.test.js` | new cases (92 lines today) |

## Canvas (PlateApproach.dc.html)

The menu and the panel (the MenuRail values are in `05a-menurail-part.md`; these are the
Plate-specific ones):

```css
.tp-mc{flex:1 1 150px;…padding:10px 12px;…}
.tp-mc .tp-seg{font-size:0}            /* the card's bar: no numbers (see below: we keep them) */
.tp-rail .tp-mc{flex:0 0 132px;padding:6px 12px}
.tp-rail .tp-ms{display:none}           /* the "% seen" meta hides in the rail */
.tp-pi{padding-top:14px}
.tp-ff1,.tp-ff2{animation:tp-fa 380ms cubic-bezier(.2,.9,.3,1) backwards}
```

The card markup (excerpt): glyph 20px, name `font-size:20px` (`.tp-sg`, display face), meta
`.tp-ms` (13px mono bold, "34.2%"), then `.tp-mx` with a 14px bar and a line
`{{r.hit}}% hitter's … {{r.pit}}% pitcher's` (11px mono bold).

The panel (excerpt):

```html
<button class="tp-chip" … style="min-height: 40px; margin-bottom: 14px; font-size: 13px">&larr; All pitches</button>
<div class="{{fc.fx}}">
  glyph 30px · name 28px (.tp-sg) · sub 11px mono "FF · 1,234 pitches" · "{{fc.seen}} seen" 15px mono bold
  3 figures: Avg MPH · Whiff · In zone (17px mono bold over a 10px label)
  bar 30px · hitter's / pitcher's line
  .tp-card2: Pitches · Swings · In the zone
```

The state (excerpt): `pick: () => this.setState({ pt: pt === k ? 'A' : k, cell: -1, fgen:
st.fgen + 1 })`; `backAll: () => this.setState({ pt: 'A', cell: -1 })`. The reading box
(`.tp-card2`, `aria-live="polite"`) shows the all-boxes bar (`rd.hasBar`) when no cell is
picked.

What this slice takes, and what it leaves:

| Canvas | This slice |
|---|---|
| card meta "% seen" | the pitch count (today's "Pitches" column). A share is a new number; the count is today's |
| card bar with `font-size:0` (no labels) | the bar WITH today's labels (under 8% prints none), so no number goes away |
| panel figures mph / whiff / in zone, pitches / swings / in the zone | not in the panel: the `FactGrid` under the menu already shows Swing, Chase, In zone, Whiff, Avg MPH and Swings for the picked pitch (it reads `view`, which follows `code`) |
| the 380ms rise on `(.2,.9,.3,1)` | MenuRail's `--dur-stamp-in` on `--ease-stamp` (05b) |
| rail basis 132px | MenuRail's default `--menurail-rail` (`calc(var(--tap-min) * 3)`, 132px) |

## Live today

`src/screens/player/next/modules/plate/PlateModule.jsx` (162 lines):

- l.10: `import { StretchTable } from '../form/StretchTable.jsx'`
- l.11: `import { MIN_CELL, OUTCOMES, fmtPct, pitchRows, pitchesVs, plateView } from './plateView.js'`
- l.18-19: `const ENDS = ["Hitter's side", "Pitcher's side"]`, `const COLUMNS = [{ key: 'n', label: 'Pitches' }, { key: 'mph', label: 'MPH' }, { key: 'whiff', label: 'Whiff' }]`
- l.22-23: `const pct = …`, `const mph = (v) => (v == null ? '—' : v.toFixed(1))`
- l.25-37, the table row:

  ```js
  const tableRow = (key, name, sub, at, v) => ({
    key, name, sub, at,
    segs: v.segs ? v.segs.map((n) => ({ n, label: n / v.n >= 0.08 ? String(pct(n / v.n)) : '' })) : [],
    good: v.hit == null ? '—' : `${pct(v.hit)}% hitter's`,
    bad: v.pitcher == null ? '—' : `${pct(v.pitcher)}% pitcher's`,
    n: v.n.toLocaleString(),
    mph: mph(v.rates.mph),
    whiff: fmtPct(v.rates.whiff),
  })
  ```
- l.41-48: `pickHand`, `pick`, `cell` state; `hand`; `all`; `rows = pitchRows(grid, hand)`;
  `code = rows.some((r) => r.code === pick) ? pick : null`; `view = plateView(grid, { hand, code })`.
- l.65-69, the rows and the cursor:

  ```js
  const tableRows = [
    tableRow('all', 'All pitches', `${handName} · ${view.n.toLocaleString()} pitches`, 0, view),
    ...rows.map((r, i) => tableRow(r.code, pitchMark(r.code).name, `${r.code} · ${r.n.toLocaleString()} pitches`, i + 1, r.view)),
  ]
  const at = tableRows.findIndex((r) => r.key === (code ?? 'all'))
  ```
  (Note: the "All pitches" row reads `view`, which follows `code`, so with a pitch picked it
  repeats that pitch's figures. The MenuRail has no "All pitches" card, so this goes away.)
- l.122-125, the reading box:

  ```jsx
  <div className="fplate__read" aria-live="polite">
    <span className="fplate__readtitle">{read.title}</span>
    <span className="fplate__readtext">{read.text}</span>
  </div>
  ```
- l.127-149, the mix column:

  ```jsx
  <div className="fplate__mix">
    <SectionHead look="rule" as="h3" note={handName}>Pitch mix</SectionHead>
    <StretchTable
      columns={COLUMNS}
      rows={tableRows}
      legend={OUTCOMES}
      ends={ENDS}
      cursor={at}
      onPick={(i) => { setPick(i === 0 || tableRows[i].key === code ? null : tableRows[i].key); setCell(-1) }}
    />
    <FactGrid className="fplate__facts"> … six Facts, `mph(view.rates.mph)` for Avg MPH … </FactGrid>
    <p className="fplate__note"> … Tap a pitch to read the map for it.</p>
  </div>
  ```

`src/screens/player/next/modules/form/StretchTable.jsx` (shared with `form/FormModule.jsx`
and `pform/index.jsx`; DO NOT change it): l.1 imports `both/formchart.css`; l.29-37 draw the
bar and the ends; l.47-52 draw the key:

```jsx
<div className="fstretch__key">
  <div className="fstretch__keyhead"><span className="fstretch__end--good">{ends[0]}</span><span className="fstretch__end--bad">{ends[1]}</span></div>
  <div className="fstretch__bar" aria-hidden="true">
    {legend.map((name, i) => <span key={name} className="fstretch__seg" data-i={i}>{name}</span>)}
  </div>
</div>
```

`src/styles/player-next/both/formchart.css:176-244`: `.fstretch__bar` (flex, `height:
var(--space-8)`, 2px stamped border), `.fstretch__seg` and its `[data-i='0'…'4']` colours,
`.fstretch__ends`, `.fstretch__end--good|bad`, `.fstretch__key`, `.fstretch__keyhead`. This
slice REUSES these classes (same markup as StretchTable), so the bars look exactly as today.

`src/screens/player/next/modules/arsenal/PitchGlyph.jsx:11`: `export const glyphD = (shape,
r) => …`. `target/MissCloud.jsx:2` and `command/CommandMapSvg.jsx:2` import it and draw their
own `<path>` with their own class; this slice does the same (`arsenal.css` is not loaded on a
batter page, so `.arsenal__glyph` would be unstyled there).

`src/styles/player-next/batter/plate.css:146-178`: `.fplate__read` (column, `gap:
var(--space-1)`), `.fplate__readtitle`, `.fplate__readtext`, `.fplate__facts`,
`.fplate__note`.

## Build

### 1. `plateView.js`: add after `fmtPct` (l.19)

```js
export const fmtMph = (v) => (v == null ? '—' : v.toFixed(1))
const whole = (v) => Math.round(v * 100)

// The figures one cut prints (#1887; slice 16 moved them here from PlateModule's table row,
// unchanged): the five outcomes as whole-number labels (a share under 8% prints none), the
// two sides, the count, the speed and the whiff. `name` makes the card's aria-label.
export function outcomeFigures(name, v) {
  const n = v.n.toLocaleString()
  const mph = fmtMph(v.rates.mph)
  const whiff = fmtPct(v.rates.whiff)
  const bad = v.pitcher == null ? '—' : `${whole(v.pitcher)}% pitcher's`
  return {
    segs: v.segs ? v.segs.map((k) => ({ n: k, label: k / v.n >= 0.08 ? String(whole(k / v.n)) : '' })) : [],
    good: v.hit == null ? '—' : `${whole(v.hit)}% hitter's`,
    bad,
    n,
    mph,
    whiff,
    aria: `${name}: Pitches ${n}, MPH ${mph}, Whiff ${whiff}, ${bad}`,
  }
}
```

The aria is today's `StretchTable.jsx:40` string for these three columns, word for word.

### 2. `PlateModule.jsx`

Imports: drop `StretchTable`; add `MenuRail` and `glyphD`; import `fmtMph` and
`outcomeFigures`.

```jsx
import { MenuRail } from '../../../../../components/ui/control/MenuRail.jsx'
import { glyphD } from '../arsenal/PitchGlyph.jsx'
import { MIN_CELL, OUTCOMES, fmtMph, fmtPct, outcomeFigures, pitchRows, pitchesVs, plateView } from './plateView.js'
```

Delete `COLUMNS` (l.19), the local `mph` (l.23; use `fmtMph` in the Avg MPH Fact) and
`tableRow` (l.25-37). Keep `ENDS` and `pct` (the map cells use `pct`).

Replace l.65-69 (`tableRows`, `at`) with:

```jsx
  const card = (r) => {
    const title = pitchMark(r.code).name
    const f = outcomeFigures(title, r.view)
    return {
      key: r.code,
      title,
      meta: f.n,
      mark: <Glyph code={r.code} />,
      label: f.aria,
      figures: (
        <>
          <span className="fplate__figs">MPH {f.mph} · Whiff {f.whiff}</span>
          <Bar f={f} />
        </>
      ),
    }
  }
  // The focus panel: the picked pitch. While the panel folds shut it keeps the last pick;
  // a hand change can drop that pitch, so a missing row draws nothing.
  const focus = (key) => {
    const r = rows.find((x) => x.code === key)
    if (!r) return null
    const f = outcomeFigures(pitchMark(key).name, r.view)
    return (
      <div className="fplate__focus">
        <div className="fplate__phead">
          <Glyph code={key} size={30} />
          <span className="fplate__pname">
            {pitchMark(key).name}
            <small className="fplate__psub">{key} · {f.n} pitches</small>
          </span>
        </div>
        <Bar f={f} />
      </div>
    )
  }
```

The reading box (l.122-125) gets the all-pitches bar when no cell is picked (the old "All
pitches" row's bar and sides; the canvas `.tp-card2` draws it the same way):

```jsx
          <div className="fplate__read" aria-live="polite">
            <span className="fplate__readtitle">{read.title}</span>
            {!picked && view.segs && <Bar f={outcomeFigures(name, view)} />}
            <span className="fplate__readtext">{read.text}</span>
          </div>
```

The mix column (l.127-136): replace the `<StretchTable … />` with:

```jsx
          <MenuRail
            className="fplate__menu"
            label="Pitch type"
            items={rows.map(card)}
            picked={code}
            onPick={(key) => { setPick(key); setCell(-1) }}
            panel={focus}
            backLabel="All pitches"
          />
          <Key />
```

and in the Avg MPH Fact use `fmtMph(view.rates.mph)`. The `FactGrid` and the note stay.

Three small components at the end of the file, beside `Fact`:

```jsx
// The pitch's mark (docs/pitch-types.md): the family is the shape, the pitch the colour.
function Glyph({ code, size = 20 }) {
  const mark = pitchMark(code)
  return (
    <svg className="fplate__icon" width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true">
      <path className={`fplate__glyph${mark.ring ? ' fplate__glyph--ring' : ''}`} d={glyphD(mark.shape, 7)} style={{ '--pitch': mark.color }} />
    </svg>
  )
}

// The five outcomes and the two sides: StretchTable's bar markup, on its classes (formchart.css).
function Bar({ f }) {
  return (
    <>
      <span className="fstretch__bar" aria-hidden="true">
        {f.segs.map((s, i) => (
          <span key={OUTCOMES[i]} className="fstretch__seg" data-i={i} hidden={!s.n} style={{ flex: `${s.n} 1 0` }}>{s.label}</span>
        ))}
      </span>
      <span className="fstretch__ends" aria-hidden="true">
        <span className="fstretch__end fstretch__end--good">{f.good}</span>
        <span className="fstretch__end fstretch__end--bad">{f.bad}</span>
      </span>
    </>
  )
}

// The key to the bars: StretchTable's key markup.
function Key() {
  return (
    <div className="fstretch__key">
      <div className="fstretch__keyhead"><span className="fstretch__end--good">{ENDS[0]}</span><span className="fstretch__end--bad">{ENDS[1]}</span></div>
      <div className="fstretch__bar" aria-hidden="true">
        {OUTCOMES.map((o, i) => <span key={o} className="fstretch__seg" data-i={i}>{o}</span>)}
      </div>
    </div>
  )
}
```

`Bar` uses `<span>`s only: it sits inside a card's `<button>`, where a `<div>` is invalid.
The comment at the top of the file (l.13-15) gains one line: "The pitch mix is the shared
MenuRail (#2073): a card a pitch type; the panel opens the picked one."

### 3. `index.jsx`

```js
import '../../../../../styles/player-next/both/formchart.css'
import '../../../../../styles/player-next/batter/plate.css'
```

(formchart.css first: plate.css may then override a bar inside its own blocks.)

### 4. `plate.css`: add at the end

```css
/* ---- the pitch mix on the shared MenuRail (#2073, slice 16) ----
   The menu, the rail and the panel are components/ui/control/MenuRail.jsx; the
   bars are the Form trend's .fstretch classes (both/formchart.css). */
.fplate__menu {
  margin-top: var(--space-3);
}
.fplate__icon {
  flex: none;
}
.fplate__glyph {
  fill: var(--pitch, var(--text-caption));
  stroke: var(--text-heading);
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.fplate__glyph--ring {
  fill: none;
  stroke: var(--pitch, var(--text-caption));
  stroke-width: 3;
}
.fplate__figs {
  display: block;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-cell);
}
.fplate__phead {
  display: flex;
  align-items: center;
  gap: var(--space-2h);
}
/* layout-exempt: the name over its count line */
.fplate__pname {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: var(--text-heading);
  font-family: var(--font-display);
  font-size: var(--fs-hero-sm);
  font-weight: var(--w-bold);
  line-height: var(--lh-tight);
}
.fplate__psub {
  color: var(--text-caption);
  font-family: var(--font-mono);
  font-size: var(--fs-cell);
  font-weight: var(--w-regular);
}
```

Guard notes: `check-layout-ratchet.mjs` counts `flex-direction: column` (marked) and not a
plain `display: flex` row. `check-typography.mjs`: every size, weight, leading and gap is a
token. `check-raw-values.mjs`: no hex, radius, time or shadow. `check-component-reuse.mjs`:
no sheet, capsule, ledger or band recipe. The glyph rules copy `arsenal.css:37-46` and
`target`'s pattern.

The rail basis: Plate takes MenuRail's default 132px. Uppercase names ("FOUR-SEAM",
"CHANGEUP") ellipse in the rail at that width (05a's `.menurail__title`). If Gary wants them
whole, set `--menurail-rail` on `.fplate__menu`; that is a follow-up, not this slice.

## Test first

Add to `test/player-next-plate.test.js` (first change its import to add `fmtMph` and
`outcomeFigures`, and add the `fs`/`path`/`url` imports). Run `node --test
test/player-next-plate.test.js`; the new cases fail; then build.

```js
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'
// add fmtMph and outcomeFigures to the plateView.js import above

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const MOD = 'screens/player/next/modules/plate/'

test('a cut prints the figures the table printed: labels from 8%, both sides, count, speed, whiff', () => {
  const f = outcomeFigures('Four-seam', plateView(one(counters())))
  // segs [18, 146, 34, 18, 34] of 250: 7.2% prints nothing, 58.4% prints 58.
  assert.deepEqual(f.segs.map((s) => s.label), ['', '58', '14', '', '14'])
  assert.deepEqual(f.segs.map((s) => s.n), [18, 146, 34, 18, 34])
  assert.equal(f.good, "66% hitter's")
  assert.equal(f.bad, "21% pitcher's")
  assert.equal(f.n, '250')
  assert.equal(f.mph, '90.0')
  assert.equal(f.whiff, '39.5%')
  assert.equal(f.aria, "Four-seam: Pitches 250, MPH 90.0, Whiff 39.5%, 21% pitcher's")
})

test('no plate file: no bar, both sides and the speed are a dash', () => {
  const f = outcomeFigures('Four-seam', plateView(one(counters({ noPlate: true }))))
  assert.deepEqual(f.segs, [])
  assert.equal(f.good, '—')
  assert.equal(f.bad, '—')
  assert.equal(f.mph, '—')
  assert.equal(fmtMph(null), '—')
})

test('the pitch mix is the shared MenuRail; the stretch table stays the Form trend\'s', () => {
  const jsx = read(`${MOD}PlateModule.jsx`)
  assert.match(jsx, /import \{ MenuRail \} from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/ui\/control\/MenuRail\.jsx'/)
  assert.doesNotMatch(jsx, /StretchTable/)
  assert.match(jsx, /picked=\{code\}/) // null is "All pitches", as the table's row 0 was
  assert.match(jsx, /backLabel="All pitches"/)
  assert.match(jsx, /onPick=\{\(key\) => \{ setPick\(key\); setCell\(-1\) \}\}/)
  assert.match(jsx, /label: f\.aria/)
  // Form trend still draws the table.
  assert.match(read('screens/player/next/modules/form/FormModule.jsx'), /StretchTable/)
  assert.match(read('screens/player/next/modules/pform/index.jsx'), /StretchTable/)
})

test('the module loads the bar classes itself now that it drops StretchTable', () => {
  const idx = read(`${MOD}index.jsx`)
  assert.ok(idx.indexOf('both/formchart.css') > -1)
  assert.ok(idx.indexOf('both/formchart.css') < idx.indexOf('batter/plate.css'))
})

test('the glyph and the panel head are drawn in plate.css with tokens', () => {
  const c = stripComments(read('styles/player-next/batter/plate.css'))
  assert.equal(ruleBody(c, '.fplate__glyph').match(/fill:\s*([^;]+);/)[1].trim(), 'var(--pitch, var(--text-caption))')
  assert.match(ruleBody(c, '.fplate__pname'), /font-size:\s*var\(--fs-hero-sm\)/)
  assert.match(ruleBody(c, '.fplate__menu'), /margin-top:\s*var\(--space-3\)/)
})
```

## Verify

- `npm run lint`, `npm test`, `npm run build`.
- Batter `/player/brice-turang-668930?nointro`, scroll to Plate approach, at 390px and
  1180px:
  - Menu state: one card a pitch type, biggest first; each shows the glyph, the name, the
    count, "MPH · Whiff", the bar with its numbers, the two sides. The reading box shows the
    all-pitches bar. The key sits under the menu, then the six facts.
  - Tap a card: the others fold into a rail of narrow cards (names may ellipse at 390px), the
    picked card is mint with the shadow, the panel opens with the glyph, name, "FF · n
    pitches", bar, sides. The map's note ("Where it lands" tag) and the facts change to that
    pitch, as today.
  - Tap another rail card: the panel body rises again. Tap the picked card, or "← All
    pitches": back to the menu; the panel keeps its content while it folds.
  - Pick a map cell, then pick a pitch: the cell clears.
  - Pick a pitch, then "vs LHP" where that pitch has fewer than 10 pitches: the pick drops,
    the menu returns.
- Check the batter Form trend card on the same page: its table is unchanged.
- Reload with Playwright `reducedMotion: 'reduce'`: every state switches at once.
- Send Gary a 390px screenshot of the rail state and a short frame strip of one pick with
  `SendUserFile`; say the route.

## Out of scope

- `StretchTable.jsx`, `formchart.css`, the Form trend modules.
- The map, the hand chips, the cell picking, the facts' content (only their place).
- A "% seen" share, an "In zone" or "Swings" figure in the panel (the canvas has them; they
  are new numbers here, and the facts already show the rates for the picked pitch).
- The card entrance on first view (slice 07 owns the Slot rise).
- `MenuRail` itself (05a/05b). If it needs a change, stop.

## Stop if

- The live lines quoted above differ (the table call, `tableRow`, the read box, the
  imports), or `PlateModule.jsx` is not 162 lines when you start.
- `MenuRail`'s API differs from 05a (`items[].label`, `panel`, `backLabel`, `className`).
- `glyphD` is no longer exported from `arsenal/PitchGlyph.jsx` (slices 11-15 work in that
  folder), or its signature is not `(shape, r)`.
- Removing the table changes the Form trend card in any way.
- A number the module showed before is nowhere on screen after (check the list in "Done
  means").
- `check-contrast.mjs` names a pair on the mint card (the bar's end colours on
  `--accent-tint`): report it; do not change the colours here.
