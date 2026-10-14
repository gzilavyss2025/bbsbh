# Slice 05c: `MenuRail` in `/design-lab` and `/animation-lab`

Third of three (05a the part, 05b the motion, 05c the lab entries). The rule: a shared part
gets a `/design-lab` entry, and a new animation gets an `/animation-lab` entry, with the
real class names (`spec.md`, "Rules every slice follows"; `docs/motion.md`, "Verifying").

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 05a merged, 05b merged.
- Parallel with: 09, 11, 16, 17. NOT with any other slice that edits
  `src/screens/AnimationLab.jsx` (see the size note below): 01, 02, 03, 08, 10, 12, 17 may
  each add an entry there.

## Goal

Show `MenuRail` on the two review pages, with invented data, so Gary can see the menu, the
rail, the panel and the rise without a player page.

## Done means

- `/design-lab` shows a "Menu rail" group in band Two (the shared components): one live
  `MenuRail` you can tap, and one held in the rail state.
- `/animation-lab` shows a "Menu rail — unfold, fold and rise" entry: the live part (Play
  remounts it; tap cards to see the glide), and a frozen strip of the rise at 0, 95, 190,
  285 and 380ms.
- `npm run lint`, `npm test`, `npm run build` pass.

## Files (5)

| File | Change |
|---|---|
| `src/screens/designlab/menurail/MenuRailLab.jsx` | **new** (a subfolder, as `jumpbar/`, `stamped/`; the flat folder holds 10 source files) |
| `src/screens/designlab/index.jsx` | import it, render it in band Two |
| `src/screens/animlab/MenuRailEntry.jsx` | **new**: the whole Animation Lab entry |
| `src/screens/AnimationLab.jsx` | import it, render it (2 lines) |
| `src/styles/46-consent-modal.css` | add the two rise bodies to the frame freeze list |

**Size note.** `src/screens/AnimationLab.jsx` is 597 lines today; `check-file-size.mjs` caps
it at 600 (`MAX_LINES`, no budget entry for it). An entry written inline is about 20 lines,
so this slice keeps the entry in its own file and adds 2 lines. `spec.md` says entries go in
`src/screens/animlab/motionDemos.jsx`; that file holds only the demo COMPONENTS (its header:
"Nothing else may be exported"), and the `Entry` list is in `AnimationLab.jsx`. With 8
slices adding entries, the cap breaks after the first one or two. See "Stop if".

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
- `src/screens/AnimationLab.jsx:10` imports `Entry` from `./animlab/Entry.jsx`; l.11-25
  import the demos; l.467-487 is the last entry ("Stamped card — the stamp-in"), then
  `</div>` and `)` at l.488-489. `Frame` (l.546-554) is local and not exported:

  ```jsx
  function Frame({ label, delayMs, children }) {
    const style = delayMs != null ? { '--animlab-delay': `${-delayMs}ms` } : undefined
    return (
      <Stack gap="tight" className="animlab__frame" style={style}>
        <div className="animlab__framebox">{children}</div>
        <span className="animlab__framelabel">{label}</span>
      </Stack>
    )
  }
  ```
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

### 3. `src/screens/animlab/MenuRailEntry.jsx`

```jsx
import { useState } from 'react'
import { MenuRail } from '../../components/ui/control/MenuRail.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Entry } from './Entry.jsx'

// THE MENU RAIL'S ENTRY (#2073, slice 05): its own file because AnimationLab.jsx sits at
// the 600-line cap (ADR-0038). The live stage is the real MenuRail on invented cards; the
// strip is the real panel body (.menurail__body--a) frozen through its rise.
// The frame below is AnimationLab.jsx's Frame, the same three classes; that one is local
// to its file.
const ITEMS = [
  { key: 'one', title: 'First kind', meta: '41%', figures: 'Invented line one' },
  { key: 'two', title: 'Second kind', meta: '27%', figures: 'Invented line two' },
  { key: 'three', title: 'Third kind', meta: '19%', figures: 'Invented line three' },
]
const BODY = <p className="hint">Invented panel text.</p>

function Live() {
  const [picked, setPicked] = useState(null)
  return <MenuRail label="Invented kinds" items={ITEMS} picked={picked} onPick={setPicked} panel={() => BODY} backLabel="All kinds" />
}

function Frame({ label, delayMs, children }) {
  return (
    <Stack gap="tight" className="animlab__frame" style={{ '--animlab-delay': `${-delayMs}ms` }}>
      <div className="animlab__framebox">{children}</div>
      <span className="animlab__framelabel">{label}</span>
    </Stack>
  )
}

export function MenuRailEntry() {
  return (
    <Entry
      title="Menu rail — unfold, fold and rise"
      note={
        <>
          The shared menu (#2073, styles/motion/menurail.css). Tap a card: the row folds into a rail and the
          panel opens over 400ms (--dur-unfold, --ease-unfold); the panel body rises 8px as it fades in, 380ms on
          --ease-stamp, and again on every new pick. Tap the picked card: the content stays while the panel
          folds. Off under reduced motion.
        </>
      }
      live={<Live />}
    >
      <span className="animlab__stagelabel">The rise on a pick, 0 → 380ms</span>
      <div className="animlab__frozen">
        {[0, 95, 190, 285, 380].map((ms) => (
          <Frame key={ms} label={`${ms}ms`} delayMs={ms}>
            <div className="menurail__body menurail__body--a">{BODY}</div>
          </Frame>
        ))}
      </div>
    </Entry>
  )
}
```

`motionDemos.jsx` is not touched: its header allows only demo components there.

### 4. `src/screens/AnimationLab.jsx` (2 lines)

```jsx
import { MenuRailEntry } from './animlab/MenuRailEntry.jsx'
…
      </Entry>          {/* the end of "Stamped card — the stamp-in" */}
      <MenuRailEntry />
    </div>
```

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

No new test file. This slice adds review pages and no logic, and a test would be a sixth
file. Every class it uses is pinned by `test/menurail.test.js` (05a) and
`test/menurail-motion.test.js` (05b). The check here is the browser (below) and
`npm run lint` (file size, dir size, typography). If the orchestrator wants a failing test
first anyway, drop the design-lab half to a later PR and add this case to
`test/menurail-motion.test.js` (it fails before step 5):

```js
test('the Animation Lab freezes the rise', () => {
  const lab = read('styles/46-consent-modal.css')
  assert.match(lab, /\.animlab__frame \.menurail__body--a,/)
  assert.match(lab, /\.animlab__frame \.menurail__body--b,/)
})
```

## Verify

- `npm run lint` (watch `check-file-size.mjs` on `AnimationLab.jsx` and `check-dir-size.mjs`),
  `npm test`, `npm run build`.
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

- `src/screens/AnimationLab.jsx` is over 598 lines when you start (another slice landed an
  entry first). Do not trim other entries to make room; report it. The fix is one small prep
  PR that moves `Frame` into `animlab/Entry.jsx` as an export and each long entry into its
  own file, and that is not this slice's call.
- `src/screens/designlab/index.jsx` no longer has band Two as quoted.
- The frozen frames show the body at full opacity in every frame (the pause does not
  reach it): report the selector that wins instead.
