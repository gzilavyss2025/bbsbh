Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L3 of #724: the still lens

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard (`/{date}/{matchup}/scorecard`) opens zoomed onto the next sealed at-bat, which sits under a
fixed navy frame. The brief is the issue comment
https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. **Read all of it, in the
order of its section 0.** This slice is its slice 2 ("The still lens"). Where this prompt and the
brief disagree, this prompt wins.

**Settled (Gary, 2026-10-02):** the phone always opens in the lens; store no preference. The lens
also comes to a sideways phone later (slices L8 and L9), so build the "is this a phone lens?" test as
**one** helper that L9 can widen. Today it is `(max-width: 480px)`.

Two slices run at the same time on the cloud: L1 (the seal's focus ring in `box.css`) and L2 (pure
helpers in `src/lib/scorecard/`, plus a line in `src/lib/CLAUDE.md`). Do not edit `.sc-ab__seal`
focus rules or `src/lib/CLAUDE.md`. You may add `src/lib/scorecard/geometry.js`.

## Workspace

1. `git fetch origin`. Base: `origin/claude/lens-ruler`, not `main`. If it does not exist, stop and
   tell Gary to run step 0 of the run sheet.
2. `git worktree add ../bbsbh-lens-l3 -b claude/lens-l3-still origin/claude/lens-ruler`, then
   `npm install` there. Do not edit the primary checkout.
3. Dev server: the first free of `npm run dev` (5173), `dev:2` to `dev:5`. Add `?nointro` to every URL.
   If all five ports are taken, run `node scripts/dev-servers.mjs`. Stop (`taskkill /PID <pid> /F`) only
   the servers of `bbsbh-lens-*` worktrees whose PR is already merged into `claude/lens-ruler`. Stop
   nothing else. If still no port is free, stop and tell Gary.
4. **Windows baseline.** This PC runs Windows. Here `npm run lint` fails `check-dir-size` and
   `check-file-size`, and `npm test` fails the three `.cluster`, `.grid` and `.stack` tests, only
   because of `\` in paths. They fail the same way on `origin/main`, and CI (Linux) passes them. Do not
   change code or budgets for them. Run those two guards with the path shim instead. Each must exit 0:
   `node --import=file:///C:/Users/gzilavy/claude-prompts/lens-ruler-724/posix-paths.mjs scripts/check-dir-size.mjs`
   and the same for `scripts/check-file-size.mjs`. Any other failure is yours to fix.

## Build (brief slice 2, with gotchas G1 to G5, G7, G15, G16, G20, G21, G23)

1. **Lens mode** is on when: the phone test is true, `stepInfo` is not null, and `commitReveals` is true
   (G7: ask `effectiveReveal`, do not re-derive). Otherwise today's sheet shows, unchanged.
   Put the decision in a pure function with a test.
2. **Geometry** (`src/lib/scorecard/geometry.js`, test first with fixed rects):
   `lensOffset({ cellRect, paneRect, scrollTop, scrollLeft, frame })` → `{ top, left }`.
3. **Measure, do not compute** (G2). Put a `data-frontier` attribute on the seal cell and on the flip
   cell. Measure with `getBoundingClientRect()` against the pane. Do not use `offsetTop` inside the
   zoomed table. A half that ends on a caught stealing puts the flip under the "CS →" box (G23).
4. **Scroll the pane, never transform the sheet** (G1). In this slice the scroll is instant. L7 adds
   the glide. After each tap and each turn, the new frontier lands under the frame.
5. **Compact rail + computed zoom** (G4): lens-only CSS variables give a rail of about 100 px (slot
   number + surname, position under the name). `zoom = paneWidth / (railWidth + 2 × cellWidth)`,
   capped at the sheet's `ZOOM_MAX`. Hide the −/+ zoom control in lens mode.
6. **Bounded pane + spacers** (G3): the pane is the scroller and fits the viewport (`100dvh` with the
   fallback pattern in `grid.css`). A top spacer lets row 1 reach the frame, a bottom spacer lets row 9
   reach it. The page itself does not scroll in lens mode.
7. **Frame and ruler** (brief section 2): the fixed navy frame (`pointer-events: none`, the seal under
   it stays the real button, G5), top at about 54% of the pane, over the **second** visible inning
   column. Inning 1: same frame place, blank ruled paper to its left. The fixed ruler under the
   frontier row, and the `--paper-3` rail cell.
8. **Bottom bar shell**: the fixed 168 px bar + `env(safe-area-inset-bottom)` with only the **[Sheet]**
   button in it for now. L4 fills the rest. The bar height must be final now, because the frame
   position depends on it.
9. **Whole sheet** (brief section 3, "Whole sheet", first-version form): [Sheet] turns lens mode off
   for this visit only (React state, not stored), shows today's sheet at its fit zoom with the frontier
   cell outlined in navy, and a floating navy "Back to the box" returns to the lens.
10. **Top/Bottom** (G20): in lens mode, `side` follows the frontier and the manual control is hidden.
    It shows in the whole-sheet view.

## Size and folder caps (check before you add a file)

- `src/components/scoring/` already has 12 source files, the `check-dir-size` maximum. New components
  go in **`src/components/scoring/lens/`**. A hook goes there too: `src/hooks/` is at its budget (28).
- `src/lib/` is at its budget (59): new logic goes in `src/lib/scorecard/`.
- `src/styles/` is at its budget (118): new CSS goes in **`src/styles/scorecard/lens.css`**, with an
  `@import` in `src/index.css` after the other scorecard partials.
- `check-file-size` caps a file at 600 lines. Today: `src/screens/Scorecard.jsx` 538 (**close**),
  `ScorecardSheet.jsx` 446, `ScorecardPage.jsx` 226. Add only thin props to those three. Put the lens
  in its own component.
- Never raise a cap or a budget.
- Tokens, not raw values (G16): add `--lens-*` tokens with a comment in `src/tokens/layout.css` or
  `effects.css`. Add each new text/background pair to `src/lib/design/contrastPairings.js`.
- Kraft only on a seal (G11): the frame, ruler and [Sheet] button use navy and paper, never `--seal*`.

## ADR and docs

- New ADR **0091**, "On a phone, the sheet moves under a fixed lens": why scroll and not transform,
  why measure, why the compact rail, why lens mode is off under a force-reveal, why nothing is stored.
  Before you take 0091, check no open PR or remote branch uses it (`git ls-tree` each
  `origin/*` branch's `docs/adr/`). `check-adr-numbers` must pass.
- A pointer in `src/CLAUDE.md` (scorecard section). Keep the root `CLAUDE.md` unchanged.

## Verify (no e2e)

In Chrome devtools, iPhone 390 × 844. Start with `/07072026/milstl-2/scorecard?nointro` (gamePk
823035). Use `docs/test-games.md` to find games for the rest. Use an Incognito window to start a game
from the top. The frontier must sit under the frame for: row 1, row 9, inning 1, a bat-around inning
(extra column), a flip cell after a half ends, and a half that ends on a caught stealing if a listed
game has one. Also check: at 1024 px wide the sheet is today's sheet; with Scores Unlocked on, the
lens is off.

## Rules

- Test first. Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge.
- Spoiler rule (G8): before a tap, nothing in the DOM (text, aria, class, position, timing) may differ
  by the sealed at-bat's result.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 4), and the two shimmed guards exit 0. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L3: the still lens". Body: what, why,
   spoiler-safety, the six frontier positions you checked (with the game and URL for each),
   "Part of #724".
4. Leave the dev server running. Your last message, in plain words for Gary: the PR link, the
   worktree and branch, the clickable local URL, and what to do: "set the phone size, tap the sealed
   box, and see the next sealed box move under the navy frame; tap Sheet, then Back to the box".
