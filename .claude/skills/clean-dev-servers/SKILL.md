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
2. The script's own summary line names how many it considers stale, and it
   reaches that verdict through `worktrees.mjs`'s classifier, so it matches
   what `/clean-worktrees` would say about the same folder. Those entries —
   `merged into origin/<branch>`, `upstream branch deleted (PR merged or
   closed)`, or `orphaned (worktree deleted)` — are safe to suggest killing.
   Anything else (`active (unmerged work)`, `active (never pushed)`, `fresh`,
   an uncommitted-changes worktree, or `main (primary checkout)`) is likely
   still in use by another concurrent agent, or is the maintainer's own
   server — call those out, don't suggest killing them by default.
3. Use `AskUserQuestion` (multiSelect) listing each stale entry (label it with
   port + worktree name) so the user picks which ones to actually kill. Always
   let them select from the full list, including active ones, in case they
   know better than the merge-status heuristic — just don't pre-select those.
4. For each PID the user selected, kill it and report the outcome per PID.
   The command depends on the machine:
   - macOS / Linux: `kill -TERM <pid>`, then `kill -9 <pid>` only if the
     process is still there a couple of seconds later.
   - Windows: `taskkill /PID <pid> /F`.
   Then re-run `node scripts/dev-servers.mjs` and confirm the killed entries
   are gone.
5. Never kill a process the user didn't explicitly select. Never re-run this
   automatically — it's on-demand only, unlike the SessionStart report.
