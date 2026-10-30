---
name: merge-pr
description: Merge one named bbsbh PR to main on green CI, with no stack, no review and no local checks. Use when the user says "merge the pr", "merge this", "merge #123" or "land #123" about one PR (or a short list he names). For "stack the PRs", "merge everything" or a batch of all open PRs, use stack-prs instead.
---

# Merge PR

**Gary saying "merge the pr" is his explicit yes to merge that PR to `main`.** It is a
yes for this request only. CI is the gate. Do not review the PR, and do not run
lint, tests or the build here: CI already ran them on the PR's head. If Gary wants a
review or a spoiler check, he asks for it.

Use the `mcp__github__*` tools in a cloud session (`gh` in a local session).

## Which PR

- He gave a number: use it.
- He did not: use the PR for this session's branch. If there is none, and exactly one
  open PR is not `wip`, use it. Otherwise ask which one (in an unattended run, stop and
  report).
- Several numbers: do each one in turn, lowest first. This gives one production
  deployment per PR. For more than two, say that `/stack-prs` gives one for all of them.

## Steps

1. **Read the PR.** State, draft flag, labels, mergeable state, and the head SHA.
2. **Gates.** All must be true on the current head:
   - It is open and targets `main`.
   - It has no `wip` or `do-not-merge` label. A `wip` PR is not done: stop and say so.
     Do not remove the label for him.
   - The `lint-and-build` check passed on the head SHA. Still running: wait for it
     (`send_later` or a PR event, not a `sleep` loop). Red: stop, and give the failing
     step from the job log.
   - The Vercel preview deployment for the head SHA is not failed (the `Vercel`
     check, or the vercel[bot] comment's Deployment column). Production builds the
     same way, so a failed preview is a failed deploy. "Ignored" is fine: the push
     touched nothing that deploys, and the earlier preview stands. Still building:
     wait as above. Failed: stop, and give the build error from the deployment's logs
     (`mcp__Vercel__list_deployment_events`).
   - No merge conflict. If the branch is only behind `main`, update it on GitHub
     (`mcp__github__update_pull_request_branch`) and go back to the CI gate for the
     new head. A conflict: stop and say which files. Do not resolve it here.
3. **Merge.** If it is a draft, mark it ready (`draft: false`). Merge with a merge
   commit (`mcp__github__merge_pull_request`, `merge_method: merge`). Never push to
   `main`.
4. **Report** in two lines: the PR link and the merge commit, and the issues its
   `Closes #n` lines closed. A PR that only says `Part of #n` leaves that issue open;
   say so. Do not comment on issues, close other PRs or touch labels.

If a gate fails, say which gate, why, and what is needed. Never merge around a gate.

## If production breaks after the merge

Roll back first, fix second. Vercel Pro rolls production back to any earlier
deployment at once (`mcp__Vercel__request_rollback` to the last Ready production
deployment before this merge, or `vercel rollback <url>` locally). Say what you
rolled back to. Then fix on a branch; the fix PR lands the usual way. Do not
revert on `main` and do not push to `main`.
