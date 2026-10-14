# Slice 06b — Shell: the top cards stamp in once per page visit

Added after the plan review of #2073 (Gary, 2026-10-14): the issue body listed "the
hero and tile stamp plays on every mount, Back included" as open, and Gary chose to
gate it on the page.

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: **01c merged** (`src/lib/motion/inViewOnce.js`: `viewKey`, `hasSeen`,
  `markSeen`) and **07b merged** (it adds `landed`, `onLand` and the Overview replay to
  `PlayerNextPage.jsx`; this slice changes that Overview branch). 07b depends on 07a and
  06, so both are on `main` too.
- Parallel with: 09, 04d, 12a, 17b. None of them edits `PlayerNextPage.jsx` or
  `page.css`.
- Not in parallel with 06, 07a, 07b: all three edit `PlayerNextPage.jsx` or `page.css`.
  The `Depends on` line already keeps them apart.

## Goal

Make the hero card and the stat tiles on `/player/{id}` stamp in the first time the page
shows for that player in this page visit, and show at rest after that. Back inside the app
in the same tab shows them at rest. A full page load stamps them again. A jump-bar tap on
Overview still stamps them again (decision 3; slice 07b), because a tap is a change the
reader caused (`docs/motion.md`, "The one-shot gate"). The comment in `stamp-in.css` ("the
page that uses it gates it") then tells the truth.

## Done means

- `PlayerNextPage.jsx` reads once at mount whether this player's top cards were seen
  (`hasSeen(viewKey(id, 'top-cards'))`), and marks them seen when the hero and the
  overview data show (`markSeen`, in an effect).
- On a return visit, the `#overview` Stack carries `pnext__top--still`, and
  `.pnext__top--still .card--stamp-in` sets `animation: none` in `page.css`.
- The Overview landing (07b's `onLand('overview')`) clears the still state in the same
  commit (`flushSync`) and then replays the stamp, so a tap stamps the top even on a
  return visit.
- A cold load stamps as today (hero at 60ms, tiles from 120ms; slice 06).
- Section cards (`Slot`) are not affected: the rule is scoped to `.pnext__top--still`,
  which wraps `#overview` only.
- The tests this slice writes and `npm run lint` pass. CI runs the full `npm test` and
  `npm run build` on the PR. The new tests fail before the change.

## Files

| File | Change |
|---|---|
| `src/screens/player/next/PlayerNextPage.jsx` | `still` state, the seen mark, the class on `#overview`, `flushSync` in the Overview branch of `onLand`. |
| `src/styles/player-next/page.css` | One rule: `.pnext__top--still .card--stamp-in { animation: none }`. |
| `test/player-top-stamp-once.test.js` | New. |

3 files. The hero (`PlayerNextHero.jsx`) and the tiles (`PlayerNextTiles.jsx`) do not
change: they keep `stampIn`, and the class on their wrapper decides whether it plays.
Slice 06 changes those two files, so this slice stays away from them.

## Canvas

The canvas has no gate. It plays the hero and tile stamp on every page mount, and again
on each pick (`g1`/`g2`). The house rule is different, and it is settled:

- Decision 3 (issue #2073, decisions comment): "A cold load, Back and a return visit
  still do not replay" the landing stamp; the jump-bar tap stamps once per landing.
- The one-shot rule (`spec.md`, "The one-shot rule for entrances"): an entrance plays the
  first time in this page visit, not on Back inside the app in the same tab, and again
  after a full page load. `inViewOnce.js` keeps that `Set` for the life of the JS bundle.

No canvas value is copied here. The stamp's own values (380ms, `--ease-stamp`, 60ms and
120ms delays) are slices 01a and 06.

## Live today

`src/screens/player/next/PlayerNextPage.jsx` (before this slice, with slices 06, 07a and
07b merged; line numbers move, so match the code and not the numbers). 07b adds the state
and the Overview branch:

```jsx
  // The section a jump-bar tap landed on, and how many landings so far (decision 3):
  // its cards stamp in once per landing. Never set on a cold load, Back or an old address.
  const [landed, setLanded] = useState({ key: null, tick: 0 })
```

```jsx
  // Overview has no slots: its hero and tiles already carry the stamp-in, so it plays again.
  // Replayed in place, not remounted: a remount would fetch the tiles' rank marks again (the
  // rank lines blink) and turn the Age fact back.
  const onLand = (key) => {
    if (motionIsReduced()) return
    if (key === 'overview') {
      for (const el of document.querySelectorAll('#overview .card--stamp-in')) replayClass(el, 'card--stamp-in')
      return
    }
    setLanded((l) => ({ key, tick: l.tick + 1 }))
  }
```

The gate and its early return, before the hooks that must come first:

```jsx
  const gate = AsyncGate({
    loading: core.loading || overview.loading,
    error: core.error || overview.error,
    data: core.data && overview.data ? true : null,
    screenClass: 'playernext',
    noun: 'player',
    onBack: back,
  })
  if (gate) return gate
```

The top, as it stands:

```jsx
          <Stack gap="section" id="overview">
            <PlayerNextHero core={core.data} />
```

`PlayerNextPage` renders `PlayerNextBody key={`${props.id}:${props.asOf ?? ''}`}`, so a
Back to the same player is a new mount of `PlayerNextBody`, which is where a mount-time
read belongs.

`src/styles/motion/stamp-in.css:20-22` (read only):

```css
.card--stamp-in {
  animation: card-stamp-in var(--dur-stamp-in) var(--ease-stamp-in) var(--stamp-delay, 0s) backwards;
}
```

`src/lib/motion/inViewOnce.js` (slice 01c): `viewKey(playerId, slotKey)`,
`hasSeen(key)` (a pure read), `markSeen(key)` (adds to the module `Set`).

`Stack` appends `className` to its own classes (`src/components/ui/layout/Stack.jsx:24`;
`pnext__page` already does this). `StatTile` and the hero draw a `Card`, so every one of
them carries `card--stamp-in` while `stampIn` is on.

## Build

### 1. `PlayerNextPage.jsx`

Imports (beside the 07b imports):

```jsx
import { flushSync } from 'react-dom'
import { hasSeen, markSeen, viewKey } from '../../../lib/motion/inViewOnce.js'
```

State and the mark, right after 07b's `landed` state and before the `AsyncGate` early
return (hooks cannot come after it):

```jsx
  // The top cards (hero, tiles) stamp in the first time this player's page shows in this page
  // visit; Back inside the app shows them at rest (docs/motion.md, "The one-shot gate"). The
  // answer is read once, at mount. The mark is written when the cards show, so a page that
  // fails to load does not use up the stamp.
  const topKey = viewKey(id, 'top-cards')
  const [still, setStill] = useState(() => hasSeen(topKey))
  const shown = Boolean(core.data && overview.data)
  useEffect(() => {
    if (shown) markSeen(topKey)
  }, [shown, topKey])
```

The effect only writes to a module `Set`; it sets no state, so
`react-hooks/set-state-in-effect` does not apply. Keep `hasSeen` in the lazy initializer
and out of the render body.

The class on the top Stack:

```jsx
          <Stack gap="section" id="overview" className={still ? 'pnext__top--still' : undefined}>
```

The Overview branch of 07b's `onLand` (the other lines stay):

```jsx
    if (key === 'overview') {
      // A return visit drew the top at rest. Take that off in this commit, or the replay
      // finds `animation: none` and plays nothing.
      flushSync(() => setStill(false))
      for (const el of document.querySelectorAll('#overview .card--stamp-in')) replayClass(el, 'card--stamp-in')
      return
    }
```

`onLand` runs from the jump bar's settle timer, not from a React lifecycle, so
`flushSync` is allowed there. After the first landing, `still` stays `false` for the life
of this mount.

### 2. `page.css`

Add after the `.pnext__page` rule (line 12-14). `.card--stamp-in` is one class, this
selector is two, so it wins without an `!important` or a load-order trick:

```css
/* THE TOP CARDS AT REST: a return visit (Back inside the app) shows the hero and the tiles with
   no stamp-in. The page drops this class when a jump-bar tap lands on Overview, so that tap
   stamps them again (slice 07b). It wraps #overview only, so section cards are not touched. */
.pnext__top--still .card--stamp-in {
  animation: none;
}
```

No reduced-motion block: the stamp is already off there, and this rule only removes it.

## Test first

New `test/player-top-stamp-once.test.js`. Run it before the change; every test fails
except the last.

```js
// Slice 06b of the player-page motion (#2073): the top cards stamp in once per page visit.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SLOTS } from '../src/screens/player/next/sections.js'
import { hasSeen, markSeen, viewKey } from '../src/lib/motion/inViewOnce.js'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const page = read('src/screens/player/next/PlayerNextPage.jsx')
const css = stripComments(read('src/styles/player-next/page.css'))
const decl = (body, prop) =>
  body.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a return visit shows the top cards at rest, and the rule is scoped to the top', () => {
  assert.equal(decl(ruleBody(css, '.pnext__top--still .card--stamp-in'), 'animation'), 'none')
  assert.equal(ruleBody(css, '.card--stamp-in'), null) // this sheet does not touch the global rule
})

test('the page reads the seen state once at mount and marks it when the cards show', () => {
  assert.match(page, /useState\(\(\) => hasSeen\(topKey\)\)/)
  assert.match(page, /const topKey = viewKey\(id, 'top-cards'\)/)
  assert.match(page, /useEffect\(\(\) => \{\s*if \(shown\) markSeen\(topKey\)\s*\}, \[shown, topKey\]\)/)
})

test('the class sits on #overview only', () => {
  assert.match(page, /id="overview" className=\{still \? 'pnext__top--still' : undefined\}/)
  assert.equal((page.match(/pnext__top--still/g) || []).length, 1)
})

test('an Overview landing clears the rest state in the same commit, then replays', () => {
  const branch = page.slice(page.indexOf("if (key === 'overview')"))
  const clear = branch.indexOf('flushSync(() => setStill(false))')
  const replay = branch.indexOf("replayClass(el, 'card--stamp-in')")
  assert.ok(clear > -1 && replay > clear)
})

test("the 'top-cards' key cannot collide with a slot key", () => {
  assert.ok(SLOTS.every((s) => s.id !== 'top-cards'))
  assert.equal(hasSeen(viewKey(688107, 'top-cards')), false)
  markSeen(viewKey(688107, 'top-cards'))
  assert.equal(hasSeen(viewKey(688107, 'top-cards')), true)
  assert.equal(hasSeen(viewKey(668930, 'top-cards')), false)
})
```

The first test's second assertion checks that `page.css` has no rule whose selector is
exactly `.card--stamp-in`. If `ruleBody` finds one, someone moved the global rule here:
stop and report.

The last test passes before the change (it tests slice 01c's module). Keep it: it pins
that the key is per player and cannot meet a slot key (`slotInstances` keys are
`<id>:<role>`, so the key has no colon).

## Verify

- `node --test test/player-top-stamp-once.test.js` and `npm run lint`. Also run the test
  files that import `PlayerNextPage.jsx`, `page.css` or `sections.js`
  (`git grep -l PlayerNextPage test/`). Do not run the full `npm test` or `npm run build`:
  CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
- `npm run dev`; open `/player/brice-turang-668930?nointro` at 390px and at 1180px in the
  preinstalled Chromium.
  - Cold load: the hero stamps in at 60ms and the tiles follow (take a frame strip of the
    first 500ms, as slice 06 does).
  - Go to `/` through the app (a link), then press Back in the same tab: the hero and the
    tiles show at once, with no stamp.
  - On the page, scroll to History, then tap Overview in the jump bar: the hero and the
    tiles stamp again, after the scroll lands. Do this on both the cold-load visit and the
    Back visit.
  - Reload the page (a full load): the stamp plays again.
- Load once with Playwright `reducedMotion: 'reduce'`: the cards show at once, no replay.
- Send Gary the strips (cold load, Back, Overview tap) with `SendUserFile`, and say the
  route.

## Out of scope

- The stamp's timing and curve (slices 01a and 06) and the hero's markup.
- The stamp of section cards after a jump-bar tap (slice 07b).
- Module entrances (`useInViewOnce`, slice 01c). This slice reuses only its `Set`.
- Any change to `PlayerNextHero.jsx`, `PlayerNextTiles.jsx` or `stamp-in.css`. The comment
  in `stamp-in.css` is already right once this slice lands.
- `docs/motion.md`: slice 01c already names the second gate there.

## Stop if

- Slice 01c or 07b is not on `main` (`src/lib/motion/inViewOnce.js` is missing, or
  `PlayerNextPage.jsx` has no `onLand`).
- The Overview branch of `onLand` differs from the code quoted above in more than line
  numbers.
- `flushSync` logs "flushSync was called from inside a lifecycle method" in the console
  when you tap Overview. Report it. Do not switch to a `setTimeout`.
- `page.css` already has a rule for `.card--stamp-in`, or the stamp plays on Back after the
  change (the key or the lazy initializer is wrong).
- The work needs a file this brief does not list.
