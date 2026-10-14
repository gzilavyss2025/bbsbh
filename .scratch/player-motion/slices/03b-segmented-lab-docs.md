# 03b — `Segmented`: the design-lab entry and the docs

The second half of slice 03. **03a** (`03a-segmented.md`) built the part.

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium** (spec.md says high for 03 as a
  whole; the hard part is in 03a, and this half is one lab entry and three short
  text edits).
- Depends on: **03a merged**.
- Parallel with: 04a, 04b, 04c, and every slice that does not touch the four files
  below.

## Goal

Show `Segmented` on `/design-lab` beside the Button, and write down where it sits in
the system: the `#1130` comment on `--control-min`, the `control/` line in
`src/components/ui/CLAUDE.md`, and the "One control, one door" paragraph in
`src/CLAUDE.md`. The docs must say that Segmented is a group of `.btn` toggles, not a
third control.

## Done means

- `/design-lab?nointro` shows a "Segmented" entry in the Button group, with two live
  specimens (plain and `fill`), from the real component.
- `src/tokens/layout.css` says why in-card toggles are 44px now and `--control-min`
  stays 34px.
- Both CLAUDE.md files name Segmented. `src/CLAUDE.md` stays at **exactly 255 lines**.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (4)

| File | Change |
|---|---|
| `src/screens/designlab/buttons.jsx` | A `SegmentedSpecimen` and one `Entry` after the IconButton entry. |
| `src/tokens/layout.css` | Comment only: three lines added to the `--control-min` comment (l.38-43). |
| `src/components/ui/CLAUDE.md` | The `control/` bullet (l.10-11) names Segmented. |
| `src/CLAUDE.md` | The "One control, one door" paragraph (l.222-225), rewritten in the same 4 lines. |

No test file: the lab entry renders the real component (03a tests it), and the rest
is prose. `src/screens/designlab/` holds 10 files; this adds none.

## Canvas

None needed here. The specimen options copy the GameLog board's filter: All 22,
Regular season, Postseason (`<div role="group" aria-label="Show games">`).

## Live today

`src/screens/designlab/buttons.jsx` l.1-9 (imports):

```jsx
import { Entry, Group } from './Entry.jsx'

// The REAL Button and Door, rendered — never a copy of their markup.
import { Button } from '../../components/ui/control/Button.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { MARKS, SKINS } from '../../lib/design/buttonClass.js'
```

l.135-151, the IconButton entry, which the new entry follows:

```jsx
      <Entry
        title="IconButton"
        path="src/components/ui/control/IconButton.jsx"
        wide
        note="A glyph with no label: ..."
      >
        ...
      </Entry>
      <Entry
        title="Which face outline is"
```

`src/tokens/layout.css` l.38-44:

```css
  /* The OTHER button height (#1130). A control that switches something inside
     a card — a scope toggle, a filter, a zoom step, Refresh — is 34px; a
     control that stands on the page or in the bar is --tap-min. Two heights,
     not five: the 28/30/32/34/44px spread the collapse measured was one
     control drawn five ways. 34px still clears WCAG 2.5.8's 24px floor with
     room, and styles/system/button.css keeps two of them from touching. */
  --control-min: 34px;
```

`src/components/ui/CLAUDE.md` l.10-11:

```md
- **`control/`** — `Button`, `Door` and `Pill` (#1130, #1131): a button acts here, a door
  leaves, a pill is a capsule.
```

`src/CLAUDE.md` l.222-225:

```md
**One control, one door:** a button acts on this page and is `.btn`
(`styles/system/button.css`, `ui/control/Button.jsx` — `size` tap/control, `skin`
outline/ink/ghost/danger/seal, selected is `aria-pressed`); a door opens more and is
`.door` (`system/door.css`). Never hand-draw a third.
```

## Build

### 1. `src/screens/designlab/buttons.jsx`

Add the imports:

```jsx
import { useState } from 'react'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
```

Add the specimen above `export function ButtonHalf()`:

```jsx
// A live Segmented: its own state, so a tap moves the fill here as it does on a card.
// The fourth option is disabled, to show that state beside the others.
const SEGMENTED_OPTIONS = [
  { value: 'all', label: 'All', count: 22 },
  { value: 'reg', label: 'Regular season', count: 19 },
  { value: 'post', label: 'Postseason', count: 3 },
  { value: 'spring', label: 'Spring', disabled: true },
]

function SegmentedSpecimen({ fill = false }) {
  const [value, setValue] = useState('all')
  return <Segmented label="Show games" value={value} onChange={setValue} options={SEGMENTED_OPTIONS} fill={fill} />
}
```

Add the entry directly after the IconButton `</Entry>` (before "Which face outline is"):

```jsx
      <Entry
        title="Segmented"
        path="src/components/ui/control/Segmented.jsx"
        wide
        note="A joined row of Button toggles for a choice inside a card (#2073): 44px, a 2px stamped edge, square. One option is always on. Selected is the ink fill, with no tick: the joined row carries the state, and forced-colors mode draws it in Highlight. A count rides after the label in mono. The second row is fill: the buttons share the width. Tap, press and Tab are live."
      >
        <Stack gap="base">
          <SegmentedSpecimen />
          <SegmentedSpecimen fill />
        </Stack>
      </Entry>
```

Check that `Stack` takes `gap="base"` (`src/components/ui/layout/Stack.jsx`); use the
gap name it lists if `base` is not one.

### 2. `src/tokens/layout.css`

Replace the last line of the comment (l.43) so the comment ends:

```css
     room, and styles/system/button.css keeps two of them from touching.
     Amended for #2073: a row of toggles inside a card (All / Regular season /
     Postseason) is the joined Segmented part (ui/control/Segmented.jsx) at
     --tap-min. --control-min stays for every other small control. */
  --control-min: 34px;
```

Do not change the value. `test/button-cascade.test.js` l.87 asserts
`--control-min:\s*34px;`.

### 3. `src/components/ui/CLAUDE.md`

```md
- **`control/`** — `Button`, `Door` and `Pill` (#1130, #1131): a button acts here, a door
  leaves, a pill is a capsule. `Segmented` (#2073) is a joined row of 44px `.btn` toggles
  for a choice inside a card: a group of Buttons, not a fourth control.
```

### 4. `src/CLAUDE.md` (keep 4 lines)

`scripts/check-claude-md.mjs` pins `src/CLAUDE.md` at a budget of **255 lines**,
which is its length now. One more line fails lint, and one fewer line fails too
(the budget must then go down in the same commit). So rewrite the paragraph in the
same 4 lines:

```md
**One control, one door:** a button acts on this page and is `.btn`
(`styles/system/button.css`, `ui/control/Button.jsx` — `size` tap/control, `skin`
outline/ink/ghost/danger/seal, selected is `aria-pressed`; `Segmented` joins them); a door
opens more and is `.door` (`system/door.css`). Never hand-draw a third.
```

## Test first

No new test. Before you edit, run `node scripts/check-claude-md.mjs` and
`wc -l src/CLAUDE.md` (expect 255); run both again after the edit.

## Verify

1. `npm run lint` (the `check-claude-md` line must stay green). This slice writes no
   test. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
2. `npm run dev`, open `http://localhost:5173/design-lab?nointro` in Chromium at
   390px and 1180px. Find "Segmented" under "The button". Check: the buttons join
   (one 2px line between them), the selected one is ink with paper text and no
   tick, the counts are mono, the disabled option is faded, the fill row spans the
   entry, and Tab draws the whole ring on a middle button. Tap "Postseason" and see
   the fill move.
3. Send Gary the two screenshots with `SendUserFile` and the route
   `/design-lab?nointro`.

## Out of scope

- Any change to `Segmented.jsx` or `segmented.css` (03a). If the lab shows a defect,
  stop and report it.
- `src/screens/designlab/catalog.js`: it lists the old card and pill blocks, not
  controls.

## Stop if

- 03a is not on `main` (no `src/components/ui/control/Segmented.jsx`).
- `src/CLAUDE.md` is not 255 lines before your edit, or the budget in
  `scripts/check-claude-md.mjs` is not 255.
- The quoted lines differ from the files (another PR moved them).
- The lab entry shows the tick or a 1.5px edge on a Segmented button: that is a
  cascade defect in 03a, not something to patch here.
