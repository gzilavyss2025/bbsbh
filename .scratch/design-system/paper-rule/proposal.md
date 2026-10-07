# Proposal: close the direct reads of `--paper-N` and `--rule*` (issue #1156, slice C1b of #1137)

Base: `origin/main` at `b24dff28`. This file is a **proposal**. Nothing in `src/`, `public/` or any guard changed. Gary decides the list at the end.

## 0. The counts, and what changed

I counted twice. Method A matches `var\(--token\)` (token names end in digits, so the class allows digits). Method B splits each file on `var(` and reads the head of each piece. Both methods agree. Comments are blanked first.

| token | issue (at `9a578dcb7`) | now | change |
| --- | ---: | ---: | ---: |
| `--paper-1` | 58 | 54 | −4 |
| `--paper-3` | 49 | 52 | +3 |
| `--paper-2` | 44 | 46 | +2 |
| `--paper-0` | 6 | 6 | 0 |
| `--rule-soft` | 42 | 45 | +3 |
| `--rule-grid` | 37 | 41 | +4 |
| `--rule` | 30 | 33 | +3 |
| **total** | **266** | **277** | **+11 (+4.1%)** |
| partials | 71 | 73 | +2 |

`--paper-N` is now 158 and `--rule*` is 119. The change is inside the 10% limit, so I went on. I **cannot say which commits caused it**: `9a578dcb7` is not in this clone and `git fetch` cannot reach it. My inference (not checked): 15 days of new partials and rules since 2026-09-22 added reads, and some `--paper-1` reads left with swept files.

**Consumers outside `src/styles/`.** The issue lists three. I found more:

| file | reads | note |
| --- | ---: | --- |
| `src/lib/preview/posterPaper.js` | 7 token names in code (10 lines with comments) | reads `:root` at run time on purpose. An alias would return the text `var(--paper-2)`, not a colour (file header says so). **It must stay on primitives.** |
| `public/learn.css` | 18 reads, plus 6 definitions (24 lines) | has its own copy of the primitives. It has **no alias tier** and no `--rule-grid`. `check-learn-css.mjs` skips aliases on purpose. |
| `src/components/page-turn/PageCurlOverlay.jsx` | 1 | `--paper-1` |
| `src/components/scoring/BaseoutDiamond.jsx` | 3 | **not in the issue** |
| `src/components/scoring/PlayDiamond.jsx` | 2 | **not in the issue** |
| `src/components/scoring/BaseState.jsx` | 2 | **not in the issue** |
| `src/tokens/effects.css` | 2 (`--rule-grid`) | **not in the issue** |

Also: `#1114` is now **closed** (PR #1631, merged), so the wait in the issue comment ("wait for the #1114 rename program") has mostly ended. The only open PR that touches a file in these slices is #1679 (`17-identity-lab-workbench.css`). That file belongs to slice 9, so slice 9 waits for #1679.

## 1. How I read the census

`census.csv` has one row per read: **312 rows** (277 in `src/styles/`, plus 35 outside). Columns: scope, file, line, selector, property, token, the alias it could use, the role, the proposed replacement, and a confidence.

- **sure**: an alias exists, it has the same colour, and its name fits the job.
- **likely**: the colour is the same, but the alias name does not fit well (for example a border name used as a text colour), or the role needs a quick look.
- **ask**: I cannot tell the role. Gary decides, or someone looks at the page.

The role comes from the selector's job and the property. I did not render pages. **Every role is my reading of the CSS, not a check on screen.**

## 2. (a) The one-to-one swaps

The tokens `--paper-3`, `--rule-soft` and `--rule` each have exactly one alias with the same colour. That is **130 reads** (52 + 45 + 33). The issue said 121.

- **75 are ready now (sure).** Border, background and fill reads. The alias name fits the job. The full list is in the appendix.
- **55 are "likely".** The read is a **mark or text**, not a surface or border: `color`, `fill`, `stroke`, `stop-color`, or a colour inside a gradient. A swap keeps the colour. The alias name is odd (`color: var(--surface-inset)`). See decision 4.

| token | alias | sure | likely |
| --- | --- | ---: | ---: |
| `--paper-3` | `--surface-inset` | 21 | 31 |
| `--rule-soft` | `--border-hairline` | 33 | 12 |
| `--rule` | `--border-rule` | 21 | 12 |

## 3. (b) `--rule-grid`: 41 reads, no alias

**The colour is `#EDE6D1`.** `--border-hairline` is `#DED6C0`, so a swap to it would **change a colour**. I do not propose that. A new token is needed. By job:

| job | reads |
| --- | ---: |
| faint row or cell separator (borders, `outline`, inset line) | 19 |
| graph-paper grid lines (gradients) | 7 |
| meter or bar track | 7 |
| hover or press wash | 5 |
| scene fill (`.pscene`) | 2 |
| print-sheet faint line (`--ps-faint`) | 1 |

27 reads are lines. 14 are fills. Two more reads sit outside (`src/tokens/effects.css`). Every name below costs the same to rename later: **43 reads** (41 + 2), the token line in `colors.css`, and the `posterPaper.js` map entry. The difference is how likely a rename is.

| | name | why | what a later rename costs |
| --- | --- | --- | --- |
| **Recommended** | `--border-grid` | Sits beside `--border-rule` and `--border-hairline`. The family stays one pattern. | Low risk of a rename. If the 14 fills later get their own name, only 14 reads move. |
| Alternative 1 | `--grid-line` | Names the graph-paper job, the app's own picture. | A rename is likely if the program picks `--border-*` for all lines. All 43 reads move. |
| Alternative 2 | `--border-faint` | Says "fainter than hairline". | A rename is likely if a fainter line ever appears. All 43 reads move. |

I propose **one** token. Two tokens (one for the 27 lines, one for the 14 fills) would be cleaner, but each extra token needs sign-off. One token now can split later at a cost of 14 reads.

## 4. (c) `--paper-1` (54 reads) and `--paper-0` (6 reads)

**`--paper-1` and `--paper-0` are one colour (`#F6EFDC`).** Two aliases carry that colour: `--bg-canvas` ("app canvas") and `--bg-page` (the ground a card sits on; it aliases `--bg-canvas`). No pixel moves whichever I pick. A wrong pick shows nothing today. It becomes a bug the day the two names unfold. So the choice is about meaning.

My rule: a read that sits **on a card, or darker than its card**, is "the ground a card sits on". That is `--bg-page`. A read that is the app canvas itself is `--bg-canvas`.

| group (`--paper-1`) | reads | my pick | confidence |
| --- | ---: | --- | --- |
| chip, badge or small fill darker than its card | 9 | `--bg-page` | likely |
| hover wash on a row or button | 4 | `--bg-page` | likely |
| open row or drawer ground | 5 | `--bg-page` | likely |
| preview well or panel ground | 4 | `--bg-page` | likely |
| logo tile ground (no club tint) | 9 | `--bg-page` | ask |
| transparency checkerboard (4 selectors, 4 lines each) | 16 | `--bg-page` | ask |
| gap in a selection ring | 3 | `--bg-page` | ask |
| slider thumb fill | 2 | `--bg-page` | ask |
| card frame gradient stop (`.contractcard__frame`) | 1 | `--bg-page` | ask |
| text on a dark band (`.abouthero__lede`) | 1 | see decision 3 | ask |
| **total** | **54** | | 22 likely, 32 ask |

| group (`--paper-0`) | reads | my pick | confidence |
| --- | ---: | --- | --- |
| ring gap on a dot (`.idlab__dot`) | 1 | `--bg-canvas` | likely |
| hole in a chip (`.idlab__chiphole`) | 1 | `--bg-canvas` | likely |
| text on a dark badge (4 selectors) | 4 | see decision 3 | ask |
| **total** | **6** | | 2 likely, 4 ask |

**The 5 "text on a dark band" reads.** `--text-on-ink` is `#FBF6E9`. The paper colour is `#F6EFDC`. They differ by about 4.0 on the CIE76 scale (above the 1.2 that #1128 treated as "not visible"). A swap to `--text-on-ink` **moves the colour** a little (lighter, so contrast rises). Keeping a paper alias moves nothing but reads oddly.

## 5. (d) `--paper-2`: 46 reads

`--paper-2` is `#FBF6E9`. Three aliases point at it. The pick is by role.

| group | reads | alias | confidence |
| --- | ---: | --- | --- |
| card surface (plain `background` or `--table-pin`) | 17 | `--surface-card` | sure |
| text or line on a dark band (`color`) | 9 | `--text-on-ink` | sure |
| line on a dark band, `color-mix` (`.loader__*` borders and shadow) | 3 | `--text-on-ink` | likely |
| card tinted by a state colour (`color-mix(... var(--paper-2))`) | 13 | `--surface-card` | likely |
| small dot or logo tile on card paper (`.scorebug__outdot`, `.bs__tallyLogobox`) | 2 | `--surface-card` | likely |
| card frame gradient stop (`.contractcard__frame`) | 1 | `--surface-card` | likely |
| blend of card and inset (`.contractcard__ticker > div`) | 1 | `--surface-card` or `--surface-inset` | ask |
| **total** | **46** | | 26 sure, 19 likely, 1 ask |

**`--album-foil` gets zero reads.** No `--paper-2` read in `src/styles/` is album foil. The three aliases cannot collide here.

## 6. (e) The order of slices

Each slice has at most 5 files. A slice also carries the **whole file**: every `--paper-N` and `--rule*` read in it, so a file is touched once. The guard goes **last**, because it cannot be half on (issue #1156). Model names are my advice, not a rule.

| # | kind | files | reads | model | can run |
| ---: | --- | --- | ---: | --- | --- |
| 1 | all-sure files | `04-site-bar.css`, `04a-wire-dock.css`, `20-charts.css`, `21-box-score.css` | 5 | Haiku | **now** |
| 2 | all-sure files | `21a-box-score-stars.css`, `26a-percentile-strip.css`, `29-team-transactions.css`, `40-game-modals.css` | 7 | Haiku | **now** |
| 3 | all-sure files | `48c-stamp-sheet.css`, `48d-stamp-detail.css`, `59-stamp-in.css`, `72-club-transactions.css` | 6 | Haiku | **now** |
| 4 | all-sure files | `72-player-hover-card.css`, `77c-express-lane-deck.css`, `postseason/home.css`, `system/section-head.css` | 10 | Haiku | **now** |
| 5 | same colour, mark reads | `06a-gamecard-parkart.css`, `13-play-by-play.css`, `14-strike-zone.css`, `21b-box-score-tally.css`, `22-box-score-tables.css` | 14 | Sonnet | after decision 4 |
| 6 | same colour, mark reads | `24-floating-nav-and-hud.css`, `31-wild-card.css`, `38-umpire-pages.css`, `39-manager-page.css` | 17 | Sonnet | after decision 4 |
| 7 | same colour, mark reads | `43-foul-tracker.css`, `65-team-records.css`, `69-hit-chart.css`, `70-contracts-grid.css` | 13 | Sonnet | after decision 4 |
| 8 | same colour, mark reads | `71-salaries-league.css`, `78-offseason.css`, `focus/atbat.css`, `report/challenge-card.css` | 9 | Sonnet | after decision 4 |
| 9 | big judgement file | `17-identity-lab-workbench.css` | 38 | Sonnet, high effort | after decisions 1, 2, 3, 5, 6 |
| 10 | big judgement file | `68-around-the-game.css` | 27 | Sonnet, high effort | after decisions 1, 2, 3, 5, 6 |
| 11 | mixed files | `01-base.css`, `05-masthead-nav.css`, `06-loader-and-cards.css`, `06b-offday-cards.css`, `07-team-logo-and-buttons.css` | 19 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 12 | mixed files | `08-site-shell.css`, `12-sealbox.css`, `15-team-color-lab.css`, `16-identity-lab-shell.css`, `18-uniforms-and-jerseys.css` | 24 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 13 | mixed files | `23-box-score-detail.css`, `25-wide-layout.css`, `26b-player-contract.css`, `26e-contract-history.css`, `27-player-position-innings.css` | 20 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 14 | mixed files | `28-team-hub.css`, `31d-prospect-card.css`, `32-milestone-watch.css`, `34-postseason.css`, `42-first-scorebook.css` | 21 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 15 | mixed files | `45-admin-copy-editor.css`, `50-logbook-landing.css`, `53-umpire-tendencies.css`, `62-identity-admin.css`, `63-print-sheet.css` | 12 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 16 | mixed files | `65-about-page.css`, `66-situational-records.css`, `67-awards-ledger.css`, `79-nine-keys.css`, `boxlines/gamelines.css` | 19 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 17 | mixed files | `boxlines/listdoor.css`, `designlab/lab.css`, `pitcher-card/card.css`, `report/charts.css` | 8 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 18 | mixed files | `scorecard/box.css`, `scorecard/footer.css`, `scorecard/grid.css`, `scorecard/lens-carry.css` | 8 | Sonnet | after decisions 1, 2, 3, 5, 6 |
| 19 | **mint** `--border-grid` | `src/tokens/colors.css`, `src/lib/design/contrastPairings.js` (only if the pairing list needs the new token) | 0 | Sonnet | after decision 1 |
| 20 | outside consumers | `PageCurlOverlay.jsx`, `BaseoutDiamond.jsx`, `PlayDiamond.jsx`, `BaseState.jsx`, `src/tokens/effects.css` | 10 | Haiku | after slice 19 and decisions 2, 6 |
| 21 | **the guard**: append one entry to `rules` in `scripts/check-typography.mjs`, with its test, an ADR line and the `src/styles/CLAUDE.md` pointer | `scripts/check-typography.mjs`, `test/` file, `docs/adr/` file, `src/styles/CLAUDE.md`, `docs/scripts/tooling.md` | 0 | Sonnet | **last**, after slices 1 to 20 |

**Slices that can run now: 1, 2, 3 and 4.** Together they cover 28 reads in 16 files. Every read in them is "sure". They need no decision. I advise Haiku because the work is a mechanical swap. A check script can prove "same colour before and after" for each read. Slice 9 (`17-identity-lab-workbench.css`) must also wait for PR #1679, which edits the same file.

Rough size: the "can run now" group is 28 reads. The other 249 reads wait on decisions. Slices 5 to 8 (53 reads) wait only on decision 4.

The guard (slice 21) also needs a place for the **exempt** files: `posterPaper.js` and `public/learn.css` (decisions 5 and 6). `scripts/check-learn-css.mjs` is not touched.

## 7. Decisions for Gary

Each answer is one word. My recommendation comes first.

1. **Name for the new `--rule-grid` token.** `border-grid` (recommended) / `grid-line` / `border-faint`. Or say `two` to mint two tokens (lines and fills).
2. **Name for the 54 `--paper-1` reads (and the 2 background `--paper-0` reads, where the answer is the canvas).** `page` (recommended: use `--bg-page` for everything on or darker than a card) / `canvas` (use `--bg-canvas` for all) / `group` (I follow the table in part 4 and you answer only the "ask" groups).
3. **The 5 "text on a dark band" reads (1 `--paper-1`, 4 `--paper-0`).** `canvas` (recommended: use `--bg-canvas`; no colour moves, the name reads oddly) / `ink` (use `--text-on-ink`; the text gets slightly lighter, about 4.0 on the CIE76 scale).
4. **The 55 mark and text reads of `--paper-3`, `--rule-soft` and `--rule`** (for example `color: var(--surface-inset)`). `accept` (recommended: use the alias; the colour is the same and a contrast guard still checks the pair) / `mint` (name a text role first, and a later PR does these 55).
5. **`public/learn.css` (18 reads).** `exempt` (recommended: it is served outside the bundle, has no alias tier, and its guard copies primitives on purpose) / `copy` (copy the alias tier into it and guard the copy).
6. **`src/lib/preview/posterPaper.js` (7 names) and the guard's reach.** `exempt` (recommended: it must read primitives at run time) / `resolve` (rewrite it to resolve aliases itself). Related: should the guard also scan JSX and `src/tokens/`? `styles` (recommended: the guard checks `src/styles/` only, and slice 20 fixes the 10 outside reads by hand) / `src` (widen the guard to `src/**`).
7. **The one `ask` row in `--paper-2`: the `.contractcard__ticker > div` blend (`color-mix(--paper-3 78%, --paper-2)`).** `card` (recommended: keep `--surface-card` as the base) / `inset` (use `--surface-inset`). It cannot change the colour either way: the alias has the same value. It only changes the name.
8. **Order.** `now` (recommended: start slices 1 to 4 while you decide) / `wait` (hold everything until you answer all seven).

## Appendix A: the 75 "sure" one-to-one swaps (ready)

Each entry is `line token→alias`. They sit in 28 partials. Reads in the same files that are "likely" or "ask" are not listed here (see `census.csv`). A "sure" read in a file that also holds an "ask" read waits for that file's slice, so the file is touched once.

- `04-site-bar.css`: 370 rule-soft→border-hairline; 389 rule-soft→border-hairline
- `04a-wire-dock.css`: 109 rule-soft→border-hairline
- `06-loader-and-cards.css`: 478 paper-3→surface-inset
- `13-play-by-play.css`: 335 paper-3→surface-inset
- `16-identity-lab-shell.css`: 152 paper-3→surface-inset; 248 paper-3→surface-inset; 370 paper-3→surface-inset
- `17-identity-lab-workbench.css`: 354 rule→border-rule; 401 paper-3→surface-inset; 431 rule→border-rule; 449 paper-3→surface-inset; 463 paper-3→surface-inset; 496 rule→border-rule; 637 rule→border-rule; 649 rule→border-rule; 694 rule→border-rule; 800 paper-3→surface-inset; 877 rule-soft→border-hairline; 942 rule→border-rule; 955 rule→border-rule; 1115 paper-3→surface-inset; 1162 rule→border-rule
- `21a-box-score-stars.css`: 138 rule-soft→border-hairline
- `22-box-score-tables.css`: 394 rule-soft→border-hairline
- `24-floating-nav-and-hud.css`: 398 paper-3→surface-inset
- `25-wide-layout.css`: 184 rule-soft→border-hairline
- `26a-percentile-strip.css`: 161 rule-soft→border-hairline
- `27-player-position-innings.css`: 553 rule→border-rule; 616 rule→border-rule
- `28-team-hub.css`: 291 rule-soft→border-hairline; 330 rule-soft→border-hairline; 343 rule-soft→border-hairline; 344 rule-soft→border-hairline; 446 rule-soft→border-hairline; 454 rule→border-rule; 710 rule-soft→border-hairline; 778 rule-soft→border-hairline; 779 rule-soft→border-hairline
- `29-team-transactions.css`: 134 rule-soft→border-hairline; 160 rule-soft→border-hairline
- `31d-prospect-card.css`: 144 rule-soft→border-hairline
- `40-game-modals.css`: 76 rule-soft→border-hairline; 77 rule-soft→border-hairline
- `43-foul-tracker.css`: 479 rule→border-rule
- `48c-stamp-sheet.css`: 211 paper-3→surface-inset; 302 paper-3→surface-inset
- `48d-stamp-detail.css`: 121 paper-3→surface-inset; 163 paper-3→surface-inset
- `59-stamp-in.css`: 42 rule-soft→border-hairline
- `68-around-the-game.css`: 496 paper-3→surface-inset; 497 paper-3→surface-inset; 504 paper-3→surface-inset; 971 paper-3→surface-inset; 976 paper-3→surface-inset
- `72-club-transactions.css`: 38 rule-soft→border-hairline
- `72-player-hover-card.css`: 42 rule-soft→border-hairline
- `77c-express-lane-deck.css`: 67 rule→border-rule
- `78-offseason.css`: 40 rule-soft→border-hairline; 122 rule-soft→border-hairline; 144 rule→border-rule
- `79-nine-keys.css`: 68 rule→border-rule; 73 rule-soft→border-hairline; 123 rule→border-rule; 197 rule→border-rule; 262 rule→border-rule; 291 rule-soft→border-hairline; 333 rule-soft→border-hairline; 370 rule→border-rule
- `postseason/home.css`: 38 rule-soft→border-hairline; 163 paper-3→surface-inset; 196 rule→border-rule; 199 rule-soft→border-hairline
- `system/section-head.css`: 96 rule-soft→border-hairline; 168 rule-soft→border-hairline

## Appendix B: how I checked

- **Counts.** Two methods, run twice (`.scratch/design-system/prC/alias-tier-count.mjs` and `census.mjs` here). Both give 277 reads. The two scripts also give the same per-token numbers.
- **10 random rows.** A fixed-seed pick from `census.csv`; I opened each file at the line. All 10 hold the token on that line with the property named. Two are `posterPaper.js` rows, where the token is a quoted name (`'--paper-2'`), not a `var(...)` read. The other eight are `var(...)` reads: `65-about-page.css:119`, `20-charts.css:144`, `48c-stamp-sheet.css:211`, `68-around-the-game.css:819`, `43-foul-tracker.css:164`, `scorecard/grid.css:94`, `public/learn.css:303`, `07-team-logo-and-buttons.css:382`.
- **Not checked.** Roles are my reading of the CSS. I did not render any page. The one number from outside the CSS is the colour gap in part 4: I computed it from the two hex values.
- **Rebuild.** Run `node census.mjs`, then `node classify.mjs`, then `node frag.mjs` from this folder's parent path (`node .scratch/design-system/paper-rule/<name>.mjs` at the repo root).
