# World Series scouting report: design handoff (#2316)

Design source: the "World Series Scouting Report" canvas in Claude Design, built on the Tally Baseball design system (https://claude.ai/artifact/S9gsCQAyDdR1ntfMcxcydx, private). Four boards: off day and game day, each at 390px and 1180px.
Wireframe: PR #2318, `.scratch/ws-scouting/` (its notes.md holds the order proposal). Issue: #2316. Build gate: PR #2317 merged and ADR-0117 Accepted (checked 2026-10-19).

The canvas is a mockup. Numbers tagged "Sample figures" are samples. The product reads real data and ships no sample number. A card with no real data renders nothing, and its jump-bar button hides with it.

## 1. Overview

The scouting report is a band of cards on the World Series home page (`WorldSeriesHome`). It sizes up the one opponent, compares the two clubs, and shows the past regular-season meetings in the open. It is a second-screen aid for a hand scorer. It is not a data-entry tool. One opponent only: no toggle, no series odds.

## 2. Order

Phone order. Pairs in brackets sit side by side from 740px.

- Off day: Hero, [Ledger], Reel, then the band head and jump bar, [Nine keys | Glove and legs], [Matchup edges | Pitch by pitch], [Platoon | Park fit], Film room (full), Played (phone), The trip, [Home and road | Bullpen].
- Game day: Hero, [Ledger], Reel, Probables, then the band head and jump bar, [Matchup edges | Umpire edge], [Pitch by pitch | Platoon], [Tale of the tape | Hot bats], Film room (compact), [Park fit | Bullpen].
- Existing cards do not change. Glove and legs is not built until a data source exists. Park fit shows on a game day only when tonight's park is Milwaukee. The order is the wireframe's proposal.

## 3. Parts

| Canvas part | Repo part |
| --- | --- |
| Stamped card with name tab and count tag | `Card frame="stamped"` with `label` and `count` (`ui/frame/Card.jsx`) |
| Band head | `SectionHead look="band" house` |
| Film room head | `SectionHead look="rule"` |
| Jump bar with count badges | `HubTabBar variant="anchor"` (`chrome/HubTabBar.jsx`); styles in `styles/system/jumpbar/` |
| Door link | `Door` (`ui/control/Door.jsx`) |
| Hitter and Pitcher tag | `Pill`. Keep the as-built grounds: `--field-soft` for hitter, `--clay-soft` for pitcher. The word carries the meaning. |
| Photo slot | `Headshot` (`components/player/Headshot.jsx`). Chain: silo, then milb, then team logo, then monogram. Sizes use the `--shot-*` rungs. |
| Player name | `PlayerLink` |
| Pitch shape and colour | `PitchMark` and `pitchMark(code)` (`lib/pitch/pitchTypes.js`). Never choose a pitch colour in a screen. |
| Figures | `StatStrip` and `StatCell`; the leading figure gets `.ww-best` |
| Layout | `Stack`, `Cluster`, `Grid min={340} gap="loose"` |

## 4. Tokens

Use semantic tokens from `src/tokens`. Check that each name exists before you use it. No raw hex (`check-raw-values`).

| Token | Use |
| --- | --- |
| `--bg-canvas` | Page |
| `--surface-card` | Card paper |
| `--surface-stamped-tint`, `--surface-stamped-ink` | Tint and ink tones |
| `--border-stamped`, `--shadow-stamped` | 2px ink edge and the 4px hard offset shadow |
| `--text-heading`, `--text-body`, `--text-muted`, `--text-caption` | Text roles |
| `--marker` | Leader emphasis (highlighter yellow). Never `--seal*`. |
| `--field`, `--clay-deep` | Positive and negative, always paired with a word or sign |
| `--accent-tint` | Count badge on the current jump-bar item |
| `--focus-ring` | 2px ring with a 2px offset |
| `--space-1` to `--space-16`, `--app-gutter`, `--tap-min` (44px) | Spacing and tap targets |
| `--fs-label` 12, `--fs-cell` 11, `--fs-small` 13, `--fs-ui` 14, `--fs-h3` 17 | Type sizes |
| `--fs-score-lg` 46 (phone), `--fs-hero-xl` 56 (from 740px) | Stat values |

Names, labels and tab text use the display face, uppercase by the style sheet. Figures are mono and tabular. No club colour on any card, tile or control.

## 5. Card specs

| Card | Verdict style | Day types | Player links | Data | Renders nothing when |
| --- | --- | --- | --- | --- | --- |
| Nine keys (as built) | Numbers on a 1 to 30 track; a failed key is struck | Off day | No | `nine-keys.json` | No file for the season |
| Glove and legs | Mark on the leader | Off day | No | NO SOURCE: do not build | Always |
| Matchup edges | Numbers only; face-off rows | Both | Yes, both players | `career-matchups.json` by gamePk | No row clears a threshold |
| Umpire edge (as built) | Five-step lean | Game day, once the crew posts | No | `umpires/` | No umpire posted |
| Pitch by pitch | Edge pill: Arm, Bats or Even, with xwOBA behind it | Both | No (Door to Scout) | `hitter-grid`, `pitch-arsenal` | No data |
| Platoon | Marker on the leader; tint on the hand each club faces | Both | No | Open: find and verify | No data |
| Park fit | Numbers only | Off day; game day only at Milwaukee | No | `spray`, `lib/ballpark` | No data |
| Film room | Numbers only | Off day full; game day compact | No (Door to Box score) | Meetings | Zero meetings |

## 6. Face-off row (Matchup edges)

- A row has three columns: side A, the word "vs", side B (`1fr auto 1fr`). The career line sits under them, centred.
- A side is a `Headshot` (44px) and the name, with the role pill under the name. Side B mirrors side A: photo at the right edge, text right-aligned.
- The opponent's role is the opposite of the subject's. A hitter row has the pitcher on side B.
- Each side is one `PlayerLink`, at least 44px tall. A hairline separates rows.
- Pitch by pitch header: `Headshot` 44px, the pitcher's name, and a caption "RHP · club · projected Game N starter".
- Film room starter: `Headshot` 36px, then "TB · name · hand", then the pitching line.
- Missing photo: the `Headshot` chain ends in a monogram. Missing opponent id: draw the monogram, never a blank.

## 7. States

| Element | State | Behaviour |
| --- | --- | --- |
| Jump-bar item | Current | Ink fill, cream text, count badge on `--accent-tint` |
| Jump-bar item | Press | Moves 2px down and right (stamp ease) |
| Jump-bar item | Focus | 2px `--focus-ring`, 2px offset |
| Door | Press | Moves 2px down and right |
| Player link | Focus | 2px ring around the whole side |
| Film room details | Closed or open | Native `details`; the marker reads + or minus |
| Card | Loading | Render nothing until data arrives. No skeleton, no spinner. |
| Card | No data | Render nothing; hide its jump-bar item |

## 8. Responsive

- Below 740px: one column. The jump bar is one row that scrolls sideways. Film room on an off day is a snap rail (same pattern as `Reel`), about 82% card width so the next card peeks.
- 740px and up: pairs through `Grid min={340} gap="loose"`. The jump bar wraps inside a bordered box. Stat values grow to `--fs-hero-xl`. Film room is three across.
- 740px is the one wide step (`check-media-widths`). Use no other width.

## 9. Edge cases

- The opponent is the Rays (139) or the Guardians (114). Test both. No "Brewers only" state.
- Long names: truncate with an ellipsis inside the side, never push the "vs" off the row.
- A count tag is one line; it truncates and never wraps.
- Three meetings today. Zero meetings: hide Film room and its jump-bar item. More than three: keep date order, oldest first.
- MiLB data degrades to `''`, `null` or a dash. This page is MLB only, but keep the pattern.
- A Series game is not a meeting. Only regular-season games between the two clubs count.

## 10. Motion

- A card appears with the stamp-in (380ms, `ease-stamp`), staggered 55ms. Use the existing card class. Off under `prefers-reduced-motion`.
- A press moves a control 2px. Nothing else animates.

## 11. Accessibility

- Focus order follows the visual order: jump bar, then cards top to bottom, left to right.
- The jump bar is a `nav` with `aria-label="Scouting report cards"`. The current item has `aria-current`.
- The photo is decorative when the name sits next to it: `aria-hidden="true"`.
- A struck rank carries hidden text "failed", so the strike is not the only cue.
- Every tap target is at least `--tap-min`. Text holds 4.5:1 (`check-contrast`).
- No `title=` attribute carries information. Each card is a `section` named by its tab. The film-room rail has a label and takes keyboard focus.

## 12. Copy

- ASD-STE100: short sentences, active voice. Say "postseason", never "playoffs".
- Sentence case in the source; uppercase comes from the style sheet.
- Records read `103-59`, rates read `.636`, a rank in a track is a bare number.

## 13. Spoiler footing

- Every card is an open surface (ADR-0034). Every read ends the day before the slate date (ADR-0087, ADR-0088). Today's game never feeds a card.
- The meetings are past games. Their box score opens by its date (ADR-0117). The Box score door is a plain link: it sets no flag and writes no `bbsbh:boxreveal:*` key. The innings viewer stays sealed.
- Import no reveal-only module (`linescore.js`, `derive.js`, `hitchart.js`).

## 14. In the canvas but not built

- "Sample figures" tags: they mark sample data.
- Dashed boxes: they stand for existing cards.
- The One-sheet door: no one-sheet exists yet.
- The two held-count tiles above the Nine keys track: a canvas proposal. `SeriesNineKeys` has none. Hold for Gary.
