# Slice 05c: `MenuRail` in `/design-lab` and `/animation-lab`

Third of three (05a the part, 05b the motion, 05c the lab entries). The rule: a shared part
gets a `/design-lab` entry, and a new animation gets an `/animation-lab` entry, with the
real class names (`spec.md`, "Rules every slice follows"; `docs/motion.md`, "Verifying").

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 05a merged, 05b merged, 01d merged (01d moves `Frame` into
  `animlab/Entry.jsx` and adds `animlab/PlayerMotionLab.jsx`, where every player-motion
  entry goes).
- Parallel with: 09, 11, 16, 17b.
- Shares append-only lines with other slices: `src/screens/animlab/PlayerMotionLab.jsx` (entries) and the freeze list in `src/styles/46-consent-modal.css`. The run plan may put
  those slices in one wave. Before you push, merge `main` in, and keep both sides
  of any conflict in those lines.

## Goal

Show `MenuRail` on the two review pages, with invented data, so Gary can see the menu, the
rail, the panel and the rise without a player page.

## Done means

- `/design-lab` shows a "Menu rail" group in band Two (the shared components): one live
  `MenuRail` you can tap, and one held in the rail state.
- `/animation-lab` shows a "Menu rail — unfold, fold and rise" entry (in
  `PlayerMotionLab.jsx`): the live part (Play
  remounts it; tap cards to see the glide), and a frozen strip of the rise at 0, 95, 190,
  285 and 380ms.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (5)

| File | Change |
|---|---|
| `src/screens/designlab/menurail/MenuRailLab.jsx` | **new** (a subfolder, as `jumpbar/`, `stamped/`; the flat folder holds 10 source files) |
| `src/screens/designlab/index.jsx` | import it, render it in band Two |
| `src/screens/animlab/PlayerMotionLab.jsx` | add the menu rail entry (01d made this file) |
| `src/styles/46-consent-modal.css` | add the two rise bodies to the frame freeze list |
| `test/menurail-motion.test.js` | one case: the lab freezes the rise (05b made this file) |

`src/screens/AnimationLab.jsx` is NOT touched: it sat at 597 of 600 lines, and 01d moved
the player entries into `PlayerMotionLab.jsx` so later slices add no line there.

## Canvas

None needed beyond 05a/05b. The demo uses the real classes only (`/design-lab`'s rule:
"THE LAB INVENTS NO GEOMETRY"; `animlab/motionDemos.jsx`: "Every one below wears the REAL
class hooks the app renders").

## Live today

- `src/screens/designlab/index.jsx:107-118`: band Two:

  ```jsx
  <Band id="components" title="Two — the shared components" lede="…">
    <ButtonHalf />
    <PillSystemHalf />
    <StackHalf />
    <ClusterHalf />
    <GridHalf />
    <ComponentHalf />
  </Band>
  ```
- `src/screens/designlab/Entry.jsx`: `Entry({ title, path, consumers, verdict, tone, note,
  wide, contained, children })` and `Group({ title, lede, children, grid })`.
- `src/screens/designlab/jumpbar/JumpBarLab.jsx`: the model for a subfolder lab file
  (imports `../../../components/…`).
- After 01d: `src/screens/animlab/Entry.jsx` exports `Entry` and `Frame` (`Frame({ label,
  delayMs, children })`: a `.animlab__frame` with `--animlab-delay` set to `-delayMs` ms).
  `src/screens/animlab/PlayerMotionLab.jsx` exports `PlayerMotionLab`, which returns a
  fragment of `Entry`s (the first is "Player page — the rise"). Read both as merged.
- `src/screens/animlab/Entry.jsx:41`: `Entry({ title, note, live, hover = false, children })`.
- `src/styles/46-consent-modal.css:212-238`: the un-delayed freeze list, ending:

  ```css
  .animlab__frame .sc-lens__tearhalf,
  .animlab__frame .sc-sheet__cell .sc-lens__moved,
  .animlab__frame .scorecard-page .sc-sheet__scroll {
    animation-play-state: paused;
    animation-delay: var(--animlab-delay, 0s);
  }
  ```

## Build

### 1. `src/screens/designlab/menurail/MenuRailLab.jsx`

```jsx
import { useState } from 'react'
import { Entry, Group } from '../Entry.jsx'
import { MenuRail } from '../../../components/ui/control/MenuRail.jsx'

// THE MENU RAIL (#2073, slice 05): the real MenuRail on invented cards. Tap a card: the
// row folds into a rail and the panel opens; tap it again, or the Back button, to return.
// Every name, figure and line is invented. None is a real player's, and none is a score.
const PATH = 'src/components/ui/control/MenuRail.jsx'
const ITEMS = [
  { key: 'one', title: 'First kind', meta: '41%', mark: '●', figures: 'Invented line one · 12 · 34' },
  { key: 'two', title: 'Second kind', meta: '27%', mark: '◆', figures: 'Invented line two · 56 · 78' },
  { key: 'three', title: 'Third kind', meta: '19%', mark: '■', figures: 'Invented line three · 9 · 10' },
  { key: 'four', title: 'Fourth kind', meta: '13%', mark: '▲', figures: 'Invented line four · 11 · 12', disabled: true },
]
const GROUPED = [
  { ...ITEMS[0], heading: 'Group A' },
  ITEMS[1],
  { ...ITEMS[2], heading: 'Group B' },
]
const panel = (key) => <p className="dlab__note">Invented panel for the card &ldquo;{key}&rdquo;.</p>

export function MenuRailHalf() {
  const [a, setA] = useState(null)
  const [b, setB] = useState('two')
  return (
    <Group
      title="Menu rail"
      lede="One menu of cards that folds into a rail, with a focus panel for the picked card (#2073). Arsenal, Splits, Plate approach and Contact use it."
    >
      <Entry title="MenuRail — menu" path={PATH} wide note="Live: tap a card, then tap it again or use Back. The fourth card is disabled.">
        <MenuRail label="Invented kinds" items={ITEMS} picked={a} onPick={setA} panel={panel} backLabel="All kinds" />
      </Entry>
      <Entry title="MenuRail — rail, railMeta, group heads" path={PATH} wide note="Starts on a pick. railMeta keeps the figure beside the name; the group heads fold away.">
        <MenuRail label="Invented kinds, grouped" items={GROUPED} picked={b} onPick={setB} panel={panel} backLabel="All kinds" railMeta />
      </Entry>
    </Group>
  )
}
```

`dlab__note` is the lab's own caption class (`styles/designlab/lab.css`), not a new box.

### 2. `src/screens/designlab/index.jsx`

```jsx
import { MenuRailHalf } from './menurail/MenuRailLab.jsx'
…
        <ComponentHalf />
        <MenuRailHalf />
      </Band>
```

### 3. `src/screens/animlab/PlayerMotionLab.jsx`

Add the imports at the top (keep 01d's), the two module-level pieces, and one more `Entry`
at the end of the fragment `PlayerMotionLab` returns:

```jsx
import { useState } from 'react'
import { MenuRail } from '../../components/ui/control/MenuRail.jsx'
…
// The menu rail (#2073, slice 05): the real MenuRail on invented cards. The strip is the
// real panel body (.menurail__body--a) frozen through its rise.
const RAIL_ITEMS = [
  { key: 'one', title: 'First kind', meta: '41%', figures: 'Invented line one' },
  { key: 'two', title: 'Second kind', meta: '27%', figures: 'Invented line two' },
  { key: 'three', title: 'Third kind', meta: '19%', figures: 'Invented line three' },
]
const RAIL_BODY = <p className="hint">Invented panel text.</p>

function MenuRailDemo() {
  const [picked, setPicked] = useState(null)
  return <MenuRail label="Invented kinds" items={RAIL_ITEMS} picked={picked} onPick={setPicked} panel={() => RAIL_BODY} backLabel="All kinds" />
}
```

and inside the fragment, last:

```jsx
      <Entry
        title="Menu rail — unfold, fold and rise"
        note={
          <>
            The shared menu (#2073, styles/motion/menurail.css). Tap a card: the row folds into a rail and the
            panel opens over 400ms on the unfold curve; the panel body rises 8px as it fades in, 380ms on the
            stamp curve, and again on every new pick. Tap the picked card: the content stays while the panel
            folds. Off under reduced motion.
          </>
        }
        live={<MenuRailDemo />}
      >
        <span className="animlab__stagelabel">The rise on a pick, 0 → 380ms</span>
        <div className="animlab__frozen">
          {[0, 95, 190, 285, 380].map((ms) => (
            <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
              <div className="menurail__body menurail__body--a">{RAIL_BODY}</div>
            </Frame>
          ))}
        </div>
      </Entry>
```

The glide and the fold are transitions, which a frozen frame cannot hold; the live stage
shows them (Play, then tap).

### 4. (no step: `AnimationLab.jsx` is untouched)

### 5. `src/styles/46-consent-modal.css`

Add the two bodies to the un-delayed list (the rise has no delay of its own, so the bare
frame offset reads true). Put them before the last selector, with a comment line:

```css
/* The menu rail's rise (styles/motion/menurail.css), no delay of its own. */
.animlab__frame .menurail__body--a,
.animlab__frame .menurail__body--b,
.animlab__frame .sc-lens__tearhalf,
```

`.animlab__frame .menurail__body--a` (0,2,0) outranks the motion rule `.menurail__body--a`
(0,1,0), so the import order (motion loads after 46) does not reset the pause.

## Test first

Add one case to `test/menurail-motion.test.js` (05b's file; it already has `read`). Run it;
it fails; then do steps 3 and 5.

```js
test('the Animation Lab shows the rail and freezes the rise', () => {
  const lab = stripComments(read('styles/46-consent-modal.css'))
  assert.match(lab, /\.animlab__frame \.menurail__body--a,/)
  assert.match(lab, /\.animlab__frame \.menurail__body--b,/)
  const demo = read('screens/animlab/PlayerMotionLab.jsx')
  assert.match(demo, /<MenuRail /)
  assert.match(demo, /className="menurail__body menurail__body--a"/)
})
```

The design-lab half is a review page with no logic; the browser check below covers it.

## Verify

- `node --test test/menurail-motion.test.js` (this slice adds to it) and `npm run lint`
  (watch `check-dir-size.mjs` and `check-file-size.mjs`). Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `/design-lab?nointro` at 390px and 1180px: the "Menu rail" group under band Two. Tap the
  cards; Back; Tab through (the shut panel takes no focus). The disabled card does nothing.
- `/animation-lab?nointro`: the last entry. The frozen strip shows the body faint and 8px
  low at 0ms and in place at 380ms. Press Play, tap cards.
- Send both screenshots with `SendUserFile`, with the two routes.

## Out of scope

- `MenuRail.jsx`, both menurail sheets (05a, 05b).
- `motionDemos.jsx`, `animlab/Entry.jsx`.
- Any player module.

## Stop if

- 01d is not merged: `Frame` is not exported from `animlab/Entry.jsx`, or
  `animlab/PlayerMotionLab.jsx` does not exist. Do not add lines to `AnimationLab.jsx`
  (597 of 600 lines before 01d).
- `src/screens/designlab/index.jsx` no longer has band Two as quoted.
- The frozen frames show the body at full opacity in every frame (the pause does not
  reach it): report the selector that wins instead.
