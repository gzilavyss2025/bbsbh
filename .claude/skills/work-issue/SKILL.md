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

**The issue number** is `$ARGUMENTS` with any leading `#` removed; call it N below.
If it is empty or not a number, ask Gary which issue, and stop until he answers.

## 1. Read

Read issue N with its comments and labels, any linked issues or PRs, and the
code it names. List the open PRs and their files. If another PR touches the same code,
stop and name it.

## 2. Interview

Ask Gary with `AskUserQuestion`, **one question at a time**. Put a recommended option
first, and ask only what the issue and the code leave open: scope, UX choices, edge
cases, and what "done" looks like. Stop when you could write the "Done means" list
without guessing. For a new or redesigned screen, show a wireframe Artifact first
(`design-brief`). Then restate the plan in a few lines and ask one last question: build this plan,
or change it. Build only on a yes. This is the last stop before the merge.

## 3. Build

Work on this session's branch, and follow CLAUDE.md. A logic fix ships with a test
that fails without the fix. Check anything user-visible in Chromium on the route you
changed. Run the narrow checks from `steward`, "Before every push".

## 4. Review and fix

Run the `code-review` skill (Skill tool, args `high origin/main`) so it reviews every
commit on the branch, not only the last one. Fix every finding
you agree with. Write down each finding you reject and why. Run the narrow checks
again, then commit.

## 5. PR

Push, then open a draft PR that follows the template, with a `Closes #N` line.
List the review findings: fixed or rejected, and why. Subscribe to the PR's activity.
When CI is green, remove `wip`. Handle any CI failure with `steward`.

## 6. Merge

Check the gates in `merge-pr`, step 2: green `lint-and-build` on the head SHA,
no `wip` or `do-not-merge` label, and no conflict. Wait for CI with a PR event or
`send_later`, never a `sleep` loop. Then mark the PR ready and merge it with a merge
commit. Never merge around a gate. Never push to `main`.

Report (this replaces `merge-pr`'s short report) the PR link, the merge commit, the closed issue, the rejected findings, and the
route to check on production. A deploy that breaks follows `merge-pr`, "If production
breaks".
