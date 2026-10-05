# EmptyState — the slice plan (#1132)

Small PRs, each revertible without the others. This mirrors the Table plan
(`../table-collapse/slices.md`). The row list for each slice is `census.md`
(the `slice` column of Parts 1 and 2); the API is `spec.md`; the open
questions are `decisions.md`.

**9 slices after this census (E0).** E1 builds `EmptyState` and moves one
pilot. E2 moves the 29 `AsyncStatus` empties through one line. E3 to E8 move
the rest, one surface each. E9 cleans up. 68 sites move; 29 empty sites are
held.

| slice | what | sites | files | runs |
| --- | --- | --- | --- | --- |
| E1 | build `EmptyState` + lab + pilot | 1 | 10 | first |
| E2 | `AsyncStatus`'s empty branch | 30 (1 line + 29 callers) | 11 | after E1 |
| E3 | the spoiler surfaces | 5 | 8 | after E1 |
| E4 | the team hub | 6 | 7 | after E1 |
| E5 | the player page | 3 | 4 | after E1 |
| E6 | the standalone pages (a bare `.hint`) | 10 | 10 | after E2 (shares 5 files) |
| E7 | the boxed and mixed ones | 5 | 10 | after E1 |
| E8 | the Matchup Scout and the Game Log | 8 | 4 | after E1 |
| E9 | clean-up: dead rules, budgets, docs | 0 | ≤ 6 | last |

E2 counts 11 files, one over the target of 10. Ten of them lose one prop
(`emptyProse`), one word each.

---

## Before any slice

1. Done: Gary answered `decisions.md` on 2026-10-05, all four as recommended.
   E1 builds the dashed, no-fill, body-face look in two sizes; E2 exists; the
   hold list stands.
2. Re-run `node .scratch/design-system/empty-state-collapse/census.mjs` on the
   current `main`. A site added since E0 prints as UNREVIEWED; an override that
   no longer matches prints STALE. Fix both before slicing. Keys are `file#n`,
   so a new site above an old one in the same file shifts the old key: read
   the STALE list, do not delete it blind.
3. Each slice is green before review: `npm run lint` in the foreground with
   the exit code echoed (`npm run lint; echo "exit=$?"`), `npm test`,
   `npm run build`, and a browser pass over each route listed for the slice at
   390px and 900px, with `?nointro` on every URL.
4. **An empty state is often hard to see on a live page**, because today's data
   is not empty. Each slice below says how to reach its empty state. Where a
   route cannot show it with today's data, the slice says so, checks the
   `/design-lab?nointro` entry, and lists the route for #1177's screenshot
   suite anyway. Never edit data, a fixture or a spec to force an empty page.
5. Screenshots: list the slice's routes in the PR body for #1177's suite. An
   agent runs `npm run visual` only when Gary asks (a hook enforces it). A
   changed page the PR did not mean to change is a bug.
6. For each slice that deletes a raw value, lower
   `scripts/check-raw-values.mjs`'s budgets (#1178) in the same PR.
7. Slice PRs say "Part of #1132", never "Closes #1132".

---

## The order, and what can run at the same time

```
E1 (EmptyState + pilot) ──┬─ E2 AsyncStatus ── E6 standalone pages ──┐
                          ├─ E3 spoiler surfaces ────────────────────┤
                          ├─ E4 team hub ────────────────────────────┤
                          ├─ E5 player page ─────────────────────────├─ E9 clean-up
                          ├─ E7 boxed and mixed ─────────────────────┤
                          └─ E8 Scout + Game Log ────────────────────┘
```

- **E6 waits for E2.** Five files are in both: `AllStarLegacyPage.jsx`,
  `MilestoneWatchPage.jsx`, `RehabPage.jsx`, `TradeDeadlineSeasonPage.jsx` and
  `GamePhotosPage.jsx` each hold an `AsyncStatus` (E2 drops `emptyProse` from
  two of them) and a hand-written empty `.hint` (E6).
- **E3, E4, E5, E7 and E8** share no file with each other or with E2. Run them
  side by side once E1 is on `main`. (E7's `ProspectsPage.jsx` has an
  `AsyncStatus` that E2 moves, but E2 does not edit that file: it passes no
  `emptyProse`.)
- **E9 is last.** It deletes rules that only become dead once every site has
  moved.

---

## The slices

### E1 — build `EmptyState`, and the pilot

- **Build:** `src/components/ui/state/EmptyState.jsx`,
  `src/styles/system/empty-state.css` (imported in `src/index.css` right after
  `system/table.css`), `src/lib/design/emptyStateClass.js`,
  `test/empty-state-cascade.test.js` (pins the slot; an unknown `size` throws;
  `label`, `note` and `action` render only when given; `EmptyState.jsx` and the
  helper import no `api/` and no stamp module). A `/design-lab` entry:
  `screens/designlab/catalog.js` + `screens/designlab/components.jsx` (spec.md,
  "The lab": text only, label + note + action, compact in a `Card` tile).
  `src/components/ui/CLAUDE.md` gains one line for `state/`.
- **Pilot (1):** `.txpage__empty`, the issue's "bare `.hint`" example. Its
  `margin: 20px 0` rule in `72-club-transactions.css` goes, unless the page
  needs it for space (then it stays as a namespace margin).
- **Why one pilot, not two:** the issue's label + note example
  (`.prospectcard__empty`) would make E1 twelve files. The lab entry proves the
  label + note shape in E1; the prospect card itself moves in E5.
- **Files (10):** the 8 above, `screens/team/TeamTransactionsPage.jsx`,
  `styles/72-club-transactions.css`.
- **Routes:** `/design-lab?nointro` (the entry, at 390px and 740px),
  `/team/milwaukee-brewers-158/transactions?nointro`. The Brewers have moves
  posted, so the empty state does not show there today. Find a club with none
  (early in a season, or a minor-league club: not checked) or check the lab.

### E2 — `AsyncStatus`'s empty branch (Q1: yes)

- **Rows:** `components/ui/AsyncGate.jsx#4` (the one line) and the 29
  `AsyncStatus` call sites with an `emptyMessage`. Census Part 2, slice E2.
- **Change:** in `AsyncStatus`, the empty branch renders
  `<EmptyState>{emptyMessage}</EmptyState>`. The `emptyProse` prop is deleted:
  the EmptyState text is the body face already. The loading branch and the two
  error branches do not change.
- **Files (11):** `components/ui/AsyncGate.jsx`, and the 10 that pass
  `emptyProse`: `FoulTrackerPage.jsx`, `StandingsPage.jsx`,
  `UmpireRankingsPage.jsx`, `MilestoneWatchPage.jsx`,
  `PostseasonHistoryPage.jsx`, `PostseasonRacePage.jsx`,
  `TradeDeadlineSeasonPage.jsx`, `PostseasonLeadersPage.jsx`,
  `postseason-records/PostseasonRecordsPage.jsx`, `AwardsHistoryPage.jsx` (all
  under `src/screens/`).
- **Care — the slate:** `GameSelect.jsx`'s "No games scheduled." moves here. A
  day with no games carries no score; the test is the schedule's length. The
  slate uppercases `.hint` with `.screen--slate .hint`; EmptyState text is
  uppercase everywhere anyway (`01-base.css`), so nothing reads differently.
- **Care — tests:** no unit test or e2e spec names `AsyncStatus` or
  `emptyProse` today (checked with grep). Add one assertion to
  `test/empty-state-cascade.test.js`: `AsyncGate.jsx` imports `EmptyState`,
  and no file under `src/` still passes `emptyProse`.
- **Routes:** `/standings?nointro`, `/attendance?nointro`,
  `/umpires?nointro`, `/fouls?nointro`, `/nine-keys?nointro` (each shows its
  board, not its empty line, while data is on file; check that the loading line
  and the board do not change), and the slate on a date with no games, such as
  `/12252026?nointro` (inference: the offseason page may take the slate's place
  on that date; if so, find an off day in the season). The empty look itself is
  checked in the lab.

### E3 — the spoiler surfaces

- **Rows (5):** the innings rail's `.refpanel__empty` ("No pitching lines
  yet"), `RosterPanel.jsx`'s "Not posted yet.", the lineup page's starter card
  "Not posted yet." (`TeamInfo.jsx`), and the two Box Lines empties
  (`BoxLinesSheet.jsx`, `GameLinesDoor.jsx`).
- **Files (8):** `components/inning/focus/ReferencePanel.jsx`,
  `styles/focus/reference.css` (the `.refpanel__empty` rule goes),
  `components/inning/RosterPanel.jsx`, `screens/TeamInfo.jsx`,
  `styles/10-lineup.css` (the `.starter > .hint` inset goes),
  `components/boxlines/BoxLinesSheet.jsx`, `components/boxlines/GameLinesDoor.jsx`,
  and `styles/boxlines/boxlines.css` only if `.boxlines__hint` needs a margin
  change (the loading and error lines keep the class).
- **Care — the spoiler rule:** move the box, never the gate. The empty TEST in
  each file stays byte for byte: `armsEmpty` (`ReferencePanel.jsx:446`), the
  roster's `empty`, the starter card's `projected?.length` fallback, Box Lines'
  `rows.length === 0` (rows gated by `api/boxlines/rows.js`, ADR-0069). No
  `SealBox`, no `revealedThrough` check and no reveal-only call moves. The
  copy does not change: none of it states a result.
- **Care — fit:** RosterPanel and the starter card take `size="compact"`. The
  innings rail is narrow at 390px; check that the inset does not push the
  rail's tabs.
- **Routes:** `/07072026/milstl-2/top1?nointro` (step through; the rail's
  empty line shows only on a half with no arms yet, which a finished game
  rarely has: not checked), the lineup pages of a game on tomorrow's slate,
  for example `/{tomorrow MMDDYYYY}/{matchup}/lineup1?nointro` (lineups and
  starters are often not posted yet), `/07072026/milstl-2/lineup1?nointro`
  (the Box Lines door; pick a player with no lines before the cutoff, such as a
  call-up), `/07072026/milstl-2/boxscore?nointro` (must not change).

### E4 — the team hub

- **Rows (6):** the Records card (`.trec__empty`), the Minors Horizon tile
  (`.hzntile__nostat`), the depth chart's "Too early" line, the Contracts tab's
  two empties (a minor-league club; a ledger not published), and Stamp In's
  "No games posted yet".
- **Files (7):** `screens/team/modules/records/RecordsCard.jsx`,
  `styles/65-team-records.css`, `screens/team/modules/minors/HorizonCard.jsx`,
  `styles/31-wild-card.css`, `screens/team/modules/minors/DepthChartCard.jsx`,
  `screens/team/ContractsTab.jsx`, `screens/team/StampInPage.jsx`.
- **Care:** the Records card, the Horizon tile and the depth chart take
  `size="compact"`. Stamp In is gated on the PAGE (ADR-0042); its empty line
  is copy only and renders no stamp art (ADR-0035).
- **Routes:** `/team/milwaukee-brewers-158/numbers?nointro` (the Records card;
  pick a month with no games, if the month lever offers one: not checked),
  `/team/milwaukee-brewers-158/minors?nointro`,
  `/team/nashville-sounds-556/contracts?nointro` (a minor-league club: the
  "no ledger" line shows; 556 is the Sounds in `public/data/teams.json`),
  `/team/milwaukee-brewers-158/contracts?nointro` (must not change),
  `/team/milwaukee-brewers-158/stamp-in?nointro`.

### E5 — the player page

- **Rows (3):** the prospect card's two standing states (`.prospectcard__empty`:
  "No qualified comparison yet", and the early-sample state with its two
  notes), and the splits-vs-club "No career meetings".
- **Files (4):** `components/playerstats/ProspectCard.jsx`,
  `styles/31d-prospect-card.css`, `components/playerstats/SplitsVsTeam.jsx`,
  `styles/26-player-page.css`.
- **Care:** the early-sample state passes both notes as one `note` node (two
  lines). The card's `__emptylabel` becomes `label`. `.vsteam__none` takes
  `size="compact"`.
- **Routes:** a Top 100 prospect's page, reached from `/prospects?nointro`
  (one with an early sample shows the three-line shape; not checked which),
  `/player/christian-yelich-592885/stats?nointro` (the splits; pick a club he
  has never faced).

### E6 — the standalone pages

- **Rows (10):** the hand-written empty `.hint` on `/all-star-legacy`,
  `/milestones`, `/rehab`, `/leaders`, `/doubleheaders`, `/trade-deadline`,
  an umpire's page, `/salaries` (league not published), `/photos` (nothing
  picked) and the game finder.
- **Files (10):** `screens/AllStarLegacyPage.jsx`,
  `screens/MilestoneWatchPage.jsx`, `screens/RehabPage.jsx`,
  `screens/LeadersPage.jsx`, `screens/around-the-game/DoubleheadersPage.jsx`,
  `screens/TradeDeadlineSeasonPage.jsx`, `screens/UmpirePage.jsx`,
  `screens/SalariesPage.jsx`, `screens/GamePhotosPage.jsx`,
  `components/game/GameFinder.jsx`. No CSS: each is a bare `.hint` today.
- **Care:** four of these are a club filter's result (All-Star legacy,
  milestones, rehab, trade deadline). They appear after the reader acts, so
  they take `role="status"`. The `/photos` prompt is the empty state of a
  picker, not a caveat.
- **Routes:** `/all-star-legacy?nointro`, `/milestones?nointro`,
  `/rehab?nointro`, `/trade-deadline?nointro` (each: pick a club with none),
  `/doubleheaders?nointro` (pick years with none), `/photos?nointro` (nothing
  picked: shows at once), `/leaders/a?nointro` (not checked that it is empty),
  `/salaries?nointro`, an umpire's page from `/umpires?nointro`, and the game
  finder from the slate's menu (not checked where it opens).

### E7 — the boxed and mixed ones

- **Rows (5):** `/prospects`'s filter result (a SOLID box with a Clear filters
  button: dashed, with `action`), `/salaries`'s board empty (a solid top rule),
  the umpire accuracy modal, the stamp sheet, and the offseason lead.
- **Files (10):** `screens/ProspectsPage.jsx`, `styles/31c-prospect-filters.css`,
  `components/salaries/SalaryBoard.jsx`, `styles/71-salaries-league.css`,
  `components/umpire/UmpireAccuracyModal.jsx`, `styles/14-strike-zone.css`
  (`.umpmodal__hint`), `components/logbook/StampSheet.jsx`,
  `styles/48c-stamp-sheet.css`, `components/offseason/OffseasonLead.jsx`,
  `styles/78-offseason.css`.
- **Care — names:** `e2e/salaries.spec.js` reads `.payboard__empty`: pass
  `className="payboard__empty"`. Do not change the spec.
- **Care — the split:** `.stampsheet__empty` and `.oseason__quiet` each say
  "loading" OR "empty" in one `<p>`. Split them: the loading branch keeps a
  plain line, only the empty branch becomes `EmptyState`. Keep `role="status"`
  on the offseason line.
- **Care — the action:** the Clear filters button becomes a `Button`
  (`ui/control/Button.jsx`) in the `action` slot, if it is not one already.
- **Care — the scope:** the umpire modal opens from the box score's umpire
  card. Its empty line says the umpire has no data, not a game result.
- **Routes:** `/prospects?nointro` (filter until nothing matches),
  `/salaries?nointro` (pick a club and a position with no salaried player),
  `/07072026/milstl-2/boxscore?nointro` (reveal, open the plate umpire's
  accuracy; the empty line shows only for an umpire with no data: not
  checked), `/logbook?nointro` (open the stamp sheet), and the slate in the
  offseason (`/aaa/10012026?nointro`, the Table plan's offseason route) for the
  offseason lead.

### E8 — the Matchup Scout and the Game Log

- **Rows (8):** the Scout's "Pick a pitcher and a hitter", its two
  head-to-head empties, its three "Not posted" chart slots, and the Game Log's
  two "No stamps yet" lines.
- **Files (4):** `screens/scout/ScoutPage.jsx`, `screens/scout/HeadToHead.jsx`,
  `screens/LogbookCollection.jsx`, `screens/LogbookStatsPage.jsx`.
- **Care:** `.scout__notposted` keeps its rule in `styles/scout/scout.css`:
  the design lab's scout harness (a held tool page) still wears it. The Game
  Log lines are copy only; they render no stamp art (ADR-0035).
- **Routes:** `/scout?nointro` (shows the prompt at once), a pair with no
  meetings from there, `/logbook?nointro` and `/logbook/stats?nointro` in a
  browser with no stamps (a private window).

### E9 — clean-up

- Delete `.hint__link` (`05-masthead-nav.css`): dead before this work (no use
  in `src`, `e2e`, `test`, `scripts` or `api`).
- Re-run the census. Delete any candidate rule that no site wears any more
  (`.scout__notposted` stays while the lab wears it).
- Lower `check-raw-values` budgets for what the slices deleted (#1178).
- `src/components/ui/CLAUDE.md`: confirm the `state/` line. If `Notice` has
  landed, the line names both.
- Post the status on #1132: what moved, what is held, and that Notice is next.
