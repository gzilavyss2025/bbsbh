# SectionHead and Card — the slice plan (#1113)

Small, independent PRs, one family each, each revertible without the others. This
mirrors the Pill sweep (`../pill-collapse/map.md`). Row lists are in `census.md`
(Part 1 for cards by slice, Part 3 for heads by slice). Specs are in `spec.md`.

**14 PRs**: 4 for SectionHead (H1a, H1b, H2, H3) and 10 for Card (C0–C7, with C6
split in three), plus a prep step that is not a PR. C8 exists only if Gary says
yes to Q5.

---

## Before any slice

**P0 — prep (no product change, no PR of its own; do it in the first slice's branch).**

1. #1131 (Pill) is merged, and #1129 / #1130 are closed. Pill slices 3–7 still touch
   ten partials this plan also touches (`10-lineup.css`, `26b-player-contract.css`,
   `39-manager-page.css`, `44-pre-game-cards.css`, `48-stamp-strip.css`,
   `66-situational-records.css`, and others), so line numbers move.
2. #1177 (the screenshot suite) is on `main`, so every slice ships a before/after list
   of changed pages. Compare against a baseline run on the merge base, never against
   zero (the e2e suite is never green on `main`).
3. Re-run `node .scratch/design-system/card-collapse/census.mjs` on the new `main`.
   Every override that no longer matches prints STALE. Fix those before slicing.
4. For each slice that deletes a per-site radius or shadow, lower #1178's budgets in
   the same PR.

**Directory budgets (ADR-0038).** `src/styles/` (116) and `src/screens/` (46) are at
their budgets. New CSS goes in `src/styles/system/` (3 files). `src/components/ui/`
holds 11 of 12, so `Card.jsx` and `SectionHead.jsx` go in a new
`src/components/ui/frame/`. Class helpers go in `src/lib/design/` (3 files).

**Every slice ships green.** `npm run lint` in the foreground with the exit code
echoed, `npm test`, `npm run build`, and a browser pass over each page listed for
the slice at 390px and 900px, with `?nointro` on every URL.

---

## The order, and what can run at the same time

```
#1131 merged ──┬── H3 (renames, any time) ─────────────────────────────┐
               │                                                          │
               ├── H1a (band, outside the seal) ──┬── C0 (Card + hub) ──┬─ C1 hub
               │                                   │                     ├─ C2 player
               ├── H2 (label + rule) ─────────────┘                     ├─ C3 pre-game
               │                                                         ├─ C6a / C6b / C6c
               └── H1b (band, inside the seal) ─────────────── after C0 ├─ C4 innings + HUD
                                                                          ├─ C5 box score
                                                                          └─ C7 account + logbook
```

- **H3** is class renames only. It does not need `SectionHead`. It can run first,
  or beside anything, except that it shares `68-around-the-game.css` with H2.
- **H1a and H2** both build on the new `SectionHead`. Whichever lands first creates
  the component; the other rebases on it. They share `09-team-info.css`
  (`.thub-card__head`) and `31-wild-card.css`. Recommended: H1a first, then H2.
- **H1b** needs H1a's band. It is its own PR because every head in it is on
  `check-seal-scope`'s allowlist and inside the spoiler scope.
- **C0** needs H1a and H2 (the hub card's head is a label that becomes a band).
- **After C0**, the C slices are independent of each other. They can run in
  parallel worktrees. Where two slices share a partial, the second rebases on the
  first; they never touch the same rule. Shared partials:
  `09-team-info.css` (C0, C2, C3), `31-wild-card.css` (C1, C6b),
  `23-box-score-detail.css` (C1, C5), `42-first-scorebook.css` (C6a, C7).
- **C4 and C5** also need H1b.

---

## The slices

### H3 — the second lines (renames only)

- **Rows:** 18 head rules in `census.md` Part 3 / H3, plus the ADR-0084 ledger's
  second-line rows for #1113 (`__kicker`, `__eyebrow`, `__sub`, `__lede` → `__note`;
  `.betweeninnings__eyebrow` is deleted, not renamed). The ledger's two-step notes
  apply (`.stampstrip__note` → `.stampstrip__label` first, `.dlab__note` →
  `.dlabentry__note` first).
- **Files:** 16 partials and about 30 JSX files (the ledger's file column is the work
  list). `e2e/box-lines.spec.js` and `e2e/intro-two-step.spec.js` name two of the
  classes.
- **Care:** `StampGameButton.jsx` is on `STAMP_ALLOWLIST`: a class rename only, no new
  import. Update the ledger row to "landed in #NNNN" for each.
- **Screenshots:** `/about`, `/first-scorebook`, `/situational-records`, `/player/christian-yelich-592885` (contract card), a box score with Box Lines open, the strike-zone and umpire modals, the intro sheet (`/` without `?nointro`, once).

### H1a — `SectionHead` + the band, outside the spoiler scope

- **Build:** `ui/frame/SectionHead.jsx`, `styles/system/section-head.css` (imported
  before `06-loader-and-cards.css`), `lib/design/sectionHeadClass.js` + its test,
  `test/card-cascade.test.js` (pins where the system file sits), a `/design-lab`
  entry.
- **Rows:** `.metricbar` + `.is-themed .metricbar` + `.metricbar__title`
  (`SectionMasthead`, 16 call sites: becomes a thin wrapper over `SectionHead`, or
  each call site moves), the hub's four themed heads (`.team-hub.is-themed …`),
  `.team-score__head`, `.tstats-card__head`, `.roster-super__head`,
  `.player.is-themed .section__title--bar` (9 call sites).
- **Allowlist:** `check-seal-scope.mjs` drops `.is-themed .metricbar` (09) and
  `.metricbar` (44), and gains the one band selector in `system/section-head.css`.
- **Decision first:** Q2 (the unthemed band's face).
- **Lab mocks:** `.idlab__barmock` in two partials previews the band. Check it still
  matches; it stays allowlisted.
- **Screenshots:** `/team/158` (themed), a MiLB club's hub with no theme,
  `/player/christian-yelich-592885`, a lineup page (`/07072026/milstl-2/lineup1`),
  `/salaries`.

### H2 — the label (and the one rule)

- **Rows:** 22 label + 1 rule head rules (Part 3 / H2). `SectionTitle` (23 call
  sites) becomes `SectionHead look="label"` or a wrapper over it. `.thub-card__head`
  (15 call sites). A card's name set in `--fs-h3` inside the card
  (`.prospectcard__title`, `.levelprog__title`, `.srecord__title`, `.note__title`,
  `.pitchslab__title`, `.posterstudio__title`) becomes the head.
- **Care:** `.txcard__head` stays a label forever (its deck bleeds; see 09's comment).
  `.pitchslab__head` is allowlisted: read why before touching the pitch-mix head.
  Find the critique's "STATCAST ——— PERCENTILE RANK" rule head by eye.
  `.roster-sub__title` is a head at the second level: leave it a namespace rule
  unless Gary wants a level prop.
- **Screenshots:** `/player/christian-yelich-592885` and its `/stats` and
  `/analytics` tabs, `/team/158`, `/leaders`, the minors hub (`/team/…` for an AAA
  club), `/higha/10122025` (offseason heads).

### H1b — the band inside the spoiler scope

- **Rows:** `.statbox__title`, `.dueup__title`, `.lineupcard__title`,
  `.lineupteam__name` (+ themed), `.halfdefense__title` + `.abs__title` (+ themed),
  `.roster__toggle` (+ themed), `.winprob__head` / `__title`,
  `.marginnotes__title`, `.pitchers__title`.
- **Allowlist:** removes 12-sealbox's six band entries, 13-play-by-play's
  `.roster__toggle`, 20-charts' three, and 09's four themed ones.
- **Care:** `.roster__toggle` IS a `<button>`: SectionHead needs `as="button"` for
  it, or the toggle stays bespoke. `.lineupteam__name` is a band that is not the
  card's first row (two clubs in one card).
- **Seal rule:** move the head, never a reveal. No `SealBox`, `revealedThrough` or
  reveal-only call moves.
- **Screenshots:** `/07072026/milstl-2/top6`, `/07072026/milstl-2/bottom7`, the box
  score (`/07072026/milstl-2/boxscore`, revealed and sealed), the roster drawer
  open, at 390 and 900 (the ABS card only shows from 740).

### C0 — `Card` + the team hub's canonical card

- **Build:** `ui/frame/Card.jsx`, `styles/system/card.css` (next to
  `section-head.css`, before 06), `lib/design/cardClass.js` + its test, the cascade
  test extended, a `/design-lab` composition band (critique finding 11).
- **Rows:** `.thub-card` only (16 modules, 20 files with the lab). The
  `thub-card chalcard` co-class becomes `Card className="chal"` — which is also the
  ledger's `.chalcard` → `.chal` rename. Do `.rvcard` → `.rv` only if the ledger's
  two-step is solved (`.rv` is already a namespace).
- **Screenshots:** `/team/158` (all bands of the one-scroll page), an MiLB hub, the
  lab.

### C1 — the rest of the team hub (14 rows, 13 after C0)

- **Rows:** `.tlead__cat`, `.tledg__block`, `.jerseydeck__card` (gains an edge),
  `.team-score`, `.txstory`, `.tstats-card` (two-step rename), `.roster-super`,
  `.thub-affiliate` (as="a"), `.horizontile`, `.hzntile`, `.alum__card`,
  `.ctr__tile`, `.ctr__card`.
- **CSS:** 09, 23, 28, 29, 31-wild-card, 64, 70.
- **Screenshots:** `/team/158`, `/team/158/…` contracts band, an AAA club (minors
  depth + horizon), `/leaders`.

### C2 — the player page (17 rows)

- **Rows:** `.player__statgrid`, `.player__splits`, `.factgrid` (all three:
  gap-rule grid moves inside), `.vsteam__last`, `.gamelog`, `.milestonewatch`,
  `.cthist__seasons` (issue comment 2: its toggle foot becomes a Door),
  `.posinn__diamond`, `.levelprog`, `.prospectcard` (keeps its accent rule),
  `.simlike__link` (as="a"), `.awards`, `.awardblk`, `.hitchart`, `.bflight`,
  `.spray`, `.gamelines__rows`.
- **Not here:** `.ledger, .standings` (Table, #1132).
- **Care:** `.hitchart` also renders in the innings half; `.factgrid` also in the
  innings reference panel. Box moves only.
- **Screenshots:** `/player/christian-yelich-592885` + `/stats` `/analytics`
  `/history`, a pitcher, a prospect (`/player/…` with a Top-100 tag).

### C3 — pre-game, TeamInfo (5 rows)

- **Rows:** `.metriccard`, `.lineup, .opp, .startercard` (one rule, three blocks),
  `.teammatecard`, `.defdiamond`, `.umps__list` (gap-rule grid).
- **Care:** `.lineup__list` inside `.lineup` and `.thub-roster` inside the hub card
  are nested frames: they become flush bodies, not second cards. Renames:
  `.metriccard` → `.metric`, `.startercard` → `.starter`, `.teammatecard` →
  `.teammate`.
- **Screenshots:** `/07072026/milstl-2/lineup1` and `lineup2` (both clubs themed),
  a MiLB lineup page (missing lineup: "not posted yet").

### C4 — the innings viewer and game HUD (13 rows) — SEAL SCOPE

- **Rows:** `.half`, `.statbox`, `.dueup`, `.lineupcard` (→ `.entering`, edits the
  allowlist), `.halfdefense`, `.roster`, `.rolling__scroll`, `.winprob`,
  `.marginnotes`, `.pitchers` (ADR-0009 gate untouched), `.halftally`,
  `.betweeninnings` (as="button"), `.abscard` (→ `.absframe`; @media only).
- **Care:** the panels inside StatBox (`.wcall`, `.favormeter`, `.halfcast`,
  `.stat`, `.statline`) do not move. Re-sealing by `key={inning}` must still work:
  click through three halves forward and back.
- **Screenshots:** `/07072026/milstl-2/top1`, `top6`, `bottom9`, a live or recent game
  at the frontier, 390 and 900.

### C5 — the box score (15 rows) — inside the reveal render

- **Rows:** `.gamestory`, `.bs__team`, `.bs__decisions`, `.bs__potg`,
  `.bs__insights`, `.bs__statcastCard`, `.bs__noteCard`, `.bs__stars`,
  `.bs__tally`, `.bs__info`, `.bs__totalsCard`, `.bs__board`, `.bs__fill`,
  `.playercard` (→ `.playerline`; also `/awards`), `.stars3__card`.
- **Decision first:** Q3 (six of these draw on page paper today).
- **Care:** `screens/BoxScore.jsx` is on `STAMP_ALLOWLIST` (it renders the mint
  strip). `Card` must import nothing stamp-related. `.stampstrip` does not move.
- **Screenshots:** `/07072026/milstl-2/boxscore` sealed and revealed, a Box Lines
  sheet, `/awards`.

### C6a — postseason and All-Star (11 rows)

- **Rows:** `.seedcard` (as="button", → `.seed`), `.psseries__result`, `__log`,
  `__lboard`, `__rostercard`, `.psleaders__teamboard`, `.allstarrosters__year`,
  `__rows`, `.allstargame`, `.allstarlegacy__leadercard`, `__teamcard`.
- **Screenshots:** `/postseason-history`, `/postseason-race`, one
  `/postseason/{seriesId}`, `/postseason-leaders`, `/all-star-rosters`,
  `/all-star-legacy`.

### C6b — people, records and reference pages (14 rows)

- **Rows:** `.umpage__card`, `.umpage__list`, `.mgrpage__card` (all gain an edge),
  `.umptend` (its band opts OUT of club theming — keep that), `.trrank__tile`,
  `.trrank__podiumcard`, `.rehabcard`, `.milestonewatch-page__card`, `.tradecard`
  (→ `.trade`), `.payboard`, `.penpage__grid`, `.moredir__card`, `.aboutrule`,
  `.prospects__filterdeck`.
- **Screenshots:** an `/umpire/…` page, a manager page, `/situational-records` and
  one detail, `/rehab`, `/milestones`, `/trade-deadline/2026`, `/salaries`,
  `/bullpen-availability`, `/more`, `/about`, `/prospects`.

### C6c — fouls, offseason and the slate's off-day tile (10 rows)

- **Rows:** `.foulboard__hero`, `.foulavg`, `.sgh-list`, `.gamehigh-tiles`,
  `.souvenir-row__tiles` (gap-rule grids), `.springcount`, `.pgame__card`,
  `.srecord`, `.note__stories`, `.offdaycard` (as="button", keeps its
  `--offday-accent` tint).
- **Also:** #1113's first comment — the "Players who moved up" rows
  (`.movedup*`, `MovedUp.jsx`) take the new card style here.
- **Care:** `GameSelect.jsx` is a stamp FORBIDDEN_SURFACE and the slate is the front
  door: `.gamecard` does not move.
- **Screenshots:** `/fouls`, `/higha/10122025` and `/aaa/10122025` (offseason, via
  `e2e/offseason-home.spec.js`), a slate day with an off-day club.

### C7 — account, logbook and chrome (12 rows)

- **Rows:** `.sitemenusheet__group`, `.scorebookstory__gamecard`,
  `__performer`, `__leaders`, `__nugget`, `.logbookstats__splits div`,
  `__streaks article`, `__performer`, `__leaders`, `__records > div`,
  `.mytally__pitch`, `.posterstudio__panel`.
- **Care:** `/logbook/stats` summarises stamped games. Before the slice, confirm its
  files are not on `STAMP_ALLOWLIST` and render no stamp art; if one is, that row
  becomes a hold.
- **Screenshots:** the site menu open, `/first-scorebook`, `/logbook/stats`,
  `/profile`, a game preview poster page.

### C8 — labs and admin (25 rows) — only if Gary says yes (Q5)

Wordmark lab, identity lab, pattern lab, animation lab, design lab boxes, `/admin`
copy editor, contract workbench, research diaries. Admin pages cannot be checked
locally (no Clerk key).

---

## After #1113

- Nested boxes (16 panels, 10 wells) — Q4.
- `Table` (#1132) takes `.ledger, .standings` and `.prospectboard`.
- `Notice` (#1132) takes the 7 notice rows.
- `Stack` (#1180) takes the 41 card margins.
- #1114's guard counts the card recipe by shape, using this census's definition.
