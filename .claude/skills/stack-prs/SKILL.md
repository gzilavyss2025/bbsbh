---
name: stack-prs
description: Combine every open bbsbh PR into one stacked PR, review it, fix what the review finds, and merge it to main when it is ready. Use when the user says "stack the PRs", "merge everything", "land the open PRs", or asks for one batch merge. Optional args - PR numbers to include, or "dry run" to stop before the merge.
---

# /stack-prs

Land all open PRs as one change. One merge to `main` means one Vercel deployment.
The Hobby plan allows about 100 deployments a day; one batch per stack keeps `main`
tidy and each deploy reviewed.

**Invoking this skill is the maintainer's explicit yes to merge to `main`.** The
orchestrator may also invoke it under the maintainer's standing permission
(`.claude/skills/orchestrate/`, "Stacking"); it then passes explicit PR numbers. It is
the only merge the maintainer pre-approves. The gates in step 7 still apply. If
one gate fails, stop and report. Never merge around a gate.

The maintainer is not a technical user. Pick the sensible default, say what you
did, and end with a short list of what needs him.

## Tools

- **Cloud session** (`CLAUDE_CODE_REMOTE=true`): no `gh`. Use the `mcp__github__*`
  tools for PRs, reviews, checks, and merges. Use plain `git` for the branch work.
- **Local session**: `gh` works. Run the branch work in a worktree, never in the
  primary checkout (see `docs/development.md`).

## Steps

1. **Refresh and list.** `git fetch origin --prune`. List open PRs
   (`mcp__github__list_pull_requests`, or `gh pr list --state open`). Drafts count:
   cloud sessions open every PR as a draft.
   - If the user named PR numbers, use only those.
   - Skip a PR labeled `wip` or `do-not-merge`. Skip a PR that targets a branch
     other than `main` unless its base PR is also in the set.
   - Skip the stack PR from an earlier run of this skill. Say so.
   - If nothing is left, report that and stop.
   - **Note the linked issues.** Read each PR body and its commit messages. Record
     every issue it names, and how: a closing keyword (`Closes`, `Fixes`,
     `Resolves` `#<n>`) or a plain reference (`#<n>`, `Refs #<n>`, `(#1132, E9)`
     in a title). You need this list in steps 5 and 9.
2. **Order them.** A PR whose base is another PR's branch goes after that PR.
   Otherwise go by PR number, lowest first. For each PR, list the files it
   changes. Report any two PRs that touch the same file. Those are the likely
   conflicts.
3. **Build the stack.** Branch `stack/<YYYY-MM-DD>` from current `origin/main`.
   **Cloud session:** build on the session's own `claude/<name>` branch instead. A
   cloud session may push only there. Reset it to current `origin/main` first, and
   read `stack/<date>` below as that branch.
   Merge each PR head in order with `git merge --no-ff origin/<head>`. Do not
   rebase and do not squash here. Each PR stays one visible merge commit.
   - **Conflict in a lockfile or generated file:** regenerate it with the repo
     tool (`npm install`, or the `scripts/gen-*.mjs` named in the file header).
     Never hand-edit it.
   - **Conflict in code:** resolve it if the two sides touch different logic and
     both must stay. If both sides changed the same logic and keeping one loses
     behavior, stop. Name both PRs and the file. Ask the maintainer with
     `AskUserQuestion`, one question at a time. If nobody is watching, stop and put
     the question in the report as `[DECISION: ...]`.
   - **A PR that will not merge cleanly and is not worth the fight:** leave it out,
     and say which one and why. Do not drop it silently.
4. **Check the stack.** Run `npm run lint`, `npm test`, and `npm run build`.
   Fix any failure the merge caused. Fix failures one PR caused in that PR's
   code, not by loosening a test. Never skip, delete, or weaken a test
   (CLAUDE.md, "Test discipline").
5. **Open the stack PR.** Push the branch with `git push -u origin stack/<date>` (the session branch in a
   cloud session).
   Open one **draft** PR to `main`. Look for a PR template first
   (`.github/pull_request_template.md`) and fill it in. The body lists each
   source PR with its title and link, the merge order, and any PR left out.
   Repeat each source PR's closing keywords for its issues (`Closes #<n>`), one
   per line, so GitHub closes those issues when the stack PR merges. Do not add a
   closing keyword for an issue that a source PR only references.
   Add the attribution lines from the session reminder. Subscribe to its activity
   (`subscribe_pr_activity`).
6. **Review the stack, then fix.** Run the `code-review` skill on the stack PR at
   `high` effort. Then check these four things by hand, because the generic review
   does not know them:
   - **The spoiler rule.** A reveal-only module (`linescore.js`, `derive.js`,
     `hitchart.js`) called outside a `SealBox` reveal render function. A
     score-revealing value fetched, computed, or rendered early. See CLAUDE.md,
     "The spoiler rule".
   - **Test integrity.** Any test removed, skipped, or given a weaker assertion
     (`git diff origin/main -- test e2e`). A bug fix with no test that fails
     without it.
   - **Cross-PR interaction.** Two PRs that are each fine alone but break each
     other: a renamed export one PR still imports in another, two PRs that edit
     the same CSS token, a doc catalog that lists a file one PR deleted.
   - **Docs tiers.** A structural change with no update to the nested
     `CLAUDE.md` or `docs/adr/` entry it touches. `npm run lint` catches some.

   Fix every finding that is real, in this order: correctness, spoiler, test
   integrity, then the rest. Keep each fix small. Commit fixes on the stack
   branch with a clear message. A finding that needs a design choice goes to the
   maintainer, not into a guess. Run step 4 again after the last fix. Push.
7. **Merge gates.** Check all of these on the current head of the stack PR. The
   merge waits until every one is true:
   - CI `lint-and-build` is green on the latest commit. If it is red, root-cause
     it, fix it, and push. Do not re-run to hope.
   - No merge conflict with `main`. If `main` moved, merge it into the stack
     branch and re-run step 4.
   - No open red-circle review finding and no failing Claude Approvals row.
   - The review in step 6 found nothing left open.
   - The user did not ask for a dry run.

   If a gate cannot pass, stop. Say which gate, why, and what you need.
8. **Merge.** Mark the stack PR ready for review. Merge it with a **merge
   commit**, so GitHub marks each source PR as merged. Use
   `mcp__github__merge_pull_request`. If the repo allows only squash, use that,
   and then do the cleanup below by hand. Never push to `main` directly.
9. **Clean up.** Do these in order, after the merge only:
   1. **Close the source PRs.** For every source PR still open: close it with one
      comment that links the merged stack PR. Then read each one again and confirm
      it shows as merged or closed. Do not close a PR that was left out of the
      stack (step 3) or skipped (step 1).
   2. **Update the issues.** For every issue on the list from step 1, read it
      first, then:
      - **Closing keyword:** confirm GitHub closed it. If it is still open, close
        it with a reason of completed.
      - **Plain reference:** leave it open. Do not change its labels. The triage
        labels in `docs/agents/triage-labels.md` are the maintainer's call.
      - **Comment on every one,** once, with the stack PR link, the source PR it
        came from, and a plain status: "Landed in <stack PR link> (from <source
        PR link>); closed" or "...; still open". Add the attribution footer from
        the session reminder.
      - **An issue that is already closed:** comment only if the status changed.
        Skip it otherwise.
      - **An issue you cannot read or edit:** do not guess. Put it in the report.
   3. **Delete the branches.** Delete the source branches and the stack branch on
      the remote.
   4. **Reset local state.** Fetch and fast-forward local `main`. Remove the stack
      worktree if you made one.

## Report

Short. First a few lines on what you did, then:

> **Needs you:** …

Name each item. Examples: a PR left out and why, a design choice from the
review, a gate that stopped the merge, an issue you could not update. If the
merge happened, give the stack PR link, the count of PRs it landed, and the
issues you closed or commented on. If nothing needs him, say exactly that.

Do not start other work after the report.

## Rules that do not bend

- Never push to `main`. The only way to `main` is the stack PR.
- Never force-push a source PR's branch. Merge it in; leave its history alone.
- Never skip a failing check to merge faster.
- Never merge a stack that the review has not covered.
- A stack run that finds nothing to stack is a valid result. Say so and stop.
