Status: needs-triage

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

## Open questions / next steps

- Not yet diagnosed *why* the primary's node_modules fell behind — worth
  checking whether something (a hook, a script) is supposed to keep it in
  sync and isn't, or whether it's simply expected drift from `npm install`
  only running in worktrees.
- Consider whether the worktree-setup automation from PR #277 should also
  cover the primary checkout, or whether a lint/CI check should catch a
  lockfile/node_modules mismatch before it's discovered mid-session.
