# Open data batches: the prompts

Written 2026-10-06 on `origin/main` at `9d01ade7`. Each prompt stands alone. Paste one block into a fresh cloud session. Every prompt ends in one draft PR, and Gary merges. Two prompts (12b and 15b) add to the draft PR that an earlier prompt opened, so they do not open a new PR. Facts marked "measured" come from the local spike of 2026-10-06. Facts marked "not checked" are for the session to verify first.

## Revision of 2026-10-06 (cost pass)

The goal is to run the bulk of this work on the cheapest model that can do it. Gary settled these five decisions:

| Decision | Answer |
|---|---|
| Effort for prompts that follow a pattern | Sonnet 5.5 at **medium** for 2, 3, 4, 7, 8, 9, 12a, 13 and 14. High stays only on 5 (the foundation, the ADR and the licenses) and 10 (the risk of a weak join). If a medium run comes back shallow, re-run that prompt at high. |
| The run-expectancy sweep (prompt 12) | Split. 12a (Sonnet medium) writes the code. 12b (Haiku 4.5) runs the whole sweep **in one overnight session**, one calendar decade after another, newest first. It pushes to the same PR after each decade. |
| Where the umpire record shows (prompt 11) | **On the umpire page only**, never on the game page, for the user's favorite club. No spoiler-rule question remains, so prompt 11 is Sonnet medium, not Opus high. |
| Where the franchise module goes (prompt 9) | **Inside or directly under `BallparkCard`** on the Overview. |
| The old-games plan (prompt 15) | Split. 15a (Sonnet medium) measures. 15b (Opus high) designs the seal and writes the plan. |

Mix after the revision: 1 Opus prompt (was 2), 2 Sonnet-high prompts (was 11), 13 Sonnet-medium prompts, and 1 overnight Haiku run.

## Run plan

| # | What it does | Model | Effort | Depends on | Parallel with |
|---|---|---|---|---|---|
| 1 | Player page: nickname, hometown and school, and same-name rows in search | Sonnet 5.5 | medium | none | 2, 3, 5, 9, 12a, 15a |
| 2 | Era context: each season against that year's league average | Sonnet 5.5 | medium | none | 1, 3, 5, 9, 12a, 15a |
| 3 | Manager history: reach back before 2000 | Sonnet 5.5 | medium | none | 1, 2, 5, 9, 12a, 15a |
| 4 | Coaching tree on the manager page | Sonnet 5.5 | medium | 3 (merged) | 6, 7, 8, 10, 13 |
| 5 | Retrosheet and Chadwick plumbing, plus the family-ties data | Sonnet 5.5 | high | none | 1, 2, 3, 9, 12a, 15a |
| 6 | Family ties band on the player page | Sonnet 5.5 | medium | 5 (merged) | 7, 9, 10, 12b, 13 |
| 7 | On this day and birthplace data | Sonnet 5.5 | medium | 5 (merged) | 6, 9, 10, 12b, 13 |
| 8 | On this day strip and Born near the park | Sonnet 5.5 | medium | 7 (merged) | 6, 9, 10, 12b, 13 |
| 9 | Franchise timeline and ballpark biography (Stats API only) | Sonnet 5.5 | medium | none | 1, 2, 3, 5, 12a, 15a |
| 10 | Umpire history data from Retrosheet | Sonnet 5.5 | high | 5 (merged) | 6, 7, 9, 12b, 13 |
| 11 | Umpire career chart and "record with this umpire" (umpire page only) | Sonnet 5.5 | medium | 10 (merged) | 6, 7, 8, 13, 14 |
| 12a | Run values by era: code, checkpoint, lookup, one test season | Sonnet 5.5 | medium | none | 1, 2, 3, 5, 9, 15a |
| 12b | Run values by era: the overnight sweep, all seven decades in one session | Haiku 4.5 | none (Haiku takes no effort setting) | 12a (draft PR open, not merged) | any prompt except another 12b |
| 13 | Six degrees: team-season rosters from Retrosheet | Sonnet 5.5 | medium | 5 (merged) | 6, 7, 9, 10, 12b |
| 14 | Six degrees of teammates: the page | Sonnet 5.5 | medium | 13 (merged) | 6, 7, 8, 11 |
| 15a | Old games: measurements (join test, recall, sizes) | Sonnet 5.5 | medium | none | 1, 2, 3, 5, 9, 12a |
| 15b | Old games: the seal design, the draft ADR and the plan | Opus 5.5 | high | 15a (draft PR open, not merged) | any |

## Prompt 1 of 17 — Sonnet 5.5, effort medium

**Player page: nickname, hometown and school, and same-name rows in search.** Three small changes on open surfaces, all from the MLB Stats API. No new dataset. It follows existing patterns, so the everyday rung fits.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: make three small changes on open (spoiler-free) surfaces. All three read the MLB
Stats API. No new dataset, no generator.
  (a) Show the player's nickname on the player page header.
  (b) Show where the player is from: birthplace, high school and college.
  (c) In site search, tell two players with one full name apart.
Inside the spoiler rule's scope these surfaces are OPEN: a player page and the
search box show identity and career facts, never a score. Add no SealBox.

Context (checked 2026-10-06 against the live API and origin/main 9d01ade7)
- Nickname. The person object already carries `nickName`: Hank Aaron "Hammerin' Hank",
  Babe Ruth "The Bambino", Christian Yelich "Yeli", Sonny Gray "Pickles". Not every
  player has one, so show nothing when it is empty. A search of src/screens/PlayerPage.jsx,
  src/screens/player/, src/components/player/ and src/api/person* found no code that
  reads it. Confirm that first.
- School and birthplace. `GET /api/v1/people/{id}?hydrate=education` returns
  `education.highschools[]` ({name, city, state}) and `education.colleges[]` ({name}).
  Measured: Yelich returns Westlake (Westlake Village, CA); Gray returns Smyrna HS and
  Vanderbilt; Aaron returns Allen Institute; Ruth returns Saint Mary's; Cobb returns
  Franklin County. The person request is src/api/person-fetch.js line 49, which sends
  hydrate=currentTeam,team,draft,rosterEntries. Add `education` there. Check first whether
  the page already shows the birth city and state.
- Search. src/api/search.js `searchPeople` calls /api/v1/people/search and shows name,
  position and team or "Retired" (src/components/chrome/SiteSearch.jsx). The response
  already carries `mlbDebutDate`, `lastPlayedDate` and `birthDate`. Measured: the two
  Will Smiths are a catcher (debut 2019, active) and a pitcher (2012 to 2024, retired).
  Do not widen the request. The file's header explains why payload size matters there.
- A `.scratch/` or `docs/` note may already cover the player header. Search before you
  invent a layout, and follow the header's existing chip or line pattern.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Add one small pure selector per change (nickname, education summary, same-name
   disambiguation). Put each next to the module that owns the data. Each returns ''
   or null when the data is missing. MiLB-only and sparse records must not crash.
2. Header: render the nickname once, in the style the header already uses for
   secondary text. Render "Born in City, ST" and "School, School" as one quiet line.
   Join colleges and high schools with a plain separator. Say so in the PR if a field is empty.
3. Search: when two or more rows in one result share a full name (compare trimmed,
   lower-case names), add years played to the second line, such as "2019-" or
   "2012-2024". Rows with a unique name stay exactly as they are.
4. Save three trimmed real responses (Yelich, Gray, Aaron) as test fixtures, in the
   way test/CLAUDE.md says. Do not invent data.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, what changed on screen (one line each for the header and
   the search row), what you did not see, and which fields were empty for the players you
   checked.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 2 of 17 — Sonnet 5.5, effort medium

**Era context: each season against that year's league average.** A hand-run generator, a reader and a table column across several files, with judgment about edge cases (weighting, the current season). Medium fits: the prompt settles both edge cases, and a worked generator exists to copy.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: in the player's season table, show how far each MLB season was above or below
that season's league average. Hitters get batting average against the league's batting
average. Pitchers get ERA against the league's ERA. Nothing else in this slice (no OPS+,
no ERA+).
Season stats are open data. Add no SealBox.

Context (measured 2026-10-06 on the live API)
- `GET /api/v1/teams/stats?season={Y}&group=hitting&stats=season&sportIds=1` returns one
  split per team: 16 teams in 1901, 24 in 1920, 16 in 1950, 20 in 1968 (the 1968 sample
  showed avg .273, 5,767 AB, 1,573 H, 690 R for one team). League averages can be built from
  these. The pitching group is NOT checked: test it for 1901, 1950, 1990 and the latest
  season before you rely on it.
- Weight the average. League AVG is sum(H) / sum(AB) over all teams. League ERA is
  9 * sum(ER) / sum(IP), where IP is innings in thirds. Never average the team averages.
- The season table is src/components/player/CareerRegister.jsx, fed by
  src/api/person/careerRegister.js. Only MLB rows (sportId 1) get the column. MiLB rows
  show nothing.
- Pattern to copy: a hand-run generator for immutable history, listed under
  "Hand-run generators" in docs/scripts/generators.md. scripts/gen-prospect-rank-history.mjs
  is a worked example (pure half in scripts/lib/, no clock in the file, so a re-run writes the same bytes).
  A generator reaches statsapi only through scripts/lib/statsapi.mjs `getJson` (see
  scripts/CLAUDE.md). Use scripts/lib/concurrency.mjs `mapConcurrent` for the sweep.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Pure half in scripts/lib/league-averages.mjs: turn one season's team splits into
   {avg, era}. Test it with fixed inputs, including a season whose pitching split is
   missing (the result for that stat is null, not zero).
2. Generator scripts/gen-league-averages.mjs, hand-run, writes
   public/data/league-averages.json for 1901 to the last COMPLETE season (use
   scripts/lib/time/season-in-play.mjs to name it; never new Date().getFullYear()).
   No `generatedAt`. About 125 calls. Print the file size. It should be a few KB.
3. Current season: do not put it in the file. The reader fetches the one live season
   request when the table includes the current season, caches it in memory for the
   session, and labels the figure "to date".
4. Reader src/api/leagueAverages.js (classify it in spoiler-manifest.json: spoiler-free).
   One function: leagueAverage(season, group) returns a number or null.
5. Column: a compact "vs lg" cell, signed (+.034 or -0.42), with plain wording in the
   header or a title. A missing figure shows an em dash. Keep the table's width on a
   390px screen: check it.
6. Docs: docs/scripts/generators.md (hand-run section) and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the file size, the call count, any season whose pitching
   split was missing, and one screenshot description or "not seen" for the table at 390px.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 3 of 17 — Sonnet 5.5, effort medium

**Manager history: reach back before 2000.** One generator change plus a hand-run sweep of about 3,000 calls. The generator already handles shared seasons, and the prompt gives a numeric stop rule, so medium fits. No screen change beyond copy.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: extend the coaching-staff history so the manager page can show careers before 2000.
Change scripts/gen-manager-history.mjs, run its full backfill further back, and fix the
copy and reader notes that say "since 2000". This is open data. Add no SealBox.

Context (measured 2026-10-06)
- scripts/gen-manager-history.mjs does a full backfill for 2000 to the present, all 30
  current teams (about 800 calls, hand-run), and a nightly `--current-only` merge that
  keeps the backfilled history. It reads GET /api/v1/teams/{teamId}/coaches?season={year}
  and files each person under shardKey100(personId) in public/data/manager-history/{NN}.json.
- The API answers before 2000. Measured roster rows: Brewers 1970 = 5, 1980 = 9, 1990 = 6
  (Tom Trebelhorn, manager, among them); Twins (team 142) 1950 = 5, 1920 = 2. A club with
  no franchise yet returns 0 rows (Brewers 1960 and earlier). That is normal.
- A franchise keeps its team id across a move. `/api/v1/teams/158?season=1969` returns the
  Seattle Pilots. So the 30 current ids reach each club's whole history.
- Shared seasons: a team-season with more than one manager row is NOT guessed at. It uses
  scripts/manager-transitions-seed.json (hand-verified dates) or lands in
  scripts/manager-transitions-needs-research.json with `sharedSeason: true` and no record.
  Read the generator header first. Mid-season changes were more common before 2000.
- The readers say "since 2000" in src/api/managers.js comments and possibly in
  src/screens/ManagerPage.jsx copy. Search for "2000".

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Measure first. Run the sweep for 1990 to 1999 only, into a scratch output (use the
   generator's own options or a flag you add). Report: calls, run time, new shared
   seasons, output size change.
2. Make the start season one named constant. Run the full backfill for 1901 to 1999 only
   if the numbers in step 1 look sane: fewer than about 150 new needs-research rows in
   total after the full run. If a run would exceed that, stop at the earliest season that
   stays under it, and say which season you stopped at.
3. Do NOT hand-research dozens of transitions. Append the new rows to
   needs-research.json as the generator does. Seed only the ones the schedule or the
   API settles for certain, and say how you checked each.
4. Compare sizes: total bytes of public/data/manager-history/ before and after. Report both.
5. Update the "since 2000" notes and any page copy to read from the constant or say the
   real first season. Add a `coverage` check to the reader tests if none exists.
6. Docs: docs/scripts/generators.md entry (the hand-run mode and the new first season).

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, calls and run time, the first season now covered, the new
   count in needs-research.json, the before and after size, and the staff counts for three
   spot checks (name them) against what you know of those clubs.
2. Say plainly that prompt 4 (coaching tree) should start after this PR merges: both change
   the same generator.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 4 of 17 — Sonnet 5.5, effort medium

**Coaching tree on the manager page.** Builds one screen from a settled direction and adds one small index to the generator.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: add a "coaching tree" band to the manager page. It shows who coached under a
manager and which of those people later managed. It needs no new dataset: it uses the
coaching history Tally already holds (public/data/manager-history/).
Open surface. Add no SealBox, and show no game result.

Context
- Prompt 3 must be merged first. It extends the same generator and the data's first season.
  Run `git log origin/main --oneline -5 -- scripts/gen-manager-history.mjs` to confirm.
  If it is not merged, stop and say so.
- The data is player-keyed: public/data/manager-history/{NN}.json maps a person id to that
  person's stints (team, season, job, and for managers a record or `sharedSeason`). Reader:
  src/api/managers.js. Page: src/screens/ManagerPage.jsx.
- A tree needs the REVERSE view: who held a coach job on the same team-season as manager M.
  A client cannot scan all 100 shards. Add a small generated index keyed by manager id.
  Keep it in the same shard scheme (shardKey100) so the reader joins the same way.
- Direction (settled): depth 2 only. Top node = the manager. Second row = people who
  coached under him, each with the count of seasons together, and a mark if that person
  later held a Manager job. No graph library. Plain CSS. On a 390px screen the second row
  wraps or stacks. Each person links to their manager page or player page.
- Wireframe: a top box "Manager A", a short vertical line, a row of boxes "Bench coach ->
  manager", "Pitching coach", "Hitting coach -> manager".

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Extend the generator to write the reverse index. Put the pure half in scripts/lib/.
   Test it with a small hand-made staff table that has two managers in one season.
2. Reader function in src/api/managers.js (or a sibling file if the file-size guard says so):
   coachedUnder(managerId) returns [{personId, name, seasons, laterManaged}] or [].
3. Component under src/components/ for the band. Reuse the page's existing card and link
   components. Name every class with the BEM-style block name the repo uses.
4. Empty state: a manager with no recorded staff shows no band at all.
5. Docs: docs/scripts/generators.md and docs/api/static-data.md entries.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the route you checked (a manager with a long career, by id),
   the size of the new index, and what you did not see.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 5 of 17 — Sonnet 5.5, effort high

**Retrosheet and Chadwick plumbing, plus the family-ties data.** The first consumer of Retrosheet and Chadwick data. It adds the shared fetch, id bridge, credits and an ADR, with the smallest dataset (family links) as its proof. No screen.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: add the shared build-time plumbing for two open datasets, Retrosheet's biographical
files and the Chadwick Bureau register, and prove it with one small dataset: family links
between players. No screen in this prompt (prompt 6 adds the band).
Both datasets are read at BUILD time by hand-run generators. The app never fetches them.
The output is static JSON under public/data/. This data is history, so it is open.

Context (measured 2026-10-06)
- Retrosheet biographical zip: https://www.retrosheet.org/downloads/biodata.zip (1.4 MB).
  Files: biofile0.csv (27,049 people: id, lastname, usename, fullname, birthdate,
  birthcity, birthstate, birthcountry, death fields, altname, debut_p, last_p, debut_c,
  last_c, debut_m, last_m, debut_u, last_u, bats, throws, height, weight, HOF),
  relatives.csv (1,329 rows: id1, relation, id2), coaches0.csv, managers0.csv, umpires0.csv,
  ballparks0.csv, teams0.csv.
- relatives.csv relation counts: Brother 617, Father 326, Uncle 148, Cousin 133,
  Grandfather 35, Brother-in-Law 21, Father-in-Law 18, Great Uncle 9, Half Brother 6,
  Related To 5. Which side the label describes is NOT checked. Verify the direction with
  pairs you know before you invert anything (Ken Griffey Sr. and Jr.; Bobby and Barry Bonds;
  two Alou brothers).
- Chadwick register: https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-{0-9,a-f}.csv
  (16 files, about 4.2 MB each). Columns include key_person, key_uuid, key_mlbam, key_retro,
  key_bbref, key_fangraphs, name_first, name_last, name_nick, birth_year/month/day,
  mlb_played_first, mlb_played_last. Measured: 526,894 rows; 135,208 carry key_mlbam; all
  19,277 person ids in Tally's public/data/war-history/ match a row, and every one has a
  key_retro. Tally's manager-history ids match 89.2% (the rest are mostly staff who never
  played pro ball). Tally top prospects who never reached MLB match on key_mlbam but carry
  no Retrosheet, Baseball-Reference or FanGraphs id.
- Licenses. Chadwick: Open Data Commons Attribution License 1.0. The repo already credits
  it: scripts/lib/prospect-rank-history.mjs line 36 holds the CHADWICK_JOIN credit string.
  Retrosheet: free use, including commercial, if this statement appears prominently: "The
  information used here was obtained free of charge from and is copyrighted by Retrosheet.
  Interested parties may contact Retrosheet at 20 Sunset Rd., Newark, DE 19711."
- Precedent: scripts/gen-prospect-rank-history.mjs (hand-run, no clock in the file, credit
  lines carried in the data and shown beside it). scripts/CLAUDE.md says a statsapi call
  goes through scripts/lib/statsapi.mjs; these are other hosts, so write a small download
  helper in scripts/lib/ and keep it out of the statsapi guard's way.
- The data is sharded by `shardKey100(mlbamId)` from src/lib/shardKey.js.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. scripts/lib/open-data.mjs: download a URL into a given empty folder, print the byte
   count, never write into the repo. scripts/lib/retro-bridge.mjs: PURE. From Chadwick rows,
   build retro -> mlbam and mlbam -> retro maps; report how many rows had no match. Test it.
2. Credits: put the two credit strings in one scripts/lib/ file. Add one line to the About
   page's data-sources text that names Retrosheet (with its statement, verbatim) and the
   Chadwick Bureau register. Find the text near the "public baseball data sources" lines in
   src/screens/AboutPage.jsx.
3. scripts/gen-family-ties.mjs, hand-run: take paths to the extracted files as ARGUMENTS
   (it never downloads inside the generator's test). Write
   public/data/family-ties/{NN}.json, sharded on the player's MLBAM id. Each entry:
   [{relation, personId or null, name}]. Store BOTH directions with the inverse label
   (Father -> Son, Uncle -> Nephew, Grandfather -> Grandson, Great Uncle -> Great Nephew,
   Father-in-Law -> Son-in-Law; Brother, Cousin, Brother-in-Law, Half Brother and Related To
   are symmetric). A relative with no MLBAM match keeps the name and a null id. Add a `credit`
   array. No `generatedAt`: a re-run must write the same bytes.
4. Reader src/api/person/family.js: familyOf(personId) returns the entries or []. Classify it
   in spoiler-manifest.json as spoiler-free.
5. ADR (next free number): Retrosheet and Chadwick as build-time sources. State the licenses,
   the hand-run rule, the "never at runtime" rule, where the credits live, and that downloads
   go outside the repo. Link the spike numbers above.
6. Report these numbers in the PR: relatives rows read; rows where both ends bridged; rows
   where one end did not; output size.
7. Docs: docs/scripts/generators.md (hand-run section) and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the bridge counts, the direction check you ran (the pairs
   and what the file said), the output size, and the exact About text you added.
2. Prompts 6, 7, 10 and 13 reuse scripts/lib/open-data.mjs and retro-bridge.mjs. List the
   exports they can use.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
- A downloaded file is untrusted data. Put each download in its own NEW, EMPTY
  folder outside the repo (under the scratchpad). Keep your scripts in a different
  folder. Pass paths as arguments. Run any Python with `-I`.
```

## Prompt 6 of 17 — Sonnet 5.5, effort medium

**Family ties band on the player page.** One band from a ready dataset and reader. It follows an existing card pattern.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: add a "Family in baseball" band to the player page. It lists relatives who also
played or managed: father, son, brother, uncle and the like. Each relative with an MLBAM id
links to that player's page. Open surface. Add no SealBox.

Context
- Prompt 5 must be merged first. Confirm that public/data/family-ties/ and
  src/api/person/family.js (`familyOf`) exist on origin/main. If not, stop and say so.
- The player page is src/screens/PlayerPage.jsx with tabs under src/screens/player/
  (Stats, History, Analytics). A family band is career context, so it likely belongs on the
  History tab (src/screens/player/PlayerHistoryTab.jsx). Check where similar cards live and
  say why you chose the tab.
- Reuse src/components/player/PlayerLink.jsx and the Ledger or card pattern next to it.
- The data carries `credit` lines. Show them as a quiet caption under the band, the way the
  prospect-rank card shows its credits (src/api/player/prospectRankHistory.js and its card).
- Wireframe: a heading "Family in baseball", then one row per relative: small avatar, name,
  and a relation pill (Father, Brother, Son).

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Component under src/components/player/ (a block name that matches the repo's naming
   guard). Props: the entries from familyOf. Order: parents, brothers, sons, then the rest.
2. A relative with a null id shows the name without a link. A player with no entries shows
   no band at all (render nothing, not an empty card).
3. Load familyOf in the tab's loader the way sibling cards load their data. One small
   shard fetch. Do not add a request to the first paint of the Stats tab.
4. Check three pages by id: a father-and-son pair, two brothers, and a player with none.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the three routes you checked, what you did not see.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 7 of 17 — Sonnet 5.5, effort medium

**On this day and birthplace data.** Two small generated datasets from Retrosheet biographical data, joined to MLBAM ids. It copies the pattern that prompt 5 sets, so medium fits. No screen; prompt 8 adds the UI.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: build two static datasets from Retrosheet's biofile, joined to MLBAM ids through the
Chadwick bridge from prompt 5:
  (a) "On this day": for each calendar day, the players born that day and the players who
      debuted that day, in past years.
  (b) A birthplace index: players grouped by birth city, for a "born near the park" line.
No screen. History only: no deaths in this slice, and nothing from the current season.

Context
- Prompt 5 must be merged first (scripts/lib/open-data.mjs, scripts/lib/retro-bridge.mjs, the
  credit strings, the ADR). Confirm they exist on origin/main. If not, stop and say so.
- Retrosheet biofile0.csv (measured: 27,049 people) has birthdate, birthcity, birthstate,
  birthcountry, debut_p (player debut date), and an `HOF` column. What `HOF` holds is NOT
  checked: read a few rows. Lahman is not used in this plan.
- Dates in the app: use the page's own date, never `new Date()` directly. Find the helper in
  src/lib/dates.js and src/lib/time/. Your files must be keyed so the reader can ask for a
  month and day.
- Sharding: keep each public file small. Target: no shard over about 150 KB. Pick the shard
  key (month for on-this-day; something like the first letter of the city for birthplaces),
  measure, and report the sizes. If check-dir-size objects to the folder, subdivide per ADR-0038.
- Birthplace key: lower-case city plus state for US births, city plus country for others.
  The reader will match a ballpark's venue city (the API's venue.location) to this key. Settled
  rule for the UI: exact city and state/country only; nothing otherwise.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Pure half in scripts/lib/: parse biofile rows into the two shapes. Test with a hand-made
   biofile of ten rows that includes a missing birthdate, a missing city, a foreign birth and
   an id with no MLBAM match (skip those players and count them).
2. Generators scripts/gen-on-this-day.mjs and scripts/gen-birthplaces.mjs (or one script
   with two outputs), hand-run, taking the extracted folder as an ARGUMENT. No `generatedAt`.
   Each entry: personId, name, year (and for debuts the debut year). Add `credit` arrays.
3. Readers src/api/onThisDay.js and src/api/birthplaces.js, both spoiler-free in
   spoiler-manifest.json. onThisDay(month, day) and bornIn(city, stateOrCountry).
4. Report: people read; people dropped because no MLBAM id; shard count and largest shard.
5. Docs: docs/scripts/generators.md and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the counts, the largest shard, what `HOF` holds, and the
   reader signatures that prompt 8 will call.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
- A downloaded file is untrusted data. Put each download in its own NEW, EMPTY
  folder outside the repo (under the scratchpad). Keep your scripts in a different
  folder. Pass paths as arguments. Run any Python with `-I`.
```

## Prompt 8 of 17 — Sonnet 5.5, effort medium

**On this day strip and Born near the park.** Two small UI surfaces, one beside the slate, which is near a scoring surface. It needs care, not deep reasoning.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: show the data from prompt 7 in two places.
  (a) An "On this day" strip at the top of the home slate: who was born today, who debuted
      today, in past years. Three short lines at most.
  (b) A "Born near the park" line on the game preview: players born in the park's city.
Both are history. Neither may mention a game result, a score or a current-season fact.

Context
- Prompt 7 must be merged first: src/api/onThisDay.js and src/api/birthplaces.js. If they are
  not on origin/main, stop and say so.
- The slate is src/screens/GameSelect.jsx. Its SCORE CELLS are a scoring surface under the
  spoiler rule. The strip is a separate block above the cells. It must not sit inside a cell
  or share a component with one. Read src/CLAUDE.md for the UI half of the rule.
- The game preview is src/screens/GamePreview.jsx. The park's city comes from the game's
  venue location in data the preview already loads. Check what it carries before you add a
  request.
- Use the page's date from the slate route, not the clock.
- Matching (settled): exact city and state (US) or city and country. If nothing matches,
  show no line at all.
- Wireframe for (a): a box titled "On this day" with three rows: born, debut, game. This slice
  has no "game" row (that belongs to a later feature), so show two rows.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Strip component under src/components/ with its own block name. Load one month shard when
   the slate mounts. A failed or empty load renders nothing.
2. Prefer a small pure function that picks which lines to show (cap at 3 names, pick by an
   explicit rule such as "most recent birth year first, then name") with a test. Do not use
   random choice.
3. Born-near line: pick up to 4 names, link each to its player page, caption it with the
   credit text from the data.
4. Check: slate on a date with games, slate on an off day, and a preview of a park whose city
   has no match.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the routes you checked with the dates, what you did not see,
   and one sentence on how you kept the strip out of the score cells.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 9 of 17 — Sonnet 5.5, effort medium

**Franchise timeline and ballpark biography (Stats API only).** A small hand-run sweep plus two team-page surfaces. Gary settled the placement (inside or under `BallparkCard`), so no judgment call is left and medium fits.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: show a club's history on its team page: one strip of names, leagues and ballparks
by season (the Brewers would read Seattle Pilots 1969, Milwaukee in the American League from
1970, the National League from 1998), and a short history for each ballpark. All data comes
from the MLB Stats API. No Retrosheet, no Lahman. Open surface. Add no SealBox.

Context (measured 2026-10-06)
- `GET /api/v1/teams?sportId=1&season={Y}&hydrate=venue` returns name, league and venue for
  each club in that season, under the franchise's current team id. Measured for team 158:
  1969 Seattle Pilots, American League, Sick's Stadium; 1970 Milwaukee Brewers, American
  League, Milwaukee County Stadium; 1998 Milwaukee Brewers, National League, Milwaukee County
  Stadium; 2021 Milwaukee Brewers, National League, American Family Field. The league had 24
  clubs in 1969 and 30 in 1998. `teams/158?season=1969` also returns the Pilots.
- NOT checked: whether other relocations keep one id. Test Dodgers (119) 1950, Giants (137)
  1950, Nationals (120) 2000, Athletics (133) 1950, Twins (142) 1950, Braves (144) 1950.
  Report any club whose history looks cut.
- The ballpark card is src/screens/team/modules/ballpark/BallparkCard.jsx, mounted at
  src/screens/TeamPage.jsx line 125 (the Overview).
- Placement (settled by Gary, 2026-10-06): put the park history inside or directly under
  BallparkCard, and the franchise strip next to it, as one compact module on the Overview.
  Do not move it to another tab. Why this is allowed: src/screens/team/CLAUDE.md says the
  Overview holds previews only, but the comment above BallparkCard in TeamPage.jsx says that
  card "IS the full detail view" with no door to another tab. This module extends that
  exception. Quote that comment in the PR body. ADR-0082 (one scroll of named bands) is a
  DRAFT and NOT accepted: do not build for it.
- Patterns: a hand-run immutable generator, like scripts/gen-manager-history.mjs; shard by
  team id, 30 small files. Use getJson and mapConcurrent.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Pure half in scripts/lib/franchise-history.mjs: collapse consecutive seasons with the same
   (name, league, venue id) into spans: {from, to, name, league, venueId, venueName}. Test it
   with a hand-made 1968 to 1999 table that includes a rename, a league move and a park move.
2. Generator scripts/gen-franchise-history.mjs, hand-run, writes
   public/data/franchise-history/{teamId}.json for 1901 to the last complete season. About 125
   calls. Re-run only to fold in a new season. No `generatedAt`.
3. Reader src/api/franchiseHistory.js (spoiler-free in the manifest): spansFor(teamId).
   Park history derives from the same spans: group by venueId, list the names, the first and
   last season IN THIS DATA, and the other clubs that used the venue in the same seasons.
   Do not call the first season "opened": the data starts in 1901. Word it as "seasons in
   this data".
4. Components: a timeline strip (horizontal, scrolls inside its own overflow container at
   390px) and the park lines. Use the repo's design tokens (src/styles/CLAUDE.md), no raw hex.
5. Check four clubs by id, including a relocated club and a club with a park that was shared.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the relocation test results, the four club ids you checked,
   and the file count and total size of the new folder.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 10 of 17 — Sonnet 5.5, effort high

**Umpire history data from Retrosheet.** A large download reduced to small shards, with an id bridge and a team-code mapping that must be measured. No screen.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: build umpire history from Retrosheet: for each umpire and season, games worked at
each position, plus each club's win-loss record with that umpire behind the plate. Join to
MLBAM ids through the Chadwick bridge. No screen in this prompt (prompt 11 adds it).

Context (measured 2026-10-06)
- Prompt 5 must be merged first (scripts/lib/open-data.mjs, retro-bridge.mjs, credits).
- Tally's own umpire files cover 2023 to 2026 only: public/data/umpires/{season}/{personId}.json
  plus seasons.json, built by scripts/gen-umpires.mjs from the Stats API. Reader: src/api/umpires.js.
  Retrosheet can fill the earlier seasons. Do not overwrite or duplicate Tally's own seasons.
- Retrosheet per-game data: gameinfo.csv has gid, visteam, hometeam, site, date, umphome,
  ump1b, ump2b, ump3b, umplf, umprf, wteam, lteam, vruns, hruns, gametype, season. Measured
  for 2025: 2,478 games, `umphome` filled for all, dates 2025-03-18 to 2025-11-01. umpires0.csv
  in biodata.zip lists 1,762 umpires (id, lastname, firstname, first_g, last_g).
- Where gameinfo lives: per-year zips (https://www.retrosheet.org/downloads/{Y}/{Y}csvs.zip,
  6 to 10 MB each, they include plays.csv) or the master zips (basiccsvs.zip 741 MB,
  csvdownloads.zip 799 MB). What each master zip contains is NOT checked: run `unzip -l`
  first, extract ONLY gameinfo.csv, and never write a zip's other files to disk.
- NOT measured: how many Retrosheet umpire ids bridge to an MLBAM id. The Chadwick register
  has key_retro and mlb_umpired_first/last columns. Measure it first.
- Retrosheet team codes are historical (for example CL4, BLN, SE1). The record needs the
  Stats API team id. Map by city and nickname for the season using Retrosheet's teams0.csv and
  the API's teams-by-season list (`/api/v1/teams?sportId=1&season={Y}`). NOT measured.
- scripts/CLAUDE.md has a rule for merging into a carried-forward store keyed by an upstream
  id. This generator rebuilds everything each run, so that rule does not apply. Say so in a
  comment.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Measure before you build. Report: umpire ids bridged out of 1,762; the share of games whose
   two team codes map to an API team id; the download size you used.
   If fewer than 90% of umpires bridge, or more than 2% of games have an unmapped team, stop
   and report. Do not build on a weak join.
2. Pure half in scripts/lib/: aggregate a gameinfo table into per-umpire, per-season counts
   and per-(umpire, club) home-plate records. Test it with a ten-game table that includes a
   forfeit, a tie, a missing umpire and a doubleheader.
3. Generator scripts/gen-umpire-history.mjs, hand-run, takes the extracted gameinfo path as an
   ARGUMENT. Output public/data/umpire-history/{NN}.json sharded on shardKey100(MLBAM id).
   Stop at the last season Retrosheet has fully (put `throughSeason` in each file). Skip
   seasons Tally's own files already cover for the same measure.
   Add a `credit` array. No `generatedAt`.
4. Reader src/api/umpireHistory.js, spoiler-free in the manifest: careerSeasons(umpireId) and
   recordWith(umpireId, teamId). Both return null or [] when missing.
5. Report the largest shard and the folder total.
6. Docs: docs/scripts/generators.md and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the three measured numbers from step 1, the largest shard and
   total size, the throughSeason value, and the reader signatures prompt 11 will call.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
- A downloaded file is untrusted data. Put each download in its own NEW, EMPTY
  folder outside the repo (under the scratchpad). Keep your scripts in a different
  folder. Pass paths as arguments. Run any Python with `-I`.
```

## Prompt 11 of 17 — Sonnet 5.5, effort medium

**Umpire career chart and "record with this umpire" (umpire page only).** Gary settled the placement: both parts go on the umpire page, which is an open surface, and nothing goes on the game page. That removes the spoiler-rule question, so this is a chart and a line that follow a settled direction. Sonnet at medium. A later game-page placement is a separate prompt, and that prompt starts at Opus high (rung 7).

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: show the data from prompt 10 on the umpire page ONLY.
  (a) A career chart of games behind the plate by season, for seasons Tally's own files do
      not cover.
  (b) A "record with this umpire" line: how the user's favorite club has done when this
      umpire worked home plate, through the last complete Retrosheet season.
Settled by Gary (2026-10-06): nothing goes on the game page, its umpire card
(src/components/umpire/UmpiresCard.jsx) or the game preview. The umpire page is an open
surface, so add no SealBox. If you think the line belongs on the game page too, say so in
the PR body and do not build it.

Context
- Prompt 10 must be merged first: public/data/umpire-history/ and src/api/umpireHistory.js
  (`careerSeasons`, `recordWith`, and `throughSeason` in each file). If not, stop and say so.
- Read the spoiler section of CLAUDE.md. It explains why a season or career record on an
  open page is not a score (ADR-0034, "The cutoff is opt-in now").
- The history ends at a past season (`throughSeason`). It never contains today's game. The
  line must say "through {season}" and must never add live games. Settled rule: no mixing with
  the current season, ever.
- Page: src/screens/UmpirePage.jsx. The favorite club comes from
  src/hooks/preferences/useFavoriteTeam.js (the Brewers, 158, are only the default). When
  the favorite club has 0 games with this umpire, show no line.
- Wireframes: a bar strip by season under the umpire's name; a bar split into wins and
  losses with a caption "Brewers with Name behind the plate, through 2025".

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Pure helper for the bar widths and the caption text, with tests, including a club with 0
   games and a club with one game.
2. Chart component for (a). Use tokens only. Check it at 390px with an umpire who has 30 years.
3. The record line for (b), under the chart on the umpire page.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the umpire ids you checked (one with a 30-year career, one
   with no record for the favorite club), and what you did not see.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 12a of 17 — Sonnet 5.5, effort medium

**Run values by era: the code, the checkpoint and the lookup.** It reuses the existing sweep for earlier seasons. The risk is to change numbers that scoring surfaces use today, and a test pins that. This prompt runs ONE test season and opens the draft PR. It does not run the long sweep: prompt 12b (Haiku) runs that overnight, one decade after another, and pushes to this same PR.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: add an era mode to the run-expectancy generator, so that later sessions can build
tables for 1960 to 2023 from MLB Stats API play-by-play, one decade at a time. Add a pure
lookup helper. Run ONE test season (1985). No screen in this prompt. Do NOT run the full
sweep: prompt 12b does that later, on this PR's branch.
DO NOT change public/data/run-expectancy.json or src/lib/runExpectancy.js's current behavior.
They feed the reveal-only favor card and scripts/gen-umpire-accuracy.mjs.

Context (measured 2026-10-06)
- scripts/gen-run-expectancy.mjs is hand-run (not on the cron). Default: the last 2 complete
  seasons; `--seasons=2024,2025` picks seasons. It walks liveData.plays.allPlays for every
  Final regular-season game, tags each pitch with its pre-pitch state, and writes 288 states
  (8 bases x 3 outs x 12 counts) plus 24 base-out totals. The current file has seasons
  ["2024", "2025"] and gamesSwept 4,860. Read the generator header in full first.
- Play-by-play coverage by era (6 sampled games per season): 0 of 6 for 1901 to 1940; 3 of 6
  for 1950; 6 of 6 for 1960, 1970, 1980, 1990, 2000 and 2010. So tables start at 1960.
- Cost (measured): 1960 onward = 140,613 regular-season games. A game feed averages about
  432 KB and 0.66 s. At 4 requests at once, one decade takes about 1 hour. Never store feeds.
  Keep only per-season sums.
- Consumers of the current table: src/lib/runExpectancy.js (`lookupRE`, `pitchFavor`),
  src/api/umpireFavor.js, src/components/gamehud/StatBox.jsx,
  src/components/inning/focus/ReferencePanel.jsx, src/hooks/useGameData.js, src/screens/GameView.jsx.
- Cloud containers are lost when a session ends. So the per-season checkpoints are COMMITTED
  to the PR branch, and a new session resumes from them. `.scratch/run-expectancy-eras/` is
  not in .gitignore. Keep it that way. check-dir-size scans only src, api and scripts, so 64
  small checkpoint files there are fine.

Use these exact names. Prompt 12b runs them without reading your code.
- `node scripts/gen-run-expectancy.mjs --era-sweep --seasons=1980,1981,...` sweeps each
  season in the list and writes .scratch/run-expectancy-eras/season-YYYY.json when that season
  finishes. It skips a season whose file already exists. It never writes
  public/data/run-expectancy.json. It uses scripts/lib/concurrency.mjs `mapConcurrent` with 4
  requests at once.
- `node scripts/gen-run-expectancy.mjs --era-aggregate --decade=1980` reads that decade's
  checkpoints and writes public/data/run-expectancy-eras/1980s.json (the same shape as the
  current file, plus `seasons`). It exits non-zero and writes nothing if a season of the
  decade has no checkpoint.
- The decades: 2020s = 2020 to 2023 (2024 and 2025 are in the current table already; 2020
  was a short season, and it counts as a normal season here), 2010s, 2000s, 1990s, 1980s,
  1970s, 1960s.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Add the two modes above. Put the pure parts (sum one season, merge season sums into a
   decade table) in scripts/lib/, with tests.
2. Add `lookupEraRE(season, state)` beside the current lookup in src/lib/runExpectancy.js or
   in a new sibling. It picks the decade file. Pure, tested, falls back to null. The old
   functions do not change. A test pins that `pitchFavor` returns the same numbers as before
   for fixed inputs.
3. Run `--era-sweep --seasons=1985`. Report games, time and the checkpoint size. Compare the
   RE24 base-out value for runners on second and third with none out against the 2024 table.
   Report the difference in plain words. Commit the 1985 checkpoint. Do NOT run
   `--era-aggregate` (the 1980s are not complete yet).
4. Docs: docs/scripts/generators.md (hand-run section: both modes, the decade list, and that
   prompt 12b's overnight session runs them) and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. The title MUST start with "Run values by era" (prompt 12b
  finds the PR by that title). Put the base SHA, the files touched and how you verified in
  the body. Write "not applicable (cloud)" for the worktree and the local URL. Add a section
  "## Sweep status" with one unticked line per decade, newest first:
  `- [ ] 2020s (2020-2023)`, `- [ ] 2010s`, ... `- [ ] 1960s`. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges after every decade is ticked. Wait for the
  `lint-and-build` check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the 1985 games, run time and checkpoint size, the step 3
   comparison, and the estimated time per decade from your 1985 run.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 12b of 17 — Haiku 4.5 (no effort setting)

**Run values by era: the overnight sweep.** Mechanical work: run two commands that prompt 12a wrote, commit the output, and tick boxes. Paste it once, before bed. One session runs all seven decades back to back, newest first, in about 6 to 7 hours. In a cloud session, one background command stops at 2 hours, so the session starts one background run per decade (about 45 to 70 minutes each). It commits and pushes after each decade. If the container stops during the night, paste the same prompt into a new session: it continues from the first unticked decade and skips every season that already has a checkpoint.

```text
Task: run the run-expectancy era sweep for EVERY unticked decade, one decade after another,
and push each decade's result to an open draft PR. You run commands and commit files. You
do not write or change code. This is an unattended overnight run: nobody will answer a
question, so follow the stop rules below and report in your final message.

Find the work
1. With the GitHub tools (the cloud has no `gh` CLI), list open PRs in
   gzilavyss2025/bbsbh. Find the draft PR whose title starts with "Run values by era". If
   there is none, or more than one, stop and say so.
2. Run `git fetch origin <its head branch>` and check out that branch. Run
   `git status`. If the tree is not clean, stop and say so.
3. Read the "Run values by era" entry in docs/scripts/generators.md for the two commands.
4. Read the PR body's "## Sweep status" list. It runs newest first. If every line is
   ticked, stop and say "Sweep complete: Gary can review the PR."

The decade loop: do steps 5 to 12 for the first unticked decade, then for the next one,
until every decade is ticked or a stop rule ends the run.
5. The seasons of the decade: 2020s = 2020,2021,2022,2023. Every other decade = its ten
   years, for example 1980s = 1980,1981,...,1989.
6. Start the sweep for THIS decade only, in the BACKGROUND (Bash with run_in_background and
   a timeout of 7200000 ms):
   `node scripts/gen-run-expectancy.mjs --era-sweep --seasons=<the seasons>`
   Seasons that already have a file in .scratch/run-expectancy-eras/ are skipped. That is
   correct. Wait for the background task to finish. Do not poll with sleep.
7. When it ends, list .scratch/run-expectancy-eras/ and check that every season of the
   decade has a file.
   - If one is missing (a failure, or the 2-hour stop), run the step 6 command once more.
     It skips the finished seasons.
   - If one is still missing after that, commit and push the season files that exist
     (steps 10 and 11), then STOP the whole run. Report the season and the last error
     lines. Do not tick the decade and do not run step 8.
8. Run `node scripts/gen-run-expectancy.mjs --era-aggregate --decade=<first year>`
   (for example --decade=1980). It writes public/data/run-expectancy-eras/<decade>s.json.
9. Run `npm run lint; echo "exit=$?"`, then `npm test`. If either fails, commit and push
   the files that exist (steps 10 and 11), then STOP the whole run and report the failing
   lines. Do not edit code to fix it.
10. Stage only the new season files and the new decade file:
    `git add .scratch/run-expectancy-eras/ public/data/run-expectancy-eras/`
    Run `git status` and check that nothing else is staged. Commit with the message
    "Run values by era: sweep the <decade>s". End the message with the attribution lines
    the session gives you.
11. `git push -u origin <branch>`. If it fails for a network error, retry up to 4 times,
    waiting 2, 4, 8 and 16 seconds. If it is rejected because the branch moved, run
    `git pull --no-rebase origin <branch>` once and push again.
12. Edit the PR body with the GitHub tools: tick that decade's line, and add after it the
    games swept, the run time and the decade file's size. Change nothing else in the body.
    Then go back to step 5 for the next unticked decade.

Rules
- Never change files under src/, scripts/, test/, docs/ or public/data/run-expectancy.json.
- Never re-run a season that already has a file. Never delete a season file.
- Never run two sweeps at once. One background sweep at a time, one decade at a time.
- Never merge the PR, mark it ready, or push to main.
- If a command fails twice for the same reason, stop and report it.

Handoff
Final message: one line per decade you ran (games swept, run time, decade file size), the
total run time, and either "Sweep complete: Gary can review the PR" or the decade where the
run stopped and why.
```

## Prompt 13 of 17 — Sonnet 5.5, effort medium

**Six degrees: team-season rosters from Retrosheet.** A big download reduced to a compact player-to-team-season graph. The size is the risk, and the prompt gives numeric stop gates for it, so medium fits. No screen.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: build the data for "six degrees of teammates": for every MLB team-season, the list of
players who played for it, as MLBAM ids. Prompt 14 builds the page that finds a chain between two
players. No screen here.

Context (measured 2026-10-06)
- Prompt 5 must be merged first (scripts/lib/open-data.mjs and retro-bridge.mjs).
- Retrosheet allplayers.csv lists one row per player per team per season: id, last, first, bat,
  throw, team, g, g_p, g_sp, g_rp, g_c, ..., first_g, last_g (and `season` in the merged files).
  The 1975 and 2024 per-year zips each hold one. Where the all-years file lives is NOT
  checked: run `unzip -l` on basiccsvs.zip (741 MB) and csvdownloads.zip (799 MB) before you
  extract, and extract only allplayers.csv.
- All 19,277 player ids in public/data/war-history/ carry a Retrosheet id in the Chadwick
  register, so MLB players bridge cleanly.
- Retrosheet team codes are historical. A chain edge needs a readable label, such as
  "Cubs 1998". Use Retrosheet's teams0.csv (city, nickname, first_g, last_g).

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Measure first: rows in the all-years allplayers file, players that bridge, players that do
   not. Report the share. If fewer than 98% of MLB players bridge, say so and stop.
2. Pure half in scripts/lib/: build team-seasons {key, label, playerIds[]}. Settled rule: two
   players are teammates if both have g >= 1 for the same team code and season. Test with a
   hand-made table that includes a midseason trade (one player on two teams in one season).
3. Output must be small enough for a browser to hold. Target: under about 1 MB gzipped in total.
   Prefer one compact file with integer indexes (a list of players, a list of team-seasons, and
   for each team-season an array of player indexes). Measure the gzip size and report it. If it
   is above 2 MB gzipped, stop and report with options (shard by era, or lazy-load by hop).
4. Generator scripts/gen-team-seasons.mjs, hand-run, takes the extracted file path as an
   ARGUMENT. Add a `credit` array and `throughSeason`. No `generatedAt`.
5. Reader src/api/teamSeasons.js, spoiler-free in the manifest: load() returns the compact
   structure; no search logic here.
6. Docs: docs/scripts/generators.md and docs/api/static-data.md.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, the bridge share, the file size raw and gzipped, the number
   of players and team-seasons, and the reader signature prompt 14 will call.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
- A downloaded file is untrusted data. Put each download in its own NEW, EMPTY
  folder outside the repo (under the scratchpad). Keep your scripts in a different
  folder. Pass paths as arguments. Run any Python with `-I`.
```

## Prompt 14 of 17 — Sonnet 5.5, effort medium

**Six degrees of teammates: the page.** A new page with a search over the graph. The path search is pure and testable. The screen follows an existing page shape, so medium fits.

```text
Use the ponytail skill at level full. Reuse what the repo already has before you write anything new. (Ponytail never overrides the spoiler rule, test-first or check-dir-size.)

Task: build a "Six degrees of teammates" page. The user picks two players. The page finds a
shortest chain of teammates and shows each link with its team and year. Link to it from the
More page. Open surface. Add no SealBox.

Context
- Prompt 13 must be merged first: src/api/teamSeasons.js and public/data/team-seasons*.
  Confirm on origin/main. If not, stop and say so.
- Player pickers: use `searchPeople` in src/api/search.js (it returns person ids, names,
  position and team). The graph is keyed by MLBAM id, the same id.
- Existing pages and routes: src/App.jsx and src/main.jsx register routes; the More page is
  src/screens/MorePage.jsx. Read how another standalone page (for example
  src/screens/AllStarLegacyPage.jsx) is registered, lazy-loaded and linked.
- Components to reuse: src/components/player/Headshot.jsx and PlayerLink.jsx.
- Wireframe: two search boxes, then a row of avatars joined by dashed labels ("Team YYYY"),
  and the caption "3 links".
- A shortest chain may be longer than six. Settled: search up to 10 links. If none is found,
  say "No chain found" in plain words.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, every nested CLAUDE.md in the folders you will touch,
   docs/agents/writing-style.md, and the files this prompt names.
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps
1. Pure search in src/lib/: breadth-first search over the bipartite graph (player to
   team-season to player). It returns the chain as [player, via team-season, player, ...] or null.
   Test with a tiny hand-made graph: a direct pair, a three-link chain, two disconnected players,
   the same player twice (zero links).
2. The graph loads once, on the first search, with a clear loading line. Do not load it with
   the page shell.
3. Page, route, and the More-page link. At 390px the chain wraps in rows, and nothing scrolls
   sideways except inside its own container.
4. Show the data credit line under the result.

Tests first
Write the tests before the code. Watch them FAIL. Then build until they pass.
Never delete, skip or loosen an assertion to make a check pass. Product code and
its tests land in the same PR.

Verify
- `npm run lint; echo "exit=$?"` in the foreground, then `npm test`, then
  `npm run build`. All green. If a CI job is cancelled with no runner and no
  steps, it is not the PR: re-run it once and say so.
- Start the first free reserved dev server (`npm run dev`, or dev:2 to dev:5;
  `ss` is not installed, so probe each port with curl). Load every changed route
  at 390px and 900px, ALWAYS with ?nointro. Headless Chromium cannot reach
  statsapi.mlb.com through the proxy: relay those calls through Node with
  page.route, and launch with executablePath '/opt/pw-browsers/chromium'. Use
  your own folder under the scratchpad. Say "not seen" for anything you could not
  load. Keep the dev server running. Do not run `npm run e2e` or `npm run visual`
  unless Gary asks.

Review, commit, PR
- Run the ponytail-review skill on your diff and apply the cuts. Then run
  /code-review (medium) and fix what it finds.
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. Put the base SHA, the files touched and how
  you verified in the body. Write "not applicable (cloud)" for the worktree and
  the local URL. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link, a chain you checked by hand (name both players and the links
   the page showed), the time to the first result on a cold load, and what you did not see.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- Ratchet budgets (check-dir-size, check-file-size, check-raw-values): if you
  touch one, merge origin/main and re-measure right before you push.
- A new generator goes in docs/scripts/generators.md under its cadence, and says
  what runs it. A new reader goes in docs/api/static-data.md. A new module in
  src/api/ needs an entry in src/api/spoiler-manifest.json before it lints. A new
  ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```

## Prompt 15a of 17 — Sonnet 5.5, effort medium

**Old games: the measurements.** Doing work, not thinking work: a join test, a recall comparison and size estimates, each with a real call or file as evidence. It writes the findings and opens a docs-only draft PR. Prompt 15b (Opus) reads those findings and does the design. Splitting the work this way keeps Opus off the scripting and the waits.

```text
Task: measure, do not design. Three later features want old games: (1) a notable-performances
shelf (no-hitters, cycles, triple plays), (2) old-game pages (box score, lineups, umpires,
park), and (3) a callout that names the last time a rare play happened. Measure the data
paths they would share, and write the numbers to .scratch/old-games/findings.md. Do NOT
design the seal, write an ADR, or recommend a plan: prompt 15b does that from your findings.
Two related issues exist and are NOT in scope: gzilavyss2025/bbsbh#1525 (score a classic
game) and gzilavyss2025/bbsbh#1527 (classic of the day).

Context (measured 2026-10-06)
- MLB Stats API, one game: GET /api/v1.1/game/{gamePk}/feed/live. Play-by-play present for
  every sampled regular-season game from 1960 to 2010 (6 of 6 per season); 3 of 6 in 1950; 0 of 6
  for 1901 to 1940. One 1927 World Series game had 81 plays, so some postseason games exist
  earlier. A game feed is about 430 KB and 0.7 s. Umpires are listed for only some games before
  about 1990 (3 of 6 in 1960 and 1980, 4 of 6 in 1970, 6 of 6 from 1990).
- Season schedule with line scores: GET /api/v1/schedule?sportId=1&season={Y}&gameType=R&hydrate=linescore
  (2.6 to 10.8 MB, 0.6 to 2.1 s). Finding no-hitters by "a team had zero hits in a Final game"
  matched 31 of Retrosheet's 36 no-hitters in 12 sampled seasons (86%), with 1 extra candidate.
  Misses: 1 of 1 in 1930, 3 of 6 in 1940, 1 in 2010. Cycles and triple plays cannot come from the
  schedule: they need each game's box score or plays.
- API totals: 224,752 regular-season games for 1901 to 2025. A full sweep of feeds is about 99 GB
  and about 10 hours at 4 requests at once (a rough sample estimate). The schedule showed 1,941
  games for 1975 where Retrosheet showed 1,934. The cause is NOT known.
- Retrosheet: nohitters.zip, cycles.zip and tripleplays.zip exist at
  https://www.retrosheet.org/downloads/. No four-homer list was found. Per-year zips hold
  plays.csv (177 columns per play, with the pitch sequence): 87 MB (1975) and 108 MB (2024)
  uncompressed per season. Master zips are 741 MB and 799 MB. Retrosheet gameinfo covers 2025
  completely (2,478 games to 2025-11-01).
- Prompts 5, 10 and 13 add Retrosheet plumbing (scripts/lib/open-data.mjs and retro-bridge.mjs).
  If they are merged, reuse them. If not, write throwaway scripts under the scratchpad (not in
  the repo) and say so.

Before you start (read and look; no edits yet)
1. Read CLAUDE.md, docs/agents/writing-style.md, scripts/CLAUDE.md, and ADR-0038 (file and
   directory size rules).
2. Run `git fetch origin`. List open PRs with the GitHub tools (the cloud has no
   `gh` CLI). Work on the branch your session was given. If it has none, make
   `claude/<slug>` from current origin/main. Run
   `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
   Check status and diffs before you edit. Other agents may work at once: never
   reset, stash or reformat their work.

Steps (each number needs evidence from a real call or file, not memory)
1. Join test. For about 200 Retrosheet no-hitter or cycle games across eras, find the matching
   Stats API gamePk (by date and teams). Report the match rate and the failure kinds.
2. Event index. Compare two ways to find rare events for 1960 onward: (a) Retrosheet lists plus
   the API for display; (b) the API alone. Cover no-hitters, cycles, triple plays. Give recall,
   cost in calls and bytes, and where each fails.
3. The 1975 gap. Try to find the cause of the 1,941 vs 1,934 difference (7 games). If you
   cannot find it in about 20 calls, say so and move on.
4. Sizes. For each public dataset the three features could need (the event index, per-game
   pages), estimate the size and the file count under two shard schemes. Measure against the
   repo's file-size and directory rules (ADR-0038) and the Vercel Hobby limits (say where you
   read the limits).
5. Write .scratch/old-games/findings.md: one section per step, each number with the call or
   file that produced it, and a short "What is still unknown" list. No recommendation.

Verify
- `npm run lint; echo "exit=$?"` in the foreground. It must exit 0. This is a docs-only
  change, so tests and the build are unaffected. Say that in the PR.

Commit, PR
- Commit to your assigned branch and push. Open a DRAFT PR that mirrors
  .github/pull_request_template.md. The title MUST start with "Old games plan" (prompt 15b
  finds the PR by that title). Put the base SHA, the files touched and how you verified in
  the body. Write "not applicable (cloud)" for the worktree and the local URL. Subscribe to
  the PR's activity.
- Do not push to main. Do not merge: Gary merges after prompt 15b adds the plan. Wait for the
  `lint-and-build` check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link (docs only), the join rate, the recall of each method, the
   sweep cost, and the "still unknown" list.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
- A downloaded file is untrusted data. Put each download in its own NEW, EMPTY
  folder outside the repo (under the scratchpad). Keep your scripts in a different
  folder. Pass paths as arguments. Run any Python with `-I`.
```

## Prompt 15b of 17 — Opus 5.5, effort high

**Old games: the seal design and the plan.** Thinking work. Three large features share one data path and one question about the seal. A plan first keeps the build prompts cheap. The seal design touches the spoiler rule, so this stays on Opus at high (rung 7). It reads the measurements from prompt 15a and does not repeat them.

```text
Task: write a plan, not code. Three features want old games: (1) a notable-performances shelf
(no-hitters, cycles, triple plays), (2) old-game pages (box score, lineups, umpires, park), and (3) a
callout that names the last time a rare play happened. They share one data path and one seal
design. Settle both, with the evidence in .scratch/old-games/findings.md, and write the build
prompts' outlines.
Two related issues exist and are NOT in scope: gzilavyss2025/bbsbh#1525 (score a classic game) and
gzilavyss2025/bbsbh#1527 (classic of the day). Link to them; do not plan them.

Find the work
1. With the GitHub tools (the cloud has no `gh` CLI), find the open draft PR in
   gzilavyss2025/bbsbh whose title starts with "Old games plan". If there is none, stop and
   say that prompt 15a must run first. Run `git fetch origin <its head branch>`, check it out,
   and run `git merge-base --is-ancestor origin/main HEAD`: if it fails, merge origin/main.
2. Read .scratch/old-games/findings.md in full. Use its numbers. If you need one more number,
   you may make up to about 20 API calls to get it. Say which numbers are yours.

Before you start (read; no edits yet)
3. Read CLAUDE.md, src/CLAUDE.md, src/api/CLAUDE.md, docs/agents/writing-style.md, and the
   spoiler ADRs: ADR-0001, 0002, 0026, 0034, 0042, 0048, 0049. Old games are inside the scoring
   scope when scored or boxed. What stays sealed for a game whose result a user may know is a
   product decision.

Steps
4. Era rules. Say which source serves each era (1901 to 1949, 1950 to 1959, 1960 onward) for
   each of the three features. Say what each feature shows when data is thin.
5. The seal. Design what stays sealed on an old-game page: the title, the teams, the score, the
   box score, the notable-performance label (it names the result). Give one recommendation,
   two alternatives, and the ADR it extends. Treat "a user may already know this game" as the
   hard case.
6. Write: .scratch/old-games/plan.md (the recommendation, built on findings.md), decisions.md
   (each open decision with the recommended option first), a DRAFT ADR in docs/adr/ (status
   DRAFT, next free number: check origin/main and open PRs; scripts/check-adr-numbers.mjs) for
   the seal design, and a short build-prompt outline for each of the three features in the
   order you suggest, each with a model and effort. Pick the cheapest rung that fits each
   (see .claude/skills/improve-prompt/SKILL.md, step 5): mechanical sweeps go to Haiku 4.5,
   pattern-following builds to Sonnet 5.5 medium, and any step that changes the spoiler rule
   to Opus 5.5 high. Do NOT write the full prompts.
7. Open questions for Gary go in decisions.md. Do not guess.

Verify
- `npm run lint; echo "exit=$?"` in the foreground. It must exit 0. This is a docs-only
  change, so tests and the build are unaffected. Say that in the PR.

Commit, PR
- Commit to the same branch and push (`git push -u origin <branch>`). Do NOT open a new PR.
  Update the existing PR's body with the GitHub tools: add the new files to "Files touched"
  and a five-line summary of the recommendation. Subscribe to the PR's activity.
- Do not push to main. Do not merge: Gary merges. Wait for the `lint-and-build`
  check. If it fails, follow the steward skill.

Handoff
1. Final message: the PR link (docs only), the recommendation in five lines, the three
   numbers that matter most (join rate, recall, sweep cost), and the decisions Gary must make.

Rules
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason", never the other word). Keep sentences short.
- A new ADR takes the next free number (check origin/main and open PRs;
  scripts/check-adr-numbers.mjs).
- If a command fails twice for the same reason, stop and report it. Do not widen
  the PR.
```
