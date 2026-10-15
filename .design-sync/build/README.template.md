# Tally Baseball: the stamped look

Tally Baseball is a paper scorebook on a phone. It is a **read-only, spoiler-safe second screen** for a live baseball game. The reader keeps score on paper. The app shows lineups, umpires, rosters and inning totals from the public MLB Stats API, and it keeps every number that could spoil the game sealed until the reader taps to reveal it. It is not a data-entry tool.

This design system holds **the player-page look** (ADR-0109, "The canvas is the site-wide look"): square corners, a stamped card with a hard offset shadow and a name tab, stat tiles with one lead (ink) tile, a fact strip, a sticky jump bar with count badges, and the stamp-in motion. It is drawn at two widths together, **390 px (phone) and 1180 px (desktop)**, with neither one leading. The next page to use it is the team page.

Every value here is copied from the repo (`src/tokens/*.css`, `src/styles/system/`, `src/components/ui/`). Nothing is invented. Light theme only: the app has no dark theme.

## How to build with it

1. Link `styles.css` once. It imports the fonts, the tokens, the base rules and the part styles.
2. Put the design inside an element with `id="root"`. The app shouts every label in capitals with one rule, `#root * { text-transform: uppercase }` (`tokens/base.css`). Write copy in sentence case ("Run diff", "Last 10"); the style sets the capitals.
3. Style with `var(--token)` only. Never write a raw hex, a raw font size or a raw spacing number. The token list, with a usage line each, is `tokens/TOKENS.md`. The values are in `tokens/*.css`.
4. Build parts from these classes (the real names in the repo):

| Part | Classes |
| --- | --- |
| Stamped card | `card card--stamped` + `card--named` (name tab) + `card--tint` or `card--ink` + `card--stamp-in`; inside: `card__name` (an `h2`, the card heading), `card__count`, `card__body` |
| Stat tile | `card card--stamped stattile` + tone; inside: `stattile__label`, `stattile__value`, `stattile__caption`, `rankmark`. Add `stattile--compact` for a tile about 40% smaller (it is in the app too): value 28px on a phone and 32px from 740px, label 12px (unchanged) |
| Fact strip | `dl.factgrid.factgrid--strip` of `div.fact` with `dt.fact__label` and `dd.fact__value`, flush inside a stamped card |
| Jump bar | `nav.jumpbar` > `div.cluster.cluster--snug.jumpbar__row` > `button.jumpbar__item` (+ `is-current`) with `span.jumpbar__count` |
| Section head | `sectionhead` + `sectionhead--label`, `--rule` or `--band sectionhead--house`; `sectionhead__title`, `sectionhead__note` |
| Table | `div.table.table--bare.table--row.table--sticky` > `table.table__grid`, flush inside a stamped card |

```html
<div id="root">
  <section class="card card--stamped card--named card--stamp-in" aria-labelledby="h">
    <h2 id="h" class="card__name">Milwaukee Brewers</h2>
    <span class="card__count">2026</span>
    <div class="card__body"><p>103-59</p></div>
    <dl class="factgrid factgrid--strip">
      <div class="fact"><dt class="fact__label">Record</dt><dd class="fact__value">103-59</dd></div>
    </dl>
  </section>
</div>
```

The six previews under `components/` show each part with real CSS. Where to look first: `styles.css`, `_ds_bundle.css`, `tokens/TOKENS.md`.

## The rules

- **Square corners.** A stamped card, a stat tile, a count tag, a jump-bar item and a section-head band have no radius. The radius tokens (`radius-xs` to `radius-pill`) belong to older sheet cards and pills. Do not round a stamped part.
- **Tokens only, no raw hex.** Fill with `surface-card`, `surface-stamped-tint` or `surface-stamped-ink`. Edge with `border-stamped` at `bw-heavy`. Shadow with `shadow-stamped` (4px right and down, no blur). On an ink fill the shadow is `shadow-stamped-soft`.
- **A rank reads "78 of 89" on its own line**, with no "#". A counting-stat rank reads "6th". It is drawn by `rankmark`.
- **Rank emphasis uses `--marker`, never `--seal`.** `seal` (kraft amber) means "sealed" and nothing else (ADR-0083). It is only for a surface where a tap can reveal a score.
- **No `title=` tooltips.** Put the information on the page. Touch has no hover.
- **Club colour only where ADR-0030 and ADR-0109 allow.** A club may colour a band head that names the club. A club colour never reaches a card, a stat tile, a control or the jump bar. The jump bar stays the app's own colours: `ink-0` edge, `surface-card` item, `ink-0` current item, `accent-tint` badge.
- **Never reveal or compute a score in a part.** A part draws what its caller gives it. A sealed value stays sealed until the reader taps.
- **A card with no data hides, and its jump-bar button hides with it.** Show `—` or "not posted yet" for a missing field. Never show an error and never a blank card.
- **One weight per face** (ADR-0109): Barlow Condensed 700, JetBrains Mono 500. Emphasis in a figure is colour, never weight. Lora (400, 700) is for play-by-play copy only.
- **Voice:** short, exact, calm. Say "postseason", never "playoffs". Records read `103-59`, rates `.636`, differentials `+214`, streaks `W5`.

## Type

- `font-display`: Barlow Condensed 700. Stat values, name tabs, labels, jump-bar items. Uppercase, tracked.
- `font-display-tag`: "Barlow Condensed Tag" 600. The card count tag and nothing else.
- `font-body`: JetBrains Mono 500. Copy, UI and fact values. The app uses the same face (#2165). This system ships no Source Sans 3.
- `font-mono`: JetBrains Mono 500. Every figure, with tabular numbers.
- `font-read`: Lora. Sentence-like copy at small sizes (play-by-play).

**Fonts ship in `fonts/`.** They are the same woff2 files the app bundles from Fontsource (`src/tokens/fonts.css`), Latin subset, at the same weights. All three families are SIL Open Font License 1.1, which allows redistribution with the licence. The licence text for each family is in `fonts/LICENSE-*.txt`. `tokens/fonts.css` is the repo file with its paths pointed at `../fonts/`. "Barlow Condensed Tag" is the Barlow 600 file under its own family name. The repo's Big Shoulders Display face (one slate watermark) is not part of the look and is not included.

## Contrast

Every text pair in the look holds 4.5:1 except the pairs below. They are kept exact from the source and flagged in `tokens/TOKENS.md`.

- `graphite-soft` on `paper-2` is 3.10:1 and on `paper-0` 2.91:1. It is for "not available" placeholders (`fact__na`) only, never a figure.
- `accent-negative` (`clay`) on a picked table row (`paper-5`) is 4.37:1. Use `clay-deep` there (6.33:1).
- `clay` text on `clay-soft` is 4.28:1. Keep clay text off `clay-soft`.
- `text-caption` on `field-wash` is 4.52:1. It passes by 0.02, so a tint tile caption takes `text-muted` (7.07:1).
- `seal-deep` in the source is the 8-digit value `#97673395` (an alpha of 0x95). It is probably a typo for `#976733`. It is kept exact.

## How to use this on a team page

The team page (`/team/{id}`, ADR-0082, still a draft) is **one scroll of seven bands under a sticky jump bar**:

**Standings, Ranks, Games, Roster, Farm, Money, About.**

| Band | The question it answers |
| --- | --- |
| Standings | How is the season going? |
| Ranks | Where does this club sit among the rest? |
| Games | What have they played? |
| Roster | Who plays here? |
| Farm | Who is coming, and where does this club sit in the org? |
| Money | What does it cost? |
| About | What is this club? (ballpark, logos and jerseys, affiliation history) |

- **The jump bar** has one button per band, each with a count badge. The band in view marks its button current. A band with no data is absent, and its button hides. It is sticky. Under 740 px it scrolls sideways. From 740 px it wraps inside a stamped box.
- **Each band** opens on a named head and a full-bleed 2px `ink-0` rule, with 48 px (`space-12`) of space above. There is no tint on a band (ADR-0082, corrected by #1106).
- **Open the page** with a stamped hero card: the club name on the tab, a fact strip (record, pct, division, run diff, last 10, streak), then a row of stat tiles. The lead tile is ink, the second is tint, the rest are plain.
- **Inside a band** use stamped cards. Pair two cards side by side only at wide widths. Space them with the `space-*` tokens.
- **Design the phone (390 px) and the desktop (1180 px) together, as one design, and neither leads.** Decide each layout choice for both widths at once. At 390 px: one column, tiles in a wrapping grid, the jump bar scrolling sideways. At 1180 px: the strip goes to six columns, the tile value grows to 56 px (`fs-hero-xl`), and the jump bar wraps inside a stamped box. The switch is at 740 px.
- **Example, Brewers, Standings band:** record `103-59`, `.636`, `1st NL Central`, run differential `+214`, last 10 `8-2`, streak `W5`, season grade `9.5` "Making it look easy".

## Motion

Motion is part of the look, and it is small. The previews in `components/Motion/` replay it.

- **Stamp-in** (`card--stamp-in`): a stamped card drops 4px (`stamped-offset`) into its shadow as it appears, over `dur-stamp-in` (380ms) on `ease-stamp`. Stagger a row with `--stamp-delay`.
- **Rise** (`player-rise`): a block comes up 6px (`space-1h`) as it fades in, over `dur-rise` (420ms) on `ease-stamp`. A row in a cascade sets `--rise-i` (0, 1, 2) and waits that many `stagger-step` (55ms).
- **Press:** a button, jump-bar item or pill moves 2px down and right on `ease-stamp`.
- **Other tokens:** `dur-grow` (750ms, a bar fills), `dur-draw` (900ms, a line inks itself), `dur-unfold` and `ease-unfold` (a menu or panel opens). Every duration and easing is listed in `tokens/TOKENS.md`.
- **Rules:** all of it is off under `prefers-reduced-motion`. An entrance plays once, the first time the block is seen in a visit. A tap the reader made may animate every time.

## The band texture

Every band head carries the ripple rings and soft sheen of the lineup page, with no extra class. It is square. It uses `ripple-light`, `ripple-dark`, `ripple-mask`, `sheen-light` and `sheen-dark`. Use it on a house band or on a band that names a club (ADR-0030).

## The player cards

The player page (`/player/{id}`, a batter or a pitcher) is built from the shared parts plus one card per module. `components/Player/` holds seven of them as **static captures of the real cards**: Season, Splits, Plate approach, Contact, Form trend (batter) and Pitch arsenal, On the mound (pitcher). Each preview carries the real DOM and only the real CSS rules that match inside it, copied from `src/styles/player-next/`. The figures are a real batter's and a real pitcher's on the day of capture, and the club marks load from the MLB image host. Nothing is wired: a card is a picture. Read them for the patterns:

- Every module is a stamped card with a name tab and, often, a count tag.
- A scope or filter is a row of square ink buttons (`Segmented`); the chosen one is ink.
- A figure table is mono with a hairline above each row, ink rules above the totals, and a star on an All-Star year.
- A chart takes its colours from the pitch and batted-ball tokens (`arsenal-*`, `batted-*`), and no text sits on those fills.
- Below 740px a card is one column. From 740px it splits into two columns where the content allows (the arsenal and the contact card do).
- With body copy in mono (see "Type"), some tight labels in these captures run wider than in the app. Give a label more room, or shorten it.

## What is in here

- `styles.css`: the entry. Imports everything.
- `tokens/`: `colors.css`, `spacing.css`, `typography.css`, `effects.css`, `layout.css` (copied verbatim), `fonts.css`, `base.css` (base rules from `01-base.css`), `TOKENS.md` (a usage line per token).
- `_ds_bundle.css`: the part styles, copied from `src/styles/system/` (card, stamped, jump bar, section head, table, cluster) and the fact rules from `09-team-info.css`, plus the stamp-in motion.
- `fonts/`: the five woff2 files and three OFL licence texts.
- `components/`: one preview each for the Stamped Card, Stat Tile, Fact Strip, Jump Bar, Section Head, Table, the report parts (Stat Band And Strip, Leader List, Result Card, Meter And Key, Pill Marks, Report Controls) and Motion, and seven player cards under `components/Player/`.

There is no JavaScript bundle. The look is CSS and class names. The React parts (`Card`, `StatTile`, `FactGrid`, `SectionHead`, `Table`, `HubTabBar`) live in the repo and draw these same classes.
