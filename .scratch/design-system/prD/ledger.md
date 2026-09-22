# Slice D ledger — every `var(--seal*)` read in `src/styles/`, classified

Issue #1138, slice D of #1128. Generated, not hand-typed:
`ledger.raw` is `grep -rn 'var(--seal' src/styles/`; `ledger.json` adds the
enclosing selector; `decisions.mjs` carries the classification; this file is
rendered from the three by `build-ledger.mjs`.

## Measured on `main` f12208170 (2026-09-22)

| | |
| --- | --- |
| partials reading `var(--seal*)` | **67** |
| grep hits | **296** — 295 declarations + 1 prose mention in a comment (`52-highlight-clip-card.css:70`) |
| border family | 114 (`border-color` 33, `border` 30, `border-bottom` 19, `border-left` 13, `border-top` 7, `border-bottom-color` 7, `border-top-color` 3, `border-right` 2) |
| `background` | 78 |
| `color` | 75 |
| `color-mix()` | 27 — these overlap the three above, so the property counts do not sum to 295 |
| the rest | 13 — `stroke` 8, `box-shadow` 4, `fill` 2 (+1 on a one-line rule), `outline` 1 |
| indirections | 1 — `26b-player-contract.css:301` sets `--seg-dot`, a custom property, not a paint property |

## The three destinations

| destination | reads | what it means |
| --- | --- | --- |
| **STAYS** | **60** | a reveal is possible on that surface — or finding 9's must-survive list names it |
| **`--marker`** | **67** | rank, flag, "you are here", "this one stands out" |
| **structural** | **168** | a rule, a neutral, an action colour, a club accent — mostly borders on controls |

The STAYS rows sit in **20 partials**. That is the number
`scripts/check-seal-scope.mjs` allowlists, and the guard asserts it.

### Three house recipes carry `--marker`

`--marker` (#E9C33F) is a bright highlighter yellow. It is a FILL colour: it
cannot be body text on paper, and as a hairline it all but disappears. Each of
these three already existed in the repo before this sweep:

| role | recipe | precedent |
| --- | --- | --- |
| fill | `var(--marker)` with `var(--text-heading)` on it | the Close Game pill, `contrastPairings.js:92` |
| wash | `color-mix(in srgb, var(--marker) 16%, var(--paper-2))` | `12-sealbox.css:561`, `14-strike-zone.css:126`, and three more |
| rule | `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | `11-pregame-scoreboard.css:193` |

Where emphasis had to be expressed as TEXT rather than a fill — a lead rank, a
today mark, a callout's star — the read goes structural (heading ink or
pencil), never to marker. Yellow text on cream is 1.9:1.

### One new token pair

`--marker-deep` + `--hold-texture` (`src/tokens/`). The status-tape family is
three weaves of one hatch: `--il-texture` (clay, injured list), `--win-texture`
(field green, a win stamp) and, until now, `--seal-texture` (kraft) for a game
or a player put ON HOLD. Kraft tape on a rehab banner is the sharpest form of
the dilution this slice is about: it is the cover's own material, on something
no tap will ever lift. Moving that one member to the flag colour keeps the
family intact and frees the material. Both stripes are asserted in
`contrastPairings.js`.

## The rows

### `03-slate-header.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 481 | `.daystate__chip--live-on` | STAYS → **STAYS** | the Scores Unlocked switch, ON — it lifts every seal on the slate (ADR-0026) |
| 483 | `.daystate__chip--live-on` | STAYS → **STAYS** | the Scores Unlocked switch, ON |
| 484 | `.daystate__chip--live-on` | STAYS → **STAYS** | the Scores Unlocked switch, ON |

### `05-masthead-nav.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 265 | `.masthead__at-ghost` | STAYS → **STAYS** | the @ watermark — must-survive |
| 555 | `.levelprog__step.is-current` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | "you are here" on the level ladder |
| 556 | `.levelprog__step.is-current` | --marker → `color-mix(in srgb, var(--marker) 16%, transparent)` | "you are here" on the level ladder |
| 561 | `.levelprog__step.is-current::before` | --marker → `var(--marker)` | "you are here" dot |
| 562 | `.levelprog__step.is-current::before` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | "you are here" dot |
| 625 | `@media (min-width: 700px) ⟩ .levelprog__step.is-current` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | "you are here" on the wide level ladder |

### `06-loader-and-cards.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 389 | `.gamecard__delay` | --marker → `var(--marker)` | a delayed game is a FLAG, not a cover |
| 390 | `.gamecard__delay` | --marker → `var(--text-heading)` | dark heading ink is what holds AA on marker |
| 460 | `.postponed` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--surface-card))` | a postponed card is a flagged card |
| 461 | `.postponed` | structural → `var(--border-rule)` | the dashed edge of a held card is a rule |
| 476 | `.postponed__stamp` | structural → `var(--text-heading)` | a stamp is ink on paper |
| 479 | `.postponed__stamp` | structural → `var(--text-heading)` | a stamp is ink on paper |
| 501 | `.postponed__reason` | structural → `var(--text-body)` | a reason line is body text |
| 620 | `.gamecard__atmark-ghost` | STAYS → **STAYS** | the slate card's @ watermark — must-survive |

### `07-team-logo-and-buttons.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 462 | `.liveedge` | STAYS → **STAYS** | the live-edge chip REPLACES the reveal action in the innings bar |
| 482 | `.liveedge__dot` | STAYS → **STAYS** | the live-edge dot, same chip |
| 495 | `.btn--reveal` | STAYS → **STAYS** | THE reveal button |
| 496 | `.btn--reveal` | STAYS → **STAYS** | THE reveal button |
| 497 | `.btn--reveal` | STAYS → **STAYS** | THE reveal button |
| 583 | `.btn--seal` | STAYS → **STAYS** | the Game Log mint strip — ADR-0035, the one action that leaves something on the far side of a seal |
| 584 | `.btn--seal` | STAYS → **STAYS** | the Game Log mint strip — ADR-0035 |

### `08a-site-menu.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 51 | `.dirglyph` | structural → `var(--accent-primary)` | a menu glyph spine is chrome |
| 132 | `.dirtag` | structural → `var(--accent-primary)` | the Guide tag is a label chip, not a cover |
| 133 | `.dirtag` | structural → `var(--text-on-ink)` | inverse text on an ink chip |
| 350 | `.guidelink` | structural → `var(--border-rule)` | a guide-link edge is a rule |
| 354 | `.guidelink` | structural → `var(--accent-primary)` | a guide-link spine is chrome |

### `09-team-info.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 62 | `.is-themed .metricbar` | STAYS → **STAYS** | club band, unthemed fallback of the club-accent slot (ADR-0030) |
| 107 | `.is-themed .abs__title, .is-themed .halfdefense__title` | STAYS → **STAYS** | club band, unthemed fallback (ADR-0030) |
| 122 | `.lineupteam.is-themed .lineupteam__name` | STAYS → **STAYS** | club band, unthemed fallback (ADR-0030) |
| 133 | `.roster.is-themed .roster__toggle` | STAYS → **STAYS** | club band, unthemed fallback (ADR-0030) |
| 289 | `.team-hub.is-themed .team-score__howlink, .team-hub.is-themed .team-score__howsep` | structural → `var(--bar-text, var(--text-caption))` | a themed bar falls back to the caption ink, not the cover |
| 293 | `.team-hub.is-themed .team-score__howlink` | structural → `var(--bar-text, var(--text-caption))` | a themed bar falls back to the caption ink |
| 421 | `.attendance__glyph` | structural → `var(--accent-link)` | an info affordance takes the action colour |
| 428 | `.attendance__glyph--open` | structural → `var(--accent-primary)` | an opened info glyph is an ink chip |
| 429 | `.attendance__glyph--open` | structural → `var(--accent-primary)` | an opened info glyph is an ink chip |
| 430 | `.attendance__glyph--open` | structural → `var(--text-on-ink)` | inverse text on an ink chip |
| 482 | `.fact__infoglyph` | structural → `var(--accent-link)` | an info affordance takes the action colour |
| 489 | `.fact__infoglyph--open` | structural → `var(--accent-primary)` | an opened info glyph is an ink chip |
| 490 | `.fact__infoglyph--open` | structural → `var(--accent-primary)` | an opened info glyph is an ink chip |
| 491 | `.fact__infoglyph--open` | structural → `var(--text-on-ink)` | inverse text on an ink chip |

### `10-lineup.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 552 | `.mastheadpill` | structural → `var(--border-rule)` | named in finding 9 — a toggle pill edge is a rule |
| 571 | `.mastheadpill[aria-pressed='true']` | --marker → `var(--marker)` | a pressed pill is a flag; marker separates from paper far better than kraft did (3.11:1) |
| 572 | `.mastheadpill[aria-pressed='true']` | --marker → `var(--marker)` | a pressed pill is a flag |

### `11-innings.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 37 | `.innings__extras` | structural → `var(--border-rule)` | the extras banner edge is a rule |
| 52 | `.innings__extras-team` | structural → `var(--text-caption)` | an extras club label is a caption |

### `11-pregame-scoreboard.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 36 | `.pregameboard__board::before, .pregameboard__board::after` | structural → `var(--graphite-soft)` | two decorative studs on a board |

### `12-sealbox.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 17 | `.sealbox.cover, .sealtear__face` | STAYS → **STAYS** | THE cover face, and the copy each torn half is cut from |
| 18 | `.sealbox.cover, .sealtear__face` | STAYS → **STAYS** | THE cover face and the tear |
| 58 | `.cover__main` | STAYS → **STAYS** | the cover copy |
| 67 | `.cover__sub` | STAYS → **STAYS** | the cover copy |
| 147 | `.abs__title` | STAYS → **STAYS** | club band recipe |
| 236 | `.abs__pip--open` | --marker → `var(--marker)` | an ABS challenge still in hand — a live flag |
| 795 | `.statbox__title` | STAYS → **STAYS** | club band recipe |
| 897 | `.pitchernotice--pbp` | structural → `var(--border-rule)` | a staging-card edge is a rule |
| 899 | `.pitchernotice--pbp` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--surface-card))` | the pre-pitch staging card reads as prominently as a note line |
| 1007 | `.usagepips__pip--used` | structural → `var(--text-caption)` | a spent mound visit is pencil, not tape |
| 1107 | `.pitchernotice__now` | structural → `var(--text-heading)` | the arm now pitching is a heading |
| 1271 | `.dueup__title` | STAYS → **STAYS** | club band recipe |
| 1370 | `.lineupcard__title` | STAYS → **STAYS** | club band recipe |
| 1408 | `.lineupteam__name` | STAYS → **STAYS** | club band recipe |
| 1579 | `.halfdefense__title` | STAYS → **STAYS** | club band recipe |

### `13-play-by-play.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 338 | `.pbp__ladder` | structural → `var(--border-rule)` | the ladder frame is a rule |
| 355 | `.pbp__laddercol--strike` | structural → `color-mix(in srgb, var(--graphite) 22%, var(--paper-3))` | the shaded strike lane is a pencil shade, not tape |
| 356 | `.pbp__laddercol--strike` | structural → `var(--border-rule)` | the lane divider is a rule |
| 368 | `.pbp__ladderhead` | structural → `var(--border-rule)` | the ladder head rule |
| 373 | `.pbp__laddercol--strike .pbp__ladderhead` | structural → `var(--text-heading)` | a lane head on a pencil shade |
| 391 | `.pbp__laddercol--strike .pbp__cell` | structural → `var(--text-heading)` | a pitch number on a pencil shade |
| 466 | `.pbp__callout` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | a callout is exactly "catches the eye without shouting" |
| 478 | `.pbp__calloutmark` | structural → `var(--text-caption)` | marker cannot be text — the callout star is pencil beside a marker rule |
| 528 | `.roster__toggle` | STAYS → **STAYS** | club band recipe |

### `14-strike-zone.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 40 | `.strikezone__frame` | structural → `var(--graphite)` | a drawn zone is a pencil rule on paper |
| 44 | `.strikezone__third` | structural → `var(--graphite)` | a drawn zone is a pencil rule on paper |
| 223 | `.pbp__zonebtn` | structural → `var(--accent-primary)` | an action button is an ink button |
| 224 | `.pbp__zonebtn` | structural → `var(--accent-primary)` | an action button edge |
| 225 | `.pbp__zonebtn` | structural → `var(--text-on-ink)` | inverse text on an ink button |
| 253 | `.pbp__hlbtn` | structural → `var(--accent-primary)` | an action button is an ink button |
| 254 | `.pbp__hlbtn` | structural → `var(--accent-primary)` | an action button edge |
| 255 | `.pbp__hlbtn` | structural → `var(--text-on-ink)` | inverse text on an ink button |

### `16-identity-lab-shell.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 264 | `.idlab__stylecard::before` | --marker → `var(--hold-texture)` | a strip of tape holding a card down — tape, never a cover |

### `17-identity-lab-workbench.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 151 | `.idlab__barmock` | STAYS → **STAYS** | mocks the club band, same fallback |
| 958 | `.idlab__chip--on::after` | --marker → `var(--hold-texture)` | the ON chip’s tape mark |
| 1181 | `.idlab__tapeflash` | --marker → `var(--hold-texture)` | a torn scrap of tape confirming an action |

### `20-charts.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 175 | `.winprob__head` | STAYS → **STAYS** | club band recipe |
| 471 | `.marginnotes__title` | STAYS → **STAYS** | club band recipe |
| 529 | `.marginnotes__mark` | structural → `var(--text-caption)` | a margin-note mark is pencil |
| 589 | `.pitchers__title` | STAYS → **STAYS** | club band recipe |

### `21-box-score.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 666 | `.bs__potgWatch` | structural → `var(--accent-primary)` | an action button is an ink button |
| 667 | `.bs__potgWatch` | structural → `var(--accent-primary)` | an action button edge |
| 668 | `.bs__potgWatch` | structural → `var(--text-on-ink)` | inverse text on an ink button |
| 713 | `.bs__potgWatch--poster .bs__potgPlay` | structural → `var(--accent-primary)` | the same button floated on a poster |
| 714 | `.bs__potgWatch--poster .bs__potgPlay` | structural → `var(--accent-primary)` | the same button floated on a poster |
| 715 | `.bs__potgWatch--poster .bs__potgPlay` | structural → `var(--text-on-ink)` | inverse text on an ink button |

### `21a-box-score-stars.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 52 | `.stars3__card--hero` | --marker → `color-mix(in srgb, var(--marker) 16%, transparent)` | the hero star card is the headline entry |
| 89 | `.stars3__marks` | structural → `var(--text-caption)` | star marks are pencil, not tape |

### `26b-player-contract.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 14 | `.contractcard__frame` | structural → `color-mix(in srgb, var(--rule) 34%, transparent)` | the card frame wash is paper, not tape |
| 301 | `.contractcard__seg--option` | STAYS → **STAYS** | the pencilled-in option year — the --seg-dot INDIRECTION, must-survive |
| 380 | `.contractcard__openzone` | STAYS → **STAYS** | the pencilled-in option year hatch — must-survive |
| 434 | `.contractcard__tag` | structural → `color-mix(in srgb, var(--rule) 30%, transparent)` | a contract tag is a ruled chip |
| 435 | `.contractcard__tag` | structural → `var(--border-rule)` | a contract tag edge is a rule |

### `26b-recent-form.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 122 | `.devbar.is-up .devbar__fill` | --marker → `var(--marker)` | a form bar trending UP is the flagged state |

### `27-player-position-innings.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 389 | `.rehab-banner` | --marker → `var(--hold-texture)` | rehab tape stays TAPE, in the flag colour — the sibling of --il-texture and --win-texture |
| 390 | `.rehab-banner` | structural → `var(--border-rule)` | the tape banner edge is a rule |
| 399 | `.rehab-banner__text` | --marker → `var(--text-heading)` | dark heading ink on hold tape |
| 402 | `.rehab-banner__mark` | --marker → `var(--text-heading)` | dark heading ink on hold tape |
| 478 | `.game-status-banner` | --marker → `var(--marker)` | a delayed/suspended game is a flag |
| 479 | `.game-status-banner` | structural → `var(--border-rule)` | the status banner edge is a rule |
| 487 | `.game-status-banner__text` | --marker → `var(--text-heading)` | dark heading ink on marker |

### `28-team-hub.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 184 | `.team-score__grade` | --marker → `color-mix(in srgb, var(--marker) 16%, transparent)` | the Season Report grade is the headline figure |
| 194 | `.team-score__grade.is-active` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the picked grade |
| 272 | `.team-score__breakdown` | structural → `var(--text-caption)` | a breakdown label is a caption |
| 311 | `.team-score__row--driver.is-active` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the picked driver row |
| 312 | `.team-score__row--driver.is-active` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--surface-inset))` | the picked driver row |
| 350 | `.team-score__meter > span` | structural → `var(--accent-primary)` | a meter is a quantity, not a highlight |
| 421 | `.team-score__rank` | structural → `var(--text-heading)` | the rank chip’s ink — dark heading ink is what holds AA on marker |
| 422 | `.team-score__rank` | --marker → `var(--marker)` | THE worked example — a rank is not a reveal; the Close Game pill already asserts text-heading on marker |
| 662 | `.rankstrip__chip--self` | --marker → `color-mix(in srgb, var(--marker) 16%, transparent)` | "you are here" among a strip of ranks |
| 674 | `.rankstrip__arrow` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the arrow onto "you are here" |
| 777 | `.team-score__howlink` | structural → `var(--accent-link)` | "how is this scored" is a link |
| 782 | `.team-score__howlink` | structural → `color-mix(in srgb, var(--accent-link) 40%, transparent)` | a link underline |
| 812 | `.team-score__detail-title` | structural → `var(--text-caption)` | a detail title is a caption |

### `29-team-transactions.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 394 | `.last10__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 395 | `.last10__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 474 | `.last10__card--home .last10__stub, .last10__card--home .last10__foot` | STAYS → **STAYS** | Last 10 home-game kraft ticket the win-loss stamp prints on — must-survive |
| 477 | `.last10__card--home .last10__stub` | STAYS → **STAYS** | Last 10 home-game kraft ticket — must-survive |
| 485 | `.last10__card--home .last10__cap, .last10__card--home .last10__daynum, .last10__card--home .last10__score, .last10__card--home .last10__score--final, .last10__card--home .last10__sep, .last10__card--home .last10__meta` | STAYS → **STAYS** | Last 10 home-game kraft ticket — the pinned #C3996A pairing |
| 490 | `@media (hover: hover) ⟩ .last10__card--home:hover .last10__stub, .last10__card--home:hover .last10__foot` | STAYS → **STAYS** | Last 10 home-game kraft ticket, hover |
| 660 | `.teamphotos__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 661 | `.teamphotos__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 716 | `.teamphotos__thumb:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 758 | `.sstrip__series--current` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | "you are here" among a season of series blocks |
| 791 | `.sstrip__cell--home` | STAYS → **STAYS** | season strip home-game kraft, the same convention |
| 812 | `.sstrip__cell--home.sstrip__cell--win, .sstrip__cell--home.sstrip__cell--loss` | STAYS → **STAYS** | season strip home-game kraft, the same convention |
| 821 | `.sstrip__series--allstar` | structural → `color-mix(in srgb, var(--allstar-blue) 12%, var(--bg-page))` | the All-Star Game has its own blue |
| 822 | `.sstrip__series--allstar` | structural → `var(--allstar-blue)` | the All-Star Game has its own blue |

### `30-standings.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 120 | `.standings-reveal` | STAYS → **STAYS** | the standings reveal chip |
| 121 | `.standings-reveal` | STAYS → **STAYS** | the standings reveal chip |
| 122 | `.standings-reveal` | STAYS → **STAYS** | the standings reveal chip |

### `31-wild-card.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 89 | `.tstats-card__head` | structural → `var(--border-rule)` | a card head rule |
| 411 | `.duepill` | STAYS → **STAYS** | THE due-up pill |
| 412 | `.duepill` | STAYS → **STAYS** | THE due-up pill |
| 413 | `.duepill` | STAYS → **STAYS** | THE due-up pill |
| 607 | `.thub-allstar` | structural → `var(--allstar-blue)` | the All-Star Game has its own blue |
| 678 | `.roster-super__head` | structural → `var(--border-rule)` | a section head rule |
| 722 | `.roster-super__toggle` | structural → `var(--border-rule)` | named in finding 9 — the themed rule already does this (09-team-info.css:274) |
| 739 | `.roster-super__toggle-btn + .roster-super__toggle-btn` | structural → `var(--border-rule)` | the divider inside a segmented control |
| 742 | `.roster-super__toggle-btn.is-active` | structural → `var(--accent-primary)` | the picked segment is an ink chip |
| 743 | `.roster-super__toggle-btn.is-active` | structural → `var(--text-on-ink)` | inverse text on an ink chip |

### `31c-prospect-filters.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 177 | `.vslevelslider__input::-webkit-slider-runnable-track` | --marker → `var(--marker) 60%` | the amber midpoint of a red-amber-green ramp |
| 189 | `.vslevelslider__input::-moz-range-track` | --marker → `var(--marker) 60%` | the amber midpoint of a red-amber-green ramp |
| 247 | `.vslevelslider__tick--mid` | structural → `var(--award-ink)` | the mid tick sits between clay and field — medal amber reads as text where marker cannot |

### `31d-prospect-card.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 47 | `.levelprog__current` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | "you are here" on the level ladder |
| 323 | `.prospectcard__chartmark` | structural → `var(--accent-primary)` | a chart mark is ink |
| 328 | `(top)` | --marker → `var(--marker)` | a chart FLAG is the flag colour |

### `31e-prospect-board.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 77 | `@media (hover: hover) and (pointer: fine) ⟩ .prospectboard tbody tr:not(.is-selected):hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 124 | `.prospectboard__level` | structural → `var(--border-rule)` | a level chip edge is a rule |
| 168 | `.prospecttable__lineitem--milb .prospecttable__linetag` | structural → `var(--border-rule)` | a line tag edge is a rule |
| 208 | `(top)` | structural → `var(--text-caption)` | a mid band is a caption |

### `34-postseason.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 92 | `.psbracket__collabel--ws` | structural → `var(--text-heading)` | a bracket column label is a heading |
| 218 | `.pswscard` | structural → `var(--award-line)` | a championship is a medal, not a cover |
| 350 | `.psstack__roundlabel--ws` | structural → `var(--text-heading)` | a round label is a heading |

### `38-umpire-pages.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 131 | `.umpage__levelchip` | structural → `var(--text-on-ink)` | inverse text on an ink chip |
| 132 | `.umpage__levelchip` | structural → `var(--accent-primary)` | a level chip is a label, not a flag |
| 299 | `.umprank__todaychip` | --marker → `var(--text-heading)` | "working today" is a flag |
| 300 | `.umprank__todaychip` | --marker → `var(--marker)` | "working today" is a flag |

### `39-manager-page.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 544 | `.psodds-pill` | structural → `var(--border-rule)` | named in finding 9 — a pill edge is a rule |
| 546 | `.psodds-pill` | structural → `var(--accent-primary)` | named in finding 9 — an odds trigger is an ink pill |
| 547 | `.psodds-pill` | structural → `var(--text-on-ink)` | inverse text on an ink pill |

### `40-game-modals.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 24 | `.tscoremodal__kicker` | structural → `var(--text-caption)` | a kicker is a caption |
| 54 | `.tscoremodal__body p:first-of-type::first-letter` | structural → `var(--accent-primary)` | a drop cap is ink |
| 59 | `.tscoremodal__pull` | structural → `var(--accent-primary)` | a pull-quote rule is ink |
| 65 | `.tscoremodal__subkicker` | structural → `var(--text-caption)` | a sub-kicker is a caption |
| 207 | `.hlsheet__save` | structural → `var(--accent-primary)` | a save button is an ink button |
| 230 | `.hlsheet__save:hover:not(:disabled)` | structural → `var(--ink-1)` | its hover |

### `44-pre-game-cards.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 36 | `.metricbar` | STAYS → **STAYS** | club band recipe — the canonical .metricbar |
| 156 | `.seasonseries__nav:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 157 | `.seasonseries__nav:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 206 | `.seasonseries__cell:hover` | structural → `color-mix(in srgb, var(--accent-link) 10%, transparent)` | a hover wash |
| 223 | `.seasonseries__cell--otherpark` | structural → `var(--surface-inset)` | a neutral-park cell is an inset, not a flag |
| 226 | `.seasonseries__cell--otherpark:hover` | structural → `color-mix(in srgb, var(--accent-link) 10%, var(--surface-inset))` | its hover |
| 308 | `.photostrip__viewall:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 336 | `.photostrip__nav:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 337 | `.photostrip__nav:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 386 | `.photostrip__thumb:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |

### `45-admin-copy-editor.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 36 | `.admincopy__save` | structural → `var(--text-on-ink)` | inverse text on an ink button |
| 37 | `.admincopy__save` | structural → `var(--accent-primary)` | a save button is an ink button |
| 252 | `.admincopy__previewBtn--confirm` | structural → `var(--text-on-ink)` | inverse text on an ink button |
| 253 | `.admincopy__previewBtn--confirm` | structural → `var(--accent-primary)` | a confirm button is an ink button |

### `46-consent-modal.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 50 | `.consent__btn--confirm` | STAYS → **STAYS** | consenting to spoil a day (ADR-0026) |
| 51 | `.consent__btn--confirm` | STAYS → **STAYS** | consenting to spoil a day (ADR-0026) |
| 90 | `.modestrip` | STAYS → **STAYS** | the Scores Unlocked mode strip |
| 91 | `.modestrip` | STAYS → **STAYS** | the Scores Unlocked mode strip |

### `48-logbook.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 138 | `.logbook__mode` | structural → `var(--text-heading)` | a mode label is a heading |

### `48a-logbook-stats.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 84 | `.logbookstats__sectionhead span` | structural → `var(--text-heading)` | a section head is a heading |
| 406 | `.logbookstats__momentmeta b` | structural → `var(--text-heading)` | a moment figure is a heading |

### `48c-stamp-sheet.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 102 | `.stamppane.is-complete` | --marker → `var(--marker)` | a completed set is a highlight; marker on the album board clears the 3:1 bar with room |
| 129 | `.stamppane.is-complete .stamppane__count` | --marker → `var(--marker)` | a completed set is a highlight |
| 343 | `@keyframes stamppane-complete ⟩ from` | --marker → `color-mix(in srgb, var(--marker) 55%, transparent)` | the completed-set pulse |
| 348 | `@keyframes stamppane-complete ⟩ 40%` | --marker → `color-mix(in srgb, var(--marker) 0%, transparent)` | the completed-set pulse |
| 354 | `@keyframes stamppane-complete ⟩ to` | --marker → `color-mix(in srgb, var(--marker) 0%, transparent)` | the completed-set pulse |

### `49-passport-book.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 365 | `.passportpage__stamp--selected` | structural → `var(--accent-primary)` | a selection outline is ink |
| 969 | `.logbook__placing, .logbook__selected` | structural → `var(--accent-primary)` | a placing outline is ink |
| 980 | `.logbook__placinglede` | structural → `var(--text-heading)` | a lede is a heading |
| 1017 | `.logbook__order--asking` | structural → `var(--accent-primary)` | an asking outline is ink |
| 1034 | `.logbook__orderscope` | structural → `var(--text-heading)` | an order scope is a heading |

### `50-logbook-landing.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 41 | `.logbooklanding__eyebrow, .logbooklanding__sectionhead > p, .logbooklanding__trustlabel` | structural → `var(--text-heading)` | an eyebrow is a heading |
| 354 | `.logbooklanding__stepnum` | structural → `var(--accent-primary)` | a step number is ink |
| 423 | `.logbooklanding__trust` | structural → `var(--border-rule)` | a trust panel edge is a rule |
| 435 | `.logbooklanding__seal` | structural → `var(--accent-primary)` | a drawn wax seal is marketing art, not a spoiler cover |
| 437 | `.logbooklanding__seal` | structural → `var(--accent-primary)` | a drawn wax seal is marketing art |

### `52-highlight-clip-card.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 73 | `.hlclip:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 160 | `.hlclip__play` | structural → `var(--accent-primary)` | a play button is an ink button |
| 183 | `.hlclip:hover .hlclip__play` | structural → `var(--ink-1)` | its hover |
| 265 | `.cliprail__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 266 | `.cliprail__nav:hover:not(:disabled)` | structural → `var(--accent-link)` | a hover state takes the action colour |
| 345 | `.flipback__watchbtn` | structural → `var(--accent-primary)` | a watch button is an ink button |
| 346 | `.flipback__watchbtn` | structural → `var(--accent-primary)` | a watch button is an ink button |
| 350 | `.flipback__watchbtn:hover:not(:disabled)` | structural → `var(--ink-1)` | its hover |
| 351 | `.flipback__watchbtn:hover:not(:disabled)` | structural → `var(--ink-1)` | its hover |

### `53-umpire-tendencies.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 129 | `.umptend__ramp` | structural → `color-mix(in srgb, var(--marker) 55%, var(--rule)) 72%` | the warm stop between --rule and --marker on one ramp |
| 315 | `.is-themed .umptend__bar` | structural → `var(--border-rule)` | a themed bar rule |

### `54-my-tally.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 95 | `.mytally__scopelabel` | structural → `var(--text-heading)` | a scope label is a heading |
| 133 | `.clubseal__circle` | structural → `var(--accent-primary)` | a drawn club crest is art, not a spoiler cover |
| 143 | `.clubseal__tick` | structural → `var(--accent-primary)` | a drawn club crest is art |
| 150 | `.clubseal__diamond` | structural → `var(--accent-primary)` | a drawn club crest is art |

### `55-my-tally-account.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 51 | `.syncreceipt__row[data-tone='pulling'] .syncreceipt__mark` | --marker → `var(--marker)` | a sync still pulling is an in-progress flag |
| 52 | `.syncreceipt__row[data-tone='pulling'] .syncreceipt__mark` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | a sync still pulling is an in-progress flag |
| 142 | `.devicehandoff__seal` | structural → `var(--accent-primary)` | handoff art is ink |
| 147 | `.devicehandoff__arc` | structural → `var(--accent-primary)` | handoff art is ink |
| 153 | `.devicehandoff__arrow` | structural → `var(--accent-primary)` | handoff art is ink |
| 232 | `.mergereceipt` | structural → `var(--border-rule)` | a receipt edge is a rule |

### `56-my-tally-intro.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 120 | `.introsheet__markertick.is-filled` | --marker → `var(--marker)` | a tick literally named markertick |
| 121 | `.introsheet__markertick.is-filled` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | a tick literally named markertick |
| 170 | `.intropassport svg` | structural → `var(--accent-primary)` | passport art is ink |

### `61-ballpark-admin.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 176 | `.bpadmin__error` | structural → `var(--accent-negative)` | an error rail is the negative accent; --seal-edge was never defined |

### `62-identity-admin.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 303 | `.iddrawer__warn` | structural → `var(--accent-negative)` | a warning rail is the negative accent; --seal-edge was never defined |
| 513 | `.idlab__barmock` | STAYS → **STAYS** | mocks the club band, same fallback |

### `65-team-records.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 40 | `.trec__half.is-on` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--paper-2))` | the picked half of a records toggle |
| 41 | `.trec__half.is-on` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the picked half of a records toggle |
| 58 | `.trec__grouphead` | structural → `var(--border-rule)` | a group head rule |

### `66-situational-records.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 48 | `.trrank__eyebrow` | structural → `var(--text-caption)` | an eyebrow is a caption |
| 390 | `@media (hover: hover) and (pointer: fine) ⟩ .trrank__jump a:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |

### `67-awards-ledger.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 128 | `(top)` | structural → `var(--award-line)` | a tier rule beside --kraft-board ink — medal amber, not tape |

### `68-around-the-game.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 610 | `.pillars__seg--youth` | structural → `var(--award-line)` | a chart category; --marker is already spoken for in this file |
| 648 | `.pillar-key__swatch--youth` | structural → `var(--award-line)` | the same category in the key |

### `69-hit-chart.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 93 | `.hitchart__rule` | structural → `var(--accent-primary)` | a headline rule runs ink to clay |
| 165 | `.hitchart__chip--on-seal` | --marker → `var(--marker)` | the ON state of the hard-hit filter — a colourway named for the seal, never on one |
| 166 | `.hitchart__chip--on-seal` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the ON state of the hard-hit filter |
| 167 | `.hitchart__chip--on-seal` | --marker → `var(--text-heading)` | dark heading ink on marker |

### `69-pitch-arsenal.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 26 | `.pitchslab__head` | STAYS → **STAYS** | club band recipe on the heat band |
| 261 | `.pitchslab__heat` | STAYS → **STAYS** | club band recipe on the heat band |

### `70-contracts-grid.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 34 | `.ctr__tile` | structural → `var(--border-rule)` | a tile cap is a rule |
| 110 | `.cliff__bar` | --marker → `var(--marker)` | the cliff bar, already ruled in --marker on the line below it |
| 346 | `.ctr__foot th, .ctr__foot td` | structural → `var(--border-rule)` | a table foot rule |

### `71-salaries-league.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 30 | `.payboard__context` | structural → `var(--text-caption)` | a context line is a caption |
| 97 | `.payboard__row--lead .payboard__rank` | structural → `var(--text-heading)` | marker cannot be text — a lead rank is heading ink |
| 177 | `.paybar__fill` | structural → `var(--club-2, var(--accent-primary))` | the unthemed fallback of a club slot |
| 299 | `.posspend__chip--lead` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the leading position group |
| 367 | `.posspend__fill` | structural → `var(--accent-primary)` | a bar cap is ink |

### `74-contract-workbench.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 442 | `.cwb__diff` | --marker → `var(--marker)` | a diff is a highlighter swipe |

### `76-workload-marks.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 402 | `.staffgrid__dayname--today` | structural → `var(--text-heading)` | marker cannot be text — today is heading ink |

### `77-express-lane.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 167 | `.xl-film__mark` | structural → `var(--album-foil-soft)` | a turning mark on the dark board is foil |
| 225 | `.xl__chip.is-on` | --marker → `var(--marker)` | the ON chip on the dark board |
| 295 | `.xl__prerollmark` | structural → `var(--album-foil-soft)` | a preroll mark on the dark board is foil |

### `77a-express-lane-entry.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 162 | `.xl-entry__choice.is-on` | --marker → `var(--marker)` | the picked entry card — one accent for the whole family |
| 167 | `.xl-entry__choice.is-on::before` | --marker → `var(--marker)` | the picked entry rail |
| 196 | `.xl-entry__choice.is-on .xl-entry__figs` | --marker → `var(--marker)` | the picked entry card |
| 221 | `.xl-entry__consent` | --marker → `var(--marker)` | the consent rail, same family as the picked card |

### `77c-express-lane-deck.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 109 | `.xl-deck__base` | structural → `var(--album-foil-soft)` | a base label on the dark board is foil |
| 199 | `.xl-deck__hold` | structural → `var(--album-foil-soft)` | a hold label on the dark board is foil |

### `78-offseason.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 353 | `.pgame__seal` | STAYS → **STAYS** | "Score sealed" on a picked game |
| 359 | `.pgame__seal` | STAYS → **STAYS** | "Score sealed" on a picked game |
| 817 | `.srecord__tape` | --marker → `var(--hold-texture)` | a season record taped to the page — tape in the flag colour |

### `boxlines/boxlines.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 40 | `.boxlines__kicker` | structural → `var(--text-caption)` | a kicker is a caption |

### `boxlines/gamelines.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 105 | `.gamelines__heading` | structural → `var(--text-caption)` | a heading is a caption |

### `designlab/lab.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 64 | `.dlab__verdictbox` | structural → `var(--border-rule)` | named in finding 9 — the lab's own verdict box edge is a rule |
| 108 | `.dlab__grouptitle` | structural → `var(--accent-primary)` | a group title spine is ink |
| 237 | `.dlab__verdict--bespoke, .dlab__verdict--hold` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | a verdict is a flag |
| 238 | `.dlab__verdict--bespoke, .dlab__verdict--hold` | --marker → `var(--marker)` | a verdict is a flag |
| 239 | `.dlab__verdict--bespoke, .dlab__verdict--hold` | --marker → `var(--text-heading)` | dark heading ink on marker |
| 375 | `.dlab__warn` | structural → `var(--accent-negative)` | a warning is the negative accent |
| 376 | `.dlab__warn` | structural → `var(--accent-negative)` | a warning is the negative accent |

### `focus/console.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 464 | `.gamehud--console` | STAYS → **STAYS** | club band recipe |

### `report/challenge-card.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 86 | `.chalcard__view.is-on` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--paper-2))` | the picked view of a challenge card |
| 87 | `.chalcard__view.is-on` | --marker → `color-mix(in srgb, var(--marker) 70%, var(--text-heading))` | the picked view of a challenge card |

### `scorecard/box.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 162 | `.sc-ab--noted::after` | --marker → `var(--marker)` | a hand-edited box flagged apart from a derived one |
| 195 | `.sc-ab__seal` | STAYS → **STAYS** | the at-bat's own seal — the reveal frontier |
| 196 | `.sc-ab__seal` | STAYS → **STAYS** | the at-bat's own seal — the reveal frontier |
| 207 | `.sc-ab__sealtext` | STAYS → **STAYS** | the at-bat's own seal — the reveal frontier |
| 247 | `.sc-ab__fliptext` | STAYS → **STAYS** | the at-bat's own seal, flipped |

### `situational-records/66a-detail.css`

| line | selector | destination | reason |
| --- | --- | --- | --- |
| 36 | `.trrank__detailgroup` | structural → `var(--text-caption)` | a detail group label is a caption |
| 150 | `.trrank__tablewrap .trrank tbody tr:first-child td` | --marker → `color-mix(in srgb, var(--marker) 16%, var(--surface-card))` | the top row of a ranked table |
| 188 | `@media (hover: hover) and (pointer: fine) ⟩ .trrank__related a:hover` | structural → `var(--accent-link)` | a hover state takes the action colour |

