# Team Page — information architecture rebuild

**Status:** design locked; implementation split into 8 issues
**Slug:** team-page-ia
**Surface:** `/team/{id}` (`src/screens/TeamPage.jsx`, 2,205 lines, 20 top-level modules)
**Design artifact:** the scoping doc this came from is an Artifact page; its
conclusions are restated in full below, so no agent needs it.

Every agent working this effort reads **this file plus its own issue file**, and
nothing else from the scoping conversation. If something here contradicts an
issue file, this file wins — say so in the PR rather than guessing.

## The problem

The team page grew to twenty top-level modules that all wear the same
`.thub-card` chrome, in one uninterrupted scroll, with no navigation of any
kind. Three specific failures:

1. **No hierarchy.** A two-line injured list and the full 40-man roster claim
   equal weight.
2. **Related things sit far apart.** Standings, team score, day-of-week record
   and comeback wins all answer "how is the season going" and are cards 2, 5,
   10 and 13, with photos and jerseys in between. Likewise the three different
   answers to "who plays here" (roster projection, current roster, injured
   list) are stacked in identical cards with nothing saying how they differ.
3. **You always pay for everything.** `loadTeam` is one `Promise.all` of ~20
   fetches plus a game-log lookup per pitcher plus a photo walk-back, all
   before first paint — even if the visitor wanted one section.

Plus: no wayfinding at all, and five sideways-scrolling tracks nested inside
one vertical scroll (club strip, jerseys, last ten, photos, leaders).

## The shape we're building

A **pinned identity header + five tabs**, each tab a real route, each loading
only its own data. Modelled on GitHub's repo tabs and Stripe's customer
detail: the detail page owns the *summary*, not the depth.

```
/team/{id}            Overview   previews that link into the tabs
/team/{id}/roster     Roster     lineup + staff, 40-man, injured list
/team/{id}/games      Games      schedule, results, photos, transactions
/team/{id}/numbers    Numbers    standings, batting, pitching, leaders, splits
/team/{id}/org        Org        affiliates, prospects, jerseys, history
/team/{id}/leaders    (exists)   unchanged — this is the pattern we're copying
```

Two behaviours grafted on:

- **Shelves.** Inside a tab, secondary modules render collapsed to a single row
  carrying their headline figure ("Injured · 4"), expanding in place. A tab must
  never become a new wall of cards. `TeamShelf` (issue 01) is the shared
  component; every tab uses it rather than rolling its own.
- **An index grid** opens the Org tab, because affiliates / prospects / jerseys /
  history genuinely are a browse-by-tile list rather than a reading order.

### Where each of today's modules lands

| Module today | Tab | Treatment |
| --- | --- | --- |
| Identity header, manager, Game Notes link | pinned | always, above the tab bar |
| Browse-other-clubs strip (`TeamFilterStrip`) | pinned | always |
| Division standings | Overview + Numbers | preview (your row + 2 neighbours) → full table |
| Postseason odds | Overview | modal off the standings preview, unchanged |
| Team score / form rails | Overview | full — this is the page's headline |
| Last 10 games | Overview + Games | preview (5 stubs) → full run |
| Team leaders | Overview + Numbers | preview (3 categories) → existing `/leaders` |
| Transactions | Overview + Games | preview (latest 3) → full timeline in a shelf |
| Roster projection (lineup / bench / staff) | Roster | full, Current-Season toggle kept |
| Current roster (40-man) | Roster | shelf |
| Injured list | Roster | shelf, count on the closed row |
| Season schedule | Games | full — the tab's headline |
| Photos rail | Games | shelf, **fetches only when opened** |
| Team batting ranks | Numbers | full |
| Team pitching ranks | Numbers | full |
| Record by day of week | Numbers | shelf |
| Comeback wins | Numbers | shelf |
| Affiliates | Org | full (MLB club's headline) |
| Prospects | Org | full — drop the 10-row preview cap, the tab has room |
| Jersey combos | Org | shelf |
| Affiliation history (MiLB) | Org | shelf |

Nothing is deleted. If you think a module should be cut, say so in the PR and
leave it in.

## Non-negotiables

1. **Dated links must survive a tab change.** A team page opened from a game
   carries `?d=` (asOf) and `?s=` (sportId); `fetchTeamSchedule` uses that
   cutoff so a visitor mid-scoring never sees a result they haven't reached.
   Every tab path helper goes through `linkQuery(opts)` and every tab renders
   inside `<LinkScope asOf sportId>`, exactly as `teamLeadersPath` already does.
   A tab switch that drops `?d=` is a spoiler bug, not a cosmetic one.
2. **A tab must not load another tab's data.** The speed win is half the point.
   If all five tabs end up sharing one big fetch, the work is cosmetic.
3. **MiLB degrades gracefully.** Minor-league feeds routinely lack lineups,
   uniforms, prospects, transactions and coaches. A tab with nothing in it
   should not render its tab button at all rather than opening an empty screen.
   Every selector already falls back to `''`/`null`/`—`; keep that.
4. **No visual redesign.** Existing card chrome, tokens and typography carry
   over unchanged. This effort moves things; it does not restyle them. New
   chrome is limited to the tab bar, the shelf row and the Org index tile.
5. **The spoiler rule is untouched.** Nothing on the team page is sealed today
   and nothing becomes sealed. The only spoiler-relevant mechanism here is the
   `asOf` cutoff in point 1.

## File ownership — read this before you edit anything

Several agents work this effort in parallel. Collisions are prevented by
ownership, not by luck. **Edit only the files your issue lists as owned.**

| File | Owned by |
| --- | --- |
| `src/lib/route.js`, `src/App.jsx` | issue 01 only, once |
| `src/screens/team/TeamHubShell.jsx`, `TeamTabBar.jsx`, `TeamShelf.jsx` | issue 01 |
| `src/screens/TeamPage.jsx` | issue 02, then issue 07 — nobody else, ever |
| `src/screens/team/modules/*` | issue 02 creates; 03–06 import but never edit |
| `src/screens/team/RosterTab.jsx`, `data/loadRoster.js` | issue 03 |
| `src/screens/team/GamesTab.jsx`, `data/loadGames.js` | issue 04 |
| `src/screens/team/NumbersTab.jsx`, `data/loadNumbers.js` | issue 05 |
| `src/screens/team/OrgTab.jsx`, `data/loadOrg.js` | issue 06 |
| `src/CLAUDE.md`, `docs/adr/` | issue 07 |
| `test/`, `e2e/` | issue 08 |

### `src/index.css` is shared — use your banner

All CSS lives in one 27k-line file, so four agents appending at the end will
conflict. Issue 01 adds five empty, widely separated regions:

```css
/* ==== TEAM HUB: SHELL + TAB BAR + SHELF ==== */   /* issue 01 */
/* ==== TEAM HUB: ROSTER TAB ==== */                /* issue 03 */
/* ==== TEAM HUB: GAMES TAB ==== */                 /* issue 04 */
/* ==== TEAM HUB: NUMBERS TAB ==== */               /* issue 05 */
/* ==== TEAM HUB: ORG TAB ==== */                   /* issue 06 */
```

Write only inside your own banner. Non-adjacent regions merge cleanly.

## Order of work

```
Wave 1 (parallel)   01 shell + routes        02 extract modules
                            └──────────┬──────────┘
Wave 2 (parallel)   03 roster   04 games   05 numbers   06 org
                            └──────────┬──────────┘
Wave 3 (serial)     07 overview + retire the old page + docs
Wave 4 (serial)     08 polish, empty-tab handling, tests
```

Issues 01 and 02 touch disjoint files and can run at the same time. Both must
be **merged to `main`** before any of 03–06 starts, because 03–06 build on the
shell and the extracted modules.

During wave 2 the old `/team/{id}` page keeps rendering exactly as it does
today. That is deliberate: the new tabs and the old page coexist, so nothing is
broken at any point, and issue 07 is what finally retires the old body.

Each tab agent writes its **own** loader in its own file, lifting the fetches it
needs out of `loadTeam` by copying. Do not edit `loadTeam` to share code with
it — that would put four agents in one function. The temporary duplication is
resolved by issue 07, which deletes `loadTeam` once nothing uses it.

## Working conventions (every issue)

- Work in your own worktree on a task branch, per `docs/development.md`:
  `git worktree add ../bbsbh-<slug> -b claude/<slug> origin/main`. A hook
  installs dependencies automatically; give it a minute.
- Never push to `main`. Open a PR and stop; the maintainer merges.
- Verify in the browser on your assigned port, and **append `?nointro`** to
  every test URL.
- `npm run lint` and `npm test` must pass before you open the PR.
- End with the handoff block from `docs/development.md` (branch, worktree, PR,
  base, state, validation, local URL), including a clickable localhost URL for
  the exact route you changed.
- List the files you touched in the PR description, so overlap across the
  parallel PRs is visible at a glance.
