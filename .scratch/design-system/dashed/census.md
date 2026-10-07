# Dashed census (#1132, slice 1)

Base SHA: `b24dff28`. Scope: every `dashed` in `src/styles/`. `public/learn.css` has none (checked, not edited). JSX has no `dashed` border (only SVG `strokeDasharray`, not a border).

## Two methods, same answer

- **A, text:** `grep -rn dashed src/styles` after blanking comments: **83** lines.
- **B, rule parse:** every `selector { decl }` whose declaration value or `border-style`/`outline-style` holds `dashed`: **83** declarations, same lines.
- **C, tokens:** no custom property holds `dashed` (`--x: ... dashed` grep: 0), so no rule hides it behind a token.

Partials: 54. Meanings, after the action column:

| meaning / action | rows |
|---|---|
| door / make solid | 5 |
| empty / move to EmptyState | 6 |
| other / ask Gary | 32 |
| other / keep | 3 |
| provisional / keep | 15 |
| row divider / ask Gary | 22 |

## Rows

| partial | line | selector | declaration | meaning | action | note |
|---|---|---|---|---|---|---|
| 05-masthead-nav.css | 425 | `.txntl-expand` | `border: var(--bw-hair) dashed var(--border-rule)` | door | make solid | DONE in slice 1 |
| 05-masthead-nav.css | 520 | `.levelprog__step.is-unreached::before` | `border-style: dashed` | provisional | keep | unreached level, pencilled in |
| 05-masthead-nav.css | 525 | `.levelprog__step.is-target.is-unreached` | `border-left-style: dashed` | provisional | keep | unreached level, pencilled in |
| 05-masthead-nav.css | 589 | `.levelprog__step.is-target.is-unreached` | `border-top-style: dashed` | provisional | keep | unreached level, pencilled in |
| 06-loader-and-cards.css | 519 | `.postponed` | `border: var(--bw-hair) dashed var(--border-rule)` | provisional | keep | postponed game |
| 10-lineup.css | 245 | `.starter__stats, .starter__last, .starter__seasonvs, .starter__careerv` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 10-lineup.css | 257 | `button.starter__careervs` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 10-lineup.css | 636 | `.defdiamond__dh` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 10b-former-teammates.css | 235 | `.ladder__badge--farm` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 12-sealbox.css | 714 | `.prepitch` | `border-bottom: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 13-play-by-play.css | 19 | `.pbp__note` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 13-play-by-play.css | 20 | `.pbp__note` | `border-bottom: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 13-play-by-play.css | 301 | `.pbp__card--placed` | `border-left: var(--bw-heavy) dashed var(--graphite-soft)` | provisional | keep | placed extra-innings runner |
| 13-play-by-play.css | 311 | `.pbp__placed` | `border-style: dashed` | provisional | keep | placed extra-innings runner |
| 14-strike-zone.css | 624 | `.gamephotos__notice` | `border-style: dashed` | other | ask Gary | Notice-family box; "unsealed"/as-of is provisional? |
| 15-team-color-lab.css | 234 | `.colorlab__logodropzone--over` | `outline: 2px dashed var(--accent-primary)` | other | ask Gary | drag-over outline on a lab drop zone |
| 17-identity-lab-workbench.css | 496 | `.idlab__monoinkart` | `border: var(--bw-hair) dashed var(--rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 17-identity-lab-workbench.css | 649 | `.idlab__barmock--unset` | `border: var(--bw-heavy) dashed var(--rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 17-identity-lab-workbench.css | 942 | `.idlab__chiptick--unset` | `border-top: 2px dashed var(--rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 17-identity-lab-workbench.css | 1162 | `.idlab__glove` | `border: var(--bw-hair) dashed var(--rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 26a-percentile-strip.css | 153 | `.pctstrip__track::before` | `border-left: var(--bw-hair) dashed var(--text-caption)` | other | ask Gary | chart reference line (not a UI state) |
| 26b-player-contract.css | 374 | `.contractcard__openzone` | `border: var(--bw-hair) dashed var(--border-rule)` | provisional | keep | option year / estimate |
| 26c-mound-card.css | 152 | `.moundstrip__day--today` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 26d-command-map.css | 47 | `.cmdmap__chip--thin` | `border-style: dashed` | provisional | keep | thin sample, not firm |
| 26e-contract-history.css | 177 | `.cthist__fuzzy` | `border-style: dashed` | provisional | keep | option year / estimate |
| 26f-glove-target.css | 161 | `.glovetarget__keyitem--median::before` | `border: var(--bw-heavy) dashed var(--accent-primary)` | other | ask Gary | chart reference line (not a UI state) |
| 27-player-position-innings.css | 118 | `.posinn__dh` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 27-player-position-innings.css | 553 | `.asof-banner` | `border: var(--bw-hair) dashed var(--rule)` | other | ask Gary | Notice-family box; "unsealed"/as-of is provisional? |
| 29-team-transactions.css | 443 | `.last10__stub` | `border-bottom: 1px dashed var(--border-rule)` | empty | move to EmptyState | waiting / nothing here |
| 29-team-transactions.css | 692 | `.teamphotos__loading` | `border: var(--bw-hair) dashed var(--border-rule)` | empty | move to EmptyState | waiting / nothing here |
| 32-milestone-watch.css | 106 | `.milestonewatch-page__row` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 34-postseason.css | 155 | `.seed--bye` | `border-style: dashed` | provisional | keep | bye seed |
| 34-postseason.css | 243 | `.pswscard__mvp` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 39-manager-page.css | 179 | `.mgrpage__timelinerow` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 45-admin-copy-editor.css | 204 | `.admincopy__preview` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 45-admin-copy-editor.css | 529 | `.awardord__cut > span[aria-hidden='true']` | `border-top: var(--bw-hair) dashed var(--clay)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 45-admin-copy-editor.css | 534 | `.awardord__note` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 47-trade-deadline.css | 238 | `.trade__considerationicon` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | empty-ish box or print mark |
| 48-logbook.css | 94 | `.logbook__pending` | `border: var(--bw-rule) dashed var(--border-rule)` | empty | move to EmptyState | waiting / nothing here |
| 48-stamp-strip.css | 61 | `.stampstrip__mount--empty` | `border-style: dashed` | empty | move to EmptyState | waiting / nothing here |
| 48-stamp-strip.css | 159 | `.stampstrip__details` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 49-passport-book.css | 319 | `.passportpage__cell` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | empty-ish box or print mark |
| 49-passport-book.css | 458 | `.passportpage__pending` | `border: var(--bw-rule) dashed var(--border-rule)` | empty | move to EmptyState | waiting / nothing here |
| 49-passport-book.css | 499 | `.passportpage__addpage` | `border: var(--bw-hair) dashed var(--border-rule)` | door | make solid | DONE in slice 1 |
| 49-passport-book.css | 558 | `.passportpage__crosshair` | `border: var(--bw-hair) dashed var(--text-caption)` | other | ask Gary | empty-ish box or print mark |
| 49-passport-book.css | 899 | `.logbook__tray` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | empty-ish box or print mark |
| 49-passport-book.css | 999 | `.logbook__order` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | empty-ish box or print mark |
| 52-highlight-clip-card.css | 318 | `.hlclip__loading` | `border: var(--bw-hair) dashed var(--border-rule)` | empty | move to EmptyState | waiting / nothing here |
| 58-logbook-shelf.css | 293 | `.shelf__newtile` | `border: var(--bw-rule) dashed color-mix(in srgb, var(--book-board-kraft) 42%, var(--bg-page))` | door | make solid | slice 2 (not in slice 1: file budget); on test PENDING list |
| 61-ballpark-admin.css | 96 | `.bpadmin` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 61-ballpark-admin.css | 187 | `.bpadmin__focusTarget` | `outline: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 62-identity-admin.css | 88 | `.iddrawer` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 62-identity-admin.css | 292 | `.iddrawer__foot` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 62-identity-admin.css | 468 | `.idlab__barmock--unset` | `border: var(--bw-heavy) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| 66-situational-records.css | 144 | `.trrank__flip` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 67-awards-ledger.css | 198 | `.awardtbl__chip--none` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 67-awards-ledger.css | 289 | `.awards__expand` | `border: var(--bw-hair) dashed var(--award-line)` | door | make solid | DONE in slice 1 |
| 68-around-the-game.css | 666 | `.method` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | empty-ish box or print mark |
| 69-pitch-arsenal.css | 414 | `.arsenal__row` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| 72-player-hover-card.css | 103 | `.phcard__tag--rehab` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 73-spray-map.css | 76 | `.spray__chip--thin` | `border-style: dashed` | provisional | keep | thin sample, not firm |
| 76-workload-marks.css | 127 | `.daystrip__day--today` | `border-style: dashed` | other | ask Gary | chip/marker: provisional or a plain state? |
| 77-express-lane.css | 246 | `.xl__chip--placed` | `border-style: dashed` | provisional | keep | placed extra-innings runner |
| 80-postseason-bracket.css | 46 | `.pbkt-mark--empty` | `border: var(--bw-hair) dashed var(--graphite)` | provisional | keep | bracket slot not decided yet |
| 80-postseason-bracket.css | 56 | `.pbkt-blank` | `border-bottom: var(--bw-hair) dashed var(--graphite)` | provisional | keep | bracket slot not decided yet |
| box-score/scoring-summary.css | 34 | `.scoresum__play + .scoresum__play` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| boxlines/boxlines.css | 387 | `.vsteam__door` | `border-top: var(--bw-hair) dashed var(--border-rule)` | door | make solid | slice 2 (not in slice 1: file budget); on test PENDING list |
| boxlines/gamelines.css | 187 | `.gamelines__famrow` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| designlab/lab.css | 120 | `.dlab__entry` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| pitcher-card/card.css | 37 | `.pcard__sec` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| postseason/series-live.css | 116 | `.psseries__starter .projection` | `border: var(--bw-hair) dashed var(--border-rule)` | provisional | keep | projection is a pencil mark |
| postseason/series-parts.css | 62 | `.psseries__flowreadout` | `border-bottom: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| postseason/series-parts.css | 453 | `.psseries__keybar` | `border-left: var(--bw-rule) dashed var(--text-caption)` | other | ask Gary | chart reference line (not a UI state) |
| report/charts.css | 266 | `.colchart__rule--mean` | `border-left: var(--bw-hair) dashed var(--text-caption)` | other | ask Gary | chart reference line (not a UI state) |
| scorecard/lens-bar.css | 133 | `.sc-lensbar__waiting` | `border: 2px dashed var(--graphite)` | other | keep | bespoke sheet; out of scope |
| scorecard/lens-cards.css | 89 | `.sc-armnotice__more` | `border-left: var(--bw-hair) dashed var(--border-rule)` | other | keep | bespoke sheet; out of scope |
| scorecard/lens.css | 146 | `.sc-ab__atbat` | `border: 2px dashed var(--graphite)` | other | keep | bespoke sheet; out of scope |
| scout/panels.css | 170 | `.scout__verdictrule` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| scout/scout.css | 65 | `.scout__lab` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | admin / lab surface; keep as dev-only? |
| scout/scout.css | 383 | `.scout__readout` | `border-top: var(--bw-hair) dashed var(--border-rule)` | row divider | ask Gary | dashed hairline between rows: a 4th meaning |
| system/empty-state.css | 25 | `.emptystate` | `border: var(--bw-hair) dashed var(--border-rule)` | other | ask Gary | unclassified |
| teammates/teammates.css | 65 | `.degrees__link` | `border-left: 2px dashed var(--border-rule)` | other | ask Gary | connector line between teammates |
| workload/projection.css | 59 | `.projection__note` | `border-top: var(--bw-hair) dashed var(--border-hairline)` | row divider | ask Gary | dashed hairline above a projection note |

## Slice 1 (this PR)

Made solid: `.txntl-expand` (05-masthead-nav), `.awards__expand` (67-awards-ledger), `.passportpage__addpage` (49-passport-book). Guard: `test/door-solid.test.js`. Changing the stroke only; the three buttons are not on `Door` yet (that is the door-collapse work, not this fix).

## Left for later

- **Slice 2, solid:** `.shelf__newtile` (58-logbook-shelf), `.vsteam__door` (boxlines/boxlines). They sit on the test's PENDING list. Remove each entry in the PR that fixes it.
- **Move to EmptyState:** the "empty" rows. Each needs a JSX move.
- **Gary decides:** the "ask Gary" rows. The biggest group is the dashed hairline *between rows* (22): it is not provisional, not empty, not a door. Make it solid, or accept "separator" as a fourth meaning?
- `scorecard/*` rows: bespoke, untouched (`.sc-armnotice__more` is a door; it is on the PENDING list so the guard skips it).
