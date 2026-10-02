Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L1 of #724: move the scorecard seal's focus ring off the kraft

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler", a phone view of the
scorecard. The brief is the issue comment
https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. Read gotcha **G12** and
**G16** in it. You do not need the rest. This slice is small and stands alone.

The bug: `.sc-ab__seal:focus-visible` in `src/styles/scorecard/box.css` draws
`outline: 2px solid var(--focus-ring)` with `outline-offset: -2px`. The ring sits inside the kraft.
Field green on kraft is about 1.81:1, under the 3:1 a focus indicator needs (WCAG 2.4.11 / 1.4.11).
`.sc-ab__flip` uses the same offset but sits on paper, so it passes. Only the seal fails.

## Workspace (cloud session)

1. `git fetch origin`. Your base is the integration branch `origin/claude/lens-ruler`, not `main`.
   If that branch does not exist, stop and tell Gary to run step 0 of the run sheet.
2. Make a worktree: `git worktree add .claude/worktrees/lens-l1 -b claude/lens-l1-focus-ring origin/claude/lens-ruler`.
   A hook refuses edits in the plain clone, so work only in the worktree. Run `npm install` there.
3. If `gh` is missing, use your GitHub tools for the PR.

## Do this

1. **Test first.** Make a check that fails on today's code. Preferred: extend
   `scripts/check-focus-ring.mjs` so a `:focus-visible` rule on `.sc-ab__seal` (or, if you can do it
   simply, on any selector whose own rule paints a `--seal*` background) fails with a negative
   `outline-offset`. Run `npm run lint` and see it fail. If the wider form flags other existing rules,
   keep the check on `.sc-ab__seal` only, and list the other rules in the PR body. Do not fix them here.
2. **Fix.** Set the seal's `outline-offset` to `2px` or more, so the ring sits on paper
   (field on `--paper-2` is about 5.62:1). Keep the form `outline: <w> solid var(--focus-ring)`,
   which `check-focus-ring` requires.
3. **Check the ring is not cut off.** The seal fills its table cell. Find out if a parent clips the
   outline (`overflow: hidden` on the cell, the pane or the sheet) or if a neighbour cell paints over it.
   If it does, fix that in the seal's own rules only. Say what you found in the PR.
4. Add the pair (field on the seal's surrounding paper) to `src/lib/design/contrastPairings.js` if
   `check-contrast` wants it. Use the measured ratio from `check-contrast`, not the number above.
5. Do not touch `.sc-ab__flip`, `.sc-ab__fliptext`, the seal's colours or its breath. Later slices do.

## Rules

- ASD-STE100 for comments, commits and PR text (`docs/agents/writing-style.md`). Never "playoffs".
- The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge your PR.

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L1: move the seal's focus ring onto paper".
   Body: what, why (the 1.81:1 number and the WCAG rule), the new check, the clip finding,
   "Part of #724". Add a **Local check** section: the URL
   `http://localhost:5173/07072026/milstl-2/scorecard?nointro`, then "press Tab until the sealed box
   has focus; the green ring shows outside the kraft, on paper, on all four sides".
4. Your last message, in plain words for Gary: the PR link, and that the gate prompt (`G-gate.md`)
   gives him the link to look at.
