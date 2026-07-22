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

## Fresh-context startup checklist

A new Claude or Codex context must not assume that the directory it opened is the
right checkout or that the local `main` branch is current. Before editing:

```bash
git fetch origin --prune
git worktree list
git status --short --branch
gh pr list --state open
```

Then classify the task:

- **Independent task:** create a new worktree and task branch from the freshly
  fetched `origin/main`, which is the canonical set of merged code. For example:

  ```bash
  git worktree add ../bbsbh-score-card -b codex/score-card origin/main
  ```

  Claude-created branches may use `claude/<slug>`; Codex-created branches use
  `codex/<slug>`. Use a unique, descriptive worktree directory.

  A `PostToolUse` hook (`.claude/hooks/setup-new-worktree.mjs`) detects this
  command and runs `npm install` + `npx playwright install chromium` in the new
  worktree automatically, in the background — no need to install manually before
  running `dev`/`lint`/`e2e` there. It's fire-and-forget; give it a minute before
  the first command in a brand-new worktree.

  Dev servers started in a worktree keep running after that worktree's work is
  merged and forgotten, squatting on the reserved ports. `session-start.sh`
  reports any stale ones (branch already merged, or worktree deleted) at the
  start of every local session; run the `/clean-dev-servers` skill to review
  and kill them interactively.

  The worktrees themselves accumulate the same way, and for the same reason:
  merging a PR doesn't remove the local worktree it was written in. Left alone
  they pile up — 48 of them by 2026-07, 41 already merged, each holding its own
  ~14.5k-file `node_modules`. `session-start.sh` reports stale ones every local
  session (`scripts/worktrees.mjs`); run the `/clean-worktrees` skill to review
  and remove them interactively. Clear them a couple at a time as PRs land:
  removal costs a few seconds each, so a large backlog is slow enough to exceed
  a command timeout mid-sweep.

## Starting a day

The maintainer's routine is a fresh session and the `/start-day` skill, before
any other prompt: it fetches, fast-forwards `main`, reports stale worktrees and
dev servers, lists open PRs, and checks that the overnight data cron actually
ran. It reports and asks; it never removes, pushes, or deploys on its own.
- **Task that depends on an open PR:** identify the exact PR and head branch first.
  Base the new branch on `origin/<that-head-branch>` only when the dependency is
  intentional, and record that dependency in the new PR and final handoff. Do not
  treat every open PR as part of "latest."
- **Resume an existing task:** enter the exact worktree named in its previous
  handoff, confirm that its branch and PR still match, and inspect its dirty state
  before running any pull, rebase, cleanup, or generator.

`origin/main` means **latest merged code**. An open PR is newer only for work that
explicitly depends on it. A worktree merely proves that a checkout exists; it does
not prove that its branch is active, reviewed, clean, or safe to reuse.

If branch ownership, dependency, or dirty-file ownership is unclear, stop and ask.
Never solve ambiguity by copying files between worktrees, rebasing someone else's
active branch, or starting edits in the shared primary checkout.

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

## End-of-task handoff and cleanup

Every final task message should leave enough state for a fresh context to continue
without guessing:

```text
Branch: codex/score-card
Worktree: C:\Users\...\bbsbh-score-card
PR: #123 / URL (or "not opened")
Based on: origin/main at <short SHA>, or dependency PR #<number>
State: clean and pushed / dirty with named files
Validation: commands and result
Local example: http://localhost:<port>/<exact-route>, or not applicable
Cleanup: safe after PR merges / do not remove yet
```

Do not remove a worktree merely because its context window was closed. It is safe
to remove only when its files are clean and its work is merged, intentionally
abandoned, or preserved on a pushed branch. Before cleanup, confirm both:

```bash
git -C <worktree-path> status --short --branch
gh pr view <number> --json state,mergedAt,headRefName
```

After confirming it is safe, remove the worktree from another checkout, delete the
merged local branch, and refresh remote references:

```bash
git worktree remove <worktree-path>
git branch -d <branch>
git fetch origin --prune
```

Never use forced removal for a dirty worktree and never delete a branch whose
unmerged work has not been pushed or explicitly abandoned by the maintainer.

## Testing the app: always append `?nointro`

On a fresh or cleared `localStorage`, the first-visit welcome modal
(`FavoriteTeamModal` in `intro` mode) pops on the slate (`/`, `/{MMDDYYYY}`),
covers the screen, and steals focus. When you load the app to test or verify —
the home slate **or any other route** — append `?nointro` to the URL. It's a
one-load query flag (`GameSelect.jsx` `welcomeSuppressed`), never persisted, so
it doesn't leak into shared links, and it's harmless on non-slate routes since
routing parses the pathname only — so use it everywhere by habit.

- **Playwright** (`npm run e2e`, `npx playwright test`): import `test`/`expect`
  from `e2e/fixtures.js`, never `@playwright/test` directly. The fixture rewrites
  every `page.goto`/`page.reload` to carry `?nointro` automatically, so no spec
  can forget.
- **Manual / curl / MCP-driven**: put `?nointro` on the URL yourself, e.g.
  `http://localhost:5173/?nointro`. A SessionStart hook reminds every session,
  and a `Bash` PreToolUse advisory hook (`.claude/hooks/remind-nointro.mjs`)
  nudges if a slate URL slips through without it.

## Local visual handoff

For every user-visible change:

- Run the relevant checks and start the first free reserved server: `npm run dev`,
  then `npm run dev:2` through `dev:5` if another agent owns the earlier port.
- Verify the exact route that demonstrates the change (with `?nointro`, per above).
  Keep the server running so the maintainer can inspect it after the handoff.
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

## Optional environment variables

Everything works with none of these set — each feature they gate degrades to
"not configured, quietly absent" (see the relevant ADR for the exact fallback):

- `VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — multi-device reveal sync
  (ADR-0022). Unset, no sign-in UI renders at all.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — the reveal-sync
  backing store (ADR-0022); `api/reveal.js` returns `501` without these even if
  Clerk is configured.

## CI

`.github/workflows/ci.yml` runs `npm run lint` + `npm run build` on every PR and
every push to `main` — a required, visible gate so a session that skipped the local
checks (or whose change only breaks in combination with another still-open PR) can't
merge unnoticed. `npm run lint` also runs the zero-dep guards `check-caps.mjs` and
`check-claude-md.mjs` (see `scripts/CLAUDE.md`).
