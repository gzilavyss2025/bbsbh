---
name: start-day
description: Get the local bbsbh checkout to a known-good state at the start of a session (refresh main, clear finished dev servers/worktrees/branches, check open PRs and ready-for-human issues, nightly cron, README drift) and report what needs a decision. Use when the user says "start day" or asks for the morning status check.
---

# /start-day

The maintainer's first command of the day, in a fresh session, before any other
prompt. Gets the local checkout back to a known-good state and reports what
needs a decision — so a day's work never starts from a stale `main`, a merged
worktree, or a forgotten dev server.

**Audience note: the maintainer is not a technical user.** Report outcomes in
plain language, make the routine calls without asking, and end with a short list
of what actually needs him. Don't present technical options or trade-offs — pick
the sensible default and say what you did. This includes clearing worktrees the
`stale` heuristic clears (merged or upstream-deleted, and clean), killing the dev
servers that same heuristic clears, and deleting branches whose upstream is gone
— do all three automatically, no confirmation, as part of the routine. Anything
outside that bar — an
`active`/`fresh`/uncommitted-changes worktree, an `active (unmerged work)` dev
server, or anything outward-facing (pushing, merging, deploying) — still needs
his explicit yes.

## Steps

Run these in order, in the primary checkout (the repo root, not a task worktree).
**The order of steps 3 and 4 matters and is not arbitrary** — see the note under
step 4.

1. **Refresh remote state.** `git fetch origin --prune`. Everything below reads
   this, so it must come first.
2. **Update `main`.** If the primary checkout is on `main`, clean, and behind,
   fast-forward it (`git pull --ff-only origin main`). If it has uncommitted
   changes, don't touch it — report that instead, and say what the files are.
   `session-start.sh` also attempts this; doing it here is harmless and covers
   the case where the session started before a merge landed.
3. **Dev servers — before worktrees, always.** Run
   `node scripts/dev-servers.mjs`. Kill every entry the script calls stale
   (`merged into origin/<branch>`, `upstream branch deleted`, or `orphaned
   (worktree deleted)`) now, no confirmation — macOS/Linux: `kill -TERM <pid>`,
   then `kill -9 <pid>` only if it's still alive a couple seconds later;
   Windows: `taskkill /PID <pid> /F`. Leave `active (unmerged work)`, `active
   (never pushed)`, `fresh`, uncommitted-changes and `main (primary checkout)`
   entries running — report them instead. Re-run the script afterward to
   confirm the killed ones are gone, and report how many were killed.

   The script shares its verdict with `worktrees.mjs` (it calls that module's
   `classifyWorktree`), so the two reports agree by construction. They have not
   always: before 2026-09-15 this one asked only "is HEAD an ancestor of
   `origin/main`", which a squash-merged branch fails, so it labelled finished
   branches `active (unmerged work)` while `worktrees.mjs` correctly called
   them stale. If the two ever disagree again, that is a bug — stop and say so;
   don't pick a side by hand.
4. **Worktrees.** Run `node scripts/worktrees.mjs`. For every entry it marks
   stale (merged into `origin/main`, or upstream deleted, **and** clean — the
   same bar `/clean-worktrees` uses), remove it now, no confirmation:
   `git worktree remove <path>`, then `git branch -d <branch>` (fall back to
   `-D` only for the upstream-deleted case, where the commits are in `main`
   under a squash merge and `-d` can't prove it). Finish with
   `git worktree prune`. Leave everything else alone — `active (unmerged
   work)`, `active (never pushed)`, `merged, but has uncommitted changes`, and
   `fresh (no commits yet)` are not safe to touch automatically; report those
   counts instead (offer `/clean-worktrees` if the user wants to review them
   by hand). Report how many worktrees were removed.

   **Why this comes after the dev servers.** On Windows a running dev server
   holds an open handle on its own worktree folder, so `git worktree remove`
   fails partway with `error: failed to delete '<path>': Invalid argument` —
   and it fails *destructively*: git drops the worktree registration anyway and
   leaves the whole tree on disk. The folder is then invisible to
   `worktrees.mjs`, which only knows what git tracks. On 2026-09-15 that
   stranded two folders of ~18,750 files each. macOS and Linux have no
   mandatory file locking, so the removal just succeeds there and the ordering
   bug stayed hidden for months. Kill first and neither platform can hit it.

   **Windows is also slow here.** Each worktree carries its own ~19k-file
   `node_modules`, so removing a batch takes minutes and will blow a two-minute
   command timeout. Run the removal loop in the background and poll it, rather
   than letting it time out mid-delete — a timed-out delete is exactly how a
   half-removed folder happens.

   **Then verify.** After `git worktree prune`, list the sibling folders next to
   the primary checkout (`ls -d ../bbsbh-*`) and compare against
   `git worktree list`. Any `bbsbh-*` directory git no longer tracks is a
   half-removed leftover: delete it with `rm -rf` once you have confirmed git
   doesn't list it. Report anything you removed this way. Sibling files that are
   not worktrees at all (stray screenshots, log folders from an old PR) are
   litter too — mention them, but don't delete them without his yes.
5. **Dead branches.** Worktree removal only deletes the branches that still had
   a worktree. Branches outlive their worktrees, and nothing else in the normal
   flow removes them, so they pile up invisibly — by 2026-09-15 there were 53
   local task branches, 38 of them with a deleted upstream. Sweep them:

   ```bash
   git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads |
     awk '$2 == "[gone]" { print $1 }'
   ```

   Delete each one with `git branch -D` (`-d` refuses a squash-merged branch,
   which is most of them). A gone upstream means the remote branch was deleted,
   which only happens after its PR merged or closed — so this is safe, and it
   is the same bar step 4 uses. Never touch a branch that still has an upstream,
   or one that never had one: that is unshared work. Report the count only.
6. **Open PRs and issues waiting on him.** `gh pr list --state open` — for each,
   note whether checks are passing and whether it's waiting on him (needs
   review/merge) or on an agent (in progress, changes requested). Then
   `gh issue list --label ready-for-human --state open`, which is the label the
   triage convention uses for "an agent has taken this as far as it can, the
   maintainer has to decide something". On a day with no open PRs those issues
   are the *only* thing needing him, and a PR-only check reports "nothing needs
   you" straight past them. List both under **Needs you**.
7. **Overnight data crons.** Check that the nightly data workflow actually ran
   and pushed — `gh run list --workflow=update-nightly-data.yml --limit 3`. A
   silent cron failure has happened before and stales the site's data without
   any visible error (see the 2026-07 README-regen incident). Flag a failed or
   missing run prominently.

   `update-nightly-data.yml` is the ONLY data cron — the three weekly ones
   folded into it on 2026-08-28. A **missing** run matters as much as a failed
   one: on 2026-08-27/28 GitHub's scheduler skipped it entirely after an Actions
   incident, and nothing anywhere went red. Check the run actually exists for
   today, not just that the last one passed. Recover either case with
   `gh workflow run update-nightly-data.yml` — it rebuilds every dataset,
   including the structural ones, and one run catches up however many nights
   were missed.

   `data-freshness-check.yml` (added 2026-08-29) is the automated version of
   this step: a second schedule at 15:00 UTC that fails, and emails the
   maintainer, if nothing has touched `public/data` in 26 hours. It exists
   because a run that never happens cannot fail, so the nightly job could never
   catch its own absence. Check it here too — if IT is also missing a run, both
   schedules were dropped and the answer is the same manual dispatch.

8. **README drift.** Check whether `README.md` has fallen behind the code:

   ```bash
   git log --format=%H -1 -- README.md          # last README commit
   git log --format=%H "<that sha>..origin/main" -- ':(exclude)public/data' ':(exclude)README.md' | head -n1
   ```

   If the second command prints nothing, the README is current — say nothing
   about it. If it prints a sha, real code has landed since the README was last
   written, so report it under **Needs you** as one line: the README may be
   stale, and you can regenerate it on request.

   **Do not regenerate it as part of this skill** — that's work, not a status
   check, and README prose is user-facing. Only when he says yes: make a task
   branch and worktree the normal way, follow `readme-prompt.md` in this skill's
   directory, run `npm run lint`, and open a PR. Never push README.md to `main`
   directly. A README-only commit deploys nothing (`scripts/vercel-ignore-build.sh`
   doesn't watch that path), so it costs no deployment either way.

## Report format

Keep it short. A few lines of "here's what I did", then:

> **Needs you:** …

listing only items requiring a decision — a PR to merge, a `ready-for-human`
issue, a failed cron, a dirty worktree that has to be resolved by hand, a stale
README. If nothing needs him, say exactly that, and that he can start prompting
normally.

Counts, not inventories: "removed 9 finished worktrees and 38 dead branches" is
the report; the list of names is not. The exception is anything under **Needs
you**, which names the specific thing every time.

Never end this skill by starting other work. It's a status check; wait for his
next prompt.
