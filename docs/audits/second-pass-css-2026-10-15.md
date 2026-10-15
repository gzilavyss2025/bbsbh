# Second pass, Job A: CSS overlap — 2026-10-15

Report for issue #1837, "Job A: CSS overlap". It reads only. It changes no CSS,
no test and no guard.

Tags: **measured** means a script or command checked it. **inferred** means a
person read it and judged it. Base commit: `babfbbc2`.

Scratch scripts (not in the repo):
`/tmp/claude-0/-home-user-bbsbh/f70cfe12-b717-5a73-844d-d9faceaf853c/scratchpad/`
(`parse.mjs`, `dup.mjs`, `dup2.mjs`, `full.mjs`, `lab.mjs`, `dead2.mjs`,
`single.mjs`, `deadlines.mjs`, `partial.mjs`).

## Already handled, not repeated

- The ponytail audit of 2026-09-30 cut 26 dead rules in 12 partials. This pass
  found none of them again.
- `docs/design-system-naming.md`: I checked every "landed" row. No old name
  still has CSS and no JS use. The old names that survive in CSS
  (`.stampstrip__modes`, `.flipback__watchbtn`) have a live call site.
  So no ledger rename left a dead rule behind. (measured)

## Not findings: rules the guards already police

- `public/learn.css` repeats `:root`, `*`, `body` and `.masthead` on purpose.
  `check-learn-css.mjs` guards the colour copy.
- Card, sheet, ledger, pill and band recipes. `check-component-reuse.mjs` ratchets
  them (budgets 4, 3, 15, 1). I skipped 6 identical groups that are these shapes.
- Raw hex, radius, motion and shadow values. `check-raw-values.mjs` ratchets them.
- File length. `check-file-size.mjs` caps a file at 600 lines with a ceiling table.
  Cutting rules can drop a file under its ceiling. The guard then wants the
  entry removed in the same PR.
- `check-contrast.mjs` reads token pairs, not rule bodies. No overlap.

## Measured line counts

Tracked `.css` files, counted as lines.

| Scope | Files | Lines |
| --- | --- | --- |
| All tracked `.css` | 240 | 72,573 |
| minus `.scratch/` (3 files) | 237 | 72,300 |
| `src/styles/` (all) | 228 | 70,114 |
| `src/styles/*.css` (top level) | 112 | 46,932 |
| `src/styles/*/*.css` (subfolders) | 116 | 23,182 |
| `src/tokens/` | 6 | 1,007 |
| `public/learn.css` | 1 | 605 |
| `src/index.css` (imports) | 1 | 338 |
| `src/screens/**.css` | 1 | 236 |

Commands:

```
git ls-files '*.css' | xargs cat | wc -l
git ls-files '*.css' | grep -v '^\.scratch' | xargs cat | wc -l
git ls-files 'src/styles/*.css' | xargs cat | wc -l
git ls-files 'src/styles/*.css' | grep -v '^src/styles/[^/]*/' | xargs cat | wc -l
git ls-files 'src/styles/*.css' | grep '^src/styles/[^/]*/' | xargs cat | wc -l
```

Do not use `git ls-files '*.css' | xargs wc -l`. `xargs` splits the list and
prints several "total" lines. The last one is wrong.

The parser in `parse.mjs` blanks comments, reads nested `@media` blocks, and finds
9,046 rules in the 237 files.

## Q1. Same thing said twice

Whole rules that carry the same selector in two places: 64 groups (not counting
`:root`, `*`, `body`). 50 are across files, 14 are in one file. Most are normal
overrides: the declarations differ. Only 10 rules are exact copies. (measured)

Identical declaration blocks under different selectors: 59 groups with 4 or more
declarations and 3 or more copies, outside the guarded shapes. (measured)

## Q2. Classes in CSS that no JS names

6,190 class names appear in selectors. 428 are not named in any `src/**/*.js`
or `.jsx` file. The second search (full name, block prefix, template and `+`
fragments, `e2e/`, `test/`, `scripts/`, `api/`, `public/`, `index.html`, JSON)
saved 376 of them. 52 stay dead. (measured)

Of the 376 that survived, about 300 are modifier families built by interpolation
(for example `pitchmix__seg--${family}`, `command__cell--h${step}`). I kept
them alive. I did not check that every value of the variable produces a rule
that exists. (inferred, not checked)

## Findings, biggest saving first

### 1. Handwritten "label" type recipe, 125 copies — up to 769 lines (measured count, inferred route)

349 rules set `--font-display` + `--fs-label` + `--ls-label`. 26 groups of
those are whole-rule identical: 125 rules, 769 lines. The top groups:

- 18 rules: display, `--fs-label`, bold, caps, `--ls-label`, `--text-caption`.
  `12-sealbox.css:355`, `:625`, `:786`; `14-strike-zone.css:293`, `:404`;
  `21-box-score.css:608`; `28-team-hub.css:257`, `:270`;
  `35-postseason-series.css:311`; `38-umpire-pages.css:192`; `43-foul-tracker.css:645`;
  `71-salaries-league.css:296`; `78-offseason.css:999`; and 5 more.
  About 136 lines.
- 18 rules: same, semibold, no caps. `21-box-score.css:389`,
  `48a-logbook-stats.css:62`, `:118`, `:165`, `:197`; `58-logbook-shelf.css:359`;
  `63-print-sheet.css:159`, `:342`; `scorecard/page.css:82`, `:212`, `:334`,
  `:395`; and 6 more. About 119 lines.
- 11 rules: display, `--fs-label`, `--ls-label`, `--text-caption`. About 60 lines.

`.t-label` already exists (`src/tokens/typography.css:158`) with the same
recipe. It has one JSX user (`GameCardParts.jsx:63`). `src/styles/CLAUDE.md:35`
already calls the recipe `.t-label`. Fix: add `t-label` to the elements and
delete the rules. This needs JSX edits in about 100 files.
A selector list in one shared file is not safe: a later partial may override a
rule that sits between, and the cascade order changes.

### 2. Other identical blocks — up to 939 lines, 41 groups (measured count, inferred route)

Same method, excluding the label recipe and the guarded shapes. The biggest:

| Lines | Copies | What | Where |
| --- | --- | --- | --- |
| 54 | 10 | flex row, baseline, space-between, gap (sheet and modal heads) | `11-innings.css:93`, `39-manager-page.css:264`, `:484`, `40-game-modals.css:164`, `46-consent-modal.css:121`, `48d-stamp-detail.css:19`, `67-awards-ledger.css:62`, `:243`, `75-run-value.css:230`, `postseason/home.css:86` |
| 48 | 9 | flex column, gap 2px, `min-width: 0` | `10b-former-teammates.css:262`, `12-sealbox.css:1066`, `14-strike-zone.css:398`, `20-charts.css:165`, `21-box-score.css:817`, `22-box-score-tables.css:702`, `35-postseason-series.css:397`, `48a-logbook-stats.css:266`, `focus/console.css:407` |
| 44 | 5 | close button, 9 identical declarations | `11-innings.css:104`, `39-manager-page.css:275`, `:495`, `40-game-modals.css:251`, `48d-stamp-detail.css:30` |
| 36 | 5 | dismiss button, 7 identical declarations | `03-slate-header.css:557`, `04-site-bar.css:257`, `:298`, `08-site-shell.css:713`, `50-logbook-landing.css:80` |
| 36 | 7 | flex row, centre, gap, wrap (`.cluster` shape) | `05-masthead-nav.css:351`, `22-box-score-tables.css:175`, `lineup-next/page.css:329`, `focus/atbat.css:88`, and 3 more |
| 36 | 7 | absolute fill (`inset: 0`, 100% by 100%) | `10-lineup.css:533`, `22-box-score-tables.css:547`, `31-wild-card.css:697`, `54-my-tally.css:127`, `71-salaries-league.css:268`, `focus/atbat.css:180`, `player-next/both/innings.css:22` |
| 36 | 7 | photo fill (`object-fit: cover`) | `14-strike-zone.css:791`, `21-box-score.css:77`, `29-team-transactions.css:670`, `44-pre-game-cards.css:345`, `52-highlight-clip-card.css:90`, `player-next/history/highlights.css:12`, `player-next/history/photos.css:32` |
| 32 | 3 | position badge, 14 identical declarations | `22-box-score-tables.css:686`, `31-wild-card.css:706`, `:943` |
| 30 | 3 | scroll track, 13 identical declarations | `29-team-transactions.css:396`, `:633`, `52-highlight-clip-card.css:288` |

The flex rows and the column are the shapes of `system/cluster.css` and
`system/stack.css`. The close and dismiss rules are the same fix as the dialog
plumbing in ponytail finding A2.1 (issue #1308): the JS and the CSS repeat
together. The saving counts one copy kept per group. A real fix keeps some
placement declarations, so expect about half. (inferred)

### 3. Dead rules of the old lineup and team-info page — 296 lines, 57 rules (measured)

No JS, JSX, e2e, script, `api/` or JSON file applies these 52 classes. Exact
block names `teaminfo`, `starter` and `sechead` have no use either. The
ledger says `.startercard` became `.starter` in #1262, but no JSX renders
it now. The lineup page moved to `lineup/next`.

| File | Lines | Rules (first line) |
| --- | --- | --- |
| `10-lineup.css` | 96 | `.name-cake` 140, `.starter__body` 150 through `.starter__sheet .btn` 266 (17 rules) |
| `09-team-info.css` | 50 | `.teaminfo` 3, `__head` 7, `.is-themed` rules 35-55, `__headright` 202, `__name` 209, `__side` 219, `__facts` 263 |
| `25-wide-layout.css` | 30 | `.teaminfo__lineupdefense` 345-353, `.starter__body` 359, `__info` 362, `__mix` 365-380 |
| `team-info/uniform-figure.css` | 17 | `.fact__figure` 6, `.fact__figure > .fact__shirt` 15, `.ufig__text` 49 |
| `03-slate-header.css` | 16 | `.topbar--game` 270, `.topbar__match` 286 |
| `39-manager-page.css` | 19 | `.fact__link` 235, `:focus-visible` 250 |
| `src/tokens/typography.css` | 24 | `.t-page-title` 134, `.t-section-title` 140, `.t-body` 146, `.t-prose` 152 |
| `12-sealbox.css` | 8 | `.favormeter__tier` 654 |
| `21-box-score.css` | 7 | `.bs__avg` 477, `.bs__ps` 480 |
| `scorecard/grid.css` | 7 | `.sc-sheet__ptlLabel` 345 |
| `src/tokens/effects.css` | 7 | `.paper-grid` 181 |
| `43-foul-tracker.css` | 4 | `.sgh-shot--lg` 550 |
| `pitcher-card/card.css` | 4 | `.pcard .fill--{fastball,breaking,offspeed,other}` 192-195 |
| `77-express-lane.css` | 3 | `.xl__body` 353 |
| `player-next/batter/form.css` | 3 | `.fform > .section-head` 88 (`section-head` is not `sectionhead`) |
| `history/history.css` | 1 | `.onthisday` 2 (its `__rows`, `__row`, `__label` are live) |

Notes before cutting:

- Two tests pin dead rules and must change with them: `test/row-divider-solid.test.js:11-12`
  (`.starter__stats`, `button.starter__careervs`) and
  `test/band-focus-ring.test.js:93` (`.teaminfo.is-themed > .teaminfo__head .innings__notes`).
  CLAUDE.md forbids loosening a test to pass. A person decides first.
- The `t-*` roles and `.paper-grid` are written as "reusable roles". Nothing
  uses them. That is a design call, 31 lines.
- Run `npm run lint`. Cutting rules that hold raw values or `--fs-caption`
  (`.favormeter__tier`) makes `check-raw-values` and `check-caption-budget`
  ask for lower budgets.
- Comment blocks above these rules are not counted. They add about 40 lines.

### 4. Identity admin partial restates the lab partials — 57 lines (measured, deliberate)

Ten rules in `62-identity-admin.css` are exact copies: `.colorlab__wpascenarios`
339, `.colorlab__wpascenario` 344, `.colorlab__wpascenariolabel` 348,
`.idlab__barmock` 448, `--unset` 459, `__logo` 463, `--darkmark` 467 and 470,
`__title` 473, `__empty` 480. The originals are in `15-team-color-lab.css:593-604`
and `17-identity-lab-workbench.css:128-657`. The comment at `62-identity-admin.css:440`
says the copy is on purpose: the lab files are DEV-only and the admin drawer
loads in production. A shared small partial would hold one copy. The saving is
57 lines, but it adds a file. Low value. (inferred)

### 5. One selector split in two places in one file — about 40 lines (inferred)

14 selectors are written twice in the same file, for example `.offday__tile`
(`06b-offday-cards.css:27`, `:140`), `.offday__logobox` (36, 158), `.offday__mascot`
(116, 205), `.pctstrip__btn` (`26a-percentile-strip.css:56`, `:67`), `.xl-film`
(`77-express-lane.css:356`, `:376`), `.sc-header__stack--wide`
(`scorecard/page.css:171`, `:240`). Their declarations differ, so each pair is
one merge, about 3 lines each. A merge can change the cascade, so check each.

### 6. Dead selectors inside live rule lists — about 8 lines (measured)

One selector in the list is dead, the rest live: `02-app-shell.css:22`
(`.starter__jersey`), `10-lineup.css:40` and `:423` (`.roster__order`,
`.roster__vs`), `11-innings.css:75` (`.teaminfo.is-themed > ...`),
`44-pre-game-cards.css:42` (`.starter`), `motion/lineup.css:67` and `:71`
(`.roster__order`). Drop the dead selector from each list. Same test note as
finding 3 for `11-innings.css:75`.

### 7. Override pairs that repeat a few declarations — about 7 lines (inferred)

The later rule repeats 1 to 2 declarations of the earlier one:
`.prospecttable__lines` and `__lineitem` (`31b-prospect-lines.css:11`, `:16` and
`31e-prospect-board.css:125`, `:130`), `.arsenal__title` (`69-pitch-arsenal.css:45`
and `player-next/pitcher/arsenal.css:316`), `.prospecttrend` (`31a-prospect-trend.css:4`
and `31e-prospect-board.css:159`).

## What I did not check

- Whether each value of an interpolated modifier (about 300 classes) has a
  producer. A class can be alive as a family and dead as a value.
- Classes that only a hidden DOM, a third-party widget or a browser extension
  creates. None are known here.
- Rules that never match because the live element lacks a second class in the
  selector. A script cannot show that without a DOM.
- `.scratch/` (3 CSS files), by instruction.
