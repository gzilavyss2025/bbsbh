# EmptyState — ready-to-paste prompts for slices E2 to E8 (#1132)

Written at the end of slice E1. Each prompt takes its rows, files, routes and
"Care" notes from `slices.md`, corrected with what E1 found. The E9 prompt is
not here: E8's session writes it, because E9 depends on what E2 to E8 leave.

## What E1 taught (read this before you paste a prompt)

1. **The API as built.** `src/components/ui/state/EmptyState.jsx`:
   `<EmptyState label note action size className {...rest}>text</EmptyState>`.
   `size` is `'block'` (the default) or `'compact'`. The root is always a
   `<div class="emptystate emptystate--{size} {className}">`, with
   `__label` (span), `__text` (p), `__note` (p) and `__action` (div). The
   helper is `emptyStateParts()` in `src/lib/design/emptyStateClass.js` (NOT
   `emptyStateClass()`). It exports `SIZES` and throws on an unknown size.
   "Not given" is `null`, `undefined`, `false` or `''`; a `0` renders.
2. **EmptyState does not wear `.hint`.** A site that moves loses `.hint`'s
   `padding: var(--space-3) 2px`, `--text-muted` and `--fs-ui`, and any
   `.screen--slate .hint` or `.x .hint` rule that hooked it. The root has
   `margin: 0`. So check the space above and below each moved site: a page
   with no `Stack` and no `gap` may need a namespace margin (E1 kept
   `.txpage__empty { margin: 20px 0 }` for this reason).
3. **`emptyProse` has 23 callers, not 10.** slices.md lists 10. A grep on
   `main` at `7e07e83cf` finds 23 files under `src/screens/` that pass it. E2
   is 24 files, and it shares files with E6 AND E7 (below).
4. **The order changes.** E6 waits for E2. E2 edits five of E6's files
   (`AllStarLegacyPage.jsx`, `MilestoneWatchPage.jsx`, `RehabPage.jsx`,
   `TradeDeadlineSeasonPage.jsx` and `around-the-game/DoubleheadersPage.jsx`:
   slices.md missed the last one), and `GamePhotosPage.jsx` holds an
   `AsyncStatus` that E2 moves without an edit. **E7 also waits for E2**: E2 deletes `emptyProse`
   from `ProspectsPage.jsx`, which E7 edits. E3, E4, E5 and E8 share no file
   with each other or with E2, E6 or E7. So: E2, E3, E4, E5 and E8 can run
   side by side once E1 is on `main`; E6 and E7 start after E2 merges, and
   then run side by side (they share no file).
5. **`screens/designlab/catalog.js` needed no change.** It is the card and
   pill block table. The lab entry lives in `components.jsx` only.
6. **The slot tests.** `test/card-cascade.test.js` and
   `test/table-cascade.test.js` pin the imports between `system/card.css` and
   `06`. Any slice that adds a `system/*.css` file there must update both.
   No slice in E2 to E8 should need to.
7. **The test file.** `test/empty-state-cascade.test.js` has five sections.
   Section 5 pins the pilot. Each slice adds its pins to section 5 (the site
   renders on `EmptyState` with its namespace; the empty test stays; the
   namespace rule keeps only a margin, or is gone).
8. **The census.** `census.mjs` now skips EmptyState's own files (they are the
   target). A moved site stays in the census when it keeps a namespace class
   or its copy starts "No", "Nothing" or "Not posted". A moved site that has
   neither drops out, and its override prints STALE. Keys are `file#n`, so a
   change above a site shifts its key. After each slice, re-run the census,
   write "DONE in Ex" into the reason of each moved row in `overrides.tsv`,
   and fix every STALE key by reading it. The census must end with
   `unreviewed 0` and no STALE line.
9. **Routes.** The Brewers' transactions page shows moves. A minor-league
   club shows the empty state live:
   `/team/nashville-sounds-556/transactions?nointro` (checked in E1).
10. **Screenshots in a cloud session.** The `playwright` npm package looks
    for a headless shell that is not installed. For an ad-hoc screenshot
    script, launch with `executablePath: '/opt/pw-browsers/chromium'`. This is
    not `npm run e2e` and not `npm run visual`.

---

## E2 — AsyncStatus's empty branch

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. The edit is
mechanical, but it changes 29 pages and the slate (a spoiler surface), and
each page needs a spacing check now that `.hint`'s padding goes.

```text
Task: build slice E2 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): AsyncStatus's empty branch renders EmptyState, and the
emptyProse prop goes. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E2), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 is on main: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest),
  src/lib/design/emptyStateClass.js (emptyStateParts, SIZES),
  src/styles/system/empty-state.css, test/empty-state-cascade.test.js.
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus moves in one
  step (this slice). Q2 a dashed hairline inset, no fill, graphite copy; the
  label in display caps, text and note in the body face. Q3 two sizes, block
  and compact. Q4 all six hold groups stay held.
- CORRECTION to slices.md: 23 files pass emptyProse, not 10. E2 is 24 files.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, src/components/ui/CLAUDE.md, spec.md
   ("AsyncStatus", "The spoiler scope") and slices.md (E2).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 is merged there. Check status and diffs before
   you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.
4. Grep for emptyProse under src/ and list every caller. Expect 23 under
   src/screens/ plus AsyncGate.jsx; use what the grep finds.

Build
- src/components/ui/AsyncGate.jsx: the empty branch becomes
  <EmptyState>{emptyMessage}</EmptyState>. Delete the emptyProse prop. Do not
  change the loading branch or the two error branches. Update the comment
  above AsyncStatus.
- Every caller: delete the one emptyProse line. Change nothing else.
- test/empty-state-cascade.test.js, section 5: AsyncGate.jsx imports
  EmptyState and renders it in the empty branch; no file under src/ passes
  emptyProse; AsyncGate.jsx still renders 'hint hint--error' for both errors.
- overrides.tsv: mark AsyncGate.jsx#4 and the 29 caller rows "DONE in E2";
  fix any STALE key; re-run the census to unreviewed 0.

Care
- The slate: GameSelect.jsx's "No games scheduled." moves here. The test
  stays the schedule's length; a day with no games carries no score. The slate
  rule `.screen--slate .hint` (05-masthead-nav.css) no longer reaches this
  line. EmptyState copy is uppercase anyway (01-base.css). Check that the
  slate reads right.
- Spacing: the old line had .hint's padding (12px top and bottom). The inset
  has margin 0. On each route, check the space between the empty inset and
  its neighbours. If a page needs space, add it in that page's own namespace
  only if E2 already edits that file; otherwise list the page in the PR for a
  later slice. Do not add a margin to empty-state.css.

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. AsyncStatus's
  hasData test stays byte for byte. A day with no games is not a result.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load, at 390px and 900px, with ?nointro on every URL:
  /standings?nointro, /attendance?nointro, /umpires?nointro, /fouls?nointro,
  /nine-keys?nointro (each shows its board while data is on file: check that
  the loader and the board do not change), and the slate on a date with no
  games, such as /12252026?nointro (not checked: the offseason page may take
  the slate's place; if so, find an off day in the season). Check the empty
  look in /design-lab?nointro. Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. Update prompts-e2-e8.md if E2 taught something that changes E6 or E7 (they
   wait for you). Do not write prompts for other slices.
```

## E3 — the spoiler surfaces

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. Every row sits inside
the spoiler scope; the slice must move five boxes and leave every gate, test
and reveal-only call exactly where it is.

```text
Task: build slice E3 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the five empty states on the spoiler surfaces
onto EmptyState. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E3), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 is on main: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint), src/lib/design/emptyStateClass.js
  (emptyStateParts, SIZES), src/styles/system/empty-state.css,
  test/empty-state-cascade.test.js.
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2). Q2 a dashed hairline inset, no fill, graphite copy; the label in
  display caps, text and note in the body face. Q3 two sizes, block and
  compact. Q4 all six hold groups stay held (Express Lane, the search boxes,
  the bracket fold, the series chart, the farm-system row, tool pages).
- E3 shares no file with E2, E4, E5, E6, E7 or E8. It can run beside them.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md ("UI-side spoiler enforcement"),
   src/api/CLAUDE.md, src/components/boxlines/CLAUDE.md, ADR-0001, ADR-0002,
   ADR-0069, spec.md ("The spoiler scope") and slices.md (E3).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 is merged there. Check status and diffs before
   you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.

Build (rows: census Part 2, slice E3)
- components/inning/focus/ReferencePanel.jsx: "No pitching lines yet"
  (.refpanel__empty) becomes EmptyState. styles/focus/reference.css: the
  .refpanel__empty rule goes (keep a namespace margin only if the rail needs
  it). Check that the class is not in scripts/check-seal-scope.mjs first.
- components/inning/RosterPanel.jsx: "Not posted yet." becomes
  <EmptyState size="compact">.
- screens/TeamInfo.jsx: the starter card's "Not posted yet." becomes
  <EmptyState size="compact">. styles/10-lineup.css: the `.starter > .hint`
  inset goes, if nothing else wears it.
- components/boxlines/BoxLinesSheet.jsx and components/boxlines/
  GameLinesDoor.jsx: the two empties become EmptyState. The loading and error
  lines keep .hint .boxlines__hint. styles/boxlines/boxlines.css changes only
  if a margin must move.
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState; each empty TEST is still in its file, byte for byte (armsEmpty,
  the roster's empty, the starter card's projected?.length fallback, Box
  Lines' rows.length === 0); each removed rule is gone.
- overrides.tsv: mark the moved rows "DONE in E3"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- Move the box, never the gate. No SealBox, no revealedThrough check and no
  reveal-only call (linescore.js, derive.js, hitchart.js) moves or changes.
  Box Lines' rows come gated from api/boxlines/rows.js (ADR-0069): do not
  touch that file.
- The copy does not change. An empty state in the scope says what is
  missing ("No pitching lines yet"), never what happened ("No runs").
- EmptyState has no reveal prop. A sealed value is never "empty": do not
  use EmptyState where a SealBox belongs.
- Fit: the innings rail is narrow at 390px. Check that the inset does not
  push the rail's tabs.

Rules
- Spoiler rule (the whole point of the app): on these surfaces a
  score-revealing value never exists in the DOM before its reveal. This slice
  must not change what renders before a reveal, except the empty box.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL:
  /07072026/milstl-2/top1?nointro (step through; the rail's empty line shows
  only on a half with no arms yet, which a finished game rarely has: not
  checked), the lineup pages of a game on tomorrow's slate, such as
  /{tomorrow MMDDYYYY}/{matchup}/lineup1?nointro (lineups and starters are
  often not posted yet), /07072026/milstl-2/lineup1?nointro (open the Box
  Lines door; pick a player with no lines before the cutoff, such as a
  call-up), and /07072026/milstl-2/boxscore?nointro (must not change). Where a
  route cannot show the empty state with today's data, say so and check
  /design-lab?nointro. Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. If E3 taught something that changes a slice not yet started, add it to
   prompts-e2-e8.md. Do not write new prompts.
```

## E4 — the team hub

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Six sites on one
hub, each a plain move; the one rule to keep in mind (Stamp In renders no
stamp art) is copy only.

```text
Task: build slice E4 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the team hub's six empty states onto EmptyState.
Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E4), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 is on main: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint), src/lib/design/emptyStateClass.js
  (emptyStateParts, SIZES), src/styles/system/empty-state.css,
  test/empty-state-cascade.test.js.
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2). Q2 a dashed hairline inset, no fill, graphite copy; the label in
  display caps, text and note in the body face. Q3 two sizes, block and
  compact. Q4 all six hold groups stay held.
- E4 shares no file with E2, E3, E5, E6, E7 or E8. It can run beside them.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, src/screens/team/CLAUDE.md, ADR-0035,
   ADR-0042, spec.md and slices.md (E4).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 is merged there. Check status and diffs before
   you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.

Build (rows: census Part 2, slice E4; 7 files)
- screens/team/modules/records/RecordsCard.jsx (.trec__empty) and
  styles/65-team-records.css: size="compact"; the rule keeps only a margin,
  or goes.
- screens/team/modules/minors/HorizonCard.jsx (.hzntile__nostat) and
  styles/31-wild-card.css: size="compact"; same.
- screens/team/modules/minors/DepthChartCard.jsx: the "Too early" line,
  size="compact".
- screens/team/ContractsTab.jsx: the two empties (a minor-league club; a
  ledger not published).
- screens/team/StampInPage.jsx: "No games posted yet".
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState with the right size; each empty test stays in its caller; each
  namespace rule keeps only a margin or is gone.
- overrides.tsv: mark the moved rows "DONE in E4"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- Stamp In is gated on the PAGE (ADR-0042). Its empty line is copy only and
  renders no stamp art (ADR-0035). Do not import a stamp module.
- A tile inside a Card: EmptyState draws its own dashed edge inside the
  card's edge. Check that the tile does not grow taller than its neighbours
  at 390px.
- EmptyState does not wear .hint: check the space each site loses.

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. The team hub
  is outside the scoring scope, but Stamp In is a consented departure
  (ADR-0042): do not widen it.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL:
  /team/milwaukee-brewers-158/numbers?nointro (the Records card; pick a month
  with no games if the month lever offers one: not checked),
  /team/milwaukee-brewers-158/minors?nointro,
  /team/nashville-sounds-556/contracts?nointro (a minor-league club: the "no
  ledger" line shows), /team/milwaukee-brewers-158/contracts?nointro (must not
  change), /team/milwaukee-brewers-158/stamp-in?nointro. Where a route cannot
  show the empty state, say so and check /design-lab?nointro. Keep the server
  running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. If E4 taught something that changes a slice not yet started, add it to
   prompts-e2-e8.md. Do not write new prompts.
```

## E5 — the player page

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Three sites; the
only new shape is the label plus a two-line note, which the lab already
proves.

```text
Task: build slice E5 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the player page's three empty states onto
EmptyState. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E5), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 is on main: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint), src/lib/design/emptyStateClass.js
  (emptyStateParts, SIZES), src/styles/system/empty-state.css,
  test/empty-state-cascade.test.js. The /design-lab entry shows the label +
  note + action shape.
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2). Q2 a dashed hairline inset, no fill, graphite copy; the label in
  display caps, text and note in the body face. Q3 two sizes, block and
  compact. Q4 all six hold groups stay held.
- E5 shares no file with E2, E3, E4, E6, E7 or E8. It can run beside them.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, spec.md and slices.md (E5).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 is merged there. Check status and diffs before
   you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.

Build (rows: census Part 2, slice E5; 4 files)
- components/playerstats/ProspectCard.jsx and styles/31d-prospect-card.css:
  the two standing states (.prospectcard__empty). "No qualified comparison
  yet" and the early-sample state. __emptylabel becomes `label`. The
  early-sample state passes both notes as ONE `note` node (two lines). The
  `.prospectcard__empty p` child rule goes; .prospectcard__empty keeps only a
  margin, or goes.
- components/playerstats/SplitsVsTeam.jsx and styles/26-player-page.css:
  "No career meetings" (.vsteam__none) takes size="compact".
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState; the prospect card passes `label` and `note`; the empty tests
  stay in the callers; the removed rules are gone.
- overrides.tsv: mark the moved rows "DONE in E5"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- A note with two lines: pass a fragment, not two <p> (the note is already a
  <p>, and a <p> inside a <p> is invalid). Use a <br /> or two inline spans.
- Do not touch .vsteam__door (a dashed door; the dashed-rule fix's call).

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. The player
  page is outside the scoring scope.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL: a Top
  100 prospect's page, reached from /prospects?nointro (one with an early
  sample shows the three-line shape: not checked which), and
  /player/christian-yelich-592885/stats?nointro (the splits; pick a club he
  has never faced). Where a route cannot show the empty state, say so and
  check /design-lab?nointro. Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. If E5 taught something that changes a slice not yet started, add it to
   prompts-e2-e8.md. Do not write new prompts.
```

## E6 — the standalone pages

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Ten bare `.hint`
lines on pages outside the scoring scope; the work is the same move ten
times, plus `role="status"` where the reader acts first.

```text
Task: build slice E6 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the hand-written empty .hint on ten standalone
pages onto EmptyState. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E6), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 and E2 must both be on main. E2 edited five of this slice's files
  (AllStarLegacyPage.jsx, MilestoneWatchPage.jsx, RehabPage.jsx,
  TradeDeadlineSeasonPage.jsx, around-the-game/DoubleheadersPage.jsx: each
  lost emptyProse). GamePhotosPage.jsx holds an AsyncStatus that E2 moved.
- EmptyState: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint).
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2, done). Q2 a dashed hairline inset, no fill, graphite copy; text in the
  body face. Q3 two sizes, block and compact. Q4 all six hold groups stay
  held.
- E6 shares no file with E3, E4, E5, E7 or E8. It can run beside E7.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, spec.md and slices.md (E6), and E2's PR.
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 AND E2 are merged there. Check status and
   diffs before you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first (E2 may have shifted keys
   in the shared files).

Build (rows: census Part 2, slice E6; 10 files, no CSS)
- The hand-written empty .hint on: screens/AllStarLegacyPage.jsx,
  screens/MilestoneWatchPage.jsx, screens/RehabPage.jsx,
  screens/LeadersPage.jsx, screens/around-the-game/DoubleheadersPage.jsx,
  screens/TradeDeadlineSeasonPage.jsx, screens/UmpirePage.jsx,
  screens/SalariesPage.jsx (league not published), screens/GamePhotosPage.jsx
  (nothing picked), components/game/GameFinder.jsx.
- Each becomes <EmptyState>. Four are a club filter's result (All-Star
  legacy, milestones, rehab, trade deadline): they appear after the reader
  acts, so they take role="status".
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState; the four filter results carry role="status"; no moved site
  still wears a bare .hint for its empty line.
- overrides.tsv: mark the moved rows "DONE in E6"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- Move only the EMPTY line in each file. A loading line, an error line or a
  caveat (.hint as a footnote) in the same file stays.
- GameFinder.jsx's "Pick two different teams." is an error, not an empty
  state: it stays.
- The /photos prompt is the empty state of a picker, not a caveat.
- No CSS file changes. If a page needs space around the inset, list it in
  the PR; do not add a margin to empty-state.css.

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. These pages
  sit outside the scoring scope; the game finder opens from the slate, so it
  must show no score.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL:
  /all-star-legacy?nointro, /milestones?nointro, /rehab?nointro,
  /trade-deadline?nointro (each: pick a club with none),
  /doubleheaders?nointro (pick years with none), /photos?nointro (nothing
  picked: shows at once), /leaders/a?nointro (not checked that it is empty),
  /salaries?nointro, an umpire's page from /umpires?nointro, and the game
  finder from the slate's menu (not checked where it opens). Where a route
  cannot show the empty state, say so and check /design-lab?nointro. Keep the
  server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. If E6 taught something that changes a slice not yet started, add it to
   prompts-e2-e8.md. Do not write new prompts.
```

## E7 — the boxed and mixed ones

Model and effort: Opus 5.5 (`claude-opus-5-5`), high. Two sites say loading
OR empty in one element and must split without changing the loading line;
one site gains the action slot; one opens from the box score's umpire card;
an e2e spec reads one class name.

```text
Task: build slice E7 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the five boxed and mixed empty states onto
EmptyState. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E7), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 and E2 must both be on main. CORRECTION to slices.md: E2 deletes
  emptyProse from screens/ProspectsPage.jsx, so E7 waits for E2.
- EmptyState: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint; `action` takes ONE element and renders it
  in a <div class="emptystate__action">).
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2, done). Q2 a dashed hairline inset, no fill, graphite copy; the label in
  display caps, text and note in the body face. Q3 two sizes, block and
  compact. Q4 all six hold groups stay held.
- E7 shares no file with E3, E4, E5, E6 or E8. It can run beside E6.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md ("One control, one door"),
   src/components/ui/CLAUDE.md, src/components/logbook/CLAUDE.md,
   src/components/offseason/CLAUDE.md, ADR-0035, spec.md and slices.md (E7).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 AND E2 are merged there. Check status and
   diffs before you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.

Build (rows: census Part 2, slice E7; 10 files)
- screens/ProspectsPage.jsx and styles/31c-prospect-filters.css: the filter
  result (.prospects__empty, a SOLID box today) becomes EmptyState with the
  Clear filters control in `action`. It must be a Button
  (ui/control/Button.jsx); convert it if it is not one. It appears after the
  reader acts: role="status". The solid box rule goes.
- components/salaries/SalaryBoard.jsx and styles/71-salaries-league.css: the
  board empty becomes <EmptyState className="payboard__empty">. The solid top
  rule goes; the namespace keeps only a margin.
- components/umpire/UmpireAccuracyModal.jsx and styles/14-strike-zone.css:
  .umpmodal__hint becomes EmptyState; its rule goes.
- components/logbook/StampSheet.jsx and styles/48c-stamp-sheet.css, and
  components/offseason/OffseasonLead.jsx and styles/78-offseason.css: SPLIT.
  .stampsheet__empty and .oseason__quiet each say loading OR empty in one <p>.
  The loading branch keeps a plain line (its own class, unchanged look); only
  the empty branch becomes EmptyState. Keep role="status" on the offseason
  line.
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState; ProspectsPage passes a Button in `action`; SalaryBoard passes
  className="payboard__empty"; the two splits keep a loading line that is not
  EmptyState; the removed rules are gone.
- overrides.tsv: mark the moved rows "DONE in E7"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- Names: e2e/salaries.spec.js reads .payboard__empty. Pass
  className="payboard__empty". Do not change the spec.
- The split: the loading copy and its look must not change. Read each
  component's state flags and keep the same conditions; only the element in
  the empty branch changes.
- The umpire modal opens from the box score's umpire card (inside the
  spoiler scope). Its empty line says the umpire has no data, not a game
  result. Do not move any reveal gate, and do not import an api/ module into
  a component that did not import one.
- The stamp sheet renders no stamp art in its empty branch (ADR-0035).
- One control, one door: the action slot holds one Button or one Door, never
  a third kind.

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. Move the box,
  never the gate. The umpire modal's empty test stays byte for byte.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL:
  /prospects?nointro (filter until nothing matches), /salaries?nointro (pick a
  club and a position with no salaried player),
  /07072026/milstl-2/boxscore?nointro (reveal, open the plate umpire's
  accuracy; the empty line shows only for an umpire with no data: not
  checked), /logbook?nointro (open the stamp sheet), and the slate in the
  offseason (/aaa/10012026?nointro) for the offseason lead. Check that each
  loading line looks as it did before. Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. If E7 taught something that changes a slice not yet started, add it to
   prompts-e2-e8.md. Do not write new prompts.
```

## E8 — the Matchup Scout and the Game Log

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), medium. Eight sites in
four files with no CSS change; the one judgment is to leave the lab's scout
harness alone. This session also writes the E9 prompt.

```text
Task: build slice E8 of the EmptyState collapse for GitHub issue #1132
(gzilavyss2025/bbsbh): move the Matchup Scout's and the Game Log's empty
states onto EmptyState. Do NOT start any other slice.

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E8 and E9), decisions.md, census.md, overrides.tsv, and
  prompts-e2-e8.md ("What E1 taught": read it first).
- E1 is on main: src/components/ui/state/EmptyState.jsx (props label, note,
  action, size 'block' | 'compact', className, children, ...rest; the root is
  a <div>; it does not wear .hint), src/lib/design/emptyStateClass.js
  (emptyStateParts, SIZES), src/styles/system/empty-state.css,
  test/empty-state-cascade.test.js.
- Gary's answers (2026-10-05), all as recommended: Q1 AsyncStatus in one step
  (E2). Q2 a dashed hairline inset, no fill, graphite copy; text in the body
  face. Q3 two sizes, block and compact. Q4 all six hold groups stay held
  (tool pages included: the lab's scout harness is one).
- E8 shares no file with E2, E3, E4, E5, E6 or E7. It can run beside them.

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, src/components/logbook/CLAUDE.md,
   docs/scout-design.md, ADR-0035, spec.md and slices.md (E8, E9).
2. Fetch origin. List open PRs and worktrees. Base your branch on current
   origin/main, and confirm E1 is merged there. Check status and diffs before
   you edit.
3. Re-run node .scratch/design-system/empty-state-collapse/census.mjs. Fix
   UNREVIEWED or STALE rows in overrides.tsv first.

Build (rows: census Part 2, slice E8; 4 files, no CSS)
- screens/scout/ScoutPage.jsx: "Pick a pitcher and a hitter", and the three
  "Not posted" chart slots (size="compact").
- screens/scout/HeadToHead.jsx: the two head-to-head empties.
- screens/LogbookCollection.jsx and screens/LogbookStatsPage.jsx: the two
  "No stamps yet" lines.
- test/empty-state-cascade.test.js, section 5: each moved site renders on
  EmptyState; the three chart slots are compact; the Game Log files import no
  stamp module for the empty line.
- overrides.tsv: mark the moved rows "DONE in E8"; fix STALE keys; re-run the
  census to unreviewed 0.

Care
- .scout__notposted keeps its rule in styles/scout/scout.css: the design
  lab's scout harness (a held tool page) still wears it. Do not edit the lab.
- The Scout's cutoff (docs/scout-design.md, ADR-0095) stays where it is. An empty
  head-to-head says no meetings, never a result.
- The Game Log lines are copy only; they render no stamp art (ADR-0035).

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. The Scout and
  the Game Log sit outside the scoring scope; stamp art may render only where
  check-stamp-surfaces allows.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5). Load at 390px and 900px, with ?nointro on every URL:
  /scout?nointro (shows the prompt at once), a pair with no meetings from
  there, /logbook?nointro and /logbook/stats?nointro in a browser with no
  stamps (a fresh browser context). Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177's
  screenshot suite. Do not push to main.

Final handoff
1. What you built, the clickable local URLs, the census re-run result, and
   what you did not check.
2. A ready-to-paste prompt for slice E9 (clean-up) ONLY, in the same shape
   (Task, Context, Before you start, Build, Rules, Final handoff), with a
   "Model and effort" line above its fenced block. Base it on slices.md (E9)
   and on what E2 to E8 left on main: re-run the census, list the dead rules,
   the check-raw-values budgets to lower (#1178), and the
   src/components/ui/CLAUDE.md state/ line. If a slice before E8 is not
   merged yet, say which, and say that E9 waits for it. Add the prompt to
   prompts-e2-e8.md (rename nothing).
```

---

## What E2 to E8 did (2026-10-05)

All seven ran as subagents of the E1 session, STACKED, not from `main`:

| slice | PR | base | test file |
| --- | --- | --- | --- |
| E1 | #1456 | main | `test/empty-state-cascade.test.js` |
| E2 | #1463 | `claude/empty-state-e1` | `test/empty-state-e2.test.js` |
| E3 | #1464 | `claude/empty-state-e1` | `test/empty-state-e3.test.js` |
| E4 | #1462 | `claude/empty-state-e1` | `test/empty-state-e4.test.js` |
| E5 | #1461 | `claude/empty-state-e1` | `test/empty-state-e5.test.js` |
| E6 | #1474 | `claude/empty-state-e2` | `test/empty-state-e6.test.js` |
| E7 | #1476 | `claude/empty-state-e2` | `test/empty-state-e7.test.js` |
| E8 | #1460 | `claude/empty-state-e1` | `test/empty-state-e8.test.js` |

Merge order: #1456 into main; retarget #1463, #1464, #1462, #1461 and #1460
to main and merge them; then retarget #1474 and #1476 to main and merge them.
Expect small conflicts in `overrides.tsv` (every slice edited its own rows,
some next to each other). No slice committed `census.md` or `census.json`.

What they found, for E9:

- **A moved site often leaves the census.** A site with no namespace class
  drops out, and its override prints STALE: the fix was to DELETE the row,
  not mark it DONE. Keys are `file#n`, so each move shifted the keys below it
  (E5 found a value mark mislabelled as a migrating empty by a shifted key).
- **New margin-only namespace classes** (each a margin, never a frame):
  `.txpage__empty` (E1), `.roster__empty`, `.starter__empty`,
  `.boxlines__empty` (E3), `.vsteam__none` (E5), `.prospects__empty`,
  `.payboard__empty`, `.umpmodal__empty`, `.oseason__empty` (E7), and the
  slate rule `.slatebody__main > .emptystate:first-child` in
  `05-masthead-nav.css` (E2). `overrides.tsv` has an `.emptystate` row
  (other, n/a) for the slate rule.
- **Deleted rules:** `.refpanel__empty` (E3), `.starter > .hint` (E3),
  `.trec__empty`, `.hzntile__nostat` (E4), the `.prospectcard__empty*` rules
  (E5), the solid `.prospects__empty` box, `.payboard__empty`'s top rule,
  `.umpmodal__hint` (E7).
- **New loading-line classes** from E7's splits: `.stampsheet__loading` and
  `.oseason__loading` (the old rules renamed, same declarations). They belong
  to the loading/Notice family, not EmptyState.
- **Budgets.** E4 lowered `scripts/check-caption-budget.mjs` BUDGET 122 to
  121 (it deleted `.trec__empty`). No other slice changed a budget. After all
  merges the count must be measured again.
- **Kept on purpose:** `.scout__notposted` (the lab's scout harness wears
  it); the `.boxlines__hint` loading and error lines; All-Star Legacy has no
  `role="status"` (its empty line sits in 30 cards on load).
- **Not seen live** (data on file, or the feed unreachable): the Records card,
  the Horizon tile, the depth chart's "Too early", Stamp In empty (E4); the
  prospect card states (E5); the roster, starter-card and Box Lines empties
  (E3: real CSS checked by injected markup); `/trade-deadline`,
  `/doubleheaders`, `/salaries` league line, the umpire page, the game
  finder, the `/photos` prompt (E6; it shows only with no favourite club);
  the Scout's head-to-head and chart slots (E8); about 19 AsyncStatus pages
  whose data is on file (E2).
- **Environment.** The reserved dev ports were often held by other
  worktrees' servers (E6 used 5168, E7 used 5165). Headless Chromium cannot
  reach statsapi.mlb.com through the proxy: E3 and E7 relayed statsapi calls
  through Node with `page.route`. The scratchpad is shared between agents:
  use your own subfolder.

## E9 — clean-up

Model and effort: Sonnet 5.5 (`claude-sonnet-5-5`), high. It is mostly
mechanical, but it merges eight slices' census edits, decides which rules are
dead by reading each one, and re-measures two lint ratchets.

```text
Task: build slice E9 (clean-up) of the EmptyState collapse for GitHub issue
#1132 (gzilavyss2025/bbsbh): regenerate the census, delete the rules that are
dead now that every site has moved, re-measure the lint budgets, update the
docs, and post the status on #1132. Do NOT start the Notice family. #1132
stays open (Notice is its third family): the PR says "Part of #1132".

Context
- The plan is on main in .scratch/design-system/empty-state-collapse/:
  spec.md, slices.md (E9), decisions.md, overrides.tsv, census.mjs, and
  prompts-e2-e8.md. Read "What E2 to E8 did" there first: the PR table, the
  merge order, the new namespace classes, the deleted rules, the budgets and
  the "not seen live" list.
- E1 to E8 are PRs #1456, #1463, #1464, #1462, #1461, #1474, #1476, #1460.
  E9 waits until ALL eight are merged into main.
- Each slice has its own test file (test/empty-state-cascade.test.js for E1,
  test/empty-state-e2.test.js to e8.test.js). No slice committed census.md
  or census.json.
- Gary's answers (2026-10-05): Q1 AsyncStatus in one step (E2). Q2 a dashed
  hairline inset, no fill, graphite copy. Q3 two sizes, block and compact.
  Q4 all six hold groups stay held (Express Lane, the search boxes, the
  bracket fold, the series chart, the farm-system row, tool pages).

Before you start
1. Read CLAUDE.md, src/CLAUDE.md, src/components/ui/CLAUDE.md,
   src/styles/CLAUDE.md, spec.md, slices.md (E9) and prompts-e2-e8.md.
2. Fetch origin. List open PRs and worktrees. Confirm each of the eight PRs
   is merged, and that origin/main has src/components/ui/state/EmptyState.jsx
   and all eight test files. If one is not merged, stop and say which.
   Base your branch on current origin/main. Check status and diffs before
   you edit.
3. Run node .scratch/design-system/empty-state-collapse/census.mjs. It must
   end "unreviewed 0" with no STALE line. The slices merged eight sets of
   override edits: read every UNREVIEWED and STALE row and fix it by reading
   the site (keys are file#n and shifted many times). A moved site with no
   namespace class has no row: delete a STALE row, do not mark it DONE.

Build
- Delete .hint__link (05-masthead-nav.css): dead before this work (no use in
  src, e2e, test, scripts or api). Check again first.
- Find each candidate rule that no site wears any more and delete it. Decide
  each by reading the JSX and CSS, never by the grep alone. Check at least:
  .hint--prose (E2 removed its AsyncStatus use; other sites may still wear
  it), .screen--slate .hint (other slate hints may still use it),
  .boxlines__hint (still the loading and error lines: keep). Keep every rule
  a held page wears (.scout__notposted stays while the lab wears it). Keep
  each margin-only namespace rule listed in prompts-e2-e8.md.
- Do not touch .stampsheet__loading, .oseason__loading or .prospects__reset:
  they are loading lines and a control, not empty states. List them in the
  #1132 status as input for the Notice family and a later Button pass.
- Lint budgets: run npm run lint. Re-measure scripts/check-caption-budget.mjs
  and the scripts/check-raw-values.mjs budgets (#1178). Lower each budget to
  the new count, never below it, with a one-line comment naming #1132 E9.
- Tests: keep all eight test files and every pin. If a pin names a rule you
  delete, change it to assert the rule is gone; never loosen it. Optionally
  fold the eight files into test/empty-state-cascade.test.js only if every
  pin moves unchanged.
- Docs: src/components/ui/CLAUDE.md, confirm the state/ line still says what
  EmptyState is. If any nested CLAUDE.md, docs/ file or ADR names a deleted
  class, update it. Keep every CLAUDE.md under its cap (npm run lint checks).
- Census: re-run until "unreviewed 0", no STALE. Commit census.md and
  census.json (regenerated, never hand-edited) and overrides.tsv.
- Status on #1132 (slices.md E9): one comment with what moved (count by
  slice and the PR numbers), what is held and why (Q4), the rules deleted,
  the budgets before and after, the "not seen live" list, and that Notice is
  next. End it with the Claude Code attribution footer.

Rules
- Spoiler rule: EmptyState fetches, computes and gates nothing. Deleting a
  CSS rule must not change what a sealed surface shows: check the innings
  viewer and the box score before and after.
- Follow docs/agents/writing-style.md (ASD-STE100) and the house word list
  ("postseason").
- Run npm run lint; echo "exit=$?", npm test and npm run build. All green.
- User-visible: start the first free reserved dev server (npm run dev, or
  dev:2 to dev:5; check each port with ss first, other worktrees often hold
  them). Load at 390px and 900px, with ?nointro on every URL:
  /design-lab?nointro (the EmptyState entry),
  /team/nashville-sounds-556/transactions?nointro,
  /team/nashville-sounds-556/contracts?nointro, /leaders?nointro,
  /all-star-legacy?nointro, /scout?nointro, /logbook/stats?nointro,
  /07072026/milstl-2/top1?nointro (the Arms tab), and
  /07072026/milstl-2/boxscore?nointro (must stay sealed). Headless Chromium
  cannot reach statsapi.mlb.com through the proxy: relay those calls through
  Node with page.route (E3 and E7 did), and launch with
  executablePath '/opt/pw-browsers/chromium'. Keep the server running.
- Do not run npm run e2e or npm run visual unless Gary asks. Say that the
  "not seen live" list is the input for #1177's screenshot suite.
- Commit, push to your assigned branch, and open a draft PR whose body says
  "Part of #1132", never "Closes #1132". List the routes for #1177. Do not
  push to main.

Final handoff
1. What you deleted, the budgets before and after, the census result, the
   #1132 comment link, the clickable local URLs, and what you did not check.
2. A one-paragraph note on what the Notice census (the third #1132 family)
   should start from: the 21 error lines, .stampsheet__loading,
   .oseason__loading, and any loading line E9 found. Do not write the Notice
   prompts.
```
