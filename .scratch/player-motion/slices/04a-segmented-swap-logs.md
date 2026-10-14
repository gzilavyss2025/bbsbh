# 04a — Swap the player toggles onto `Segmented`: game logs, Season, Advanced

Slice 04 is split into four, by file count and by owner:

| Part | Modules | Files |
|---|---|---|
| **04a** (this file) | batlog, pitchlog, season, advanced | 4 JSX + 1 test |
| 04b | innings, similar | 2 JSX + 2 CSS + 1 test |
| 04c | fouls (batter), pfouls (pitcher) | 2 JSX + 1 CSS + 1 test |
| 04d | mound | 1 JSX + 1 CSS + 1 test (waits for slice 10) |

## Run

- Model: `claude-sonnet-5-5`. Effort: **medium**.
- Depends on: **03a merged**.
- Parallel with: 03b, 04b, 04c (no shared file). Not with 20a or 20b: they edit
  `pitchlog/index.jsx` and `season/index.jsx` after this lands.

## Goal

The in-card scope toggles on the game logs, the Season card and the Advanced card
become one joined 44px `Segmented` row (decision 4 in spec.md), instead of separate
34px `Button size="control"` boxes with a gap and a tick.

## Done means

- Each of the four modules renders `<Segmented>` where its `role="group"` toggle
  row was, with the same `aria-label`, the same options, the same counts, and the
  same click side effects.
- No `pressed=` prop is left in these four files (an `aria-pressed=` on some other
  element is fine).
- Unused imports (`Button`, `Cluster`) are gone where nothing else uses them.
- `test/segmented-swap-logs.test.js` passes; it fails before the change.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR.

## Files (5)

| File | Change |
|---|---|
| `src/screens/player/next/modules/batlog/index.jsx` | l.121-127: the scope row → `Segmented` with counts. |
| `src/screens/player/next/modules/pitchlog/index.jsx` | l.188-194: the scope row → `Segmented` with counts. |
| `src/screens/player/next/modules/season/index.jsx` | l.69-75: the scope row → `Segmented`. Drop the `Button` import. |
| `src/screens/player/next/modules/advanced/index.jsx` | l.36-40: the scope row → `Segmented`. Drop the `Button` and `Cluster` imports. |
| `test/segmented-swap-logs.test.js` | **new.** |

No CSS changes: none of these four rows has a class of its own.

## Every toggle on the player page: the verdict

`grep -rn 'size="control"\|role="control"' src/screens/player/next/modules`
(plus the `pressed=` hits), on `95bdd6fb`:

| Hit | What it is | Verdict |
|---|---|---|
| `batlog/index.jsx:123` | All / Regular season / Postseason, with counts | **swap here (04a)** |
| `batlog/index.jsx:141` | Show all / Show fewer (`aria-expanded`) | not a toggle row (one action) |
| `pitchlog/index.jsx:190` | All / Regular season / Postseason, with counts | **swap here (04a)** |
| `pitchlog/index.jsx:183` | Load earlier season (`busy`) | not a toggle (an action) |
| `pitchlog/index.jsx:209` | Show all / Show fewer | not a toggle row (one action) |
| `pitchlog/StartDetail.jsx:86,181,184` | Close, Earlier, Later in the dialog | not a toggle (actions) |
| `season/index.jsx:71` | MLB / Minors / All / Postseason | **swap here (04a)** (canvas `.ss-btn` is joined) |
| `season/index.jsx:149` | All columns / Fewer columns link (`aria-pressed`) | not a toggle row (a text link; 20b adds its ring) |
| `advanced/index.jsx:38` | Regular season / Postseason | **swap here (04a)** (same scope pattern) |
| `advanced/index.jsx:49` | the stat tiles (`aria-pressed`) | not a toggle row (tiles that open a note) |
| `innings/index.jsx:154` | the scope row | **swap in 04b** |
| `similar/index.jsx:141` | Usage / Velocity (`size="tap"`) | **swap in 04b** |
| `fouls/FoulsCard.jsx:52` | Season stat `Pill`s | **swap in 04c** (canvas `.fe-tab` is joined) |
| `pfouls/index.jsx:77` | Regular season / Postseason, with games | **swap in 04c** |
| `pfouls/index.jsx:97` | Season stat `Pill`s | **swap in 04c** |
| `mound/index.jsx:41` | Starter / Bullpen | **swap in 04d** (canvas `.mc-btn` is joined); 04d waits for slice 10, which owns the mound files |
| `arsenal/FlightCard.jsx:81,82,88,103,131,134` | flight mode, pitch picks, camera, gravity, speed | **owned by slices 11-15** (arsenal); leave them |
| `arsenal/ArsenalCard.jsx:59,60,67` | Replay, All pitches, the pitch menu | **owned by slices 11-15**; leave them |
| `contact/ContactModule.jsx:82,89,118` | view, colour and type chips | **owned by slice 17** (contact menu onto `MenuRail`); leave them |
| `plate/PlateModule.jsx:85` | batter-hand chips | **owned by slice 16** (plate onto `MenuRail`); leave them |
| `splits/index.jsx:104,112` | scope, Reset | **owned by slices 08-09** (splits); leave them |
| `splits/GameLines.jsx:97`, `splits/VsTeam.jsx:104`, `splits/index.jsx:166` | Show more (`aria-expanded`) | not a toggle row; owned by 08-09 |
| `command/index.jsx:40` | Batter hand (L / R, counts, disabled) | not swapped: it sits in one side panel with the pitch-type chips (`command/index.jsx:53`), which are a many-option filter with pitch marks, not a joined choice. Swap both together in a later issue, or neither. |
| `command/index.jsx:53` | pitch-type chips | not a Segmented (a filter of up to ten chips with marks) |
| `form/FormModule.jsx:70`, `pform/index.jsx:99` | the game-window `Pill`s | not a Segmented: the canvas (`FormTrend .tf-chip`) draws separate chips with a mint pressed fill and an offset shadow, not a joined row |
| `pform/index.jsx:106` | the metric `Pill`s | same as above: not a Segmented |
| `form/FormModule.jsx:76`, `pform/index.jsx:112` | Play / Pause | not a toggle row (an action) |
| `runvalue`, `target`, `teams`, `command/CommandMapSvg`, `plate/PlateModule:102`, `form/StretchTable`, `splits/VsTeam:51`, `splits/index:128` | `aria-pressed` on rows, cells, tiles | not a toggle row |

## Canvas

`GameLog` / `BatterGameLog` (the logs):

```
<div role="group" aria-label="Show games" style="display:flex;flex-wrap:wrap;row-gap:0">
  <button class="gl-fbtn gl-cap" aria-pressed="{{f.on}}">{{f.label}} <span class="gl-mono" style="font-size:12px">{{f.n}}</span></button>
.gl-fbtn{min-height:44px;padding:0 14px;border:2px solid #0F1822;margin-left:-2px;...}
```

`SeasonStats` (the scope): `.ss-btn{min-height:44px;padding:0 14px;border:2px solid
#0F1822;margin-left:-2px;display:inline-flex;align-items:center;gap:6px}`.

Neither board fills the row: no `fill` prop on these four.

## Live today

`batlog/index.jsx` l.118-129:

```jsx
    <Stack className="batlog">
      <Cluster align="center" className="batlog__top">
        {post > 0 && (
          <Cluster gap="tight" role="group" aria-label="Show games">
            {SCOPES.map(([id, label]) => (
              <Button key={id} size="control" pressed={id === scope} onClick={() => (setScope(id), setMore(false))}>
                {label} <span className="mono">{counts[id]}</span>
              </Button>
            ))}
          </Cluster>
        )}
        <span className="mono batlog__scope">{season} · newest first</span>
```

`SCOPES` (l.18-22) is `[['all','All'],['reg','Regular season'],['post','Postseason']]`;
`counts` is built at l.115.

`pitchlog/index.jsx` l.186-195:

```jsx
          {post > 0 && (
            <Cluster gap="tight" role="group" aria-label="Show games">
              {SCOPES.map(([id, label]) => (
                <Button key={id} size="control" pressed={id === scope} onClick={() => setScope(id)}>
                  {label} <span className="mono">{counts[id]}</span>
                </Button>
              ))}
            </Cluster>
          )}
```

(`SCOPES` l.24-28, `counts` l.155. Note: pitchlog does not reset `more` on a scope
change and batlog does. Keep each as it is.)

`season/index.jsx` l.67-77:

```jsx
    <Stack gap="loose" className="seasonmod">
      <Cluster gap="base" align="center" className="seasonmod__bar">
        <Cluster gap="tight" role="group" aria-label="Show stats for">
          {scopes.map((s) => (
            <Button key={s.id} size="control" skin="outline" pressed={s.id === scope} onClick={() => { setPick(s.id); setOpen(null) }}>
              {s.label}
            </Button>
          ))}
        </Cluster>
        <span className="seasonmod__caption">{CAPTION[scope]}</span>
      </Cluster>
```

`Button` is used nowhere else in `season/index.jsx`; `Cluster` is (l.68, l.147).

`advanced/index.jsx` l.34-42:

```jsx
      <div className="pnext-adv__top">
        {views.post && (
          <Cluster role="group" aria-label="Scope">
            {SCOPES.map(([k, text]) => (
              <Button key={k} size="control" pressed={active === k} onClick={() => (setScope(k), setOpen(null))}>{text}</Button>
            ))}
          </Cluster>
        )}
```

`SCOPES` (l.9) is `[['regular','Regular season'],['post','Postseason']]`. `Button`
and `Cluster` are used nowhere else in the file.

## Build

Add to each of the four files, beside the other `components/ui` imports:

```jsx
import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'
```

**Write `label` as the first prop** of every `<Segmented`: the test reads
`<Segmented\s+label="…"`.

`batlog/index.jsx`, replace l.121-127 (keep the `{post > 0 && (` guard):

```jsx
        {post > 0 && (
          <Segmented
            label="Show games"
            value={scope}
            onChange={(id) => (setScope(id), setMore(false))}
            options={SCOPES.map(([id, label]) => ({ value: id, label, count: counts[id] }))}
          />
        )}
```

`pitchlog/index.jsx`, replace l.188-194:

```jsx
          {post > 0 && (
            <Segmented
              label="Show games"
              value={scope}
              onChange={setScope}
              options={SCOPES.map(([id, label]) => ({ value: id, label, count: counts[id] }))}
            />
          )}
```

`season/index.jsx`, replace l.69-75 and remove the `Button` import (l.8):

```jsx
        <Segmented
          label="Show stats for"
          value={scope}
          onChange={(id) => { setPick(id); setOpen(null) }}
          options={scopes.map((s) => ({ value: s.id, label: s.label }))}
        />
```

`advanced/index.jsx`, replace l.36-40 and remove the `Button` (l.3) and `Cluster`
(l.4) imports:

```jsx
        {views.post && (
          <Segmented
            label="Scope"
            value={active}
            onChange={(k) => (setScope(k), setOpen(null))}
            options={SCOPES.map(([k, text]) => ({ value: k, label: text }))}
          />
        )}
```

The old `<span className="mono">` count goes away: `Segmented` draws the count in
`.segmented__count` (mono, 12px).

## Test first

Create `test/segmented-swap-logs.test.js`. Run it and see every case fail, then
make the swaps.

```js
// Slice 04a (#2073): the game logs', Season's and Advanced's scope rows are the joined
// Segmented control. Asserted from the source text: a .jsx file cannot be imported here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MODS = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'screens', 'player', 'next', 'modules')
const src = (rel) => readFileSync(join(MODS, rel), 'utf8')
const IMPORT = "import { Segmented } from '../../../../../components/ui/control/Segmented.jsx'"

const SWAPS = [
  ['batlog/index.jsx', 'Show games', /count: counts\[id\]/],
  ['pitchlog/index.jsx', 'Show games', /count: counts\[id\]/],
  ['season/index.jsx', 'Show stats for', null],
  ['advanced/index.jsx', 'Scope', null],
]

for (const [rel, label, count] of SWAPS) {
  test(`${rel}: the scope row is a Segmented labelled "${label}"`, () => {
    const s = src(rel)
    assert.ok(s.includes(IMPORT), `${rel} imports Segmented`)
    assert.match(s, new RegExp(`<Segmented\\s+label="${label}"`))
    if (count) assert.match(s, count, `${rel} passes the game counts`)
  })
  test(`${rel}: no Button or Pill toggle is left (no pressed= prop)`, () => {
    assert.doesNotMatch(src(rel), /(?<![-\w])pressed=\{/)
  })
}

test('the side effects stay: batlog closes "Show all", Season closes the WAR dialog, Advanced closes the note', () => {
  assert.match(src('batlog/index.jsx'), /onChange=\{\(id\) => \(setScope\(id\), setMore\(false\)\)\}/)
  assert.match(src('season/index.jsx'), /onChange=\{\(id\) => \{ setPick\(id\); setOpen\(null\) \}\}/)
  assert.match(src('advanced/index.jsx'), /onChange=\{\(k\) => \(setScope\(k\), setOpen\(null\)\)\}/)
})

test('season and advanced import no Button they no longer use', () => {
  assert.doesNotMatch(src('season/index.jsx'), /import \{ Button \}/)
  assert.doesNotMatch(src('advanced/index.jsx'), /import \{ (Button|Cluster) \}/)
})
```

If Prettier or ESLint reflows an `onChange` line, update the regex to the new text
and keep what it checks (the same calls, in the same order). Do not drop a case.

## Verify

1. `node --test test/segmented-swap-logs.test.js`.
2. `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
3. `npm run dev`. In Chromium at 390px and 1180px:
   - Batter `/player/brice-turang-668930?nointro`, Season card: the scope row is
     joined, 44px, ink on the selected one, no tick. Tap Minors (if shown), then
     tap a WAR figure: the dialog opens; tap another scope: it closes.
   - The Game log card shows the scope row only when he has postseason games
     (`post > 0`). If the 2026 log has none, say so and check the row on a player
     who has (any club in this year's postseason), or on `/design-lab?nointro`.
   - Pitcher `/player/robert-gasser-688107?nointro`: Game log (same condition),
     Season, and Advanced (its row shows only with a postseason line).
4. Tab through one row: each button takes focus in turn and shows the full ring.
5. Send Gary the screenshots with `SendUserFile`, with each route.

## Out of scope

- Any CSS (none of these rows has its own class).
- The "Show all", "Load earlier season" and dialog buttons: actions, not toggles.
- Every hit marked "owned by" or "not" in the verdict table.
- The game-log row hover and the Season focus rings: slices 20a and 20b.

## Stop if

- 03a is not on `main` (no `src/components/ui/control/Segmented.jsx`), or its API
  differs from spec.md (`label`, `value`, `onChange`, `options`, `fill`, `className`).
- The quoted blocks differ from the files (line drift is fine; a different shape is
  not, for example a scope row that now has its own CSS class).
- An open PR edits `batlog/index.jsx`, `pitchlog/index.jsx`, `season/index.jsx` or
  `advanced/index.jsx` (list the open PRs and their files first).
- A swap would change what a card shows (a count, a label, a guard such as
  `post > 0`). This slice changes the control only.
