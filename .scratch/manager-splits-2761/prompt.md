# Manager splits: the chunk prompt (#2761)

One prompt for every H chunk. Change only `CHUNK`. Model: Haiku, medium effort.
Run one chunk at a time, and start the next only after the last one's PR is merged:
every chunk rewrites the seed, the queue and the ledger. M1–M3 need S0 first and
Sonnet; do not use this prompt for them.

Re-run a chunk on Sonnet when Haiku's PR has three or more `[DECISION]` lines.

---

```text
CHUNK = H1

Do chunk CHUNK of GitHub issue #2761 (gzilavyss2025/bbsbh). Read the issue first.
Its CHUNK line lists ten "teamId season" pairs.

For each pair, in order:

1. Find the outgoing and incoming managers' W-L for that club-season. Use the
   Baseball-Reference team page, https://www.baseball-reference.com/teams/<CODE>/<YEAR>.shtml,
   on its "Manager" line. If that page will not load, use the club's Wikipedia
   season page. Record the URL you used.
2. Run:
     node scripts/research/find-manager-split.mjs <teamId> <season> <outW-outL> <inW-inL>
   It prints JSON and the two managers' names from the queue.
3. Only when "status" is "ok": append the printed seed entry to the END of
   scripts/manager-transitions-seed.json. Replace the two 0 ids with the ids
   the script printed, matching each name to the source's outgoing and incoming
   manager. Do not reorder existing entries.
4. Any other status (incoming-mismatch, doubleheader, no-match, no-games-after),
   more than two managers, or names that do not match the source: add NO entry.
   Write one line in the PR body:
     [DECISION: <teamId> <season> — <status>; source says <out> / <in>; <URL>]
   Do not adjust the numbers to make the script agree. Never guess.

Then:

5. For each season you added: node scripts/gen-manager-history.mjs --from=<season> --to=<season>
   Then once: node scripts/gen-franchise-ledger.mjs --through 2025
6. git status. Revert every public/data/manager-history/ and manager-staff/ shard
   whose only change is "generatedAt" (git diff each one). Keep the seed, the
   queue, the shards that really changed, and the changed ledger files.
7. npm run lint and npm test must pass (check the exit code).
8. Open a DRAFT PR titled "Manager splits CHUNK (#2761)". Body: a table of
   season | transitionDate | outgoing W-L | incoming W-L | source URL, then the
   [DECISION] lines, then "Part of #2761" (not "Closes"). Tick the CHUNK box on
   the issue only for the seasons that landed.

Do not edit any other file. Do not touch other chunks' seasons.
```
