Status: resolved

# Primary checkout's node_modules missing @clerk/clerk-react

## What happened

While verifying a UI fix (2026-07-20, star-badge-centering session), `npx vite`
in the primary checkout (`C:\Users\gzilavy\bbsbh`, not a task worktree) failed
to start with:

```
Error: The following dependencies are imported but could not be resolved:
  @clerk/clerk-react (imported by C:/Users/gzilavy/bbsbh/src/components/AccountPitch.jsx)
```

`@clerk/backend` and `@clerk/clerk-react` are both listed in `package.json`
and `package-lock.json`, but `node_modules/@clerk` didn't exist. `npm install`
in the primary checkout added 19 packages and fixed it — so the lockfile was
correct, the installed tree just wasn't in sync with it.

## Why this matters for future sessions

Multiple agent worktrees run off this repo concurrently (see
`[[bbsbh-automate-worktree-setup]]` — worktrees already need a manual
`npm install`/Playwright-install pass per session). This means the *primary*
checkout can also silently drift out of sync with the lockfile if a
dependency was added while the primary's `node_modules` wasn't touched. A
session that tries to run the primary checkout's dev server (rather than a
worktree's) can hit the same resolution error.

## Root cause (found same session, after initial triage above)

The primary checkout's local `main` was **18 commits behind `origin/main`**
(`git status -sb` → `main...origin/main [behind 18]`). Those missing commits
included PR #278 (merged 2026-07-20), which landed
`.claude/hooks/setup-new-worktree.mjs` — a `PostToolUse` hook that auto-runs
`npm install && npx playwright install chromium` for any worktree spun up
with `git worktree add`, registered in `.claude/settings.json`. Because the
primary checkout never pulled that commit, its local `.claude/settings.json`
didn't register the hook, so it never fired for worktrees created from a
session rooted in the stale primary — leaving them to hit the exact
`npm install`-not-run friction the hook exists to prevent. It's plausible the
same staleness is why `node_modules/@clerk` fell behind `package.json` in the
primary itself (unconfirmed — the primary's `package.json` already listed
Clerk, so this may be a separate, second drift).

Note: the original open question below referenced "PR #277" as the source of
the worktree-setup hook — #277 was actually **closed** (superseded by #278,
which combined several open PRs, including #277's hook, into one branch/PR).
The hook that exists on `origin/main` today shipped via #278, not #277.

## Resolution (2026-07-21)

By the next session, the drift had grown to 52 commits behind — confirming
this recurs rather than being a one-off. Fixed two ways:

- Manually fast-forwarded the primary checkout's local `main` to `origin/main`
  once (`git pull --ff-only`), after discarding an unrelated stray local edit
  to `public/brand/tally-wordmark.png` that a newer commit also touched.
- Added an automated guard to `.claude/hooks/session-start.sh` that runs on
  every session start in the primary checkout only (detected via `.git` being
  a real directory, not a worktree's gitfile pointer): if local `main` is
  behind `origin/main` and the working tree is clean, it fast-forwards
  automatically; if the tree is dirty, it warns instead of touching anything.
  So the drift can no longer silently reach the size it did here.

Still unconfirmed / left open: whether the primary's own `node_modules` needs
the same "stays in sync" treatment as worktrees (a step running `npm install`
if `package-lock.json` changed since last install). Not addressed by this fix
since it wasn't the reported symptom this time around.
