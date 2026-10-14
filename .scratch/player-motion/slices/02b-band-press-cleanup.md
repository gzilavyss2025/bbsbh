# Slice 02b: remove the band rules the old press inset needed

Part 2 of 2 of slice 02 (see 02a for the split).

## Run

- Model: `claude-sonnet-5-5`. Effort: medium.
- Depends on: 02a merged.
- Parallel with: 01c, 01d, and any later slice that does not touch the five files
  below.

## Goal

Before 02a, a pressed Button or Pill drew `box-shadow: var(--inset-cell)`. On a
coloured band the focus ring is also a `box-shadow` (`--ring-band`, the ink halo,
#1215). So three band hosts carry a `:focus-visible:active` rule that writes both
in one value: `var(--inset-cell), var(--ring-band)`. After 02a the press draws no
shadow, so those three rules now ADD an inset that the plain press no longer has:
a keyboard-focused control presses differently from a pointer-pressed one. Delete
the three rules. The band `:focus-visible` rule alone keeps the halo through the
press, because no `:active` rule sets `box-shadow` any more.

**This is a deliberate spec change to a pinned look.** `test/band-focus-ring.test.js`
asserts the combined rule today. This slice changes that test to assert the new
contract (no `:focus-visible:active` rule, and no press shadow to combine). It is not
a loosened test: it asserts the opposite of the old rule, so it fails before the
change. The PR text must say: "The band focus+press rules go: the stamp-press (#2073,
decision 1) draws no shadow, so the band halo needs no combined rule. The test now
pins their absence."

## Done means

- No `:focus-visible:active` rule for `.psodds-pill`, `.mastheadpill` or
  `.innings__notes` in `09-team-info.css`, `10-lineup.css`, `11-innings.css`.
- The comments above each band rule no longer mention a press inset.
- `test/band-focus-ring.test.js` asserts the new contract and passes; it failed
  before the change.
- The comment at `src/styles/focus/stage.css:232` says "moves it 2px".

## Files

1. `src/styles/09-team-info.css` (619 lines, budget 650): delete lines 181-183; edit
   the comment at 171-176.
2. `src/styles/10-lineup.css` (659 lines, budget 700): delete lines 484-487; edit
   the comment at 470-478.
3. `src/styles/11-innings.css` (307 lines): delete lines 80-83; edit the comment at
   69-74.
4. `test/band-focus-ring.test.js`: header lines 16-17 and the test at 119-126.
5. `src/styles/focus/stage.css`: one comment phrase at line 232.

## Canvas

None for this slice. The canvas draws no band ring; the house band ring stays
(spec.md, "Focus rings stay the house ring").

## Live today

`src/styles/09-team-info.css:171-183`:

```css
/* The ring sits 2px off the chip, on the club's colour, where the green ring
   falls under 3:1. On the band it is the two-colour band ring (#1215): a
   paper outline with an ink halo. The Pill keeps the ring's width, style and
   offset; the band sets its colour and the halo. Focused and pressed, the one
   box-shadow carries the Pill's press inset and the halo.
   test/band-focus-ring.test.js holds it. */
.team-hub.is-themed .psodds-pill:focus-visible {
  outline-color: var(--focus-ring-band);
  box-shadow: var(--ring-band);
}
.team-hub.is-themed .psodds-pill:focus-visible:active {
  box-shadow: var(--inset-cell), var(--ring-band);
}
```

`src/styles/10-lineup.css:470-487`:

```css
/* On a bar, the green ring sits on the bar's colour and falls under 3:1
   (2.41:1 on the house navy). A band head is always a bar, navy or the
   club's; a club head (the player page's section bars) is a bar only when it
   is themed.
   There the ring is the two-colour band ring (#1215): a paper outline with an
   ink halo. The Pill keeps the ring's width, style and offset. A pressed
   chip's paper edge stays apart from the ring: the halo's ink fills the gap
   between them. Focused and pressed, one box-shadow carries the press inset
   and the halo. test/band-focus-ring.test.js holds it. */
.sectionhead--band .mastheadpill:focus-visible,
.is-themed .sectionhead--club .mastheadpill:focus-visible {
  outline-color: var(--focus-ring-band);
  box-shadow: var(--ring-band);
}
.sectionhead--band .mastheadpill:focus-visible:active,
.is-themed .sectionhead--club .mastheadpill:focus-visible:active {
  box-shadow: var(--inset-cell), var(--ring-band);
}
```

`src/styles/11-innings.css:69-83`:

```css
/* On a themed lineup page the team head is the club's bar, and on the team
   hub the hero wears the club's tile colour. The green ring sits on that
   colour and falls under 3:1, so there it is the two-colour band ring
   (#1215): a paper outline with an ink halo. The Button keeps the ring's
   width, style and offset. Focused and pressed, one box-shadow carries the
   Button's press inset and the halo. test/band-focus-ring.test.js holds it. */
.teaminfo.is-themed > .teaminfo__head .innings__notes:focus-visible,
.team-hub__id .innings__notes:focus-visible {
  outline-color: var(--focus-ring-band);
  box-shadow: var(--ring-band);
}
.teaminfo.is-themed > .teaminfo__head .innings__notes:focus-visible:active,
.team-hub__id .innings__notes:focus-visible:active {
  box-shadow: var(--inset-cell), var(--ring-band);
}
```

`test/band-focus-ring.test.js:16-17` (header) and `:119-126`:

```js
//   - a control that is focused AND pressed (:active) shows both: the press
//     inset and the halo, in one box-shadow;
...
  test(`${host}: focused AND pressed, it shows the press inset and the halo`, () => {
    // The control's :active rule draws its press as an inset box-shadow. A
    // focus rule that sets box-shadow alone would erase it (or the :active
    // rule would erase the halo). One box-shadow carries both.
    const found = rulesFor(rel, `${host}:focus-visible:active`)
    assert.equal(found.length, 1, `one ${host}:focus-visible:active rule in ${rel}`)
    assert.equal(decl(found[0].body, 'box-shadow'), 'var(--inset-cell), var(--ring-band)')
  })
```

The loop runs over `BAND_CONTROLS` (`test/band-focus-ring.test.js:89-95`), five
hosts in three files. Helpers in the file: `read`, `rules`, `decl`, `rulesFor`
(lines 45-61).

`src/styles/focus/stage.css:231-233`:

```css
   below the buttons, not the old gap between two rows. Measured from the
   BUTTON, which is load-bearing: .btn:active nudges it 1px with a transform,
   making it the containing block for its own absolutely positioned pseudo.
```

Keep the guard fixture at `test/band-focus-ring.test.js:246`
(`.d .e:focus-visible:active { box-shadow: var(--inset-cell), var(--ring-band); }`):
it tests that `check-focus-ring.mjs` accepts that shape, which is still valid CSS
for a control whose press is an inset. Keep the `--ring-band` comment in
`src/tokens/effects.css:38-44` for the same reason: it states the rule for such a
control, and is still true.

## Build

### 1. `src/styles/09-team-info.css`

Delete lines 181-183. Lines 174-176 of the comment become:

```css
   offset; the band sets its colour and the halo. A press draws no shadow
   (the stamp-press, #2073), so the halo stays on through it with no second
   rule. test/band-focus-ring.test.js holds it. */
```

### 2. `src/styles/10-lineup.css`

Delete lines 484-487. Lines 477-478 of the comment become:

```css
   between them. A press draws no shadow (the stamp-press, #2073), so the halo
   stays on through it. test/band-focus-ring.test.js holds it. */
```

### 3. `src/styles/11-innings.css`

Delete lines 80-83. Lines 73-74 of the comment become:

```css
   width, style and offset. A press draws no shadow (the stamp-press, #2073),
   so the halo stays on through it. test/band-focus-ring.test.js holds it. */
```

### 4. `test/band-focus-ring.test.js`

Lines 16-17 become:

```js
//   - a control that is focused AND pressed (:active) keeps the halo: the
//     press draws no shadow (#2073), so no rule has to restate the ring;
```

Lines 119-126 become:

```js
  test(`${host}: focused AND pressed, the halo stays with no second rule`, () => {
    // The stamp-press (#2073) is a move only, so no :active rule sets a
    // box-shadow and the focus rule's halo survives the press. A
    // :focus-visible:active rule here would only add back the old press inset.
    assert.equal(rulesFor(rel, `${host}:focus-visible:active`).length, 0, `no ${host}:focus-visible:active rule in ${rel}`)
  })
```

After the loop (after line 127), add one test for the precondition:

```js
test('the Button and Pill press draws no box-shadow, so a band halo needs no :active rule', () => {
  for (const [rel, selector] of [
    ['system/button.css', '.btn:active'],
    ['system/pill.css', '.pill--control:active'],
  ]) {
    const found = rulesFor(rel, selector)
    assert.ok(found.length >= 1, selector)
    for (const { body } of found) assert.equal(decl(body, 'box-shadow'), undefined, selector)
  }
})
```

`rulesFor` finds the top-level `.btn:active` and the indented copy in the
reduced-motion block (it reads innermost rules); neither sets `box-shadow` after 02a.

### 5. `src/styles/focus/stage.css`

Line 232: `BUTTON, which is load-bearing: .btn:active nudges it 1px with a transform,`
becomes `BUTTON, which is load-bearing: .btn:active moves it 2px with a transform,`.

### Guards

- `check-focus-ring.mjs`: the deleted rules were `:focus-visible` rules; deleting
  them removes nothing the guard needs. The remaining band rules are unchanged.
- `check-file-size.mjs`: 09 and 10 shrink by 4-5 lines, inside their bands (a
  file must shrink a full 100 lines below its budget before the budget must drop).
- `check-raw-values.mjs`: the deleted values are tokens only, never counted.
- `check-layout-ratchet.mjs`: no layout declaration is in the deleted rules.

## Test first

Make the test edits in step 4 first, run
`node --test test/band-focus-ring.test.js`, and see the five "focused AND pressed"
cases fail (each finds one rule). The new precondition test passes once 02a is in;
it guards against a press shadow coming back. Then delete the rules.

## Verify

1. `node --test test/band-focus-ring.test.js` (this slice edits it).
2. `npm run lint`. Do not run the full `npm test` or `npm run build`: CI runs them on your PR ("Check once" in `.claude/skills/orchestrate/SKILL.md`).
3. `npm run dev`, then in the preinstalled Chromium at 390px:
   - `/team/milwaukee-brewers-158?nointro` (the hub hero): Tab to Game Notes and
     to the Postseason Odds Pill; hold a press with the keyboard (`page.keyboard.down('Space')`)
     and screenshot it. The paper ring and its ink halo stay, and the control sits
     2px down and right with no inset.
   - A themed lineup page (a recent game from `docs/test-games.md`, the club-name
     bar): the same check on Game Notes and a masthead Pill.
4. Send Gary the screenshots with `SendUserFile` and name the routes and the
   `gamePk`.

## Out of scope

- The press itself (02a).
- Any other `:focus-visible` rule.
- `src/tokens/effects.css` (see "Live today": its comment stays true).

## Stop if

- 02a is not merged (`.btn:active` still sets `box-shadow`): then deleting these
  rules would drop the inset only for focused presses, the opposite of the goal.
- A quoted block differs on your checkout, or a fourth `:focus-visible:active`
  rule that combines `--inset-cell` exists (`grep -rn "focus-visible:active" src/styles`).
- The held keyboard press shows no halo: report the computed `box-shadow`.
