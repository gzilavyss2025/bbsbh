# Repository agent workflow

These rules apply to every agent and every session in this repository.

## PR-only delivery and Vercel budget

- Never push changes directly to `main` and never invoke a Vercel deployment. Work on a task-specific branch and deliver changes through a pull request for the maintainer to merge.
- This project is on Vercel Hobby. Treat every production deployment as scarce: keep work-in-progress on branches, batch related changes into one PR, and reduce pushes and merges that could create deployments ruthlessly.
- Vercel previews are disabled for non-`main` branches. Validate locally; do not enable branch previews or create an ad hoc deployment unless the maintainer explicitly authorizes it.

## Concurrent-agent isolation

- At the start of every fresh context, run `git fetch origin --prune`, `git worktree list`, `git status --short --branch`, and inspect open PRs before choosing a checkout. Do not start editing in whichever directory happened to open.
- For an independent task, create a new worktree and branch from current `origin/main`. If the task depends on an unmerged PR, identify that exact PR branch and base the new work on it intentionally; open PRs and old worktrees are not automatically part of the latest code.
- Assume uncommitted or unfamiliar changes belong to another active agent. Inspect `git status` and relevant diffs before editing, and do not overwrite, reset, stash, reformat, or otherwise disturb them.
- Keep each task on its own branch and, when separate checkouts are available, its own worktree. Touch only files required for the assigned task. If ownership overlaps, stop and coordinate rather than editing through another agent's work.
- End every task with a handoff that names the branch, worktree path, PR, dependency branch (if any), validation status, and whether the worktree is safe to remove. Never remove a dirty worktree or one whose PR is still active.
- In the PR description, list the files or subsystems changed and flag likely overlap with other active work.

## Claude/Codex parity

- These rules apply equally to Claude Code and Codex. Claude's `.claude/settings.json`
  hooks are useful safeguards for Claude sessions, but Codex must not assume those
  hooks ran: perform the fetch/worktree/status/PR checks above explicitly and never
  edit the shared primary checkout.
- Before editing, read this file and the root `CLAUDE.md`; then read the most
  specific nested `CLAUDE.md` and linked ADRs for the directories or invariants the
  task touches. Use `CONTEXT.md` and `docs/agents/` for shared vocabulary and
  workflow conventions rather than recreating local interpretations.
- The shared skills live under `.agents/skills/` and are available to both agents.
  `.claude/skills/` contains Claude-oriented entrypoints and pointers; it is not a
  substitute for the repository rules above.
- Preserve the test harness honestly: run the relevant unit/lint/E2E checks, add a
  regression test for a bug fix when practical, and never delete, skip, weaken, or
  bypass an assertion just to get a green result. Record validation in the handoff.

## Local visual handoff

- For user-visible changes, run the appropriate checks and start a localhost dev server using the first free reserved script: `npm run dev`, then `dev:2` through `dev:5` if needed.
- Verify the exact changed route locally. Keep the server running for the maintainer, and end the handoff with a clickable example URL such as `http://localhost:5172/team/158`.
- If a change has no user-visible surface, state that a localhost example is not applicable instead of implying that one exists.

See `docs/development.md` for the expanded workflow and reserved ports.

## Architecture docs

- This repo's architecture decisions live in `CLAUDE.md` (root + nested `src/CLAUDE.md`, `src/api/CLAUDE.md`, `scripts/CLAUDE.md`) and `docs/adr/`. Read the relevant one before touching the data layer, generators, or spoiler-reveal logic — don't infer architecture from a single file's diff.
- As of `docs/adr/0021-sqlite-data-layer.md`: `gen-game-score.mjs`, `gen-team-score.mjs`, and `gen-season-score.mjs` now author their `public/data/*.json` output through a shared SQLite layer (`scripts/lib/schema.sql`, `scripts/lib/db.js`) instead of hand-rolled JSON merges, so cross-file joins (e.g. Season Grade) don't need another one-off merge function. The committed source of truth is TEXT dumps (`scripts/data/*.sql`), never a binary `.db` — see the ADR before adding a new table or generator to this layer.
