# Pivotal plays: what is missing after the biggest swings

Status: idea, shaped. Not built. Working note, not the tracker. Idea 2 in issue #2811.
Written 2026-11-03. Every number below was measured that day with the probes in this folder.

## Short answer

The idea as first pitched ("after reveal, show the plays that decided the game") is mostly built.
Two parts are not:

1. **A turning point.** The one play after which the winner's win probability never fell back to
   50% or lower. Today nothing says when a game was won, only which plays moved the most.
2. **Leverage.** The repo ranks by how far a play moved the win probability. It never reads the
   feed's own leverage index. Leverage picks out the tense spots, including outs where nothing
   scored.

A third item is a small fix: a quiet game can show a thin ledger.

## What exists today (read in the repo, 2026-11-03)

| Piece | Where | What it does |
|---|---|---|
| Win-probability chart | `src/components/charts/WinProbChart.jsx`, `src/api/winprob.js` | Plots the home win % per play. Reveal-only (ADR-0001), clamped by `throughHalf`. |
| Biggest swings ledger | `SwingLedger.jsx`, `selectWinProbBigPlays` | Up to 4 plays whose swing is 8 points or more, ranked by the raw swing. Each row has a Watch button for the clip. |
| Play of the Game | `computePlayOfTheGame`, `src/api/boxscore.js` | One play. Score is `|WPA| + 0.5 x captivatingIndex`, cut to 0.4 if the play helped the loser (ADR-0013). |
| Three stars | `computeThreeStars`, ADR-0013 | Players by WPA plus Game Score or linear weights. |
| Moments | `src/api/gameday/moments/moments.js` | Gameday's per-play moments. One family, `odds`, is the win-% swing. |

Not in the repo: `leverageIndex` (no match in `src/`), a turning point, any "never trailed" fact.

## Data (checked 2026-11-03)

`GET /api/v1/game/{gamePk}/winProbability`, the same call `fetchWinProbability` makes. One entry per
play. Fields used here:

| Field | Meaning | Note |
|---|---|---|
| `homeTeamWinProbability` | Home win % after the play | Already read by `selectWinProbPath`. |
| `homeTeamWinProbabilityAdded` | The play's swing, home side | Positive favors home. Already read. |
| `leverageIndex` | How much the moment mattered, 1.0 is average | Top level on the entry. **New to the repo.** The first play of a game has none. |
| `about.captivatingIndex` | An undocumented MLB score | Already read by Play of the Game. |

Over 62 sampled games every game had a `leverageIndex` on all but the first play. The endpoint is
absent at most MiLB parks, so everything here degrades to nothing there, as the chart does today.

## Measured gap

Sample: every third final game from 2026-09-01 to 2026-09-14, 62 games (`sample.probe.mjs`). A
systematic sample, not a random one.

| Question | Result |
|---|---|
| Ledger full (4 plays of 8+ points)? | 73% of games (45 of 62) |
| Ledger thin (fewer than 3 plays)? | 11% (7 of 62). Never empty. |
| Winner never at or below 50% after play 1 (wire to wire)? | 15% |
| Turning point in the 7th inning or later? | 31% |
| Turning point earlier than the 7th? | 55% |
| Is the game's top-leverage play also in the top 4 by swing? | 50% |
| Peak leverage in a game | median 3.2, 10th percentile 2.0, 90th percentile 6.0 |

How to read it:

- The ledger is fine most of the time, so the fix for thin ledgers is a small one.
- Leverage disagrees with swing size in half of all games. That is the real new information.
- Most games have a turning point, and it is often before the 7th. It tells a different story
  from the biggest swing.

## Two real games

World Series 2026, from `game.probe.mjs`.

**Game 5, Brewers 4, Rays 1 (gamePk 849799).** A calm game.

| Ranking | Top play |
|---|---|
| By swing | Contreras double, top 6th, 8.8 points. Only one play reaches 8, so the ledger shows one row. |
| By leverage | Williamson groundout, bottom 4th, leverage 2.83 (7.8 points). |
| Turning point | Turang double, top 2nd. The Brewers' win % stayed above 50% from there (52%). |

**Game 4, Rays 4, Brewers 3 in 12 (gamePk 849803).**

| Ranking | Top play |
|---|---|
| By swing | Pratt homer, top 12th, 33.5 points. Then Hicks single, bottom 12th, 30.8 points. |
| By leverage | Hicks single, bottom 12th, leverage 5.48. The top four by leverage are all in the 12th. |
| Turning point | Hicks single, bottom 12th (the Rays' win % reached 65% and stayed). |

In a close game the three views agree. In a calm one they tell three different stories.

## Gary's scrapbook: the use case (2026-11-03)

Gary keeps a physical scrapbook of the 2026 season, and a private dashboard, "Brewers 2026
Scorebook", that Claude built from the Stats API to feed it. Read-only; the dashboard was not
changed.

What it holds: 175 Brewers games, 99 of them scored by hand (87 Brewers, 12 others), in chapters
(one per month, then one per postseason round). Each scored game gets a card with: a featured
flag, the go-ahead play (labelled "Turning point"), the stars, the longest homer, conditions, the
MLB recap, clips, a photo, writing prompts, a "card to tuck in", and room for a reduced scorecard.

What Gary wants (his words): "I can quickly identify the impactful moments from all the games I
scored."

### What the card does today

Its "Turning point" is the **go-ahead play**: the play after which the winner led for good, by
the score. It is not the win-probability turning point defined above, and the two disagree often.

Measured on all 87 scored Brewers games with `scorebook.probe.mjs`:

| Question | Result |
|---|---|
| Go-ahead play matched to a play in the win-probability feed | 87 of 87 |
| Go-ahead play is the same play as the win-probability turning point | 23 of 87 (26%) |
| Go-ahead play is in the game's top 3 by swing | 57 of 87 (66%) |
| Go-ahead play is in the game's top 3 by leverage | 25 of 87 (29%) |
| Win-probability turning point is in the top 3 by swing | 24 of 87 (28%) |
| Wire to wire (no win-probability turning point) | 12 of 87 (14%) |

Example: 2026-06-06, Brewers 7, Rockies 1. The go-ahead play was the 2nd play of the game. The
win probability did not settle above 50% until the 51st. An early lead was not yet a won game.

### What this means for the design

1. **The two definitions are different facts, not rivals.** The go-ahead play says when the score
   went ahead for good. The turning point says when the game was effectively won. A scrapbook
   page can print both when they differ, and one line when they agree.
2. **Leverage finds what neither finds.** Only 29% of go-ahead plays are top-3 leverage. The tense
   spots (a stranded runner, a double-play ball) are the moments the card does not show today.
3. **It is a cross-game need.** The ask is to scan many games, so the unit is a short list per
   game (up to three moments) plus a way to compare games in a chapter.
4. **The Tally match is the Game Log.** `CONTEXT.md` defines the Game Log as the games you
   stamped. A stamped game is one you chose to reveal, so showing its moments there respects the
   spoiler rule (ADR-0042, ADR-0048, ADR-0049, ADR-0116 and ADR-0117 govern stamps; Inference:
   read them before slice 2).
5. **A chapter view needs one more number:** how dramatic a game was, to pick the featured games.
   Candidates (Inference): the sum of `|WPA|` across the game, or the peak leverage, or the count
   of lead changes in win probability. Not measured yet.

### The scrapbook dashboard now has the data (2026-11-03)

Gary asked for the extra information in his dashboard, so it was added as a working prototype of
the report below. Built by `scrapbook.build.mjs` from the game list and the winProbability feed.

- New dataset `pivotal` (99 rows, one per scored game; 14 wire to wire, 25 with a "fell as low as"
  note, 71 with three tense spots, 11 with none above the leverage floor of 2.0).
- Each game card on the Game log and Chapters tabs gained: **Game won for good** (the win-probability
  turning point), **Tensest spot**, and a **More moments that mattered** section (low point, two
  more tense spots, biggest swing, and three drama numbers).
- Nothing else in the page changed. The existing "Turning point" row (the go-ahead play) is
  untouched; the two rows now sit side by side. Gary may want to rename it "Go-ahead play".
- Not verified in a browser. The page's own check had not run, so only the stored text was
  checked (11 changed lines, the script parses).

## The standalone report (draft structure)

Gary: "on the website itself it probably is a standalone report once we figure out what the
structure is." This section is that structure, taken from what the scrapbook cards do. Not built;
a wireframe Artifact is the next step (390 px and desktop), per `CLAUDE.md`.

**Wireframe (desktop, 2026-11-03):** https://claude.ai/artifact/QeQSP3GGQA9eqv1VZCghay (private; built
with the Tally Baseball design system and Gary's real World Series games). Mobile is not drawn yet.
Not opened in a browser by Claude, so layout is unchecked.

**What it is.** One page that lists the games you stamped, grouped into chapters, and shows for
each the moments that mattered. It is for scanning many games, not reading one.

**Who it covers.** Stamped games only (Inference). A stamp is the opt-in reveal, so every moment
on the page is for a game you chose to see (ADR-0042 and the stamp ADRs; read before building).

**Page order, top to bottom:**

1. Header: season, number of stamped games, the club's record in them.
2. Chapter picker: one chapter per month, then one per postseason round (as the scrapbook has).
3. Chapter header: games, record, and the most dramatic game (once Open question 8 is settled).
4. Game entries, in date order, with a switch to order by drama.
5. A short season list at the end: the 10 biggest moments across all stamped games.

**One game entry, at 390 px** (Inference on wording; the voice rules in `docs/callouts.md` apply):

```
May 18  W 9-3 at Chicago Cubs                     Book 1 #1
  Go-ahead   Top 2: Yelich homers (3) ...  (1-0)
  Won for good   Top 2: Turang doubles ...
                 Brewers' win probability stayed above 50% from here (52%).
  Tensest spot   Bottom 4: Williamson grounds out ... Leverage 2.8
  [ More moments that mattered v ]
```

Chips on an entry, only when true: `Wire to wire` (no turning point), `Fell to 9%` (the winner's
low point at 25% or lower), `Extra innings`.

**Data.** The winProbability call per stamped game. For about 100 games that is heavy to fetch
on open, so options are: fetch one chapter at a time, or compute at stamp time and keep the
result (the stamp already stores a half-index, never a score, so storing moments needs a decision
under the spoiler rule). Open question 10.

**Two facts from the prototype that the page must handle:**

- 14 of 99 games are wire to wire: no turning point, so the row says that instead of staying blank.
- 11 of 99 games have no spot above the leverage floor: show the biggest swing instead.

## Proposal

### A. Turning point (new, one play)

Definition: the first play after which the winner's win % is above 50% for every later play. The
winner comes from the final score in the last entry.

- **Result-aware.** It names the winner, so it can only run where the whole game is revealed: the
  box score's SealBox. Never in the innings view, where `throughHalf` clamps the path
  (ADR-0001, ADR-0014). This is the rule the repo already uses for result-aware wording.
- Wire to wire (15% of games): there is no turning point. Say the fact instead, or say nothing.
  Inference: say nothing, since "never trailed" is a result the box score already shows.
- Wording follows the house voice: no verdict label such as "Turning point:". State the evidence.
  Inference: "From here the Brewers' win probability stayed above 50%." Shown as a marker on the
  chart and one line in the ledger.

### B. Tense spots (new, leverage)

Definition: the plays with the highest `leverageIndex`, top 3, with a floor of 2.0 (the 10th
percentile of a game's peak, so nearly every game shows at least one).

- **Not result-aware.** Leverage is known as the play is made, so it clamps with `throughHalf`
  like the swing ledger. It can run in the innings view for revealed halves.
- It picks plays the swing ledger skips: a groundout that ends a threat has a modest swing and a
  high leverage.
- Wording: the play, the inning, the situation. Inference: reuse the ledger's row.

### C. Quiet-game fallback (small fix)

When fewer than 3 plays reach the 8-point cutoff (11% of games), fill the ledger from the next
largest swings, down to a floor. Inference: floor of 3 points. A change to `selectWinProbBigPlays`
and its tests.

### Not proposed

- Replacing the Play of the Game. It already blends swing and captivating index, and A and B add
  different information.
- Clutch scores per player (WPA divided by leverage). Out of scope here.
- A new page. All of this fits the existing chart panel.

## Where it lives (Inference: names are proposals)

| Part | Where |
|---|---|
| `selectTurningPoint(winProb)` and `selectTenseSpots(winProb, opts)` | `src/api/winprob.js`, next to `selectWinProbBigPlays` |
| `selectWinProbPath` passes `li` on each point | `src/api/winprob.js` |
| Chart marker for the turning point | `src/components/charts/WinProbChart.jsx` |
| Ledger: a second list or a toggle | `src/components/charts/winprob/SwingLedger.jsx` |
| Tests | `test/winprob-*.test.js` (find the existing file first) |

## Spoiler-rule check

All of it sits behind the same gates the chart already uses: the box score's SealBox, or
`revealedThrough` in the innings view. The new rule is on A: it needs the final score, so it runs
only in the box score. B and C clamp like the ledger. No new fetch: the winProbability call is
already made.

## Open questions

1. **Toggle or two lists?** "Biggest swings | Tense spots" as a toggle on the ledger, or both
   lists stacked? Needs a wireframe.
2. **Is B worth a place on the Gameday sheet** (innings view, revealed halves), or box score only?
3. **Turning-point wording** and whether a wire-to-wire game says anything.
4. **The 3-point floor** for C, and whether C should be its own change.
5. **A Watch button** on tense-spot rows, as the swing rows have? It depends on the clip lookup.
6. **Name.** The repo calls the list "Biggest swings". Baseball-Reference calls its tool "Pivotal
   Play Finder" (cWPA, a season-standing measure, not the same thing). Keep the repo's plain names.

7. **Where do scrapbook moments live in Tally?** Decided in outline by Gary (2026-11-03): a
   standalone report, once the structure is settled. See "The standalone report". Whether a short
   version also sits in the Game Log per game is not decided.
8. **A drama score for a whole game**, to rank games within a chapter. Which of the three
   candidates, or none?
9. **Print both go-ahead and turning point when they differ?** The data says they differ in 74% of
   games.

10. **How does the report get its data?** One call per stamped game, fetched a chapter at a time,
    or stored at stamp time. The second needs a ruling under the stamp ADRs.
11. **Report name.** The repo says "Game Log" for stamped games. Gary's scrapbook says "scorebook".
    Neither is a report title yet.

## Slices (each at most 5 files)

1. **Selectors and tests.** `src/api/winprob.js` (turning point, tense spots, `li` on points, the
   quiet-game fill), a test file, and a fixture from a real game (849799 and 849803 are good ones).
   Done when: the two World Series games give the plays in the tables above.
2. **Chart and ledger.** `WinProbChart.jsx`, `SwingLedger.jsx`, `explore.js` if wording lives
   there, one CSS file. **Needs a wireframe Artifact first** (390 px and desktop), per
   `CLAUDE.md`. Done when: the box score of 849799 shows the marker and the lists at 390 px with
   `?nointro`.
3. **Docs.** `docs/callouts.md` or `docs/api/`, and an ADR if the result-aware rule needs one.

## Probes in this folder

- `game.probe.mjs`: ranks one game's plays by swing, leverage and captivating index, and finds the
  turning point. Run on 849799 and 849803.
- `sample.probe.mjs`: the 62-game sample behind "Measured gap".
- `scrapbook.build.mjs`: builds the `pivotal` dataset for Gary's dashboard (99 rows). Takes the
  dashboard's `gamelog.json` and an output path.
- `scorebook.probe.mjs`: compares the scrapbook's go-ahead play with the turning point on Gary's 87
  scored Brewers games. It takes the path to the dashboard's `gamelog.json` (not in the repo).

Both use `getJson` and write nothing. Source: statsapi.mlb.com, checked 2026-11-03.
