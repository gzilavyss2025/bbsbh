Use the ponytail skill at level full. Reuse what the repo already has before you write anything new.

# Lens L6 of #724: the carry strip

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 builds "Lens and Ruler": on a phone, the
scorecard opens zoomed onto the next sealed at-bat under a fixed navy frame. The brief is the issue
comment https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. Read sections 1,
2 ("Carry strip"), 3 ("Order wraps mid-half"), 4 ("Carry") and gotchas G2, G3, G8, G15, G16.

The problem it solves: when the batting order wraps (the 9-hitter reaches, then row 1 is up), the pane
scrolls far up the sheet. The last result and the runners' boxes are then off screen, and the reader
cannot copy them onto paper.

**Already on `claude/lens-ruler`:** L2 helpers (`src/lib/scorecard/`: `situation`, `runnerMoves`),
L3 lens layout, measured scroll and top spacer (ADR-0091), L4 bar, L5 dock and pitcher sheet.

## Workspace

1. `git fetch origin`. Base: `origin/claude/lens-ruler`. Check that L5 is merged into it:
   `gh pr list --base claude/lens-ruler --state merged --json number,title` must list "Lens L5".
   If not, stop and tell Gary.
2. `git worktree add ../bbsbh-lens-l6 -b claude/lens-l6-carry origin/claude/lens-ruler`, then
   `npm install`. Do not edit the primary checkout.
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

## Build

1. **Which boxes**: the last opened box plus every runner still on base, at most 3. Read who is on
   base from L2's `situation`. Read only opened cards (G8).
2. **When it shows**: when the last opened box **or** any runner's box is outside the pane's visible
   area. **Measure** it with `getBoundingClientRect()` against the pane (G2). Do not reason from row
   numbers. Re-measure after each tap and each scroll settle.
   Put the visibility test in a pure function in `src/lib/scorecard/` that takes rects, with a test
   (test first).
3. **Look**: pinned at the top of the pane, in L3's top spacer band (G3), 16 px insets. Header
   "The order wrapped · carried from below". Each box at 0.9 scale, the real `AtBatBox`, labelled, for
   example "Varganyi · last · on 1st". Reuse the sheet's own box component; do not draw a second box.
4. It must not cover the frame. If the band is too short for 3 boxes on a 390 × 844 screen, report the
   measured numbers in the PR and show as many as fit.
5. Minor league: labels degrade to the slot number when a name is missing.

## Caps and folders

New components in `src/components/scoring/lens/` (split it into a subfolder before about its 10th
file). CSS in `src/styles/scorecard/`. `src/lib/`, `src/hooks/`, `src/styles/` and
`src/components/scoring/` are full. 600-line file cap. Never raise a cap. Tokens, not raw values.
`src/lib/scorecard/` fills up across the slices: at about its 10th file, move a group into a
subfolder (`check-dir-size` fails at 13).
No kraft (G11).

## Verify (no e2e)

iPhone 390 × 844, Incognito. The order wraps in any half where the 9-hitter bats and the 1-hitter
follows in the same half. That is common. Find one in the anchor game
`/07072026/milstl-2/scorecard?nointro`, else in another game in `docs/test-games.md`. Pick one where
the 9-hitter reaches base. Name the game and half in the PR.
Tap until the order wraps with runners on base: the strip shows the last box and the runners. Tap
until the boxes are back in view: the strip goes away. Check that a cold reload at that point shows the
right strip.

## Rules

- Test first. Never loosen a test. The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 4), and the two shimmed guards exit 0. Read the exit codes.
2. Run the `ponytail-review` skill on your diff and apply its cuts. Then run `/code-review` and fix
   what it confirms.
3. Push. Open a PR into **`claude/lens-ruler`**. Title: "Lens L6: the carry strip". Body: what, why,
   the game and step you checked, "Part of #724".
4. Leave the dev server running. Last message, in plain words for Gary: the PR link, the clickable
   local URL, and the exact taps that bring the strip up.
