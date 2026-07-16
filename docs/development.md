# Development workflow & deployment

How changes land in this repo, and why the deploy setup is shaped the way it is.
The root `CLAUDE.md` carries a short summary and points here for the detail.

## One working mode: branch and pull request

Every local, interactive, autonomous, and remote agent session follows the same
workflow:

1. Work on a task-specific branch, preferably in a dedicated worktree when several
   agents are active.
2. Keep work-in-progress on that branch and validate it locally.
3. Push the branch only when useful for review or backup; avoid micro-pushes.
4. Open a pull request and let the maintainer decide when to merge it.

Never push directly to `main`, invoke `vercel deploy`, or enable an ad hoc preview
without explicit maintainer authorization. Merging to `main` is the production
deployment trigger and is intentionally controlled by the maintainer.

## Concurrent agents

The maintainer often runs several agents at once. Branches isolate commits, but
agents sharing a checkout can still see and overwrite each other's uncommitted
files. Treat isolation as a hard requirement:

- Before editing, inspect `git status`, the current branch, and relevant diffs.
  Assume unfamiliar changes belong to another active agent.
- Use a dedicated task branch and, when available, a dedicated worktree. Never
  reset, stash, overwrite, reformat, or clean another agent's changes.
- Check for file ownership overlap before touching a dirty file. If tasks overlap,
  stop and coordinate rather than editing through the other change.
- Keep each session's change scoped to the one task it was given rather than
  opportunistically touching unrelated files — smaller diffs collide less.
- Say in the PR description which files you touched, so the maintainer can spot
  overlap across several open PRs at a glance.
- Prefer merging/closing promptly over letting several `claude/*` branches sit open
  in parallel — the longer one lives, the more likely another session's PR conflicts
  with it.
- No branch other than `main` gets its own Vercel preview deployment (see
  `git.deploymentEnabled` below) — verify locally (`npm run dev` / `npm run e2e`)
  before opening the PR rather than expecting a preview URL on the PR check.

## Local visual handoff

For every user-visible change:

- Run the relevant checks and start the first free reserved server: `npm run dev`,
  then `npm run dev:2` through `dev:5` if another agent owns the earlier port.
- Verify the exact route that demonstrates the change. Keep the server running so
  the maintainer can inspect it after the handoff.
- End the final message with a clickable example URL, not merely the server root;
  for example, `http://localhost:5172/team/158` for a Brewers team-page change.

For docs, scripts, or other changes with no visual surface, say explicitly that a
localhost example is not applicable.

## Deployment

Hosted on Vercel, auto-deploying `main` to production on every push. This is a
Hobby-plan account, so production deployments are scarce. Agents must reduce them
ruthlessly: keep work on PR branches, combine related changes, avoid unnecessary
push/merge cycles, and leave the final merge timing to the maintainer. Two settings
in `vercel.json` enforce part of that policy:

- `git.deploymentEnabled: { "main": true, "*": false }` — skips deployments
  entirely for every branch except `main`. Preview any other branch locally
  instead (see above); nothing but `main` ever gets a Vercel URL.
- `ignoreCommand: scripts/vercel-ignore-build.sh` — Vercel's Ignored Build Step;
  skips a deployment when the push touched only docs/scripts/workflow files with no
  effect on the deployed app (diffs against `VERCEL_GIT_PREVIOUS_SHA`, the last commit
  Vercel actually deployed, so a multi-commit push is judged as a whole). Defaults to
  building whenever it can't confidently tell — a missed skip just costs one
  deployment; a wrong skip is a silent non-deploy.

## CI

`.github/workflows/ci.yml` runs `npm run lint` + `npm run build` on every PR and
every push to `main` — a required, visible gate so a session that skipped the local
checks (or whose change only breaks in combination with another still-open PR) can't
merge unnoticed. `npm run lint` also runs the zero-dep guards `check-caps.mjs` and
`check-claude-md.mjs` (see `scripts/CLAUDE.md`).
