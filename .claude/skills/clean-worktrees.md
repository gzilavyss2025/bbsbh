---
name: clean-worktrees
description: Interactively remove local bbsbh worktrees whose work is already merged or whose upstream branch was deleted. Use when the user says "clean worktrees" or asks to clear out stale worktrees.
---

# /clean-worktrees

Interactively remove local worktrees whose work is already merged. Companion to
the informational check `session-start.sh` runs automatically at the start of
every local session (`scripts/worktrees.mjs`) — that check only reports, this
skill is what actually deletes directories and branches, and only with the
maintainer's confirmation each time.

Nothing in the normal branch → PR → merge flow removes a worktree afterwards, so
they accumulate: a session in 2026-07 found 48, of which 41 were already merged.
Each carries its own ~14.5k-file `node_modules`, so a large backlog is slow to
clear — which is the reason to clear it a couple at a time, every session.

## Steps

1. Run `git fetch origin --prune` first. `scripts/worktrees.mjs` reads the
   last-fetched remote state, so without this a just-merged branch still reads
   as active and a deleted upstream still looks alive.
2. Run `node scripts/worktrees.mjs` and show the full report to the user
   verbatim (path, branch, status, uncommitted count for every worktree). If it
   reports 0 stale, say so and stop — nothing to do.
3. Only entries the script marks stale are safe to suggest. It marks stale only
   when the branch is merged into `origin/main`, or its upstream was deleted,
   **and** the worktree is clean. Never widen this by eye:
   - `active (unmerged work)` / `active (never pushed)` — likely another
     concurrent agent's work. Never suggest, never pre-select.
   - `merged, but has uncommitted changes` — call these out explicitly as
     needing a human look, and leave them alone. Someone's unsaved work.
   - `fresh (no commits yet)` — this is usually the worktree the current
     session is working in.
4. Use `AskUserQuestion` (multiSelect) listing each stale entry, labelled by
   worktree directory name and branch, so the user picks which to remove. Let
   them select from the full list in case they know better than the heuristic —
   just don't pre-select anything outside step 3.
5. For each selected worktree, in order:
   - `git worktree remove <path>` (add `--force` only if it fails on ignored
     build artifacts, never to override uncommitted tracked changes)
   - `git branch -d <branch>`, falling back to `-D` only for the
     upstream-deleted case, where the commits are genuinely in `main` under a
     squash merge and `-d` cannot prove it
   - Report the outcome per worktree.
6. Removal is slow (~4s each, because of `node_modules`). If more than ~10 are
   selected, run the loop with `run_in_background: true` — a foreground sweep of
   30 exceeds the 2-minute command timeout and leaves half-removed directories
   behind.
7. Finish with `git worktree prune`, then re-run `node scripts/worktrees.mjs`
   and confirm the removed entries are gone. Check for leftover directories that
   git deregistered but failed to delete, and report any it finds rather than
   silently deleting them.
8. Never remove a worktree the user didn't explicitly select. Never run this
   automatically — it's on-demand only, unlike the SessionStart report.

## Do not

Don't hand-roll a `git branch -vv | grep '[gone]'` loop to find candidates. Git
prints `[origin/<branch>: gone]`, so that pattern silently matches nothing and
reports success having done nothing — the bug in the upstream `commit-commands`
plugin's `/clean_gone`, which is why this repo has its own skill.
`scripts/worktrees.mjs` checks the ref structurally instead.
