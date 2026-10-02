PR to gate: #____   (Gary: write the PR number here before you paste.)

Model: Opus 5.5, effort high, for L2, L3, L4, L5 and L7 (spoiler core, the bar's spoiler test,
geometry, motion). Sonnet 5.5, effort high, for L6 and L9. Sonnet 5.5, effort medium, for L1.

# Lens gate for #724: review one slice PR, then merge it into the integration branch

## Context

Repo `gzilavyss2025/bbsbh`. Issue #724 ("Lens and Ruler") is built in slices. Each slice PR goes into
the integration branch `claude/lens-ruler`. The brief is
https://github.com/gzilavyss2025/bbsbh/issues/724#issuecomment-5953254710. The slice prompts are in
`C:\Users\gzilavy\claude-prompts\lens-ruler-724\`. Read the one that matches this PR's title (L1, L2 …).

**Authority (Gary, 2026-10-02):** you merge a slice PR into `claude/lens-ruler` when its CI and your
review pass. Do not wait for Gary to look first; he looks after the merge, and a later slice fixes
what he finds. You may **never** merge anything into `main`.

## Do this

1. `git fetch origin`. `gh pr view <N>`: the base must be `claude/lens-ruler`. If the base is `main`,
   stop and tell Gary.
2. **Worktree.** Run `git worktree list`. If the PR branch is already checked out in a worktree (a
   local slice leaves `../bbsbh-lens-l<k>`), work there: `git pull`. Else
   `git worktree add ../bbsbh-lens-gate-<N> <branch>` and `npm install`. Do not edit the primary
   checkout.
3. **Bring in the base.** In the worktree, `git merge --no-edit origin/claude/lens-ruler`. If it
   conflicts, resolve it and keep both sides' work. If the merge made a commit, push it, so CI tests
   the combined code. If a conflict is not clearly mechanical, stop and tell Gary.
4. **CI.** `gh pr checks <N> --watch`. Only the `lint-and-build` row decides. Another check that fails
   (for example Claude Code Review) does not block. If `lint-and-build` fails, read the log. A failure
   that is not about this diff (a network timeout, a runner error): re-run it once with
   `gh run rerun <run-id> --failed`. A small, clear failure in the diff: fix it on the PR branch. For
   anything else, stop and report. If no check starts within 15 minutes, stop and tell Gary.
5. **Local checks.** `npm run lint`, `npm test` and `npm run build`. Read the exit codes.
   **Windows baseline:** on this PC, lint fails `check-dir-size` and `check-file-size`, and
   `npm test` fails the three `.cluster`, `.grid` and `.stack` tests, only because of `\` in paths.
   They fail the same way on `origin/main`; CI (Linux) passes them. Run those two guards with the
   shim instead, and each must exit 0:
   `node --import=file:///C:/Users/gzilavy/claude-prompts/lens-ruler-724/posix-paths.mjs scripts/check-dir-size.mjs`
   and the same for `scripts/check-file-size.mjs`. Any other local failure counts.
6. **Review** the diff against `origin/claude/lens-ruler`:
   - Does it do its slice and only its slice? Compare with the slice prompt.
   - The spoiler rule (brief G8): before a tap, nothing in the DOM may differ by the sealed result.
     Helpers read only the clamped view. Force-reveal (Scores Unlocked, a stamp) turns the lens off.
   - The gotchas the slice prompt names. Caps and budgets not raised. Tokens, not raw values. No
     kraft on anything that is not a seal.
   - Tests: written for the change, none loosened or skipped.
   - Run `/code-review` at effort high on the PR diff.
7. **Look at it.** If the slice changes the screen: if a dev server already runs from this worktree
   (`node scripts/dev-servers.mjs`), use it. Else start the first free of `npm run dev` (5173),
   `dev:2` to `dev:5`. If all five are taken, stop only the servers of `bbsbh-lens-*` worktrees whose
   PR is already merged (`taskkill /PID <pid> /F`), nothing else. Load the slice's URL with
   `?nointro` at 390 × 844 and do what the PR's Local check or handoff says. Take a screenshot if
   you can.
8. If the review finds problems: fix small ones on the PR branch (commit, push, go back to step 4).
   For a big one, write it as a PR comment and stop. Do not merge.
9. If it is good: `gh pr merge <N> --merge` (not squash: later slices may be based on its commits).
   The base is `claude/lens-ruler`. A local cleanup error from `gh` after the merge is harmless.
10. Count the commits `claude/lens-ruler` is behind `origin/main` that touch `src/`
    (`git log --oneline origin/claude/lens-ruler..origin/main -- src | wc -l`). Only report the number.
    Do not merge `main` in here. L10 does that.

## Rules

- The browser suite is Gary's alone: leave it. Do not push to `main`. ASD-STE100 for any PR comment.

## Finish

Leave the dev server running. Your last message, in plain words for Gary:
- merged or not, and why;
- the clickable local URL and what to tap and see (if the slice changes the screen);
- how far `claude/lens-ruler` is behind `main` (step 10);
- which slice to start next, from the run sheet.
