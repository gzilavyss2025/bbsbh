# /clean-dev-servers

Interactively find and kill stale local `vite` dev/preview servers left running
from past sessions/worktrees. Companion to the informational check
`session-start.sh` runs automatically at the start of every local session
(`scripts/dev-servers.mjs`) — that check only reports, this skill is what
actually kills processes, and only with your confirmation each time.

## Steps

1. Run `node scripts/dev-servers.mjs` and show the full report to the user
   verbatim (PID, port, worktree path, branch, status for every running vite
   process it finds). If it reports none running, say so and stop — nothing
   to do.
2. For any entry whose status is `merged into origin/<branch>` or
   `orphaned (worktree deleted)`, it's safe to suggest killing. For any entry
   still `active (unmerged work)`, call it out as likely still in use by
   another concurrent agent/worktree — don't suggest killing it by default.
3. Use `AskUserQuestion` (multiSelect) listing each stale entry (label it with
   port + worktree name) so the user picks which ones to actually kill. Always
   let them select from the full list, including active ones, in case they
   know better than the merge-status heuristic — just don't pre-select those.
4. For each PID the user selected, kill it with
   `taskkill /PID <pid> /F` (Windows; this repo's only dev machine) and report
   the outcome per PID.
5. Never kill a process the user didn't explicitly select. Never re-run this
   automatically — it's on-demand only, unlike the SessionStart report.
