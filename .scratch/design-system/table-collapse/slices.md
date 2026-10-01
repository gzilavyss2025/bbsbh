# Table — the slice plan (#1132)

Small PRs, each revertible without the others. This mirrors the card plan
(`../card-collapse/slices.md`). The row list for each slice is `census.md`
Part 1; the API is `spec.md`; the open questions are `decisions.md`.

**8 slices.** T1 builds `Table` and moves a pilot. T2 is the two renames. T3 to
T8 move the rest, one family each. 57 tables move; 13 are held.

| slice | what | tables | files | runs |
| --- | --- | --- | --- | --- |
| T1 | build `Table` + pilot | 2 | 11 | first, beside T2 |
| T2 | `.bs__sub` and `.ledger__sub` renames | 0 | 9 | first, beside T1 |
| T3 | the game surfaces (spoiler scope) + team leaders | 7 + 1 list | 10 | after T1 + T2 |
| T4 | the small ledgers | 6 | 11 | after T1 + T2 |
| T5 | the report boards | 17 | 10 | after T1 |
| T6 | ABS boards + Nine Keys | 9 | 11 | after T5 |
| T7 | the other standalone boards | 10 | 10 | after T1 |
| T8 | Standings (sticky) + the shared bases | 6 | 11 | last |

Three slices count 11 files, one over the target of 10. In each, the extra file
is a test, an e2e spec or a second partial that the move cannot skip.

---

## Before any slice

1. Gary answers `decisions.md`. Q1 (keyboard scrolling) and Q2 (the density
   snap) change what T1 builds; Q3 changes T2's names.
2. Re-run `node .scratch/design-system/table-collapse/census.mjs` on the
   current `main`. A table added since T0 prints as UNREVIEWED; an override that
   no longer matches prints STALE. Fix both before slicing.
3. Each slice is green before review: `npm run lint` in the foreground with the
   exit code echoed (`npm run lint; echo "exit=$?"`), `npm test`, `npm run build`,
   and a browser pass over each route listed for the slice at 390px and 900px,
   with `?nointro` on every URL.
4. Screenshots: list the slice's routes in the PR body for #1177's suite. An
   agent runs `npm run visual` only when Gary asks (a hook enforces it). A
   changed page the PR did not mean to change is a bug.
5. For each slice that deletes a raw radius, shadow or colour, lower
   `scripts/check-raw-values.mjs`'s budgets (#1178) in the same PR.
6. Slice PRs say "Part of #1132", never "Closes #1132".

---

## The order, and what can run at the same time

```
T1 (Table + pilot) ──┬──────────────┬─ T5 report boards ── T6 ABS + Nine Keys ──┐
                     │              └─ T7 standalone boards ────────────────────┤
T2 (renames) ────────┴─ T3 game surfaces                                         ├─ T8 Standings
                     └─ T4 small ledgers ───────────────────────────────────────┘
```

- **T1 and T2** share no file. Run them side by side.
- **T3, T4, T5 and T7** share no file with each other. Run them side by side
  once T1 (and, for T3 and T4, T2) is on `main`.
- **T6 waits for T5.** Both edit `68-around-the-game.css`. T5 moves the
  around-the-game pages and leaves the `.rpt` sticky rules, because the ABS boards
  still need them; T6 moves the ABS boards, then deletes those rules and
  `BoardScroller.jsx`.
- **T8 is last.** It deletes the shared bases (`.standings` in
  `29-team-transactions.css`, the `.ledger, .standings` frame block,
  `.ledger-wrap` and `.standings-wrap` in `26-player-page.css`). Every table that
  wears one must have moved first: T4 (`.ledger`), T5 and T6 (`standings rpt`),
  T7 (`standings foulboard / umprank / trrank`). It shares
  `26-player-page.css` and `31-wild-card.css` with T4.

Shared partials, so the second PR rebases on the first: `68-around-the-game.css`
(T5, T6); `26-player-page.css` and `31-wild-card.css` (T2, T4, T8);
`21-box-score.css` (T2, T3).

---

## The slices

### T1 — build `Table`, and the pilot

- **Build:** `src/components/ui/table/Table.jsx`, `src/styles/system/table.css`
  (imported in `src/index.css` right after `system/card.css`),
  `src/lib/design/tableClass.js`, `test/table-cascade.test.js` (pins the slot and
  the helper: an unknown frame or density throws, `label` adds the region
  attributes). A `/design-lab` entry: `screens/designlab/catalog.js` +
  `screens/designlab/components.jsx` (a sheet + row + sticky board wide enough to
  scroll at 390px, and a bare + tight grid in a `Card`).
- **Pilot rows (2):** `.gnotes` (`/game-notes`) and `.prospectboard`
  (`/prospects`). Neither is sticky, neither is gated, each sits in its own
  partial. `.gnotes` is already the row recipe on a sheet, so it should not move
  a pixel: that proves `Table` draws today's look. `.prospectboard` snaps 8/12 to
  6/8: the one visible change, and it proves the snap.
- **Files (11):** the 7 above, `screens/game-notes/GameNotesArchivePage.jsx`,
  `styles/report/game-notes.css`, `screens/ProspectsPage.jsx`,
  `styles/31e-prospect-board.css`.
- **Care:** the wrap is a new `<div>` around each table. Search the two partials
  for a `> table` or `:first-child` selector that the wrap would break.
- **Routes:** `/game-notes?nointro`, `/prospects?nointro`, `/design-lab?nointro`.

### T2 — the two `__sub` renames (no `Table`)

- **Rows:** none move. Two classes are renamed, with the corrected readings in
  `spec.md` ("The two `__sub` renames"): `.bs__sub` → `.bs__row--substitute`,
  `.ledger__sub` → `.ledger__label` (or the names Gary picks in Q3).
- **Files (9):** `screens/BoxScore.jsx`, `styles/21-box-score.css`,
  `components/player/Ledger.jsx`, `screens/team/modules/minors/ProspectsCard.jsx`,
  `styles/26-player-page.css`, `styles/31-wild-card.css`,
  `test/card-cascade.test.js`, `docs/design-system-naming.md`,
  `docs/adr/0084-a-block-is-named-for-its-job-never-its-shape.md`.
- **Care:** the box score is in the spoiler scope. The rename is the `<tr>`'s
  class string only; it does not move the row, the `SealBox` or `selectBoxscore`.
  In `test/card-cascade.test.js`, replace the two "held" entries with an
  assertion that the old names are gone and the new ones are written. Never
  just delete them.
- **Routes:** `/07072026/milstl-2/boxscore?nointro` (tap to reveal; the
  substitutes still indent), `/player/christian-yelich-592885/stats?nointro`
  (the career register's club column), `/team/milwaukee-brewers-158/minors?nointro`
  (the prospects table's name column).

### T3 — the game surfaces (spoiler scope)

- **Rows (7):** the rolling line, the pitchers table, the pitcher handoff card's
  table, and the four box score grids (bat, pit, totals, board). All `tight`;
  all `bare`, because each sits in a `Card` (or the handoff card's own wrap).
  The rolling line is `sticky`.
- **Also (Q5):** the team-leaders list (`TeamLeadersLedger.jsx`) becomes two
  `Table`s with column names (spec.md, "The team leaders become a table"). It is
  NOT in the spoiler scope. It rides here only because its CSS shares
  `23-box-score-detail.css` with the box score totals.
- **Files (10):** `components/teamstats/TeamLeadersLedger.jsx`,
  `components/gamehud/RollingLine.jsx`,
  `components/inning/PitchersSection.jsx`,
  `components/playbyplay/PitcherHandoffCard.jsx`, `screens/BoxScore.jsx`,
  `styles/20-charts.css`, `styles/21-box-score.css`,
  `styles/23-box-score-detail.css`, `styles/12-sealbox.css`,
  `styles/focus/reference.css`.
- **Care — the spoiler rule:** move the box, never the gate. Each row's `gate`
  column in `census.md` names its gate; it stays byte for byte. No `SealBox`, no
  `revealedThrough` check and no reveal-only call moves. The pitchers table stays
  OUT of a `SealBox` (ADR-0009).
- **Care — names:** keep `className="rolling__grid"` and
  `className="pitchers__grid"` on the tables. The spoiler e2e invariants
  (`extra-innings-gating`, `reveal-persistence`) find them by those names.
- **Care — held neighbours:** `InningTally` (held) still wears `.bs__grid`, and
  `Scorecard.jsx` (held) still wears `.pitchers__grid`. Leave both base rules,
  and check the tally and the scorecard on screen.
- **Care — fit:** the pitchers table must still fit 390px with no sideways scroll
  (its file header). Tight adds 2px a column.
- **Routes:** `/07072026/milstl-2/boxscore?nointro` (reveal it),
  `/07072026/milstl-2/top1?nointro` (the rolling line and the pitchers rail;
  step through a half), a later half with a pitching change (step through the halves from
  `/07072026/milstl-2/top5?nointro`) for the handoff card, `/07072026/milstl-2/scorecard?nointro` and the box score's
  inning tally (the held neighbours: must not change),
  `/game/823035/express?nointro` (the rolling line in Express Lane),
  `/team/milwaukee-brewers-158?nointro` and
  `/team/milwaukee-brewers-158/numbers?nointro` (the team leaders: three a side,
  then six a side).

### T4 — the small ledgers

- **Rows (6):** `Ledger.jsx` (career register and splits), the recent-form
  table, the Minors-tab prospects table, the awards table, and the two offseason
  notebook tables.
- **Files (11):** `components/player/Ledger.jsx`,
  `components/playerstats/RecentFormCard.jsx`,
  `screens/team/modules/minors/ProspectsCard.jsx`,
  `components/player/AwardsLedger.jsx`, `components/offseason/MovedUp.jsx`,
  `components/offseason/YoungestRegulars.jsx`, `styles/26-player-page.css`,
  `styles/26b-recent-form.css`, `styles/31-wild-card.css`,
  `styles/67-awards-ledger.css`, `styles/78-offseason.css`.
- **Care:** `.ledger` shares ONE frame block with `.standings` in
  `26-player-page.css`. Take `.ledger` out of that selector list; leave
  `.standings` for T8. Keep the ledger's footer, all-star row, MiLB pencil rows
  and subtotal row as namespace rules. `test/card-cascade.test.js` asserts the
  `.movedup__table` first/last-cell inset rules exist: they stay.
- **Routes:** `/player/christian-yelich-592885/stats?nointro`,
  `/player/christian-yelich-592885/history?nointro`,
  `/player/freddy-peralta-642547/stats?nointro` (a pitcher's ledger),
  `/team/milwaukee-brewers-158/minors?nointro`, `/aaa/10012026?nointro` (the
  offseason notebook).

### T5 — the report boards

- **Rows (17):** every `standings rpt` table on the around-the-game pages, and
  the doubleheaders drawer. All `sheet`, `row`, `sticky`, with a `label` (from
  their `BoardScroller`).
- **Files (10):** `screens/around-the-game/AttendancePage.jsx`, `BullpenPage.jsx`,
  `DoubleheadersPage.jsx`, `FarmSystemPage.jsx`, `PacePage.jsx`,
  `RunDifferentialPage.jsx`, `RunValuePage.jsx`, `styles/68-around-the-game.css`,
  `styles/75-run-value.css`, `e2e/around-the-game.spec.js`.
- **Care:** the e2e spec pins the sticky club cell at 390px through
  `.ledger-wrap`. Point it at the new wrap; do not weaken what it checks. Leave
  the `.rpt` sticky rules in 68: the ABS boards (T6) still use them. The club cell
  keeps `display: table-cell` and its flex on `.rpt__club`.
- **Routes:** `/attendance?nointro`, `/bullpen-availability?nointro`,
  `/doubleheaders?nointro` (open a row's drawer), `/farm-system-rankings?nointro`,
  `/pace-of-play?nointro`, `/run-differential?nointro`, `/run-value?nointro`. At
  390px, scroll each board sideways: the club column must stay put.

### T6 — the ABS boards, and Nine Keys

- **Rows (9):** the eight `/abs-challenges` boards and the Nine Keys grid
  (`keep` density: its cells hold drawn marks).
- **Files (11):** `screens/around-the-game/abs/ClubBoard.jsx`, `LongestRuns.jsx`,
  `MissBands.jsx`, `PlayerBoards.jsx`, `RanOut.jsx`, `UmpireBoard.jsx`,
  `WhoCalls.jsx`, `styles/68-around-the-game.css`,
  `components/around-the-game/BoardScroller.jsx` (deleted),
  `screens/NineKeysPage.jsx`, `styles/79-nine-keys.css`.
- **Care:** delete the `.rpt` sticky rules and `.ledger-wrap .rpt` now that no
  board uses them. `BoardScroller`'s focus ring moves to `table.css` (T1).
  `.rpt__between` stays a namespace row rule.
- **Routes:** `/abs-challenges?nointro`, `/nine-keys?nointro`.

### T7 — the other standalone boards

- **Rows (10):** the six `/fouls` boards, `/umpires`, `/situational-records`,
  the contract grid, the team ABS challenge board.
- **Files (10):** `screens/FoulTrackerPage.jsx`, `styles/43-foul-tracker.css`,
  `screens/UmpireRankingsPage.jsx`, `styles/38-umpire-pages.css`,
  `screens/SituationalRecordsPage.jsx`,
  `styles/situational-records/66a-detail.css`,
  `components/salaries/ContractGrid.jsx`, `styles/70-contracts-grid.css`,
  `screens/team/modules/TeamChallengeCard.jsx`,
  `styles/report/challenge-card.css`.
- **Care:** `29-team-transactions.css` holds `.standings .team >
  .umprank__rank, .standings .team > .foulboard__team { align-self: flex-start }`.
  These tables drop `.standings`, so restate that rule in 38 and 43. Do not edit
  29 here (T8 deletes the base). The contract grid is sticky with a sticky foot
  row: check both at 390px. `e2e/salaries.spec.js` finds `.ctr__table`, which
  stays as the namespace.
- **Routes:** `/fouls?nointro`, `/umpires?nointro`, `/situational-records?nointro`,
  `/team/milwaukee-brewers-158/contracts?nointro`,
  `/team/milwaukee-brewers-158/numbers?nointro`.

### T8 — Standings (the sticky boards), and the shared bases

- **Rows (6):** the two `/standings` boards, the `/postseason-race` mini table,
  the team hub's `StandingsCard`, the postseason odds sheet, `/game-notes-debug`.
- **Files (11):** `screens/StandingsPage.jsx`, `screens/PostseasonRacePage.jsx`,
  `screens/team/modules/StandingsCard.jsx`,
  `components/teamstats/PostseasonOddsModal.jsx`,
  `screens/GameNotesDebugPage.jsx`, `styles/30-standings.css`,
  `styles/31-wild-card.css`, `styles/26-player-page.css`,
  `styles/29-team-transactions.css`, `styles/39-manager-page.css`,
  `e2e/offseason-home.spec.js`.
- **Care — the trick:** this is the slice the sticky-cell border trick lives in.
  Walk `spec.md`'s seven-row table before and after, at 390px with "More columns"
  on and the board scrolled: the team column stays, the row rules do not step at
  the seam, the top-left corner does not notch, the favorite-team row is not see-
  through. If the row rule steps, sticky tables fall back to per-cell
  `border-top` (spec risk 7) and the census row says so.
- **Care — the bases:** delete `.standings th, td` and its family in 29, the
  `.ledger, .standings` frame block, `.ledger-wrap` and `.standings-wrap` in 26.
  Before deleting, re-run the census: every row that wore `.standings` or
  `.ledger` must show MIGRATE and a merged slice. `e2e/offseason-home.spec.js`
  reads `.standings tbody tr`: point it at the new class.
- **Routes:** `/standings?nointro` (390px: "More columns", then scroll),
  `/postseason-race?nointro`, `/team/milwaukee-brewers-158?nointro` and
  `/team/milwaukee-brewers-158/numbers?nointro` (open "Postseason odds"),
  `/game-notes-debug?nointro`.

---

## Not in these slices

- **EmptyState and Notice**, the other two families of #1132. Each gets its own
  census and plan.
- **The state renames the ADR-0084 ledger files under #1132**
  (`.dh__row--open`, `.umptend__row--on`, `.cwb__row--done`, and the three
  `--empty` rows). They are state grammar, not Table work. They go with the
  EmptyState and Notice PRs, or in their own small PR.
- **The 22 row-grid rules** in census Part 4. None has column heads and a
  `<table>`'s reading order except `.staffgrid`, `.scorebookstory__leader*` and
  `.logbookstats__*`. A later pass can decide if any is a table in disguise.
