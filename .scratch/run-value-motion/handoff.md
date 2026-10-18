# Handoff spec: club Run value card, with headshots and motion

Design: https://claude.ai/artifact/XTqjCKxLLPUKAvo2kf1LVe (artboard `Main.dc.html`, 390px).
Renders checked at 390px for all five boards (total, batting, defense, running, pitching):
no overflow, no truncated name.

## Overview

The card sits in the team page's **Ranks** band. It answers one question: "how many runs is
this roster worth, and who supplies them?" Today it is `src/screens/team/next/ranks/RunValueBoard.jsx`.
This spec changes that card. It does not add a new card or a new route.

The new card adds four things to the current one:

1. A **league strip** in the ink lead tile: 30 bars, one for each club, best to worst. The
   strip shows the meaning of "3 of 30" without more text.
2. **Part buttons.** The four legend cells of the split bar become toggle buttons. A tap
   re-ranks the top six by that part. A second tap returns to the total.
3. **Headshots** and a **mini split bar** in each leader row.
4. **Motion**: the design-system stamp-in, a count-up on the club total, the league bars
   growing, and rows that slide when the board re-ranks.

**Spoiler scope.** Run value is a season aggregate. The card is outside the spoiler scope
(ADR-0034), the same as the card today. No seal, no reveal. Do not import a reveal-only module.

## Data

Everything comes from `public/data/run-value.json` through `src/api/around-the-game/runValue.js`.
Add no fetch.

| Need | Source | Status |
|---|---|---|
| Club parts and total | `clubRunValue(data, teamId)` → `{ bat, fld, run, pit, total, players[] }` | exists |
| Club rank, of | `clubBoard(data)` (already used for `data.rank`, `data.of`) | exists |
| League strip | `clubBoard(data)` → `{ teamId, total }[]`, sorted best to worst | `loadNumbers.js` already builds it as `clubs` (line ~228) and keeps only `rank` and `of`. Add `league: clubs` to the `runValue` object. |
| Top six by total | `club.players` (sorted by `total`) | exists |
| Top six by one part | sort `club.players` by `p[key]` descending, then by name | **new pure helper** |
| Mini bar scale | `splitScale(entries)` in `RunValueParts.jsx` | exists |
| Club abbreviation for the strip | team abbreviation from `src/lib/teams.js` | exists |

New helper. Put it in `runValue.js`, with a unit test in `test/run-value.test.js`:

```js
// The club's top `limit` by one part ('total' or a COMPONENTS key). Ties break on name,
// the same rule clubRunValue uses, so a board never reorders between renders.
export function clubLeaders(club, key = 'total', limit = 6)
```

Test cases (write them first and watch them fail):
- Brewers, `bat`: Bauers, Turang, Chourio, Vaughn, Contreras, Sánchez.
- `run`: David Hamilton leads (+4.4). His total (−14.9) has no effect on his place.
- A club with fewer than six players returns them all.
- A tie on the part breaks on name.

## Layout (phone first, 390px)

The card is one column inside `Card frame="stamped"`. Inner width at 390px is 318px
(390 − 2 × `space-4` gutter − 2 × `bw-heavy` − 2 × `space-4` padding − `stamped-offset`).

```
┌ RUN VALUE ─────────────────────── [RUNS ABOVE AVERAGE] ┐
│ ┌ ink lead tile ─────────────────────────────────────┐ │
│ │ CLUB TOTAL                                       3  │ │
│ │ +158                                  OF 30 CLUBS  │ │
│ │ MIL                                                │ │
│ │ ▇▇▇▆▆▅▄▃▂▂▁▁ ─────────────── ▁▂▂▃▃▄▄▅▆▇           │ │
│ │ LAD +216   LEAGUE, BEST TO WORST   ATH −231        │ │
│ └────────────────────────────────────────────────────┘ │
│ [████████|██|▒▒|███████████████████]   split bar        │
│ TAP A PART TO RE-RANK THE TOP SIX                       │
│ [■ BATTING   +54] [■ DEFENSE    +6]                      │
│ [□ RUNNING   +12] [■ PITCHING  +86]                      │
│ TOP SIX · ALL FOUR PARTS                                │
│ ─────────────────────────────────────────────────────── │
│ [1] [photo 64]  JACOB MISIOROWSKI                  +52  │
│                 P  [mini bar────────]                   │
│  2  [photo 48]  BRICE TURANG                       +39  │
│  …  (rows 2–6 are the same)                             │
│ Every Brewers player Baseball Savant has …              │
│ SAVANT · OCT 18                       LEAGUE BOARD ›    │
└─────────────────────────────────────────────────────────┘
```

| Block | Spec |
|---|---|
| Card | `Card frame="stamped" label="Run value" labelAs="h3" count="runs above average" stampIn={!still}`. Gap between blocks `space-5`. |
| Lead tile | `StatTile tone="ink"`. Padding `space-4`. Value `fs-score-lg` (46px), `fs-hero-xl` (56px) from 740px (see Decisions). Rank `3` in `marker`, `font-display`, 34px, with "of 30 clubs" under it in `fs-caption` `text-on-ink-dim`. |
| League strip | Height 72px. Zero line at 50%, 1px `graphite`. 30 flex slots, gap 2px. Bar height = abs(total) ÷ max abs(total) × 30px, minimum 2px. Positive bars sit above the line in `graphite-soft`. Negative bars sit below in `clay`. The viewed club is `marker`, with its abbreviation 6px above the strip in `marker`, `font-display` 11px. |
| Strip captions | One row, `justify-content: space-between`: best club, "League, best to worst", worst club. `fs-caption`, `text-on-ink-dim`, `ls-label`. |
| Split bar | Reuse `RunValueSplit`. Track 22px, `bw-heavy` `ink-0` edge, 2px inner padding, 2px gap between segments. |
| Part buttons | Replace the `<dl>` legend with a button grid: `repeat(2, minmax(0,1fr))`, gap `space-2`. Each button: min height 48px (≥ `tap-min`), padding `space-1h` `space-2h`, row layout: swatch 12px + label (`font-display`, `fs-ui`, `ls-label`, caps) left, value (`font-mono` 20px, tone colour) right. |
| Hint | Above the buttons. `fs-caption`, `graphite`, caps. Text in States, below. |
| Board title | `font-display` 15px, caps, `ink-0`, 2px `ink-0` rule under it. |
| Leader list | `<ol>`, `position: relative`, fixed height = 104 + 5 × 77 = **489px**. Each row is absolutely placed (see Motion). |
| Leader row | Grid `22px <photo> minmax(0,1fr) auto`, column gap `space-3`. Row 1 is 104px tall, rows 2–6 are 77px, with a 1px `rule-soft` top rule. |
| Rank | `font-mono` `fs-ui`, centred, 22px line. Row 1: `marker` chip with `ink-0` 700 text. Others: `graphite`. |
| Headshot | `Headshot` in a frame: row 1 64 × 76px, others 48 × 57px (ratio 1 : 1.18). `bw-heavy` `ink-0` border, `shadow-stamped`, fill `paper-4`, `object-fit: cover; object-position: top`, `mix-blend-mode: multiply`. |
| Name | `PlayerLink`. `font-mono` 500 `fs-ui`, `ls` 0.02em, caps, `ink-0`, one line, ellipsis. |
| Position + mini bar | One line under the name, gap `space-2`: position (`font-display` `fs-label`, `graphite`, fixed 20px) then the mini bar (height 8px, track `rule-grid`, 2px `ink-0` zero tick 14px tall). |
| Row value | `font-mono` 500 `fs-num-lg` (22px) **on every row, row 1 too**. Colour from `tone()`. |
| Footnote | Keep today's `rvcard__note` copy. |
| Footer | Source line "Savant · {date}" (`fs-caption`, `graphite`, `nowrap`) left, `Door` right. |

## Design tokens used

All of these exist in `src/styles`. Use no raw hex.

| Token | Value | Usage |
|---|---|---|
| `--paper-2` | #FBF6E9 | Card fill, unselected button fill |
| `--paper-4` | — | Headshot frame fill |
| `--ink-0` | #0F1822 | Lead tile, edges, selected button, **Pitching part** |
| `--field` | #2F6E4F | Positive values, **Batting part** |
| `--field-mint` | #86BE98 | **Defense part** |
| `--field-wash` | #DDE7CF | **Running part**, with a 1px `ink-0` inset edge |
| `--clay` | #B4453A | Negative values, negative mini-bar segments, below-average league bars |
| `--marker` | #F2C14E | Rank `3`, rank-1 chip, the viewed club's league bar and tag |
| `--graphite` | #6B6558 | Captions, rank 2–6, position, strip zero line |
| `--graphite-soft` | — | Above-average league bars |
| `--rule` | — | Unselected button border |
| `--rule-soft` | #DED6C0 | Row rules |
| `--rule-grid` | #EDE6D1 | Mini-bar and split-bar track |
| `--text-on-ink-cream` / `--text-on-ink-dim` | — | Lead tile value / labels |
| `--shadow-stamped` / `--shadow-stamped-soft` | 4px 4px 0 | Frames, card / selected button, lead tile |
| `--dur-stamp-in` | 380ms | Every stamp-in |
| `--ease-stamp` | cubic-bezier(0.2, 0.9, 0.3, 1) | Stamp-in, row slide, bar growth |
| `--ease-press` | — | Button press |
| `--stamp-delay` | 55ms steps | Stagger |
| `--space-2/3/4/5`, `--tap-min` | 8/12/16/20/44px | Gaps, padding, targets |

**Part colours.** Today `.rvsplit__seg--fld` and `--run` are opacity shades of one green. The
new four have clearly different lightness (field 42, mint 72, wash 90, ink 8), so a reader
can tell batting from pitching without the labels. Change `.rvsplit__seg--{key}` in
`75-run-value.css`. This also changes the report board and the player card, which use the
same component, and that is correct: one part, one colour everywhere.

## Components

| Component | Change | Props | Notes |
|---|---|---|---|
| `RunValueBoard` | Holds `part` state (`'total'` or a part key) | add `league` (the `clubBoard` rows) | Passes `part` down. Hides the league strip when `league` is missing. |
| `LeagueStrip` (new, in `RunValueParts.jsx` or `ranks/`) | 30 bars | `rows`, `teamId` | `aria-hidden`. The rank text in the tile carries the meaning. |
| `RunValueSplit` | New props: `selected`, `onSelect` | `entry`, `scale`, `selected`, `onSelect` | Without `onSelect` it renders the `<dl>` exactly as today, so the report board and player card do not change. With `onSelect` the legend renders buttons. When `selected` is set, the selected part's segments draw in `field` and the other segments go to opacity 0.18 (see Decisions). |
| `RunValueLeaderRow` (new) | One row | `player`, `rank`, `part`, `scale`, `lead` | Mini bar = `RunValueSplit` track without legend, or a small `RunValueBar` built from the same math. Do not copy the clamping math a second time. |
| `Headshot` | none | `personId`, `name`, `teamId` | Already `aria-hidden` and has its own retry and fallback chain. |

## States and interactions

| Element | State | Behaviour |
|---|---|---|
| Part button | Default | `paper-2` fill, 2px `rule` border, `ink-2` label, value in tone colour. |
| Part button | Hover (pointer only) | Border goes to `ink-0`. |
| Part button | Pressed (`:active`) | Moves 2px down and right on `--ease-press`, the house press. |
| Part button | Selected (`aria-pressed="true"`) | `ink-0` fill, `text-on-ink-cream` label and value, `shadow-stamped-soft`. |
| Part button | Focus | 2px solid `focus-ring` (`field`), 2px offset. |
| Part button | Tap while selected | Back to `total`. |
| Part button | Tap another part | That part becomes selected. Only one at a time. |
| Hint | `total` | "Tap a part to re-rank the top six" |
| Hint | a part selected | "Tap it again for all four parts" |
| Board title | `total` / part | "Top six · all four parts" / "Top six · batting" (lower case in source, caps by CSS) |
| Row value | `total` / part | Player total / that part's value, signed, tone colour. |
| Mini bar | part selected | The selected part's positive segment draws in `field`; every other part's segment at opacity 0.2. |
| Name | tap | `PlayerLink` to the player page, as today. |
| Row | tap outside name | Nothing. The row is not a control. |
| `Door` | tap | `runValuePath({ d: asOf, s: sportId })`, as today. |

Hold `part` in component state only. Do not put it in the URL and do not persist it. It is a
view of one card, not a page state.

## Responsive behaviour

The Ranks band changes layout at 740px (`src/styles/team-next/ranks.css`, the `min-width: 740px` rule), the same breakpoint the design system uses for its tiles.

| Width | Changes |
|---|---|
| < 740px | The layout above. Buttons 2 × 2. |
| ≥ 740px (card in a column about 560px wide) | Buttons 4 × 1 (`repeat(4, …)`), only when each cell is at least 120px wide. Use a container query on the card, not the viewport. Lead value 56px (`fs-hero-xl`), the design-system wide tile size. |
| Any | The card never scrolls sideways. Names truncate, nothing else does. |

## Edge cases

- **MiLB club / no data.** `data` is null, so the card does not render (today's rule). Keep it.
- **Fewer than six players.** List height = 104 + (n − 1) × 77px. A part board can be
  shorter than the total board, so compute the height from the current board.
- **A part with no positive player** (possible for Running on a slow club). Show the six
  highest anyway, negative values in `clay`. Do not hide the button.
- **Part value 0 for the club.** The segment is not drawn (`RunValueSplit` already skips
  widths under 0.5%). The button still shows `0`.
- **Long names.** Ellipsis on the name only. Checked: "Jacob Misiorowski" (17 characters) fits
  in the row-1 layout at 390px. A longer name is cut with an ellipsis, and the full name is in
  the link's accessible name.
- **No headshot.** `Headshot` falls back on its own (generic silhouette, team tint). The frame
  stays the same size, so rows do not jump.
- **Two-way player.** `bat` and `pit` both non-zero. The mini bar shows both. Nothing special.
- **Ties in the league.** `clubBoard` ranks ties. The tile prints the tied rank the same way it does today.
- **League strip with fewer than 30 clubs** (early season, a club with no rows). Draw what
  `clubBoard` returns. The slots fill the width.
- **Hidden rows.** Rows that are not on the current board must draw a zero-width mini bar. If
  they keep their widths, the scale of a small board makes them run past the card and
  the page scrolls sideways. This bug happened in the design and was fixed.
- **Loading.** The file loads before the band renders (`loadNumbers.js`). The card has no
  loading state of its own.

## Animation and motion

One idea, from the design system: **the stamp-in**. Everything else is that idea at a
different size. Turn all of it off under `prefers-reduced-motion: reduce`: the card shows
its final state at once, and the count-up shows the final number.

| Element | Trigger | Animation | Duration | Delay | Easing |
|---|---|---|---|---|---|
| Card | First time in view | Existing `stampIn` on `Card` | `dur-stamp-in` | 0 | `ease-stamp` |
| Lead tile | Same | Stamp-in on the soft shadow | `dur-stamp-in` | 140ms | `ease-stamp` |
| Club total | Same | Count up 0 → total, rounded each frame, sign kept | 1500ms | 260ms | ease-out cubic |
| Rank `3` | Same | Shows `—` until the count is 15% done, then the rank | — | — | — |
| League bars | Same | `scaleY` 0 → 1 from the zero line | 520ms | 360ms + 22ms × index | `ease-stamp` |
| Split bar | Same | Left-to-right wipe (`clip-path: inset`) | 900ms | 520ms | cubic-bezier(.6,0,.2,1) |
| Part buttons | Same | Stamp-in | `dur-stamp-in` | 620ms + 55ms × index | `ease-stamp` |
| Rows | Same | Stamp-in | `dur-stamp-in` | 900ms + 55ms × index | `ease-stamp` |
| Row mini bar | Same | `scaleX` 0 → 1 from the zero point | 640ms | row delay + 140ms | cubic-bezier(.6,0,.2,1) |
| Row values | Same | Count up | 900ms | 900ms | ease-out cubic |
| Row that stays on re-rank | Part tap | Slides `top` to its new place; frame resizes if it moves to or from #1 | 460ms | 0 | `ease-stamp` |
| Row that enters on re-rank | Part tap | Stamp-in | `dur-stamp-in` | 160ms + 55ms × new index | `ease-stamp` |
| Row that leaves | Part tap | Fades out | `dur-med` (220ms) | 0 | linear |
| Mini-bar segments | Part tap | `left` / `width` move to the new scale; other parts dim | 460ms | 0 | `ease-stamp` |
| Values on re-rank | Part tap | Change at once. **No** count-up. | — | — | — |

Rules for the build:

- **Play the intro once.** Start it when the card is first in view (one
  `IntersectionObserver`, threshold 0.3), not on mount: the card is below the fold in the
  Ranks band. After it has played once in the session, render the final state. `Card`'s
  existing `still` prop already means "do not stamp", so reuse it.
- **Count-up without re-renders.** Write the number into a ref'd text node in one
  `requestAnimationFrame` loop. Do not `setState` 60 times a second; the design did, and it
  re-renders the whole card each frame. Cancel the loop on unmount.
- **Stable row nodes for the slide.** Render one `<li>` per player on any board (the union of
  the five boards, at most 30 players), keyed by player id, in a fixed order. Place each with
  `top`. A player on the current board is visible; any other player is
  `visibility: hidden; opacity: 0`, `aria-hidden="true"`, and draws a zero-width bar. Do not
  re-key rows by position. Doing so re-mounts them and they stamp in again instead of sliding.
- **Restart the enter animation on each re-rank** with two identical keyframe names chosen by
  an even/odd counter (`rowA` / `rowB`). A changed `animation-name` restarts an animation; a
  changed delay does not.
- **Easing token.** Use the app's `--ease-stamp` (0.2, 0.9, 0.3, 1). The design used a copy with
  overshoot (1.15). Use the token, not the copy.
- **Removed in the critique pass, do not add back:** photo fade from grayscale, a bounce on the
  club tag, a dropping name tab.

## Accessibility

- **Focus order:** name tab heading → part buttons (Batting, Defense, Running, Pitching) →
  each player name link, rank order → `Door`. The league strip and the bars are not
  focusable.
- **Roles and names:**
  - Part buttons: real `<button type="button">` in a `role="group"` with
    `aria-label="Rank the club by one part"`, each with `aria-pressed`. The accessible name
    is the label and the value ("Batting +54").
  - League strip, split bar and mini bars: `aria-hidden="true"`. The rank text, the button
    values and the row values carry the same facts.
  - Headshot: `aria-hidden` (Headshot's own policy). The name is the link text.
  - The list stays an `<ol>`. Hidden rows have `aria-hidden="true"`, so a screen reader reads
    six items, in rank order. Order the DOM by rank for the visible rows, or set the hidden
    rows to `display: none` after their fade ends, so that reading order equals visual order.
- **Announcements:** the board title has `aria-live="polite"`. A tap announces "Top six ·
  batting".
- **Keyboard:** Tab moves between buttons. Space or Enter toggles one. No arrow-key roving:
  these are four independent toggles, not a tab list.
- **Contrast** (calculated from the token values): all text pairs pass 4.5:1. Graphics pass
  3:1: `graphite-soft` on ink about 5.2:1, `clay` on ink about 3.2:1. The Running segment
  (`field-wash`) fails on its own, so it must keep its 1px `ink-0` inset edge.
- **Touch targets:** buttons 48px tall, `Door` 44px.
- **Reduced motion:** see Animation.

## Copy

Sentence case in the source; CSS sets caps. No exclamation marks.

- Count tag: "runs above average" (unchanged)
- Tile: "Club total", "of 30 clubs"
- Strip: "{best abbr} {signed}", "League, best to worst", "{worst abbr} {signed}". Use the
  minus sign (−, U+2212), the same as `signed()`.
- Hint: "Tap a part to re-rank the top six" / "Tap it again for all four parts"
- Title: "Top six · all four parts" / "Top six · {part inProse}" (use `COMPONENTS[].inProse`,
  never `.toLowerCase()`; `check-name-casing` enforces this)
- Footer: "Savant · {Mon D}" from `generatedAt`. `Door`: "League run value board" (unchanged).

## Out of scope

- The "Replay the stamp-in" button. It exists only in the design.
- The report page (`/run-value`) and the player card. They change only through the shared
  part colours.

## Decisions (Gary, 2026-10-18)

1. **Lead value size: the design-system sizes.** `fs-score-lg` (46px) below 740px and
   `fs-hero-xl` (56px) from 740px, the same as every other lead stat tile. Do not use the
   design's 64px.
2. **Selected part: drawn in `field`.** When a part is selected, its segments on the split bar
   and on every mini bar draw in `--field`, whichever part it is. The other parts keep their
   own colours and dim (opacity 0.18 on the split bar, 0.2 on the mini bars). Negative
   segments of the selected part stay `clay`. With no part selected, each part has its own
   colour. This rule also fixes Running, whose own colour (`field-wash`) is the palest.

## Check before merge

- `npm test` with the new `clubLeaders` tests.
- `npm run lint` (word choice, casing, contrast, file and directory size: `RunValueParts.jsx`
  may need a split).
- Render the Brewers team page (`/team/{name-id}`, id 158, with `?nointro`) at 390px. Tap each of the four parts and check that the page
  width stays 390px and that no name is cut. Repeat with reduced motion on. Send Gary a
  screenshot.
