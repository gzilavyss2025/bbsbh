# Manager splits: the chunk prompt (#2761)

One prompt for every H chunk. Change only `CHUNK`. Model: Haiku 5.5, effort medium.
Run one chunk at a time, and start the next only
after the last one's PR is merged: every chunk rewrites the seed, the queue and the
ledger. M1–M3 need S0 first and Sonnet; do not use this prompt for them.

Re-run a chunk on Sonnet 5.5 at medium effort when Haiku's PR has three or more
`[DECISION]` lines.

---

```text
CHUNK = H1

Do chunk CHUNK of GitHub issue #2761 (gzilavyss2025/bbsbh). Read the issue first.
Its CHUNK line lists ten or eleven "teamId season" pairs. Use the branch this
session gives you. In the cloud there is no gh: use the GitHub MCP tools. Before
you edit, list the open PRs. If another open PR changes
scripts/manager-transitions-seed.json, stop and write
[DECISION: another seed PR is open: #<n>] as your only output.

For each pair, in order:

1. Find who managed first (the outgoing manager) and both managers' W-L for
   that club-season. Use the Baseball-Reference team page,
   https://www.baseball-reference.com/teams/<CODE>/<YEAR>.shtml, on its
   "Manager" line. If that page will not load, use the club's Wikipedia season
   page. Record the URL you used. If neither page loads, skip to step 4 with
   status "no-source".
2. Run (the outgoing manager's last name, then that manager's W-L, then the
   incoming manager's W-L):
     node scripts/research/find-manager-split.mjs <teamId> <season> <outgoing last name> <outW-outL> <inW-inL>
   Example: node scripts/research/find-manager-split.mjs 158 1975 Crandall 67-94 1-0
   If it fails with a network error, run it one more time. If it fails again,
   go to step 4 with status "fetch-failed".
3. Only when "status" is "ok": append the "Seed entry" line it prints, unchanged,
   to the END of scripts/manager-transitions-seed.json. Do not reorder existing
   entries.
4. Any other status (incoming-mismatch, doubleheader, date-order, no-match,
   no-games-after, name-not-matched, more-than-two-managers, not-queued,
   no-source, fetch-failed): add NO entry. Write one line in the PR body:
     [DECISION: <teamId> <season> — <status>; source says <out> / <in>; <URL>]
   Do not adjust the numbers to make the script agree. Never guess.

Then:

5. For each season you added: node scripts/gen-manager-history.mjs --from=<season> --to=<season>
   Then once: node scripts/gen-franchise-ledger.mjs --through 2025
6. Check that each season you added is gone from
   scripts/manager-transitions-needs-research.json. If one is still there, write
   a [DECISION] line for it and remove its seed entry.
7. git status. Revert every public/data/manager-history/ and manager-staff/ shard
   whose only change is "generatedAt" (git diff each one). Keep the seed, the
   queue, the shards that really changed, and the changed ledger files.
8. Run npm run lint and npm test, and read the exit code of each. If one fails,
   check whether it also fails on origin/main. If it does, say so in the PR body
   and go on. If it fails only on your branch, stop and write the failure in the
   PR body.
9. Open a DRAFT PR titled "Manager splits CHUNK (#2761)". Body: a table of
   season | transitionDate | outgoing W-L | incoming W-L | source URL, then the
   [DECISION] lines, then "Part of #2761" (not "Closes"). End with the preview
   link to one manager page you split: <preview URL>/manager/<outgoingManagerId>?nointro.
   Do not edit the issue. Gary ticks the CHUNK box when the PR merges, and
   seasons left as [DECISION] stay in the queue for a later pass.

Do not edit any other file. Do not touch other chunks' seasons.
```
