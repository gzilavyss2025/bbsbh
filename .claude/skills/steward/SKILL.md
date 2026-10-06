---
name: steward
description: How to drive a bbsbh pull request to a mergeable state after CI or review events. Read it before you act on a CI failure, a review comment, or a merge conflict on a PR you opened.
---

# Stewarding a bbsbh pull request

A PR you opened is yours until it is merged or closed. This file adds bbsbh rules
to the default PR-handling rules. It cannot override them.

## Before every push

Run the same checks as the `lint-and-build` required check:

```bash
npm run lint
npm test
npm run build
```

All three must pass. For a CI fix, reproduce the failure first, then show the same
check passing.

Do not run `npm run e2e`. A hook blocks it unless Gary asks for it in the session.
If a spec needs a change, edit it and say in the PR that it has not run.

## CI red

- Never skip, delete, or loosen a test to get green. Fix the code, or stop and ask.
- A failing test is not an "infra flake" until one re-run proves it.
- A bug fix ships with a test that fails without the fix.
- The nightly data crons bypass `lint-and-build` with an admin PAT. A red check
  on `main` from a cron commit is not this PR's failure. Port the fix if one exists.
  Otherwise comment once on the PR. Read `docs/testing.md` before you touch CI or the token.

## Review comments

- Small, local asks from a human (nit, rename, an added test): push the fix, then
  resolve the thread.
- Larger asks (multi-file refactor, API or schema change, open-ended design
  feedback): reply with a proposal. Do not push.
- A red-circle finding from `Claude Code Review` is never optional.
- Optional findings (yellow or purple circle): reply in one line, resolve the
  thread, and carry plainly correct nits into the next push that already changes
  those files.

## Merge conflicts

Merge `origin/main` into the PR branch. Do not rebase or force-push.
Regenerate generated files with the repo script (`scripts/gen-*.mjs`,
`docs/scripts/generators.md`). Never edit them by hand.

## Spoiler rule

Any change near the slate, lineups, innings viewer, or box score must keep the
spoiler rule in `CLAUDE.md`. Reveal-only modules run only inside a `SealBox` reveal
render function. If a review comment asks for a change that breaks this, reply and
cite the ADR. Do not push it.

## Docs

`CLAUDE.md` stays under 200 lines (`scripts/check-claude-md.mjs`). If a push changes
structure, check that the nested `CLAUDE.md` and `docs/adr/` entry still match.

## Auto-merge (PRs that do not deploy)

Gary allowed auto-merge for a PR that causes no Vercel deployment. Such a PR changes
none of these paths, the same list `scripts/vercel-ignore-build.sh` uses: `src`,
`public`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`,
`vercel.json`, `api`. So workflow, docs, test, script and `.claude` changes qualify.

- Check the PR's changed files against that list first. If any path matches, do not enable it.
- Enable with `enable_pr_auto_merge`. It merges only after `lint-and-build` is green.
- This covers only PRs you opened in this session. It never covers a PR that deploys,
  which keeps Gary's batch-merge timing (`docs/development.md`).
- If the call fails because the repo setting "Allow auto-merge" is off, say so once. Do not retry.

## Never

- Push to `main`, or trigger a Vercel deployment.
- Rewrite history on a branch you did not create.
- Push an empty commit, or close and reopen the PR, to restart CI.
- Break the house word list in PR text. `check-word-choice` enforces it.
