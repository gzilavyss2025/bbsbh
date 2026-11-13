---
name: work-issue
description: Take one GitHub issue from open to merged in this session. Interview Gary about it, build it, run /code-review high, fix the findings, and merge on green CI.
argument-hint: "[issue-number]"
disable-model-invocation: true
---

# Work issue

**Gary running `/work-issue $ARGUMENTS` is his explicit yes to merge the PR this
session opens for that issue.** It covers that one PR and no other. Every gate below
still applies.

Use the `mcp__github__*` tools in a cloud session (`gh` in a local session).

## 1. Read

Read issue #$ARGUMENTS with its comments and labels, any linked issues or PRs, and the
code it names. List the open PRs and their files. If another PR touches the same code,
stop and name it.

## 2. Interview

Ask Gary with `AskUserQuestion`, **one question at a time**. Put a recommended option
first, and ask only what the issue and the code leave open: scope, UX choices, edge
cases, and what "done" looks like. Stop when you could write the "Done means" list
without guessing. For a new or redesigned screen, show a wireframe Artifact first
(`design-brief`). Then restate the plan in a few lines and go on. Do not wait for
a reply.

## 3. Build

Work on this session's branch, and follow CLAUDE.md. A logic fix ships with a test
that fails without the fix. Check anything user-visible in Chromium on the route you
changed. Run the narrow checks from `steward`, "Before every push".

## 4. Review and fix

Run `/code-review high` on the branch diff against `origin/main`. Fix every finding
you agree with. Write down each finding you reject and why. Run the narrow checks
again, then commit.

## 5. PR

Push, then open a draft PR that follows the template, with a `Closes #$ARGUMENTS` line.
List the review findings: fixed or rejected, and why. Subscribe to the PR's activity.
When CI is green, remove `wip`. Handle any CI failure with `steward`.

## 6. Merge

Run the gates from `merge-pr`, "Steps" 2–4: green `lint-and-build` on the head SHA,
no `wip` or `do-not-merge` label, and no conflict. Then mark the PR ready and merge it
with a merge commit. Never merge around a gate. Never push to `main`.

Report the PR link, the merge commit, the closed issue, the rejected findings, and the
route to check on production. A deploy that breaks follows `merge-pr`, "If production
breaks".
