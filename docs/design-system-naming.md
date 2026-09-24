# The rename ledger

Every class in this repo that breaks the naming grammar, and the collapse PR
that carries its rename.

**The rule is [ADR-0084](adr/0084-a-block-is-named-for-its-job-never-its-shape.md),
and only there.** This file does not restate it. Two copies of a rule drift, and
the copy a reader happens to open is the one they follow. Read the ADR for what
the six clauses say and what each one rejects; read this file for what moves.

Measured on `main` at `9a578dcb7`. **156 rows**, of which **9 are held**.

One row was added after the measurement, by the rename that found it: see
`.bs__noteMore` under #1130. Twelve more, the `sheet` family under #1113, were
added by #1155 and measured on `main` at `ffd91507a`.

| collapse issue | rows |
| --- | --- |
| Button and Door (#1130) | 26 |
| Pill (#1131) | 33 |
| SectionHead and Card (#1113) | 87 |
| Table, EmptyState and Notice (#1132) | 10 |
| **total** | **156** |

## How to read a row

**One row per class.** A class that breaks two clauses is one row and the clause
column lists both.

**The file column is measured, not estimated.** It is every file under `src/`,
`e2e/`, `test/`, `scripts/` and `api/` that contains the class, matched on shape
with a `(?![a-z0-9-])` right boundary. Do not use `\b`: `_` is a word character,
so `\b` does not exist between `card` and `__element`, and a `\b`-anchored search
silently drops every block that appears only as `.block__element`. That trap
already produced a wrong count once (#1127).

**Two files are easy to miss and both break on a rename.**
`src/screens/designlab/catalog.js` names classes as data, and
`scripts/check-seal-scope.mjs` matches on them (ADR-0083) — it asserts that every
allowlisted selector is still reached, so a renamed one fails `npm run lint`
rather than rotting on the list. Both appear in the file column where they apply.

**A file marked `†` names the class only in a comment.** It still has to move —
a comment naming a renamed class is stale the moment the rename lands, and a
comment that lies about a rule is how the drift got here (ADR-0083) — but it is
not a call site, so do not read it as one.

**Two rows have no literal call site at all**, because the class name is built by
interpolation or is orphaned. A grep-driven rename misses both. They are
`.pitcherhandoff__chip--open` and `.cover__sub`, and each row says so.

**A row whose note says `landed in #NNNN` has already moved.** Its `current
class` column is then history — the name the class HAD — and its target column is
what is in the tree. This file is the one place an old name is meant to survive,
so a boundary grep for a renamed class that hits here and nowhere else is the
expected result, not a miss.

**An ABSORBED row's target is a shared rule, not a per-site name.** Each collapse
issue gives its shape word one rule that owns it, and where a row turned out to be
a copy of that rule declaration for declaration, the copy was deleted rather
than renamed — so the element wears the shared class and no per-site class at
all. Such a row's target column names the shared rule (`.door--block`) and the
per-site name in its `current class` column exists nowhere in the tree. A row
that keeps even one declaration of its own is a rename, not an absorb, and its
target column names the class the way every other row does.

**A held row moves nothing**, so its file column carries the measured count as
evidence for the hold instead of a work list.

**Blocks that own the base rule for their shape keep the word and are not rows:**
`.thub-card` and `.gamecard` (card), `.btn` (btn), `.sheet` (sheet, in
`styles/14-strike-zone.css`) and
`.pill` (pill). `.milestonepill` owned the pill recipe until #1131 moved it into
`.pill` (`styles/system/pill.css`); it is absorbed, and no class is left.

Rows are ordered by the sequence the collapse issues land in: #1130, then #1131,
then #1113, then #1132.

## Button and Door — #1130 — 26 rows

Eleven blocks carry `btn` or `door` without owning the base rule for it;
`.btn` owns that rule and is not a row. Twelve `__more` doors and one
`__action` control break clause 3.

The rule the door rows collapse onto is `.door` in `src/styles/system/door.css`,
with an `--inline` and a `--block` layout, written by `components/ui/control/Door.jsx`.

| current class | clause(s) broken | target name | collapse issue | files that must move | hold + reason |
| --- | --- | --- | --- | --- | --- |
| `.accountbtn` | 1 | `.account__btn` | #1130 | `components/account/AccountButton.jsx`, `styles/03-slate-header.css`, `styles/04-site-bar.css`, `e2e/slate-header.spec.js` | landed in #1166, renamed, keeping its `margin-left`. Its elements moved with it (`.account__signin`, `__team`, `__avatarbox`, `__avatarimg`, `__teamlogo`), and the sign-in wears `btn btn--ghost`. |
| `.backbtn` | 1 | `.player__back` | #1130 | `components/chrome/BackBtn.jsx`, `styles/26-player-page.css` | landed in #1166, renamed: ghost · control, keeping only the margin that puts its word on the page edge. |
| `.logbook-btn` | 1 | `.sitebar__logbook` | #1130 | `components/chrome/LogbookButton.jsx`, `styles/04-site-bar.css` | landed in #1166, renamed: ghost · tap. The `--labeled` modifier and `__label` element are gone (it was always labelled); it keeps its inline padding and no block padding. |
| `.notesbtn` | 1 | `.innings__notes` | #1130 | `screens/team/TeamHubShell.jsx`, `screens/TeamInfo.jsx`, `styles/11-innings.css` | landed in #1166, renamed: outline · control, an anchor because its action is a PDF. `__ext` became the button's `.btn__icon`. |
| `.refreshbtn` | 1 | `.innings__refresh` | #1130 | `screens/TeamInfo.jsx`, `styles/11-innings.css`, `styles/21-box-score.css`, `styles/25-wide-layout.css` | landed in #1166, renamed: outline · control, busy while it fetches. Its modifier moved with it: `.refreshbtn--float` → `.innings__refresh--float`. `__icon` became `.btn__icon`. |
| `.sitemenu-btn` | 1 | `.sitebar__menu` | #1130 | `components/chrome/SiteMenu.jsx`, `styles/03-slate-header.css` †, `styles/04-site-bar.css`, `e2e/slate-header.spec.js` | landed in #1166, renamed: ghost · tap, keeping its square. |
| `.sitesearch-btn` | 1 | `.sitebar__search` | #1130 | `components/chrome/SiteSearch.jsx`, `styles/03-slate-header.css` †, `styles/04-site-bar.css`, `e2e/site-search.spec.js`, `e2e/slate-header.spec.js` | landed in #1166, renamed: ghost · tap, keeping its square. |
| `.watchbtn` | 1 | `.masthead__watch` | #1130 | `components/game/GamePhotosStrip.jsx` †, `screens/GameView.jsx`, `styles/05-masthead-nav.css`, `styles/44-pre-game-cards.css` † | landed in #1166, renamed: ink · control. `__logo` → `.masthead__watchlogo`, `__ext` → `.btn__icon`. |
| `.boxlines-door` | 1 | `.boxlines__door` | #1130 | `components/boxlines/BoxLinesDoor.jsx`, `styles/10-lineup.css` †, `styles/boxlines/boxlines.css`, `styles/boxlines/listdoor.css` † | landed in #1130. The name is BUILT BY INTERPOLATION (`BoxLinesDoor.jsx:41`), with a modifier this row did not list until the rename found it: `.boxlines-door--face` → `.boxlines__door--face`, a hook that has no rule of its own. Its `__label` did NOT follow the block — the words at the far end of that row are the text door's, so they are the shared `.door__label` now. |
| `.thub-door` | 1 | `.thub__door` | #1130 | `src/CLAUDE.md`, `components/inning/focus/ReferencePanel.jsx`, `components/player/PlayerHighlightsRail.jsx`, `components/player/PlayerPhotosRail.jsx`, `screens/PlayerPage.jsx`, `screens/team/GamesTab.jsx`, `screens/team/modules/TeamChallengeCard.jsx`, `screens/team/modules/TeamRunValueCard.jsx`, `screens/TeamInfo.jsx`, `screens/TeamPage.jsx`, `styles/10-lineup.css`, `styles/46-consent-modal.css` | landed in #1130. It is the WRAPPER that right-aligns a text door under a preview card, never the control — `ui/control/Door.jsx` is the control, and `.thub__door` goes on owning only where it sits. |
| `.xldoor` | 1 | `.xl__door` | #1130 | `components/game/ExpressLaneDoor.jsx`, `styles/77b-express-lane-door.css` | landed in #1130, with the names under it this row did not list: `.xldoor__go` → `.xl__go` (the chevron is an element of `.xl`, not of the door) and five `--xldoor-*` custom properties → `--xl-door-*`. Keeps its whole film-strip dress and wears `.door` for the pointer and the focus ring only. |
| `.btn--reveal` | — (collapse risk) | hold | #1130 | 15 files — none move | HOLD, and held in #1166 — #1130 folds every `.btn--*` skin into a `skin` prop; this one may not go. It stays in 07 and now pins the body face it used to inherit from `.btn`. The kraft hatch is the seal metaphor doing its job and this is the spoiler rule's one control. `scripts/check-seal-scope.mjs` allowlists it by name (ADR-0083). |
| `.allstarlegacy__more` | 3 | `.allstarlegacy__door` | #1130 | `screens/AllStarLegacyPage.jsx`, `styles/42-first-scorebook.css` | landed in #1130, RENAMED and not absorbed: this and `.allstarrosters__door` draw an outlined capsule in `--accent-primary`, which is a button's dress and not a door's. The audit found the pair one declaration apart — this one carried no `cursor: pointer` — and that is fixed here. Whether a door may wear a button skin is #1130's Button half to settle — it settled NO in #1166, see the classification below; this door moved onto `.door--block` and keeps only its top margin. |
| `.allstarrosters__more` | 3 | `.allstarrosters__door` | #1130 | `screens/AllStarRostersPage.jsx`, `styles/37-all-star-rosters.css` | landed in #1130, renamed and not absorbed — see the `.allstarlegacy__more` row for the pair. Then ABSORBED in #1166 onto `.door--block`, which its margin already matched, so the name exists nowhere now. |
| `.bs__noteMore` | 3 | `.door--block` | #1130 | `screens/BoxScore.jsx`, `styles/21-box-score.css` | ADDED in #1130 and landed there. The census missed it because it spells the reject-list word `__noteMore`, not `__more`. It was the FIFTH declaration-identical copy of the block door, and the one three of the other four name in their own comments as the shape they were copying — so leaving it behind would have left the next reader a copy to copy. Absorbed whole: no per-site rule remains. |
| `.cmdrecv__more` | 3 | `.cmdrecv__door` | #1130 | `components/playerstats/CommandReceivedCard.jsx`, `styles/26g-command-received.css` | landed in #1130. One declaration (a top margin) over `.plink`, so it is a rename and not an absorb. |
| `.foulcard__more` | 3 | `.foul__door` | #1130 | `components/playerstats/FoulCard.jsx`, `styles/26-player-page.css` | moves with its block — see the `.foulcard` row. The ELEMENT half landed in #1130 on today's prefix, as `.foulcard__door`; the block half rides with #1113, which is what makes `.foul` exist. |
| `.gamesgrid__more` | 3 | `.door--block` | #1130 | `screens/team/modules/TeamGames.jsx`, `styles/29-team-transactions.css` | landed in #1130, ABSORBED and not renamed. Read against the three the issue measured, this is a FOURTH copy of the same thirteen declarations, plus the focus ring that is now on `.door`. |
| `.marginnotes__more` | 3 | `.door--block` | #1130 | `components/inning/MarginNotes.jsx`, `styles/20-charts.css`, `styles/29-team-transactions.css` † | landed in #1130, absorbed — one of the three the issue measured as declaration-identical. |
| `.pshistory__more` | 3 | `.door--block` | #1130 | `screens/PostseasonHistoryPage.jsx`, `screens/team/modules/InjuredListCard.jsx`, `screens/team/modules/minors/ProspectsCard.jsx`, `styles/33-awards-history.css` | landed in #1130, absorbed — one of the three the issue measured as declaration-identical. The name was already a lie at two of its three call sites: the injured-list card and the prospects card both wore the postseason-history door. |
| `.rvcard__more` | 3 | `.rv__door` | #1130 | `components/playerstats/RunValueCard.jsx`, `styles/75-run-value.css` | moves with its block — see the `.rvcard` row. The ELEMENT half landed in #1130 on today's prefix, as `.rvcard__door`; the block half rides with #1113, and that row's standing warning that `.rv` is not a free name is untouched here. |
| `.teammates__more` | 3 | `.door--block` | #1130 | `screens/TeamInfo.jsx`, `styles/10-lineup.css`, `styles/20-charts.css` †, `styles/21-box-score.css` †, `styles/29-team-transactions.css` † | landed in #1130, absorbed — one of the three the issue measured as declaration-identical, and the one the other four cite in their comments. |
| `.txcard__more` | 3 | `.txrow__door` | #1130 | `components/transactions/TeamTransactionsCard.jsx`, `styles/29-team-transactions.css`, `styles/72-club-transactions.css` † | moves with its block — see the `.txcard` row. The ELEMENT half landed in #1130 on today's prefix, as `.txcard__door`; the block half rides with #1113. Absorbed onto `.door--block` apart from three placement declarations it keeps as a flex item in a scroll deck; its dashed edge went solid, which #1132 reserves for the pencil meaning. |
| `.txpage__more` | 3 | `.txpage__door` | #1130 | `screens/team/TeamTransactionsPage.jsx`, `styles/72-club-transactions.css` | landed in #1130, absorbed onto `.door--block` apart from the margin that lays it across a page rather than at the foot of a card. Its dashed edge went solid, which #1132 reserves for the pencil meaning. |
| `.sitefooter__action` | 3, 5 | `.sitefooter__btn` | #1130 | `components/chrome/SiteFooter.jsx`, `styles/08-site-shell.css`, `styles/08a-site-menu.css` † | clause 3 reserves `__action` for the head's action slot; this is a standalone 44px control in the footer, not a head part. Landed in #1166, renamed: outline · tap, keeping `min-width: 0`. |
| `.cta__go` | 5 | hold | #1130 | 1 file — none move | HOLD — `/learn` is server-rendered by `api/page.js` from `src/copy/landing/`, and its CSS is `public/learn.css`, outside `src/styles/`. The guide keeps its own copy of the palette; a rename here moves a file no collapse PR touches. |

### The Button half — classification

Landed in #1166. Written and committed BEFORE any control moved, so the sweep is reviewable
against a decision (the ADR-0083 precedent). The rule every control moves onto
is `.btn` in `src/styles/system/button.css`, written by
`components/ui/control/Button.jsx`. The ledger rows above that this half
touches say which bin they are in; this table also covers the in-scope
controls whose names are already legal, so they are not rows.

Three bins. **Absorbed**: the per-site rule was only dress, so none is left.
**Renamed, keeps placement**: the class stays (or takes its ledger target) and
keeps only what places it — margin, flex, alignment, width, or the one
padding a flex cell's width forces. **Held**: moves nothing, with the reason.

"Before the slot" means the old rule sat in 01–06b, which loads BEFORE
`system/button.css`, so any declaration it keeps that `.btn` also sets must be
written at two-class specificity or it silently loses.

| control | bin | skin · size | kept | old rule vs the slot |
| --- | --- | --- | --- | --- |
| `.btn--chip` | absorbed | outline · control | — | after (48) |
| `.btn--account` | absorbed | ink · tap | — (width moves to `.introsheet__primary`, already there) | after (08) |
| `.erasesheet__btn`, `--danger` | renamed, keeps placement | outline / danger · tap | `flex: 1 1 auto` | after (55) |
| `.btn--next` | renamed, keeps placement | ink · tap (callers add `btn--ink`) | `width`, `margin-top` | the slot's own file (07) |
| `.btn--seal` on the four Game Log confirms that are not the mint | re-skinned to ink | ink · tap | — | — |
| `.refreshbtn` | renamed → `.innings__refresh` | outline · control, icon, busy | — (its host rules keep `display` per width) | after (11) |
| `.refreshbtn--float` | renamed → `.innings__refresh--float` | — | `pointer-events`, and in focus mode its position, z-index, flex and square min-width | after (24, focus/) |
| `.notesbtn` | renamed → `.innings__notes` | outline · control, icon | `flex: none` | after (11) |
| `.watchbtn` | renamed → `.masthead__watch` | ink · control, icon | — (`__logo` → `.masthead__watchlogo`) | BEFORE (05) |
| `.stepnav__btn` | renamed, keeps placement | outline · control, `aria-current` | `flex: 1 1 0`, `padding-inline` | BEFORE (05) |
| `.posinn__scopebtn` | renamed, keeps placement | outline · control, `pressed` | `flex: 1 1 0`, `padding-inline` | after (27) |
| `.umpage__filterbtn` | renamed, keeps placement | outline · control, `pressed` | `flex: 1` | after (38) |
| `.sc-zoom__btn` | renamed, keeps placement | outline · control | square: `width`, `padding: 0` | after (scorecard/) |
| `.sitefooter__action` | renamed → `.sitefooter__btn` | outline · tap | `min-width: 0` (a grid item) | after (08) |
| `.sitesearch-btn`, `.sitemenu-btn`, `.logbook-btn` | renamed → `.sitebar__search`, `__menu`, `__logbook` | ghost · tap | square: `min-width`, `padding: 0`; the labelled Game Log its inline padding | BEFORE (04) |
| `.accountbtn` | renamed → `.account__btn` | the wrapper; its sign-in is ghost · tap | `margin-left` | BEFORE (04) |
| `.backbtn` | renamed → `.player__back` | ghost · control | the margins that seat it on the page edge | after (26) |
| `.allstarlegacy__door`, `.allstarrosters__door` | re-homed onto `.door--block` | — (a door, not a button) | the top margin | after (37, 42) |
| `.mytally__rowbtn` | **held** | — | everything | — |
| `.btn--reveal` | **held** | — | everything | — |
| `.teamtabs__btn` | **held** — moves with #1131 | — | everything | — |
| `.cta__go` | **held** | — | everything | — |

**May a door wear a button skin? No.** The skin is how a reader knows what a
tap will do: a ruled ink box acts on the page, a door opens more of what you
are reading. The two All-Star "load more" controls grow their list in place,
which is exactly `.door--block`'s job, so they move onto it rather than
onto a button — and their accent-primary capsule, a button's dress on a door,
goes with it.

**Why `.mytally__rowbtn` is held.** It is an action ROW, not a button: a
caps title over a sentence of body type, left-aligned, 66px tall because the
sentence is. The button's anatomy is one centred label. Forcing the row into
it breaks either the anatomy or the row; the list-row shape is #1132's.

**Why four Game Log confirms leave the seal.** "Move it", "Stamp it here",
"Start this book" and "Re-place them" place or arrange a stamp that already
exists. None lifts a seal and none mints, so under ADR-0083 they may not wear
kraft. They take ink — the skin 07's own comment already named for "the
follow-on step (putting the stamp in the book)".

## Pill — #1131 — 33 rows

Fourteen blocks carry `pill`, `chip` or `tag` without owning the base rule;
`.pill` owns it now (#1131; `.milestonepill` held it before) and is not a row. Twelve `__chip`
elements are measurably tappable, and six states are written as modifiers.

| current class | clause(s) broken | target name | collapse issue | files that must move | hold + reason |
| --- | --- | --- | --- | --- | --- |
| `.debutpill` | 1 | `.debut__tag` | #1131 | `components/badges/DebutPill.jsx`, `screens/designlab/blocks.jsx`, `screens/designlab/catalog.js`, `styles/31-wild-card.css` | — |
| `.duepill` | 1 | `.dueup__tag` | #1131 | `components/inning/EnteringReference.jsx`, `screens/designlab/catalog.js`, `styles/12-sealbox.css` †, `styles/31-wild-card.css`, `scripts/check-seal-scope.mjs` | the rename edits `scripts/check-seal-scope.mjs`, which allowlists `.duepill` by name (ADR-0083). |
| `.mastheadpill` | 1, 5 | `.masthead__btn` | #1131 | `components/player/CareerRegister.jsx`, `components/player/GameLog.jsx`, `components/teamstats/BullpenBoard.jsx`, `components/teamstats/StarterMatchups.jsx`, `screens/designlab/catalog.js`, `styles/10-lineup.css` | measured tappable — `cursor: pointer` and a `<button>` call site. |
| `.prospectpill` | 1 | `.prospect__tag` | #1131 | `components/badges/ProspectPill.jsx`, `screens/designlab/catalog.js`, `screens/player/PlayerHubShell.jsx`, `styles/22-box-score-tables.css` †, `styles/23-box-score-detail.css`, `styles/31-wild-card.css`, `styles/47-trade-deadline.css`, `e2e/offseason-home.spec.js` | landed in #1131 slice 1, renamed: an outline `Pill` with no ink. It keeps no declaration of its own; the class is the hook for `.tlead__row` and `.tradecard__playerinfo` and for `e2e/offseason-home.spec.js`. Its logo element moved with it (`.prospect__logo`). |
| `.psodds-pill` | 1, 5 | `.psodds__btn` | #1131 | `screens/designlab/catalog.js`, `screens/team/modules/SeasonSchedule.jsx`, `screens/team/modules/StandingsCard.jsx`, `styles/09-team-info.css`, `styles/39-manager-page.css` | measured tappable — `cursor: pointer`, `:focus-visible` and a `<button>` call site. |
| `.radarpill` | 1, 2, 5 | `.radar__btn` | #1131 | `components/badges/RadarPill.jsx`, `screens/designlab/catalog.js`, `screens/designlab/components.jsx`, `styles/09-team-info.css` †, `styles/10-lineup.css`, `styles/31-wild-card.css`, `styles/motion/lineup.css` † | measured tappable — `cursor: pointer` and a `<button>` call site. Also a namespace: it owns no base rule. |
| `.reg-pill` | 1 | `.reg__tag` | #1131 | `components/player/CareerRegister.jsx`, `screens/designlab/catalog.js`, `screens/RehabPage.jsx`, `styles/05a-career-timeline.css` †, `styles/26-player-page.css` | #1129 names this one: a 3px `--radius-xs` tag wearing a capsule's name. It does not join the capsule family. |
| `.rookiepill` | 1 | `.pill` | #1131 | `components/badges/RookiePill.jsx`, `screens/designlab/catalog.js`, `styles/12-sealbox.css`, `styles/13-play-by-play.css` †, `styles/31-wild-card.css` | landed in #1131 slice 1, absorbed: `<Pill ink="--field">`, no class of its own. Its two elements moved (`.rookie__full`, `.rookie__short`) and keep the phone swap. |
| `.tierpill` | 1 | `.tier__tag` | #1131 | `components/badges/TierPill.jsx`, `screens/designlab/catalog.js`, `styles/09-team-info.css`, `styles/14-strike-zone.css` †, `styles/51-similar-players.css` † | landed in #1131 slice 1, renamed: an outline `Pill`; each `.tier__tag--*` tint sets the pill's custom properties rather than repainting it. |
| `.ilchip` | 1 | `.il__tag` | #1131 | `components/badges/InjuredMark.jsx` †, `screens/team/modules/InjuredListCard.jsx`, `styles/31-wild-card.css` | — |
| `.rankchip` | 1 | `.rank__tag` | #1131 | `screens/StandingsPage.jsx`, `screens/team/modules/RosterList.jsx`, `styles/31-wild-card.css` | landed in #1131 slice 1, renamed: an outline `Pill` that keeps the figure face (mono, tabular, `--fs-cell`, no tracking); `--good`/`--bad` are tints on the pill's custom properties. |
| `.rolechip` | 1 | `.role__tag` | #1131 | `screens/team/modules/CurrentRosterCard.jsx`, `screens/team/modules/RosterProjection.jsx`, `styles/31-wild-card.css` | — |
| `.rpt-chip` | 1, 5 | `.rpt__btn` | #1131 | `screens/around-the-game/abs/ClubBoard.jsx`, `screens/around-the-game/abs/LongestRuns.jsx`, `screens/around-the-game/abs/UmpireBoard.jsx`, `screens/around-the-game/abs/WhenTheyCall.jsx`, `screens/around-the-game/AbsChallengesPage.jsx`, `screens/around-the-game/AttendancePage.jsx`, `screens/around-the-game/BullpenPage.jsx`, `screens/around-the-game/DoubleheadersPage.jsx`, `screens/around-the-game/FarmSystemPage.jsx`, `screens/around-the-game/PacePage.jsx`, `screens/around-the-game/RunDifferentialPage.jsx`, `screens/around-the-game/RunValuePage.jsx`, `styles/68-around-the-game.css`, `e2e/pen-rule.spec.js` | measured tappable — `cursor: pointer` and a `<button>` call site. |
| `.dirtag` | 1 | `.dirlink__tag` | #1131 | `components/account/AdminFooterLink.jsx`, `components/account/AdminMenuLink.jsx`, `components/chrome/FooterParts.jsx`, `components/chrome/SiteMenu.jsx`, `screens/MorePage.jsx`, `styles/08a-site-menu.css`, `styles/59-more-directory.css` † | — |
| `.cmdmap__chip` | 5 | `.cmdmap__btn` | #1131 | `components/charts/CommandMap.jsx`, `components/charts/GloveTarget.jsx`, `src/index.css` †, `styles/26d-command-map.css`, `styles/26f-glove-target.css` † | — |
| `.daystate__chip` | 5 | `.daystate__btn` | #1131 | `screens/GameSelect.jsx`, `styles/03-slate-header.css`, `styles/69-hit-chart.css` † | — |
| `.hitchart__chip` | 5 | `.hitchart__btn` | #1131 | `components/charts/HitChart.jsx`, `styles/69-hit-chart.css` | — |
| `.idlab__chip` | 5 | `.idlab__btn` | #1131 | `screens/identity-lab/workbench/JerseyRack.jsx`, `styles/17-identity-lab-workbench.css` | — |
| `.leaguepicker__chip` | 5 | `.leaguepicker__btn` | #1131 | `components/winter/LeaguePicker.jsx`, `styles/03-slate-header.css`, `e2e/winter-tab.spec.js` | — |
| `.payboard__chip` | 5 | `.payboard__btn` | #1131 | `components/salaries/SalaryBoard.jsx`, `styles/71-salaries-league.css` | — |
| `.rankstrip__chip` | 5 | `.rankstrip__btn` | #1131 | `components/teamstats/TeamScoreCard.jsx`, `styles/28-team-hub.css` | — |
| `.refbar__chip` | 5 | `.refbar__btn` | #1131 | `components/inning/focus/ReferencePanel.jsx`, `styles/focus/reference.css` | — |
| `.slate-filterbar__chip` | 5 | `.slate-filterbar__btn` | #1131 | `screens/GameSelect.jsx`, `styles/22-box-score-tables.css` | — |
| `.spray__chip` | 5 | `.spray__btn` | #1131 | `components/charts/SprayMap.jsx`, `styles/73-spray-map.css` | — |
| `.trrank__chip` | 5 | `.trrank__btn` | #1131 | `screens/SituationalRecordsPage.jsx`, `styles/66-situational-records.css` | — |
| `.xl__chip` | 5 | `.xl__btn` | #1131 | `screens/expresslane/ExpressLanePage.jsx`, `styles/77-express-lane.css` | — |
| `.daystate__chip--live-on` | 4, 5 | `.daystate__btn.is-on` | #1131 | `screens/GameSelect.jsx`, `styles/03-slate-header.css`, `styles/46-consent-modal.css` †, `scripts/check-seal-scope.mjs` | applied as `${scoresUnlocked ? ' daystate__chip--live-on' : ''}`. The rename edits `scripts/check-seal-scope.mjs`, which allowlists it by name (ADR-0083) — and the new entry is the compound pair. A bare `.is-on` there would widen a spoiler-scope exception from one named selector to every `.is-on` rule in that file. |
| `.slate-filterbar__chip--active` | 4, 5 | `.slate-filterbar__btn.is-active` | #1131 | `screens/GameSelect.jsx`, `styles/22-box-score-tables.css` | — |
| `.cmdmap__chip--on` | 4, 5 | `.cmdmap__btn.is-on` | #1131 | `components/charts/CommandMap.jsx`, `components/charts/GloveTarget.jsx`, `styles/26d-command-map.css` | — |
| `.idlab__chip--on` | 4, 5 | `.idlab__btn.is-on` | #1131 | `screens/identity-lab/workbench/JerseyRack.jsx`, `styles/17-identity-lab-workbench.css` | — |
| `.spray__chip--on` | 4, 5 | `.spray__btn.is-on` | #1131 | `components/charts/SprayMap.jsx`, `styles/73-spray-map.css` | — |
| `.pitcherhandoff__chip--open` | 4 | `.pitcherhandoff__chip.is-open` | #1131 | `styles/12-sealbox.css` | no literal call site — `PitcherHandoffCard.jsx` builds the name as `` `pitcherhandoff__chip--${bookOpen ? "open" : "closed"}` ``, so a grep-driven rename misses it and the rule silently stops applying. `--closed` moves with it. |
| `.index-group__badge` | — (for #1114) | hold | #1131 | 1 file — none move | HOLD — `badge` is not one of clause 1's eight shape words, so no clause reaches this class. It is recorded because it draws the pill shape and #1114 counts shapes, not words. It is also the same surface as `.cta__go`: server-rendered landing copy styled from `public/learn.css`. |

## SectionHead and Card — #1113 — 87 rows

Twenty-nine blocks carry `card` without owning the base rule for it.
`.thub-card` and `.gamecard` draw their own box and are not rows. Twelve blocks
carry `sheet` without owning the base rule for it; `.sheet` owns it and is not a
row. They ride with #1113 because `Card`'s `frame="sheet"` is the one rule the
word will name, and two of them already have `__eyebrow` rows here. The other
forty-six rows are the head: four titles, thirty-nine second lines that
become `__note`, one eyebrow retired, one orphan deleted, and one row
#1113 must name.

| current class | clause(s) broken | target name | collapse issue | files that must move | hold + reason |
| --- | --- | --- | --- | --- | --- |
| `.advcard` | 1, 2 | `.adv` | #1113 | `components/player/AdvancedStatsCard.jsx`, `screens/designlab/catalog.js`, `styles/26-player-page.css` | — |
| `.ballparkcard` | 1, 2 | `.ballpark` | #1113 | `screens/designlab/blocks.jsx`, `screens/designlab/catalog.js`, `screens/team/modules/ballpark/BallparkCard.jsx`, `styles/57-ballpark-card.css` | — |
| `.chalcard` | 1, 2 | `.chal` | #1113 | `screens/designlab/blocks.jsx`, `screens/designlab/catalog.js`, `screens/team/modules/TeamChallengeCard.jsx`, `styles/report/challenge-card.css` | — |
| `.foulcard` | 1, 2 | `.foul` | #1113 | `components/playerstats/FoulCard.jsx`, `screens/designlab/catalog.js`, `styles/26-player-page.css` | — |
| `.horizoncard` | 1, 2 | `.horizon` | #1113 | `screens/designlab/blocks.jsx`, `screens/designlab/catalog.js`, `screens/team/modules/minors/DepthChartCard.jsx`, `screens/team/modules/minors/HorizonCard.jsx`, `styles/31-wild-card.css` | — |
| `.rvcard` | 1, 2 | `.rv` | #1113 | `components/playerstats/RunValueCard.jsx`, `screens/designlab/blocks.jsx`, `screens/designlab/catalog.js`, `screens/team/modules/TeamRunValueCard.jsx`, `styles/75-run-value.css`, `styles/report/challenge-card.css` † | two-step — `.rv` is NOT a free name. It is already the Run Value page's namespace (`rv__board`, `rv__num`, `rv__nameplate`, `rv__controls`, `rv__who`, `rv__pos`, `rv__face`), and both families live in `styles/75-run-value.css`, which `TeamRunValueCard.jsx` already draws from. No element name overlaps today, so the rename does not break on the day it lands — but two unrelated components then share one namespace in one file, and the next element added to either collides in silence. Give the card its own name, or move the page's rules out first. |
| `.abscard` | 1 | `.absframe` | #1113 | `components/gamehud/StatBox.jsx`, `screens/designlab/catalog.js`, `styles/12-sealbox.css`, `styles/25-wide-layout.css` | two-step — `.abs` is already the ABS block this one frames, so the target may not be `.abs`. |
| `.contractcard` | 1 | `.contract` | #1113 | `components/playerstats/PlayerContractCard.jsx`, `screens/designlab/catalog.js`, `styles/01-base.css` †, `styles/26b-player-contract.css`, `styles/26e-contract-history.css` †, `scripts/check-seal-scope.mjs` | the rename edits `scripts/check-seal-scope.mjs`, which allowlists `.contractcard__openzone` and `.contractcard__seg--option` by name (ADR-0083). |
| `.derbycard` | 1 | `.gamecard--derby` | #1113 | `components/allstar/DerbyCard.jsx`, `screens/designlab/catalog.js`, `styles/06-loader-and-cards.css` | — |
| `.flipcard` | 1 | `.flipstage` | #1113 | `components/ui/FlipCard.jsx`, `screens/designlab/catalog.js`, `screens/designlab/components.jsx`, `styles/22-box-score-tables.css`, `src/tokens/effects.css` † | — |
| `.gamecardstack` | 1 | `.slate__stack` | #1113 | `components/game/GameCard.jsx`, `screens/animlab/motionDemos.jsx`, `styles/06-loader-and-cards.css`, `styles/motion/slate.css`, `e2e/wire-rail.spec.js` | clause 6 does not reach this row: `card` sits inside `gamecardstack` as a substring, not as the whole name, a suffix or a hyphen-delimited segment, so #1114's guard will not reproduce it. The rename is worth doing for the reader, and #1113 carries it as a judgment, not as a guard finding. |
| `.lineupcard` | 1 | `.entering` | #1113 | `components/inning/EnteringReference.jsx`, `components/scoring/StruckLine.jsx` †, `screens/designlab/catalog.js`, `styles/12-sealbox.css`, `styles/46-consent-modal.css`, `styles/focus/atbat.css` †, `styles/focus/reference.css`, `styles/motion/strike.css`, `scripts/check-seal-scope.mjs` | the rename edits `scripts/check-seal-scope.mjs`, which allowlists `.lineupcard__title` by name (ADR-0083). |
| `.metriccard` | 1 | `.metric` | #1113 | `components/game/GamePhotosStrip.jsx`, `components/teamstats/BullpenBoard.jsx`, `components/teamstats/SeasonSeriesStrip.jsx`, `screens/designlab/catalog.js`, `screens/FoulTrackerPage.jsx`, `screens/TeamInfo.jsx`, `styles/09-team-info.css` †, `styles/43-foul-tracker.css`, `styles/44-pre-game-cards.css` | — |
| `.moundcard` | 1 | `.mound` | #1113 | `components/playerstats/PitcherWorkloadCard.jsx`, `screens/designlab/catalog.js`, `styles/26c-mound-card.css` | — |
| `.offdaycard` | 1 | `.offday__tile` | #1113 | `components/team/OffDaySection.jsx`, `screens/designlab/catalog.js`, `styles/06b-offday-cards.css` | — |
| `.phcard` | 1 | `.playerpop` | #1113 | `components/player/PlayerHoverCard.jsx`, `screens/designlab/catalog.js`, `screens/designlab/Entry.jsx` †, `screens/team/modules/minors/HorizonCard.jsx` †, `styles/31-wild-card.css` †, `styles/72-player-hover-card.css`, `styles/designlab/lab.css` †, `e2e/scorecard.spec.js`, `scripts/check-file-size.mjs` | — |
| `.playercard` | 1 | `.playerline` | #1113 | `components/CLAUDE.md`, `components/game/GameResultFace.jsx`, `components/gamehud/StatBox.jsx`, `components/player/PerformerCard.jsx`, `src/index.css` †, `screens/AwardsHistoryPage.jsx`, `screens/BoxScore.jsx`, `screens/designlab/catalog.js`, `screens/designlab/components.jsx`, `screens/player/PlayerAnalyticsTab.jsx`, `styles/12-sealbox.css`, `styles/21-box-score.css` †, `styles/22-box-score-tables.css`, `styles/23-box-score-detail.css` †, `styles/25-wide-layout.css`, `styles/31-wild-card.css` †, `styles/33-awards-history.css`, `styles/51-similar-players.css` †, `e2e/invariants/name-tag-wrap.spec.js` | — |
| `.prospectcard` | 1 | `.prospect` | #1113 | `components/playerstats/ProspectCard.jsx`, `screens/designlab/catalog.js`, `styles/31d-prospect-card.css` | — |
| `.pswscard` | 1 | `.psws` | #1113 | `screens/designlab/blocks.jsx` †, `screens/designlab/catalog.js`, `screens/PostseasonHistoryPage.jsx`, `styles/34-postseason.css` | — |
| `.rehabcard` | 1 | `.rehab` | #1113 | `screens/designlab/catalog.js`, `screens/RehabPage.jsx`, `styles/26-player-page.css` †, `styles/31-wild-card.css`, `styles/47-trade-deadline.css` † | — |
| `.seedcard` | 1 | `.seed` | #1113 | `src/index.css` †, `screens/designlab/blocks.jsx` †, `screens/designlab/catalog.js`, `screens/PostseasonHistoryPage.jsx`, `screens/PostseasonRacePage.jsx`, `styles/34-postseason.css`, `styles/70-postseason-race.css`, `e2e/postseason-race.spec.js`, `scripts/check-dir-size.mjs` † | — |
| `.startercard` | 1 | `.starter` | #1113 | `components/boxlines/BoxLinesDoor.jsx` †, `components/CLAUDE.md`, `screens/designlab/catalog.js`, `screens/TeamInfo.jsx`, `styles/02-wordmark-lab.css`, `styles/10-lineup.css`, `styles/21a-box-score-stars.css` †, `styles/25-wide-layout.css`, `styles/26-player-page.css` †, `styles/44-pre-game-cards.css`, `styles/69-pitch-arsenal.css` †, `styles/boxlines/boxlines.css` † | — |
| `.teammatecard` | 1 | `.teammate` | #1113 | `components/player/PerformerCard.jsx` †, `screens/designlab/catalog.js`, `screens/TeamInfo.jsx`, `styles/10-lineup.css`, `styles/22-box-score-tables.css` † | — |
| `.tradecard` | 1 | `.trade` | #1113 | `components/transactions/TradeCard.jsx`, `screens/designlab/catalog.js`, `styles/01-base.css` †, `styles/47-trade-deadline.css`, `styles/51-similar-players.css` † | — |
| `.tstats-card` | 1 | `.tstats` | #1113 | `screens/designlab/catalog.js`, `screens/team/modules/ComebackCard.jsx`, `screens/team/modules/records/LastTimeCard.jsx`, `screens/team/modules/records/RecordsCard.jsx`, `screens/team/modules/RosterProjection.jsx` †, `screens/team/modules/TeamStatsCard.jsx`, `styles/09-team-info.css`, `styles/31-wild-card.css`, `styles/65-team-records.css` †, `scripts/check-dir-size.mjs` † | two-step — `.tstats` is the grid inside this card today, and becomes `.tstats__grid` in the same commit. |
| `.txcard` | 1 | `.txrow` | #1113 | `components/transactions/TeamTransactionsCard.jsx`, `screens/designlab/catalog.js`, `styles/09-team-info.css` †, `styles/28-team-hub.css` †, `styles/29-team-transactions.css`, `styles/30-standings.css` †, `styles/44-pre-game-cards.css` †, `styles/72-club-transactions.css` † | — |
| `.scorecard` | 1 | hold | #1113 | 86 files — none move | HOLD — the scoring grid, 13 custom properties read by 39 modules including `src/api/`. `inventory.md` puts it on the bespoke list: leave it alone and rename nothing about it. |
| `.stampcard` | 1 | hold | #1113 | 5 files — none move | HOLD — a stamp IS a final score. `scripts/check-stamp-surfaces.mjs` tracks the JS identifiers `GameStamp`/`StampGameButton`/`useStamps`, NOT this CSS class, so a rename passes lint in silence. The hold rests on ADR-0035, which contains stamps by WHERE the art may render; a shared name any surface may take is what that ADR prevents. |
| `.tally-cl-card` | 1 | hold | #1113 | 4 files — none move | HOLD — this class is handed to Clerk's `appearance` API from `lib/clerkAppearance.js` and every declaration is `!important` because it overrides a third party's stylesheet. No Clerk key exists in a local checkout, so the rename cannot be verified before it ships. |
| `.erasesheet` | 1, 2 | `.erase` | #1113 | `components/profile/EraseDataDialog.jsx`, `styles/54-my-tally.css`, `styles/55-my-tally-account.css`, `e2e/my-tally.spec.js`, `test/button-placement.test.js` | Also a namespace: its one bare selector is the descendant scope `#root .erasesheet .caps-exempt`, and the box is `.sheet`'s. The rename edits `test/button-placement.test.js`, which pins `.erasesheet__btn` by name (#1166). |
| `.introsheet` | 1, 2 | `.intro` | #1113 | `components/account/AccountPitch.jsx`, `components/account/FavoriteTeamModal.jsx`, `styles/56-my-tally-intro.css`, `e2e/intro-two-step.spec.js` | Also a namespace: its one bare selector is the descendant scope `#root .introsheet .caps-exempt`. It rides as a co-class on `.favteamsheet`, which draws the box. The `.introsheet__eyebrow` row below moves with it, so that target becomes `.intro__note`. |
| `.bpsheet` | 1 | `.parkfacts` | #1113 | `components/ballpark/BallparkModal.jsx`, `screens/team/modules/ballpark/BallparkCard.jsx`, `styles/39-manager-page.css`, `styles/57-ballpark-card.css` † | not `.ballpark` — that is `.ballparkcard`'s target in this same issue. `BallparkCard.jsx` already wears `.bpsheet__facts` and `.bpsheet__ranks`: the elements are the park's facts, shared by the card and the modal, and that is the job. |
| `.brewsheet` | 1 | `.brew` | #1113 | `components/game/WhatsBrewingModal.jsx`, `styles/11-innings.css` | — |
| `.favteamsheet` | 1 | `.favteam` | #1113 | `components/account/FavoriteTeamModal.jsx`, `screens/GameView.jsx` †, `styles/01-base.css` †, `styles/08-site-shell.css`, `styles/56-my-tally-intro.css` † | it does not wear `.sheet`; it draws its own box in `08-site-shell.css`. |
| `.gamefindersheet` | 1 | `.gamefinderframe` | #1113 | `components/game/GameFinderModal.jsx`, `styles/08-site-shell.css` | two-step — `.gamefinder` is NOT a free name. It is the finder's own block (`GameFinder.jsx`, `08-site-shell.css`), which this sheet wraps, so the target may not be `.gamefinder`. Same case as `.abscard`. |
| `.hlsheet` | 1 | `.hlview` | #1113 | `components/highlights/SaveClipButton.jsx`, `components/playbyplay/HighlightSheet.jsx`, `styles/40-game-modals.css`, `e2e/inning-modal-stacking.spec.js`, `e2e/invariants/spoiler-dom.spec.js` | `e2e/invariants/spoiler-dom.spec.js` names it. That spec is a spoiler invariant and is not CI-gated, so ask Gary to run it after the rename; lint does not see it. |
| `.printsheet` | 1 | `.printpage` | #1113 | `screens/sheet/ScoreSheet.jsx`, `styles/63-print-sheet.css`, `e2e/print-sheet.spec.js` | the printable scorecard. #1132 leaves `scorecard/*` bespoke, and this block is not in it: its rules are its own partial, and a rename flattens nothing. |
| `.sc-editsheet` | 1 | `.sc-edit` | #1113 | `components/scoring/ScorecardCellEditor.jsx`, `styles/scorecard/page.css`, `e2e/scorecard.spec.js` | the scorecard's cell editor, a modal on `.sheet` — not the grid, so the `.scorecard` hold does not reach it. |
| `.sitemenusheet` | 1 | `.sitemenu` | #1113 | `components/account/AdminMenuLink.jsx`, `components/chrome/SiteMenu.jsx`, `styles/08-site-shell.css`, `styles/08a-site-menu.css`, `e2e/site-directory.spec.js` | NOT a namespace, although #1155 reported one: `.sheet.sitemenusheet` in `08a-site-menu.css` is a rule on the block itself, so clause 2 does not apply. The `.sitemenusheet__eyebrow` row below moves with it, so that target becomes `.sitemenu__note`. |
| `.stampsheet` | 1 | `.stampset` | #1113 | `components/logbook/StampSheet.jsx`, `styles/48c-stamp-sheet.css`, `styles/48d-stamp-detail.css` † | a sheet of stamps, not the modal shape. The `.stampcard` hold does not reach a rename to a name no other surface takes: `scripts/check-stamp-surfaces.mjs` names no CSS class, and ADR-0035 contains the art by where it renders. |
| `.sc-sheet` | 1 | hold | #1113 | 5 files — none move | HOLD — the scoring grid's own `<table>` (`ScorecardSheet.jsx`, `styles/scorecard/grid.css`). The `.scorecard` hold covers it: the grid is bespoke and nothing about it is renamed. #1132 also leaves `scorecard/*` bespoke by name, as "the sheet you score on". |
| `.awardord__hd` | 3 | `.awardord__title` | #1113 | `components/admin/AwardOrderEditor.jsx`, `styles/45-admin-copy-editor.css` | — |
| `.coverpick__heading` | 3 | `.coverpick__title` | #1113 | `components/passport/BookCoverPicker.jsx`, `styles/60-book-cover-picker.css` | — |
| `.gamelines__heading` | 3 | `.gamelines__title` | #1113 | `components/playerstats/GameLinesCard.jsx`, `styles/boxlines/gamelines.css`, `e2e/box-lines.spec.js` | — |
| `.lookupdeck__heading` | 3 | `.lookupdeck__title` | #1113 | `components/admin/contracts/LookupDeck.jsx`, `styles/74a-contract-lookup.css` | — |
| `.abouthero__kicker` | 3 | `.abouthero__note` | #1113 | `screens/AboutPage.jsx`, `styles/65-about-page.css` | two-step — `.abouthero__lede` also lands on `.abouthero__note`. This line is "Keep score. Keep the surprise.", which is copy, not the block's name. |
| `.boxlines__kicker` | 3 | `.boxlines__note` | #1113 | `components/boxlines/BoxLinesSheet.jsx`, `screens/animlab/motionDemos.jsx`, `styles/boxlines/boxlines.css`, `e2e/box-lines.spec.js` | the line is built — `` `Game lines · ${picked.name}` ``, defaulting to the `kicker` prop. `BoxLinesSheet.jsx` says the kicker titles the sheet. |
| `.scorebookstory__kicker` | 3 | `.scorebookstory__note` | #1113 | `screens/FirstScorebookPage.jsx`, `styles/42-first-scorebook.css` | holds "The 22 Scorebook" above `<h1>My First Scorebook</h1>` — a second line, not the title again. |
| `.tscoremodal__kicker` | 3 | `.tscoremodal__note` | #1113 | `components/teamstats/TeamScoreExplainer.jsx`, `styles/40-game-modals.css` | holds "How We Score It" above the modal's own question-form title. |
| `.wire__kicker` | 3 | #1113 names it | #1113 | `components/transactions/MoveRow.jsx`, `styles/04-site-bar.css`, `styles/25-wide-layout.css` | NOT the head's second line — this is a `<div>` that holds the move banner, the club link, the club mark and the type label. Clause 3 rejects the word `kicker`, but `__note` is the wrong target for a meta row. Judge it with the `Card` work. |
| `.bcast__eyebrow` | 3 | `.bcast__note` | #1113 | `components/around-the-game/BroadcastMasthead.jsx`, `styles/68-around-the-game.css` | a container, not a text line: it holds `.bcast__strand`, `.bcast__slash` and a dynamic `eyebrow`, and renders only when `strand` is set. |
| `.betweeninnings__eyebrow` | 3 | retired — the line repeats the block's name | #1113 | `components/gamehud/BetweenInnings.jsx`, `styles/focus/console.css` | the one row of the twenty where the verdict holds: the line is "Between Innings" inside `.betweeninnings`. The other nineteen carry copy, data or a prop, and each says what it holds. |
| `.contractcard__eyebrow` | 3 | `.contract__note` | #1113 | `components/playerstats/PlayerContractCard.jsx`, `styles/26b-player-contract.css` | moves with its block — see the `.contractcard` row. Holds "Player compensation" above `<h2>Contract</h2>`. |
| `.derbycard__eyebrow` | 3 | `.gamecard__note` | #1113 | `components/allstar/DerbyCard.jsx`, `styles/06-loader-and-cards.css` | two-step — `.derbycard__sub` also lands on `.gamecard__note`. This line is "All-Star Break". Moves with its block; see the `.derbycard` row. |
| `.guidelink__eyebrow` | 3 | `.guidelink__note` | #1113 | `components/chrome/GuideLink.jsx`, `styles/08a-site-menu.css` | renders a prop, `eyebrow = 'New to this?'`, so it has no fixed text to be redundant with. |
| `.hitchart__eyebrow` | 3 | `.hitchart__note` | #1113 | `components/charts/HitChart.jsx`, `styles/69-hit-chart.css` | renders `eyebrow ?? venue` — a ballpark name. |
| `.introsheet__eyebrow` | 3 | `.introsheet__note` | #1113 | `components/account/FavoriteTeamModal.jsx`, `styles/56-my-tally-intro.css`, `e2e/intro-two-step.spec.js` | holds the step indicator, "Step 1 · Your club" or "Step 2 · Your scorebook". The rule for when it renders is documented at the call site. |
| `.logbooklanding__eyebrow` | 3 | `.logbooklanding__note` | #1113 | `components/account/LogbookLanding.jsx`, `styles/50-logbook-landing.css` | two-step — `.logbooklanding__lede` also lands on `.logbooklanding__note`, and this class renders TWO different lines: "The one place that is yours" and "One game starts the book". |
| `.researchdiary__eyebrow` | 3 | `.researchdiary__note` | #1113 | `screens/contenders/ContenderDiaryPage.jsx`, `screens/research/ResearchDiaryPage.jsx`, `styles/research/diary.css` | two-step — `.researchdiary__lede` also lands on `.researchdiary__note`. This line is "Working notebook", above the diary's own title. |
| `.sitemenusheet__eyebrow` | 3 | `.sitemenusheet__note` | #1113 | `components/chrome/SiteMenu.jsx`, `styles/08a-site-menu.css` | holds "Tally Baseball" — the app's name, not the block's. |
| `.stampstrip__eyebrow` | 3 | `.stampstrip__note` | #1113 | `components/logbook/StampGameButton.jsx`, `styles/48-stamp-strip.css` | two-step — `.stampstrip__lede` also lands on `.stampstrip__note`, and today's `.stampstrip__note` becomes `.stampstrip__label`. Three classes reach one name: see the `.stampstrip__lede` row. |
| `.szmodal__eyebrow` | 3 | `.szmodal__note` | #1113 | `components/scoring/StrikeZone.jsx`, `styles/14-strike-zone.css` | holds "Pitch zone". The slot beside it holds the batter's name, so this is the only line that says what the modal is. |
| `.trrank__eyebrow` | 3 | `.trrank__note` | #1113 | `screens/SituationalRecordsPage.jsx`, `styles/66-situational-records.css` | renders `{season} {SPORT_LABEL[sportId]} season` — data, not a fixed line. |
| `.umpmodal__eyebrow` | 3 | `.umpmodal__note` | #1113 | `components/umpire/UmpireAccuracyModal.jsx`, `styles/14-strike-zone.css` | holds "Plate accuracy" beside the umpire's name, the same shape as `.szmodal__eyebrow`. |
| `.wordmarklab__eyebrow` | 3 | `.wordmarklab__note` | #1113 | `screens/WordmarkLab.jsx`, `styles/02-wordmark-lab.css` | renders FIVE different lines on one page, among them "Selected direction", "Live comparison" and "My read". |
| `.cover__sub` | 3 | delete | #1113 | `styles/12-sealbox.css`, `scripts/check-seal-scope.mjs` | DELETE, do not rename — this rule has had no call site since `05ba45bdf` (2026-07-06) removed `<span className="cover__sub">` from `SealBox.jsx`. `scripts/check-seal-scope.mjs` still allowlists it: its reach assertion checks that the SELECTOR is still in the stylesheet, not that anything renders it, so an orphan passes. The allowlist entry goes with the rule. |
| `.cthist__sub` | 3 | `.cthist__note` | #1113 | `components/player/ContractHistoryLedger.jsx`, `styles/01-base.css` †, `styles/26e-contract-history.css` | — |
| `.derbycard__sub` | 3 | `.gamecard__note` | #1113 | `components/allstar/DerbyCard.jsx`, `styles/06-loader-and-cards.css` | moves with its block — `.derbycard` becomes `.gamecard--derby`, so its parts become `.gamecard`'s. See the `.derbycard` row. |
| `.leaders__sub` | 3 | `.leaders__note` | #1113 | `screens/LeadersPage.jsx`, `styles/23-box-score-detail.css` | — |
| `.mgrpage__sub` | 3 | `.mgrpage__note` | #1113 | `screens/ManagerPage.jsx`, `styles/39-manager-page.css` | — |
| `.psoddsmodal__sub` | 3 | `.psoddsmodal__note` | #1113 | `components/teamstats/PostseasonOddsModal.jsx`, `styles/39-manager-page.css` | — |
| `.rpt__sub` | 3 | `.rpt__note` | #1113 | `components/around-the-game/ClubCell.jsx`, `components/around-the-game/RunValueParts.jsx` †, `screens/around-the-game/abs/LongestRuns.jsx`, `screens/around-the-game/abs/PlayerBoards.jsx`, `screens/around-the-game/abs/RanOut.jsx`, `screens/around-the-game/abs/UmpireBoard.jsx`, `screens/around-the-game/abs/WhoCalls.jsx`, `screens/around-the-game/AttendancePage.jsx`, `screens/around-the-game/BullpenPage.jsx`, `screens/around-the-game/FarmSystemPage.jsx`, `screens/around-the-game/PacePage.jsx`, `screens/around-the-game/RunDifferentialPage.jsx`, `styles/68-around-the-game.css`, `styles/report/charts.css` †, `styles/report/chrome.css` | — |
| `.searchbox__sub` | 3 | `.searchbox__note` | #1113 | `components/team/TeamSearchBox.jsx`, `styles/08-site-shell.css` | — |
| `.searchoverlay__sub` | 3 | `.searchoverlay__note` | #1113 | `components/chrome/SiteSearch.jsx`, `styles/08-site-shell.css` | — |
| `.split__sub` | 3 | `.split__note` | #1113 | `screens/player/PlayerHistoryTab.jsx`, `styles/26-player-page.css` | — |
| `.umptend__sub` | 3 | `.umptend__note` | #1113 | `components/umpire/UmpireTendencies.jsx`, `styles/53-umpire-tendencies.css` | — |
| `.abouthero__lede` | 3 | `.abouthero__note` | #1113 | `screens/AboutPage.jsx`, `styles/65-about-page.css` | — |
| `.admincopy__lede` | 3 | `.admincopy__note` | #1113 | `screens/AdminCopy.jsx`, `styles/01-base.css` †, `styles/45-admin-copy-editor.css`, `styles/46-consent-modal.css` | — |
| `.clubsseen__lede` | 3 | `.clubsseen__note` | #1113 | `components/logbook/ClubsSeen.jsx`, `styles/48-logbook.css` | — |
| `.dlab__lede` | 3 | `.dlab__note` | #1113 | `screens/designlab/blocks.jsx`, `screens/designlab/Entry.jsx`, `screens/designlab/index.jsx`, `styles/designlab/lab.css` | two-step — `.dlab__note` is an ENTRY's note under this page-level lede, and becomes `.dlabentry__note` in the same commit. |
| `.foulavg__lede` | 3 | `.foulavg__note` | #1113 | `screens/FoulTrackerPage.jsx`, `styles/43-foul-tracker.css` | — |
| `.logbooklanding__lede` | 3 | `.logbooklanding__note` | #1113 | `components/account/LogbookLanding.jsx`, `styles/50-logbook-landing.css` | — |
| `.note__lede` | 3 | `.note__note` | #1113 | `components/offseason/LongAtBats.jsx`, `components/offseason/YoungestRegulars.jsx`, `styles/78-offseason.css` | — |
| `.researchdiary__lede` | 3 | `.researchdiary__note` | #1113 | `screens/contenders/ContenderDiaryPage.jsx`, `screens/research/ResearchDiaryPage.jsx`, `styles/research/diary.css` | — |
| `.stampin__lede` | 3 | `.stampin__note` | #1113 | `screens/team/StampInPage.jsx`, `styles/59-stamp-in.css` | — |
| `.stampstrip__lede` | 3 | `.stampstrip__note` | #1113 | `components/logbook/StampGameButton.jsx`, `styles/48-stamp-strip.css` | two-step — `.stampstrip__note` is a form `<label>`, and becomes `.stampstrip__label` in the same commit. |
| `.xl-entry__lede` | 3 | `.xl-entry__note` | #1113 | `screens/expresslane/EntryChooser.jsx`, `styles/01-base.css` †, `styles/77a-express-lane-entry.css` | — |

## Table, EmptyState and Notice — #1132 — 10 rows

Two blocks carry `notice`; no block owns the `notice` base rule today, and
#1132 builds one. Six states are written as modifiers, and two `__sub`
classes are held because clause 3 does not reach them.

| current class | clause(s) broken | target name | collapse issue | files that must move | hold + reason |
| --- | --- | --- | --- | --- | --- |
| `.delaycard` | 1 | `.notice--delay` | #1132 | `components/inning/DelayCard.jsx`, `screens/designlab/catalog.js`, `styles/27-player-position-innings.css`, `styles/46-consent-modal.css` | — |
| `.pitchernotice` | 1 | `.notice--pitcher` | #1132 | `src/CLAUDE.md`, `components/playbyplay/BatterNotice.jsx`, `components/playbyplay/EventCards.jsx`, `components/playbyplay/FielderNotice.jsx`, `components/playbyplay/PinchRunNotice.jsx`, `components/playbyplay/PitcherHandoffCard.jsx`, `components/playbyplay/PitcherNotice.jsx`, `styles/01-base.css` †, `styles/12-sealbox.css`, `styles/13-play-by-play.css`, `styles/21a-box-score-stars.css` †, `styles/focus/atbat.css`, `src/tokens/layout.css` † | no block owns the `notice` base rule today; #1132 builds one. This is the largest of the six and its 18 elements move with it. |
| `.umptend__row--on` | 4 | `.umptend__row.is-on` | #1132 | `components/umpire/UmpireTendencies.jsx`, `styles/53-umpire-tendencies.css` | — |
| `.dh__row--open` | 4 | `.dh__row.is-open` | #1132 | `screens/around-the-game/DoubleheadersPage.jsx`, `styles/68-around-the-game.css` | — |
| `.cwb__row--done` | 4 | `.cwb__row.is-done` | #1132 | `components/admin/contracts/DecisionPane.jsx`, `styles/74-contract-workbench.css` | — |
| `.posinn__box--empty` | 4 | `.posinn__box.is-empty` | #1132 | `components/player/PositionInnings.jsx`, `styles/27-player-position-innings.css` | — |
| `.xl-deck--empty` | 4 | `.xl-deck.is-empty` | #1132 | `screens/expresslane/ScoringDeck.jsx`, `styles/77c-express-lane-deck.css` | — |
| `.stampstrip__mount--empty` | 4 | `.stampstrip__mount.is-empty` | #1132 | `components/logbook/StampGameButton.jsx`, `styles/48-stamp-strip.css` | — |
| `.bs__sub` | 3 (does not apply) | hold | #1132 | 2 files — none move | HOLD — `__sub` here names a box-score SUBTOTAL row (`b.isSub`), not a head's second line, so clause 3 does not reach it. Renaming it to `.bs__row--subtotal` is #1132's Table work, not a grammar fix. |
| `.ledger__sub` | 3 (does not apply) | hold | #1132 | 4 files — none move | HOLD — `__sub` here names a subtotal CELL (`tr.reg-subtotal .ledger__sub`), not a head's second line, so clause 3 does not reach it. Renaming it to `.ledger__cell--subtotal` is #1132's Table work. |

