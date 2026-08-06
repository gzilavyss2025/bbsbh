---
name: start-day
description: Get the local bbsbh checkout to a known-good state at the start of a session (refresh main, check worktrees/dev servers/open PRs/nightly cron) and report what needs a decision. Use when the user says "start day" or asks for the morning status check.
---

# /start-day

The maintainer's first command of the day, in a fresh session, before any other
prompt. Gets the local checkout back to a known-good state and reports what
needs a decision — so a day's work never starts from a stale `main`, a merged
worktree, or a forgotten dev server.

**Audience note: the maintainer is not a technical user.** Report outcomes in
plain language, make the routine calls without asking, and end with a short list
of what actually needs him. Don't present technical options or trade-offs — pick
the sensible default and say what you did. Anything genuinely destructive or
outward-facing (deleting worktrees, pushing, merging, deploying) still needs his
explicit yes.

## Steps

Run these in order, in the primary checkout (`C:\Users\gzilavy\bbsbh`).

1. **Refresh remote state.** `git fetch origin --prune`. Everything below reads
   this, so it must come first.
2. **Update `main`.** If the primary checkout is on `main`, clean, and behind,
   fast-forward it (`git pull --ff-only origin main`). If it has uncommitted
   changes, don't touch it — report that instead, and say what the files are.
   `session-start.sh` also attempts this; doing it here is harmless and covers
   the case where the session started before a merge landed.
3. **Worktrees.** Run `node scripts/worktrees.mjs`. Report the counts, not the
   full table. If any are stale, don't remove them here — say how many and offer
   `/clean-worktrees`, which asks before deleting anything.
4. **Dev servers.** Run `node scripts/dev-servers.mjs`. Same treatment: report
   stale ones and offer `/clean-dev-servers`. Never kill anything from here.
5. **Open PRs.** `gh pr list --state open`. For each, note whether checks are
   passing and whether it's waiting on him (needs review/merge) or on an agent
   (in progress, changes requested). This is the part he most needs.
6. **Overnight data crons.** Check that the nightly data workflow actually ran
   and pushed — `gh run list --workflow=update-nightly-data.yml --limit 3`. A
   silent cron failure has happened before and stales the site's data without
   any visible error (see the 2026-07 README-regen incident). Flag a failed or
   missing run prominently.

## Report format

Keep it short. A few lines of "here's what I did", then:

> **Needs you:** …

listing only items requiring a decision — a PR to merge, a failed cron, a dirty
worktree that has to be resolved by hand. If nothing needs him, say exactly that,
and that he can start prompting normally.

Never end this skill by starting other work. It's a status check; wait for his
next prompt.
