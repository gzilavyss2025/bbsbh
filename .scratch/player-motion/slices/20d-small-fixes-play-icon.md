# 20d — Small fixes: the Form trend play and pause icon

Part of slice 20 (split in four; see `20a-small-fixes-log-rows.md` for the table). Added
after the plan review of #2073 (Gary, 2026-10-14): the issue body lists "no play/pause
icon on the button" as a Form trend gap, and Gary chose to build it. It is its own slice
and not part of 20b, because 20b already has five files and a slice has at most five.

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: none. It adds no token and reads none. It edits only the Form trend
  modules (`form/FormModule.jsx`, `pform/index.jsx`), which no other slice edits: 04a
  leaves the Form trend `Pill`s and the Play button alone, and 16 leaves `form/`
  unchanged.
- Parallel with: any slice that does not touch the three files below.

## Goal

The Form trend's Play button shows the canvas icon: a triangle while the season is
stopped, two bars while it plays, drawn in the button's own ink, before the label. The
label words stay the same ("Play the season", "Pause"). The batter card and the
pitcher card both change.

## Done means

- `parts/PlayPauseIcon.jsx` draws the two canvas shapes at 16px, in `currentColor`.
- `FormModule.jsx` and `pform/index.jsx` pass `icon={<PlayPauseIcon playing={running} />}`
  to the Play `Button`. Nothing else in either file changes.
- The button's accessible name is still its label: the icon sits in `Button`'s
  `.btn__icon` slot, which is `aria-hidden`.
- The button still does not render under reduced motion (the `!motionIsReduced()` guard
  stays), so there is nothing to animate and no reduced-motion rule to add.
- `test/player-next-play-icon.test.js` passes; it fails before the change.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (4)

| File | Change |
|---|---|
| `src/screens/player/next/parts/PlayPauseIcon.jsx` | **new.** One component, `PlayPauseIcon({ playing })`. |
| `src/screens/player/next/modules/form/FormModule.jsx` | Import it; pass `icon` to the Play `Button` (l.76-80). |
| `src/screens/player/next/modules/pform/index.jsx` | Import it; pass `icon` to the Play `Button` (l.112-116). |
| `test/player-next-play-icon.test.js` | **new.** |

`parts/` goes from 3 files to 4 (cap 12). A part two modules use sits in `parts/`
(`src/screens/player/next/CLAUDE.md`, "Shared parts").

## Canvas

`FormTrend`, the Play control (the same markup on the batter and the pitcher board):

```html
<button class="tf-chip" type="button" onClick="{{F.togglePlay}}">
  <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="{{F.playIcon}}" fill="#0F1822"></path></svg>
  <span>{{F.playLabel}}</span>
</button>
```

```js
playIcon: st.playing ? 'M5 3H8V17H5Z M12 3H15V17H12Z' : 'M5 3L16 10L5 17Z',
playLabel: st.playing ? 'Pause' : 'Play the season',
```

The fill `#0F1822` is the ink. The live `Button` is an outline button whose text is ink,
so `currentColor` gives the same colour and follows the button's states. No hex goes
into the repo.

## Live today

`form/FormModule.jsx` l.76-80 (the pitcher card, `pform/index.jsx` l.112-116, is the
same lines):

```jsx
          {!motionIsReduced() && (
            <Button size="control" onClick={() => { if (!running && cursor >= last) setAt(0); setPlaying(!running) }}>
              {running ? 'Pause' : 'Play the season'}
            </Button>
          )}
```

`Button` takes `icon` and draws it first, in a `.btn__icon` span with `aria-hidden`
(`src/components/ui/control/Button.jsx:19-21`, `:43-47`). `.btn__icon`
(`src/styles/system/button.css:226-232`) sets `flex: none`, `font-size: 1.15em` and a
small `translate`; an SVG with its own `width` and `height` ignores the font size, so the
icon stays 16px. `LensBar.jsx` (`GridIcon`, l.97-104) already passes a 16px `currentColor`
SVG as an `icon`; this follows it.

## Build

### 1. `parts/PlayPauseIcon.jsx` (new)

```jsx
// The Form trend's Play button icon (board FormTrend): a triangle while the season is
// stopped, two bars while it plays. Drawn in the button's own ink (currentColor), 16px.
// Button's icon slot is aria-hidden: the label ("Play the season", "Pause") is the name.
const PLAY = 'M5 3L16 10L5 17Z'
const PAUSE = 'M5 3H8V17H5Z M12 3H15V17H12Z'

export function PlayPauseIcon({ playing }) {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
      <path d={playing ? PAUSE : PLAY} fill="currentColor" />
    </svg>
  )
}
```

### 2. `form/FormModule.jsx` and `pform/index.jsx`

Import (with the other `parts/` or relative imports; `modules/<module>/` reaches
`parts/` as `../../parts/PlayPauseIcon.jsx`):

```jsx
import { PlayPauseIcon } from '../../parts/PlayPauseIcon.jsx'
```

The `Button` line in both files:

```jsx
            <Button size="control" icon={<PlayPauseIcon playing={running} />} onClick={() => { if (!running && cursor >= last) setAt(0); setPlaying(!running) }}>
```

Nothing else changes: the children, the guard and the handler stay as they are.

## Test first

Create `test/player-next-play-icon.test.js`; run it and see it fail first. Node cannot
import `.jsx`, so the test reads the source, as the other `player-next` tests do.

```js
// Slice 20d (#2073): the Form trend Play button carries the canvas play and pause icon.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', 'player', 'next')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')

test('the icon is the canvas triangle and two bars, in the button ink, at 16px', () => {
  const s = read('parts/PlayPauseIcon.jsx')
  assert.match(s, /const PLAY = 'M5 3L16 10L5 17Z'/)
  assert.match(s, /const PAUSE = 'M5 3H8V17H5Z M12 3H15V17H12Z'/)
  assert.match(s, /<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">/)
  assert.match(s, /<path d=\{playing \? PAUSE : PLAY\} fill="currentColor" \/>/)
  assert.doesNotMatch(s, /#[0-9a-fA-F]{3,8}\b/, 'no raw hex')
})

test('the batter and pitcher Play buttons pass the icon and keep their label', () => {
  for (const file of ['modules/form/FormModule.jsx', 'modules/pform/index.jsx']) {
    const s = read(file)
    assert.match(s, /import \{ PlayPauseIcon \} from '\.\.\/\.\.\/parts\/PlayPauseIcon\.jsx'/, file)
    assert.match(s, /<Button size="control" icon=\{<PlayPauseIcon playing=\{running\} \/>\} onClick=/, file)
    assert.match(s, /\{running \? 'Pause' : 'Play the season'\}/, file)
    assert.match(s, /\{!motionIsReduced\(\) && \(\s*<Button size="control" icon=/, `${file}: the reduced-motion guard stays`)
  }
})
```

## Verify

1. `node --test test/player-next-play-icon.test.js`, then `npm run lint`. Also run the
   existing tests that import a changed file (`git grep -l FormModule test/` and
   `git grep -l pform test/`). Do not run the full `npm test` or `npm run build`: CI runs
   them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
2. `npm run dev`; open in the preinstalled Chromium, at 390px and at 1180px:
   - Batter `/player/brice-turang-668930?nointro`, Form trend: the button shows a
     triangle before "Play the season". Tap it: it shows two bars before "Pause" while the
     cursor moves, and the triangle again when the season ends or you tap Pause.
   - Pitcher `/player/robert-gasser-688107?nointro`, Form trend: the same.
   - At 390px the controls still fit: the button does not push a chip off the row. If it
     wraps, say so in the PR.
3. Load once with Playwright `reducedMotion: 'reduce'`: no Play button, as today.
4. Send Gary a screenshot of each state (stopped, playing) with `SendUserFile`, and say
   the routes.

## Out of scope

- The window and metric `Pill`s (they stay `Pill`s: slice 04a's table).
- The button's size, skin, label or behaviour.
- The stamp-press (slice 02a draws the press for every `Button`).
- A Form trend module for a two-way player, and the Plate approach (slice 16).
- An `/animation-lab` entry: the icon is a static swap, not an animation.

## Stop if

- `Button` no longer takes `icon`, or `.btn__icon` hides an SVG.
- The Play `Button` in either file differs from the quoted lines (other than line
  numbers).
- An open PR edits `form/FormModule.jsx` or `pform/index.jsx`.
- The work needs a file this brief does not list.
