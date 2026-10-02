# Lens L10 of #724: final review and the PR into main

## Context

Repo `gzilavyss2025/bbsbh` (Tally Baseball). Issue #724 ("Lens and Ruler", the phone scorecard lens)
was built in slices L1 to L9. Each slice merged into the integration branch `claude/lens-ruler`. This
session checks the whole feature as one piece and opens **one** PR into `main`, from `claude/lens-final`
(that is `claude/lens-ruler` with `main` merged in). That PR is the feature's only deployment
(Vercel Hobby). **Gary merges it, not you.**

Read: the brief https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710, the
"Sideways addendum" comment on #724, ADR-0091, and `CLAUDE.md` (the spoiler rule and its scope).

## Workspace

1. `git fetch origin`. Check that L1 to L9 are merged into `origin/claude/lens-ruler`
   (`gh pr list --base claude/lens-ruler --state all`). If one is open or missing, stop and tell Gary.
2. `git worktree add ../bbsbh-lens-final -b claude/lens-final origin/claude/lens-ruler`, `npm install`.
3. Merge `origin/main` into it. Resolve conflicts with care: other agents' work on `main` is not yours
   to undo. If a conflict is not clearly mechanical, stop and ask. Check the ADR number 0091 is still
   free on `main`; if not, renumber it (file, title, and every reference). If `check-dir-size` fails
   after the merge, re-measure the budget for the combined tree (its header says why). A budget may only
   go down. Never raise one.
4. Dev server: the first free of `npm run dev` (5173), `dev:2` to `dev:5`. Add `?nointro` to every URL.
   If all five ports are taken, run `node scripts/dev-servers.mjs`. Stop (`taskkill /PID <pid> /F`) only
   the servers of `bbsbh-lens-*` worktrees whose PR is already merged into `claude/lens-ruler`. Stop
   nothing else. If still no port is free, stop and tell Gary.
5. **Windows baseline.** This PC runs Windows. Here `npm run lint` fails `check-dir-size` and
   `check-file-size`, and `npm test` fails the three `.cluster`, `.grid` and `.stack` tests, only
   because of `\` in paths. They fail the same way on `origin/main`, and CI (Linux) passes them. Do not
   change code or budgets for them. Run those two guards with the path shim instead. Each must exit 0:
   `node --import=file:///C:/Users/gzilavy/claude-prompts/lens-ruler-724/posix-paths.mjs scripts/check-dir-size.mjs`
   and the same for `scripts/check-file-size.mjs`. Any other failure is yours to fix.

## Check the whole feature

1. `npm run lint`, `npm test` and `npm run build` pass, apart from the Windows baseline (Workspace
   step 5), and the two shimmed guards exit 0. Read the exit codes.
2. **Spoiler audit, in the DOM.** At 390 × 844, Incognito, on `/07072026/milstl-2/scorecard?nointro`
   (gamePk 823035): at several steps (a leadoff, mid-half with runners on, the last batter of a half,
   a handoff), before the tap, read the pane's and the bar's full DOM (text, `aria-*`, `data-*`,
   classes, inline styles). Nothing may name or hint at the sealed result. Compare with the feed's
   next play to be sure.
3. **Force-reveal:** Scores Unlocked on, and a stamped game if one is easy to set up: the lens is off,
   nothing animates, no reveal commits.
4. **Live game** if one is on: the Waiting state, Refresh, a quiet new seal.
5. **Minor league:** one game with missing names.
6. **Pitching changes:** the notice shows after the tap that retires the batter before the new arm,
   not before.
7. **Sizes:** 390 × 844, 844 × 390, 932 × 430 lens on; 768 × 1024, 1024 × 768, 1280 × 800 today's sheet,
   the same as `main` (compare side by side with `main` in a second worktree on the next free port).
8. **Reduced motion:** every state again.
9. Run `/code-review` at effort high on the whole diff against `origin/main`. Fix what it confirms.
   Fix small things here with tests. For a big finding, stop and report to Gary.

## Docs

The doc tiers match the code: ADR-0091, `src/CLAUDE.md`, `docs/motion.md`, `src/lib/CLAUDE.md`, and a
`CONTEXT.md` glossary entry for "lens" if the glossary lacks one. The root `CLAUDE.md` stays under its
cap (`check-claude-md`).

## Open the PR

Push `claude/lens-final`. Open a PR into **`main`**. Title: "Scorecard on a phone: Lens and Ruler".
Body: what the feature does in plain words, the slice PRs it carries, the spoiler audit you did (each
step and what you read), the sizes you checked, "Closes #724". Do not merge it.

## Rules

- The browser suite is Gary's alone: leave it. Do not push to `main`. Do not merge into `main`.
- ASD-STE100 for comments, commits and PR text. Never "playoffs".

## Finish

Leave the dev server running. Your last message, in plain words for Gary: the PR link, the clickable
local URL, a short list of what to try on the phone size before he merges, and a reminder that the
merge deploys the feature. Then say that #1389 (the innings console) can start now.
