# Player page redesign: run plan (cloud, from 2026-10-13)

Run plan for the `orchestrate` skill, Lane 3. Slug: `player-redesign`. Written with
`write-prompt` from the local session's handoff, checked against `origin/main` 6910d607e.

## Settled before the run (Gary, 2026-10-13)

- **PR #1901 merged** (ADR-0109 is on `main`) and #1879 is closed. Nothing is left to do there.
- **CI is green** on #1902, #1903 and #1904. The two local test failures were Windows paths only.
- **Blockers:** each issue gets a `Blocked by: #a, #b` line in its body. The orchestrator reads
  that line. The cloud cannot set native "blocked by" links, so Gary gets one checklist and
  adds them by hand. The run does not wait for him.
- **#1856 builds the data and the rank mark only.** No change to the live player page. The
  mark shows in `/design-lab`, and the hidden page (#1884) uses it.
- **#1884 waits for #1882, #1883, #1856 and the hero-tile data issue only**
  (`docs/player-redesign.md` line 116; the audit's gap 1). Pitch flight belongs to the Pitch
  arsenal module (#1892), so the audit's gap 2 blocks #1892, not #1884.
- **The live site can be imperfect while the new page is built.** Gary is the only daily user.
  A small change on a live page is not a reason to stop. Say it in the PR body.
- **The new pages are the standard.** Check new work against the design canvas and against the
  other new parts, so that they look like one family. Do not compare it with the live pages.

## Run plan

| # | What it does | Model | Effort | Depends on | Parallel with |
|---|---|---|---|---|---|
| 1 | Finish PR #1902: file the data-gap issues, add `Blocked by` lines, put issue numbers in the audit doc | `claude-sonnet-5-5` | medium | none | 2 |
| 2 | Finish PR #1903: shared parts. Merge main, screenshots, say why the 5 CSS lines stay | `claude-sonnet-5-5` | medium | none | 1 |
| 3 | Finish PR #1904: jump bar. Merge main, wide shadow, move its CSS, screenshots | `claude-sonnet-5-5` | medium | row 2 **merged** | 4 |
| 4 | #1856 and the hero-tile data issue: rank data, tile figures and captions, the rank mark (no live change) | `claude-sonnet-5-5` | high | row 1 done, row 2 **merged** | 3 |
| 5 | #1884: the hidden page. The orchestrator writes this prompt later | `claude-sonnet-5-5` | high (suggested) | rows 3 and 4 **merged** | none |

Why this order: #1903 and #1904 change five of the same files (`src/tokens/colors.css`,
`src/lib/design/contrastPairings.js`, `src/screens/designlab/catalog.js`,
`src/screens/designlab/index.jsx`, `src/styles/46-consent-modal.css`), and #1904 needs
`--shadow-stamped` from #1903. Row 4 needs the hero-tile issue number that row 1 files. Prompt 4
shows its mark on #1903's design-lab page, a file that #1904 does not touch. Prompt 1 changes
one doc and issue text, so it can run beside anything.

## Orchestrator steps (the parent session, not a child)

1. Run `orchestrate` Lane 3 with this plan. Cap 3. Work on this plan only. Do not start
   #1851, #1856 or any other `ready-for-agent` issue from the queue, except as prompt 4.
2. **Rows 1 to 3 continue an open PR.** Set `source_revision` and `outcome_branch` to the PR's
   head branch (#1902 `claude/player-redesign-data-audit`, #1903
   `claude/player-redesign-shared-parts`, #1904 `claude/player-redesign-jump-bar`). In the
   footer, replace "Open a DRAFT PR to main" with "Push to the existing PR #n. Do not open a new
   PR. Bring in main with a merge, never a rebase or force-push." If the push is refused, the
   child opens a new draft PR that links the old one. Ask Gary before you close the old one.
   (PR #1905 added this rule and its footer to the skill.)
3. **Stacking.** When #1903 is green and its `wip` label is gone, run `/stack-prs` with
   `1903` (and `1902` if row 1 is done and its `wip` label is gone). Then start row 3, and
   row 4 when row 1 is done. Before you start row 4, put the number of the issue that row 1
   filed as "Player redesign data: Hero tiles" in place of `<HERO-TILES>` in prompt 4.
4. **After row 1 finishes,** give Gary the native-link checklist from #1902's PR body, as one
   message. Do not ask him a question about it.
5. **Row 5.** When rows 3 and 4 are merged, run `write-prompt` on #1884. Use the code that
   merged, ADR-0109, `docs/player-redesign.md`, the audit doc and #1884's latest comments. Show
   Gary the prompt and ask once: "Start #1884 now?" Then start it. Start no module issue
   (#1885 to #1896, #1851) in this run.
6. Player ids: Turang 668930, Gasser 688107, Ashby 676879, Ohtani 660271.

---

## Prompt 1 of 4 — Sonnet 5.5, effort medium

```
Run at medium.

Finish draft PR #1902 (issue #1880, the player-redesign data audit). You are on its branch,
claude/player-redesign-data-audit. Read CLAUDE.md, docs/development.md ("Cloud sessions"),
docs/agents/triage-labels.md, ADR-0109 (docs/adr/0109-the-canvas-is-the-site-wide-look.md),
docs/player-redesign.md, and docs/player-redesign-data.md (the audit, on this branch).
Read the latest comments on #1880. Do not use the gist link in them; the branch replaces it.

Gary approved these issue changes. Make these and no others:

1. File one issue for each gap in the audit's "Summary of gaps" that has no issue yet.
   Gap 10 is #1881: do not file it. #1856 covers only the rank in gap 1, so file one
   issue for the rest of gap 1 (the league figure and the captions on the tiles), titled
   exactly "Player redesign data: Hero tiles". Gap 2 (pitch movement) blocks #1892 only:
   Gary decided on 2026-10-13 that Pitch flight belongs to the Pitch arsenal module, not
   the hero. Before you file each one, search
   the open issues, and read #1846 and #1851, so that you do not file a duplicate. If an
   open issue already covers a gap, use that issue and say so in the PR body.
   Each new issue: title "Player redesign data: <card>"; milestone "Player page redesign";
   a sub-issue of #1878 (parent_issue_number); body = the gap, the rows from the audit table
   with their Source and Fix, the player ids to check with, and "Blocks #n" for its module.
   Label it ready-for-agent when the audit's Fix column names the source and the change;
   else needs-info.
2. Rewrite the body of #1881 with the by-count plan in the audit's Foul balls section.
   Keep its title.
3. Add one line "Blocked by: #a, #b" at the top of the body of each issue below. Keep the
   rest of the body unchanged.
   - #1884: #1882, #1883, #1856, and the "Hero tiles" issue from step 1.
   - Each module issue #1885 to #1895, and #1851: #1884, and its data issue from step 1
     (#1891 uses #1881). A module with no gap gets #1884 only.
   - #1896: #1884.
   - #1898: every issue from #1884 to #1897, and #1851.
4. In docs/player-redesign-data.md, put the issue number on each line of "Summary of gaps".

Done means: every gap has one open issue, each issue in step 3 has its line, the doc names
the issues, npm run lint passes (eslint did not run locally), and the PR body is updated.

PR body: "Closes #1880". A table: gap, issue, label, blocks. Then a checklist titled
"Native links for Gary to add" with one line per pair, in this form:
"- [ ] #<module> blocked by #<data issue>".
Change the PR title to "Data audit for the player redesign (#1880)".

The GitHub MCP tools cannot set native "blocked by" links. Do not try other ways.
This is docs and issue text only: no ponytail, no code. Do not change any file but the doc.
Keep working until everything asked for is done. Stop to ask only when you cannot go on
without the user, or before a risky step. When the work is done and checked, stop and
report; do not add features, tests, files or docs that were not asked for. Tests, docs and
checks that this prompt or CLAUDE.md names count as asked for.
Stop if: a gap other than gap 2 does not map to one module issue, or two gaps look like
one issue. Write what you found, and do not guess.
```

## Prompt 2 of 4 — Sonnet 5.5, effort medium

```
Run at medium.

Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Finish draft PR #1903 (issue #1882, the player redesign's shared parts: tokens, the stamped
Card frame, StatTile, the FactGrid strip, the stamp-in). You are on its branch,
claude/player-redesign-shared-parts. Read CLAUDE.md, docs/development.md ("Cloud sessions"),
src/CLAUDE.md, src/styles/CLAUDE.md, src/components/ui/CLAUDE.md, ADR-0109 and
docs/player-redesign.md section 3. Read the PR body and the latest comments on #1882.

1. Merge origin/main into the branch. Do not rebase or force-push.
2. The 5 lines in src/styles/46-consent-modal.css stay where they are. They sit in the
   ANIMATION LAB section, and that section's comment says to add each new
   `.animlab__frame` rule there. Confirm this, and say why in the PR body.
3. Do the rest of the PR body's "Check" list and the issue's "Done means".
4. Screenshots in the preinstalled Chromium with ?nointro: /design-lab (the
   "stamped-parts" entry) at 390 and 1180 px, and /animation-lab (the stamp-in entry) at
   390 px. Compare them with the design canvas boards B-phone and B-wide
   (https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK; read with the Artifact tool,
   path "project/<board>.dc.html"). If you cannot read it, say so and compare with the
   spec. The new parts are the standard: do not compare them with the live pages. Send the
   screenshots to Gary with SendUserFile, and commit them to .scratch/player-redesign/shots/
   with names that start "1882-" (for example 1882-design-lab-390.png).
5. Run ponytail-review on the diff, apply the cuts it lists, then run /code-review.

Done means: npm run lint, npm test and npm run build pass; the screenshots are sent; the
PR body says "Closes #1882", lists the files, and says why the 5 CSS lines stay. Change
the title to "Shared parts for the player redesign (#1882)".

The live site can be imperfect while the new page is built. A small change on a live
page is not a reason to stop; say it in the PR body.
Keep working until everything asked for is done. Stop to ask only when you cannot go on
without the user, or before a risky step. When the work is done and checked, stop and
report; do not add features, tests, files or docs that were not asked for. Tests, docs and
checks that this prompt or CLAUDE.md names count as asked for.
Stop if: a test would need to be weakened, a design choice is open (a colour or a shape
the canvas does not show), or CI fails twice for a reason you cannot fix.
```

## Prompt 3 of 4 — Sonnet 5.5, effort medium

```
Run at medium.

Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Finish draft PR #1904 (issue #1883, the jump bar with counts: HubTabBar variant="anchor").
You are on its branch, claude/player-redesign-jump-bar. PR #1903 (shared parts) is now
merged into main. Read CLAUDE.md, docs/development.md ("Cloud sessions"),
src/CLAUDE.md, src/styles/CLAUDE.md, src/components/chrome/CLAUDE.md, ADR-0109 and
docs/player-redesign.md section 3. Read the PR body and the latest comments on #1883.

1. Merge origin/main into the branch. Do not rebase or force-push. Expect conflicts in
   src/tokens/colors.css, src/lib/design/contrastPairings.js,
   src/screens/designlab/catalog.js, src/screens/designlab/index.jsx and
   src/styles/46-consent-modal.css. Keep both sides in each one. In 46-consent-modal.css,
   #1903's 5 `.animlab__frame .card--stamp-in` lines stay where they are; step 3 moves
   only the jump-bar block.
2. Add the wide-screen box shadow with --shadow-stamped (now on main).
3. Move the 89 jump-bar lines out of src/styles/46-consent-modal.css into their own file.
   Do not put a new file in src/styles/ itself: that folder is at its check-dir-size
   budget (119). Use a subfolder, for example src/styles/system/jumpbar/jumpbar.css,
   imported in src/index.css directly after 46-consent-modal.css, so the cascade order
   does not change. Follow the import of system/stamped/stamped.css.
4. Screenshots in the preinstalled Chromium with ?nointro: /design-lab (the jump-bar entry)
   at 390 and 1180 px. Check it against the canvas boards B-phone and B-wide
   (https://claude.ai/artifact/V3RGaxTfYFsTqmB1ucTDEK; Artifact tool, path
   "project/<board>.dc.html") and against the stamped parts on /design-lab, so they look
   like one family. Do not compare it with the live team or player hubs. Send the
   screenshots with SendUserFile, and commit them to .scratch/player-redesign/shots/
   with names that start "1883-". Do not change the "1882-" files.
5. Run ponytail-review on the diff, apply the cuts it lists, then run /code-review.

Done means: npm run lint, npm test and npm run build pass; the screenshots are sent; the
PR body says "Closes #1883" and lists the files. Change the title to
"Jump bar for the player redesign (#1883)".

The live site can be imperfect while the new page is built. A small change on a live
page is not a reason to stop; say it in the PR body.
Keep working until everything asked for is done. Stop to ask only when you cannot go on
without the user, or before a risky step. When the work is done and checked, stop and
report; do not add features, tests, files or docs that were not asked for. Tests, docs and
checks that this prompt or CLAUDE.md names count as asked for.
Stop if: a merge conflict changes the same logic on both sides, a test would need to be
weakened, or CI fails twice for a reason you cannot fix.
```

## Prompt 4 of 4 — Sonnet 5.5, effort high

```
Run at high.

Use the ponytail skill at level full. Reuse what the repo already has before you write
anything new.

Issues #1856 (a league rank, "2 of 89", beside the top season stats) and #<HERO-TILES>
(the hero tiles' league figure and captions). Read both bodies and their latest comments.
Gary changed the scope of #1856 on 2026-10-13: build the data and the rank mark only. Do
not change the live player page. The hidden player page (#1884) will use the mark and the
tile data later. Gary's four decisions in #1856 still hold (pool, stats and top-10
threshold, the "N of M" format, data first).

First, edit the "Done means" section of #1856 to match the new scope: the rank data, the
rule's tests, and the mark on /design-lab; the rank shows on the player page when #1884
uses it. Keep the rest of the body. This edit records Gary's 2026-10-13 decision.

Read CLAUDE.md, docs/development.md ("Cloud sessions"), src/api/CLAUDE.md,
src/components/ui/CLAUDE.md, ADR-0109, docs/player-redesign.md (line 116), and the Hero
section of docs/player-redesign-data.md. The audit found that N already comes from
fetchPersonStats type 'rankings' (hittingRanksView / pitchingRanksView in
src/api/person/stats.js), and that M (the pool size) is missing.

1. Find M. Check how the team pages get their league ranks first, then the
   league_leaders endpoint. Verify each field path against a live statsapi response for
   Turang (668930) and Gasser (688107). Add no request per card.
2. Write the rank rule test first (qualified, ties, outside the top 10, a missing league,
   a MiLB player), watch it fail, then write the rule.
3. Make one small rank mark component, styled with the current tokens and nothing spread
   across cards. Show it on a StatTile in src/screens/designlab/stamped/StampedParts.jsx
   for three cases: a hitter, a pitcher, a player with no rank. Do not change
   src/screens/designlab/catalog.js or index.jsx (another session changes them).
4. Screenshots of /design-lab?nointro at 390 px, sent with SendUserFile. Say which data
   is real and which is invented.
5. Add the tile data from #<HERO-TILES>: the captions ("680 PA" under SO, "20 GS" under
   W-L) in hitterTiles and pitcherTiles, and the league figure (leagueAverage() in
   src/api/player/leagueAverages.js, called in the tile build in
   src/api/player/overview.js). Test first. The audit's Hero section has the rows.
6. Screenshots go to .scratch/player-redesign/shots/ with names that start "1856-".
7. Run ponytail-review on the diff, apply the cuts it lists, then run /code-review.

Done means: the unit tests pass; npm run lint, npm test and npm run build pass; the PR
body names the source of N and M, the request count per player page, and the files.
Write "Closes #1856" and "Closes #<HERO-TILES>". Open a DRAFT PR to main.

Player pages are open surfaces (ADR-0034): a rank is not a score.
Keep working until everything asked for is done. Stop to ask only when you cannot go on
without the user, or before a risky step. When the work is done and checked, stop and
report; do not add features, tests, files or docs that were not asked for. Tests, docs and
checks that this prompt or CLAUDE.md names count as asked for.
Stop if: no source gives M without a new request per card, the change needs more than
about 8 files, or a test would need to be weakened.
```
