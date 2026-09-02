# Box Lines are fetched on the tap, and gated before the fetch

**Status:** Accepted
**Date:** 2026-09-02

## Context

The lineup page's Starting pitcher card carries one line about the man the
club is about to face: "Career vs MIL: 7 G, 34.0 IP, 3.44 ERA, 28 K, 17 BB",
read from the nightly `vs-team-splits` file. The line answers "how has he
done against us" with one number. It cannot answer the question that made
someone look: David Peterson's career numbers are ordinary (5.11 ERA in
2026), yet he is said to pitch well against the Brewers. The seven games
behind that line say why. His last four starts against them ran 24.2 innings
and 3 earned runs. The line hides that; the rows show it.

So the app wants a **drilldown**: tap a summary stat line and see the
game-by-game rows behind it, each linking to that game's box score. It needs
a name that later prompts can use, a data path, a shape, and — because the
lineup page is a scoring surface and every row carries a final score — a
spoiler gate that cannot be bypassed.

## Decision

### The name is Box Lines

Each row is the player's box-score line for one game, and each row links to
that box score. In a prompt: "make the box lines open from X, showing Y."
The component is `components/boxlines/BoxLinesSheet.jsx`; the data is
`api/boxlines/`. *Stubs* was considered (the app already draws games as
ticket stubs) and rejected because "stub" reads as a code stub in a prompt;
*Receipts* was rejected because "receipt" already names My Tally's sync
receipt.

### The rows are fetched live, on the tap

Two paths were weighed. `gen-vs-team-splits.mjs` already walks every game of
every rostered player's career to fold the career line, and throws the rows
away; the obvious move is to keep them. Measured on the 2026-09-02 file:

| | |
| --- | --- |
| Rostered players | 837 |
| Player-opponent pairs | 20,851 |
| Game rows behind them (summed `car.g`) | **264,770** |
| At ~95 bytes a compact row | ~25 MB, before scores |
| Today's whole dataset | 3.5 MB |

Nine times the dataset, ~850 KB a club shard, so a lineup page would read
1.7 MB for a tap that may never come — and the file is sized against the ONE
surface that opens it (`src/api/CLAUDE.md`'s third rule), which here is a
sheet opened for one man. The game log carries no final score, so the
generator would also need ~750 club-season schedule calls a run, and the
cron would rewrite hundreds of shards into git every night.

Fetched live instead (`api/boxlines/vsClub.js`), verified against the API on
2026-09-02:

1. `stats=yearByYear`, seasons only (~1 KB).
2. One `stats=gameLog` per season, in parallel, trimmed with `fields=` — a
   pitcher's season is ~7 KB (36 KB whole), a hitter's ~25 KB (96 KB whole).
   `opposingTeamId=` is ignored by this endpoint, so the club filter is
   client-side.
3. One `/api/v1/schedule?gamePks=…` call for every matching game (60 fit in
   one request, ~22 KB trimmed) — the final score, the venue, day/night, the
   Final status, and with `hydrate=team` the abbreviations the box-score path
   needs.

A twelve-season veteran is 14 requests and under 200 KB, once per session.
This is not a parallel data path: it is the same endpoint the generator
sweeps, one tier down. The file keeps the line; the tap fetches the rows.
The umpire and rookie shards are the precedent for detail on demand.

### The gate is in the data, and it runs before the fetch

The sheet opens on a scoring surface, and a row carries a final score. The
rule: **a row for a game on or after the day being scored does not exist** —
not hidden, not fetched then dropped. Two mechanisms, both in
`api/boxlines/rows.js`, classified `cutoff-gated` beside `person/gameLog.js`:

- `logRequestPlan(seasons, cutoff)` asks for the cutoff season only through
  the day BEFORE the cutoff (`endDate`, which the endpoint honours
  inclusively — verified: `endDate=2024-09-29` returns the 9/29 game,
  `2024-09-28` does not) and never for a later season. The game being scored
  is never requested.
- `boxLineRows(...)` keeps only games dated strictly before the cutoff (a
  same-day doubleheader game 1 shares the date and is out) and only games the
  schedule reports `Final`. A live, suspended or postponed game produces no
  row, cutoff or not — which is what makes the no-cutoff case on an open
  surface (ADR-0034) safe as well.

The component holds no date logic. It renders what it is handed. The cutoff
is the scored game's `officialDate` on the lineup page, the page's `?d=`
elsewhere, and null with neither. `test/boxlines-rows.test.js` pins all of
it and was written first, watched fail, then the gate landed.

What still shows: the headline is the tapped line, verbatim — the career
aggregate already open on the page. It may say a seventh meeting happened; it
never says how it went. Same as before this ADR.

### The shape is a sheet dialog, not the wire's rail and dock

The roster wire's rail (ADR-0062) and dock (ADR-0061) were considered as the
shell, since they already answer "a rail on desktop, a dock on a phone". They
were rejected. Both exist for a feed that is always there and never modal:
the dock traps no focus and takes no tap it was not given, because the slate
behind it must stay live. A drilldown is the opposite object — opened by one
tap, read for a few seconds, dismissed. That is the app's dialog contract
(`.scrim` + `.sheet`, Escape, backdrop, focus in and back), portalled through
`ModalPortal` so it can open from any surface. The lineup page also has no
reserved right margin to put a rail in; only the slate widens, and only for
the wire.

The desktop half of the picture survives as one scrim modifier
(`.scrim--boxlines`) that anchors the same sheet to the right edge, full
height, the way `.scrim--center` centres the highlight player.

### Two things the rows fixed on the way

The line printed "7 GS". The generator sums `gamesPlayed`, and Peterson's
seven include a relief outing; the rows made the mismatch visible, so the
label now says "G". And the game log's own `game.dayNight` is unreliable —
it reported "day" for two known night games (gamePks 717597 and 823770) —
so day/night is read off the schedule record, never the log.

### The name is internal; the page says "See all"

"Box Lines" is what a prompt calls this thing, and what the module paths call
it. It shipped as the door's LABEL too — "Box lines ›" at the far end of the
career line, and "Box lines · regular season" as the sheet's kicker — which put
an internal word on a page that never uses one. The reader has no way to know
what a box line is; the app's own name for these rows, in the sheet's hints, is
"game lines".

So the label is now the house `See all ›` — the same words `ui/ChevronLink.jsx`
gives every other "open the full list behind this summary" door, which is
exactly what this is — and the kicker reads `Game lines · {facet}`. The internal
name stays in `api/boxlines/`, `components/boxlines/`, this ADR and the issue
tracker, where it is doing useful work: it is short, it is unambiguous in a
prompt, and no reader ever sees it.

Two dress bugs went with it, both from the door being a real `<button>`:

- **The line sat 6px right of its neighbours.** A button carries the UA's own
  `padding: 1px 6px`, and `.boxlines-door` reset the border but not the
  padding, so the career line's ink started at 135px where every stat line
  above it started at 129px. The reset now takes the padding too. That makes
  `.boxlines-door` a FULL reset from a partial that loads after its host's, so
  a host restates its row's own dress at `button.` specificity — which is also
  what restored the dashed divider this line had silently lost.
- **Hover said nothing.** The door had `:active` and `:focus-visible` and no
  hover at all, so a mouse crossing it got no answer. It now draws the outline
  the design canvas scoped for the press (`--bw-heavy` in `--accent-link`,
  3px offset), inside `@media (hover: hover)` so a phone's sticky `:hover`
  cannot leave it drawn after the tap.

## Consequences

- One shell for every facet. A facet is a filter over the same game-log +
  schedule join. Venue and day/night are free once joined (the schedule
  record carries both, and venue by record is right at a neutral site where
  opponent + `isHome` is not). Handedness and batter-vs-pitcher rows need
  `stats=playLog` per season (every plate appearance carries `pitchHand`,
  `batSide` and the pitcher). A hitter's started/entered needs the game's
  boxscore; pinch-hit appearances need a boxscore per game row, so they
  belong in the nightly precompute or behind a cap. None of that is built;
  the map is recorded so the next facet extends `api/boxlines/` rather than
  starting over.
- The player page's Splits vs team card is the second door (issue #1007), and
  a hitter's rows do use the same shell with the hitter chyron. It is an OPEN
  surface: the career aggregate above the door is whole, and the page's own
  `?d=` is passed through as the sheet's cutoff, so the card's last-meeting
  line and the sheet's newest row stop on the same day. The door is keyed on
  the club the strip has picked, so a new pick remounts it closed rather than
  re-pointing an open sheet. Both doors word their line with one function,
  `vsTeamDoorLabel` in `api/vsTeamSplits.js`: the sheet quotes the door's label
  verbatim as its headline, so two spellings of the same career would show up
  as the door and the sheet disagreeing.
- `src/api/` and `src/hooks/` were at their file budgets, so the data went
  in a new `api/boxlines/` subdirectory and the sheet uses `useAsync`
  directly. `src/styles/` was at its budget too, so the skin is
  `styles/boxlines/boxlines.css`, component-imported.
- Pinned by `test/boxlines-rows.test.js` (the gate, the request plan, the
  row shape), `test/vs-team-splits.test.js` (both doors' wording) and
  `e2e/box-lines.spec.js` (each door opens the sheet — on a scored game and on
  a player page carrying `?d=` — every row is dated before that day, and the
  sheet closes).

## Amendment (2026-09-02, issue #997): the facet shape

Nine more facets are queued (#998–#1006), each wanting a door on the player
page. Building nine doors nine ways would give the sheet nine data paths, so
this amendment fixes ONE. Nothing about the gate changes.

- **A facet is a tagged object** (`api/boxlines/facets.js`), one of
  `{kind:'club', opponentId}`, `{kind:'venue', venueId}`, `{kind:'month',
  month}`, `{kind:'dayNight', value}`, `{kind:'weekday', day}`, `{kind:'side',
  home}`, `{kind:'started', value}`, `{kind:'gameTypes', types}`. It resolves
  to exactly three things: an `opponentId`, a set of `gameTypes`, and a
  `keep(row)` predicate.
- **`keep` runs AFTER the gate, never before.** `boxLineRows` applies its
  cutoff and Final checks first and hands `keep` only the rows that survived,
  so a facet can narrow but has no way to widen — the rows it never sees do not
  exist. An unknown `kind` keeps NOTHING rather than everything, so a typo in a
  future facet issue shows as an empty sheet, not a full one. Pinned by
  `test/boxlines-facets.test.js` and four cases in `test/boxlines-rows.test.js`.
- **Game types are a parameter, defaulting to `['R']`.** Regular season stays
  the only thing a row can come from unless a facet asks otherwise; the row now
  carries its `gameType`. This is what the postseason facet (#1006) will use —
  `gameType=P` is dead on statsapi; the live types are `F`, `D`, `L`, `W`.
- **The schedule is asked by gamePk for EVERY facet.** #997 first specified a
  call per (club, season), to spare a long career the ~34 chunk calls a
  2,000-game hitter costs at 60 gamePks each. Measured live 2026-09-02 that
  trade does not pay, and the third reason is a spoiler reason:
  - a chunk is much bigger than 60 — 162 gamePks answered in one call, 177 ms,
    URL 1,193 chars, so at the 120 now used a 2,000-game hitter is 17 calls and
    a pitcher's whole career is 3;
  - a club-season is MORE bytes, carrying all 164 of the club's games where a
    starter appeared in ~30, and two full club schedules for a traded season;
  - it leaks past the cutoff. A club-season call must be date-bounded to stay
    behind the cutoff, `season=` + `endDate=` is a 400, and the `startDate`/
    `endDate` form is both leaky and lossy — a window ending 2024-06-30
    returned gamePk 746730 dated 2024-08-30 (a rescheduled game keeps its
    original date's slot), and 2 of its 86 rows came back with no score at all.

  Asking by gamePk needs no date bound to be safe: the only gamePks that exist
  are the ones the already-cutoff-bounded splits named.
- **One join, many doors.** `fetch.js` memoizes the JOIN — the splits and the
  schedule records — per (person, group, cutoff, gameTypes), not the rows, and
  each facet runs its own `keep` through `boxLineRows` over the shared result.
  The nine doors on one card cost one fetch; the second door costs no requests
  at all. Only the club facet, which narrows the game log itself, is keyed
  separately, so the lineup page's single door stays as cheap as it was.
- **The card is a registry** (`components/playerstats/GameLinesCard.jsx`,
  titled **Game lines**, under the splits on the Stats tab, both groups). Each
  row is one `FACET_ROWS` entry — `{ sitCode, label, kicker, facet, groups }`
  — whose label figures come from ONE `careerStatSplits&sitCodes=…` call for
  every code on the card (`api/boxlines/careerSplits.js`, spoiler-free: a
  career aggregate is open here, ADR-0034). It ships with an EMPTY registry, so
  it fetches nothing and renders nothing until a facet issue adds a row.
- `fetchBoxLinesVsClub` survives as a one-line wrapper on `fetchBoxLines`, so
  the two shipped doors and `e2e/box-lines.spec.js` did not have to change.

### A trap for the home/road facets (#1004, #1005), verified 2026-09-02

The door's label and the sheet's rows come from two different statsapi
pipelines, and for home/away they do not always agree:

- **`careerStatSplits` (`h`/`a`) classifies by the PARK.**
- **The game log's `isHome` — what `boxLineRows` derives its `home` from —
  classifies by the DESIGNATED home club.**

They diverge on a RELOCATED home game. Measured over four players:

| player | rows h/a | split h/a | where |
| --- | --- | --- | --- |
| Yelich | 853/861 | 849/865 | 2017 (79 vs 76), 2020 (29 vs 28) |
| Peterson | 78/80 | 77/81 | 2020 (5 vs 4) |
| Freeman | 1152/1161 | 1152/1161 | match |
| Betts | 817/815 | 817/815 | match |

Yelich's 2017 gap is the three Marlins "home" games moved to Milwaukee for
Hurricane Irma; the 2020 gaps are the neutral-site season. Players with no
relocated home game match exactly, and day/night (`d`/`n`) matched exactly for
every player tested.

So a home or road door would be labelled "849 G" and open a sheet holding 853
rows. That is the door and the sheet disagreeing, which ADR-0069 says must not
happen. #1004/#1005 must decide which definition the app means and make BOTH
sides say it — the cheap option is to count the label off the same `isHome` the
rows use rather than off `careerStatSplits`, which costs the one-call-per-card
saving only for those two rows. Not decided here; #997 ships no rows.

### The gate asks for the score, not for the word "Final" (2026-09-02)

The original gate read `status.abstractGameState !== 'Final'` and this ADR
claimed "a live, suspended or postponed game has no row". The last third of
that was false: **a POSTPONED game reports `abstractGameState: 'Final'`** with
`detailedState: 'Postponed'` and no scores at all. Three of Christian Yelich's
139 rows against the Cubs were postponed games — gamePks 776691 (2025-08-19),
777459 (2025-08-18) and 632997 (2021-08-10) — rendering as ledger rows with a
"—" where the score goes, for games that were never played.

`boxLineRows` now requires the score itself: a row exists only when both clubs'
runs are present. That covers postponed, cancelled and any future status whose
spelling nobody predicted, and it states the invariant the sheet actually
needs — every row is a game the player played and a score he may be shown.
Pinned by two cases in `test/boxlines-rows.test.js`.

`e2e/box-lines.spec.js` had been hiding this. Its wait polled for rows OR any
`.boxlines__hint`, and that class is also on the "Pulling his game lines…"
LOADING hint, so the wait exited while the sheet was still fetching: the
lineup page's pitcher (3 requests) beat it and read as a pass, the player
page's hitter (30 requests) did not and failed at 0 rows. It now waits for the
skeletons to clear, which is what "the fetch finished" actually looks like —
and that is what surfaced the postponed rows.
