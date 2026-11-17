# Home explorers

An explorer is a home-page card for digging into a season: a few ways to rank it (tabs), a
list to pick from, and one item shown in motion. Longest At-Bats
(`components/offseason/LongAtBats.jsx`) and Wild Rides (`components/explorers/wildrides/`) are
the two so far. The decisions behind this page are ADR-0134.

## How one gets built

Live with Gary, in one session:

1. Wireframe a few ideas as a local page (not an Artifact), with real rows and sample detail.
2. Build a rough draft on real data at its own route.
3. Run `/design:design-critique` passes on the parts Gary circles, and fix as you go.
4. Ask an independent reviewer for a critical read before shipping work.
5. Make it ship-ready (below), then put it on the home card.

## The parts

| Part | Where | Use |
| --- | --- | --- |
| Tabs | `components/explorers/ExplorerTabs.jsx` | The house `Segmented`, each option a name over a one-line meaning; `tool` adds a separate dashed button (Wild Rides' Draw) |
| Copy | `lib/explorers/copy.js` | `club`, `abbr`, `ord`, `lastName`, `past` (below) |
| Scorebug | `components/gamehud/HeaderBug.jsx` | Gameday's own bug. In a ride, wrap it in a `memo` child so it redraws when the game state changes, not every frame |
| Club plate | `.seasonnote__result--club`, `.wr-plate` | The batting club's colour, its mono mark, the batter as a cutout (the house At bat panel) |
| Scroll list | `components/ui/layout/ScrollCue.jsx` | Gameday's scroll box: the scorebook scrollbar and the bouncing "more below" chevron. Zebra rows on `--surface-inset` |
| Park | `components/ballpark/BallparkDiagram.jsx` + `lib/ballpark/ballFlight.js` | The real park and a ball's flight to its landing spot |

## Copy

Write like a beat writer, not a stat sheet.

- Lead with runs, leads and innings ("7 run lead the Nationals blew in the 8th"), not percentages.
- A club in a sentence is its nickname ("the Red Sox"); an abbreviation only in a score or a tight row.
- A headline is past tense ("Durbin singled to walk it off in the 13th"); a play as it happens is present ("Durbin singles").
- A player by his last name; suffixes dropped.
- Say who won the moment: a strikeout is the pitcher's, a hit-by-pitch or an error is the batter reaching.
- One fact per headline. No colon reveals, no stat lists.

## Data: the recipe

1. **Generator** (`scripts/gen-*.mjs`): read each Final game once, through `lib/statsapi.mjs`,
   with a `fields=` list of only what you read. Keep a summary per game in a scan file
   (`scripts/data/*-scan.json`) so a nightly run reads only new games. Default season from
   `lib/time/season-in-play.mjs`. Put it on the nightly cron, gated on finals.
2. **Index**: the top rows per tab, a few KB, with a `generatedAt` and an `index.json` stamp
   for the freshness guard. This is all the card loads at first.
3. **On demand**: anything bigger loads when asked for, e.g. Wild Rides' Draw file (every
   game as a 24-character PAA shape word, ~55 KB gz) when Draw opens.
4. **Detail**: one game's full data is read client-direct from statsapi when it is picked,
   with a trimmed `fields=` list (measure it: the trimmed read must give the card the same
   values as the full feed). Defer it until the card is near the screen.
5. **Logic in `src/lib/`** with unit tests; the generator imports it, never a copy.

Wild Rides went from 11.3 MB to about 40 KB this way. Longest At-Bats' per-pick read went
from 610 KB to 352 KB.

## Motion

A ride steps through its moments and can always be scrubbed: drag, tap, or arrow keys, with
pause and replay. Under reduced motion (`hooks/preferences/motionIsReduced.js`) it shows the
whole thing at once. Keep the per-frame work small: only the line, dot and marks change each
frame; memoize everything else.
