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

## Amendment (2026-09-03, issues #1000, #1003, #1004, #1005): the first six doors

The Game lines card shipped with an empty registry. It now holds six doors, and
they are the first thing that card has ever rendered: **Home** and **Road**
(#1004, #1005), **Day** and **Night** (#1000), and a pitcher's **Started** and
**In relief** (#1003's pitcher half). A hitter sees four, a pitcher six, a
two-way player each set once. Nothing about the gate, the fetch or the sheet
changed — every door is one registry entry, which is what #997 built the card
for.

The registry moved from the card to `api/boxlines/cardFacets.js`. The card is a
`.jsx` file and this repo's `node --test` suite cannot import one, which left
the facet layer's own documented failure untested: an unknown `kind` keeps
NOTHING, so a typo ships as a door that opens, loads and renders an empty
ledger with nothing anywhere saying why. `test/boxlines-card-facets.test.js`
now checks every entry against the same `facetPlan` the sheet calls, and was
watched failing on a deliberately misspelled `dayNight` before it was kept.

### The situation trap, resolved: MLB's aggregate and MLB's per-game flags disagree

The #997 amendment flagged that `careerStatSplits` (`h`/`a`) counts home games
by the PARK while the rows count the club the schedule LISTED as home, and said
#1004/#1005 must decide which the app means. Measured properly across five full
careers on 2026-09-03, **there is nothing to decide, because there is no rule
that reconciles them**:

| player | MLB `h` | listed home | at his own park | not at the opponent's park |
| --- | --- | --- | --- | --- |
| Yelich | 849 | 853 | 848 | 850 |
| Guerrero Jr | 550 | 555 | **506** | 550 |
| Betts | 818 | 818 | 815 | 819 |
| Peterson | 78 | 79 | 78 | 79 |
| Braun | 688 | 687 | 687 | 681 |

No column matches every row. The gap is small (1 to 5 games) and it is always a
season with a relocated home game — Braun matches MLB in 9 of his 10 seasons and
differs by one in 2020. And statsapi will not settle it: **`sitCodes` is ignored
on the game log** (verified — Braun's 2013 log returns all 158 rows whether or
not `h` is asked for), so MLB publishes an aggregate for a situation but never
the list of games behind it.

So the app uses stock on both sides and accepts the margin: the door prints
MLB's official career figure, the rows use MLB's own per-game flags, and a
career with a hurricane in it can have a door reading 849 above a sheet holding
853 games. That is two MLB numbers disagreeing, not the app contradicting
itself, and it is the honest state of the data.

**The third definition must not be reinvented.** Deriving "his club's home park
that season" from the games in hand and counting that was built first, on the
strength of three careers where it matched MLB exactly. It is wrong: it counts
the 2020–21 Blue Jays' Buffalo and Dunedin home games as road games, because
those parks were not the club's usual one — 44 games wrong on Guerrero alone,
and they were real home games. The `side` case in `facets.js` carries this
warning where the next author will meet it.

### Three corrections for the facets still queued

Verified live 2026-09-03, against what the issues assume:

- **`sitCodes=ven` returns nothing at all** (#998, a player at a ballpark). The
  issue allowed for this and named summing the joined rows as the fallback;
  that fallback is now the only path, and it changes the door's shape, because
  the card labels its doors before the join exists.
- **`stats=careerPlayoffs` does not return postseason stats** (#1006) <!-- word-choice-exempt: statsapi's own stat-type name, breaks the call if renamed -->
  It
  answers with the REGULAR-SEASON career — Yelich comes back 1,715 G and .282,
  which is his whole career, not his 27 postseason games. The working source is
  `stats=career&group={group}&gameType=P` (27 G, .218), or `gameType=F,D,L,W`
  for one row per round.
- **The game log does not carry postseason rows by default** (#1006 again). The
  issue states it does and that no new call is needed. A 2018 game log returns
  147 rows, all `gameType: 'R'`; the postseason rows appear only when the call
  itself passes `gameType=`. `fetch.js` would have to pass it through, which is
  real work rather than a registry entry. The schedule join needs no such
  parameter: asked by gamePk it returns postseason games with their `gameType`
  and a `seriesDescription` ("NL Division Series") worth more than a mapped
  letter.

`byMonth`, `byDayOfWeek` and `homeAndAway` exist as first-class stat types and
look like better sources than the `sitCodes` list for #999 and #1001 — but they
answer for ONE season (no `season` returns the current one, and a retired player
gets nothing), so a career needs one call each and the sitCodes list stays the
cheaper route.

## Amendment (2026-09-10, issue #1006): the postseason door

The seventh door on the Game lines card, and the first whose rows are not the
regular season. It is also the first that changes what the fetch ASKS FOR
rather than only what the gate keeps, so it is worth saying where the line now
falls.

### The game types are asked for, not filtered for

`fetch.js` now passes `gameType=` on both of its stats calls. The 2026-09-03
correction above — a game log carries no October unless the call names it —
turned out to have a second half: the same is true of `yearByYear`, and that is
a saving rather than a cost. `yearByYear&gameType=F,D,L,W` returns the five
Octobers Yelich has played, not his fourteen seasons, so the postseason join
fetches five game logs instead of fourteen and never asks about a summer he
spent at home. `gameType=R` returns exactly what the bare call did on both
endpoints (verified 2026-09-10 on 453286 and 592885), so the club door's fetch
is unchanged by being made explicit.

This door does not share the six others' join, and cannot: the memo key carries
the game types, and a regular-season join does not contain an October game to
filter for. That is one extra fetch on a card, paid only by a reader who opens
the door.

### `gameType=P` is not dead — it is worse than dead, on one group

The 2026-09-02 note above says `P` is dead on statsapi and the live types are
`F`, `D`, `L`, `W`. The first half is wrong and the correction matters, because
`P` *works*: it selects exactly the right games. What it does not do is survive
the round trip. Ohtani's 2025, the same games, one call apart (2026-09-10):

| call | rows | each row's `gameType` |
| --- | --- | --- |
| `group=pitching&gameType=P` | 4 | `P`, `P`, `P`, `P` |
| `group=pitching&gameType=F,D,L,W` | 4 | `D`, `L`, `W` |
| `group=hitting&gameType=P` | 17 | `F`, `D`, `L`, `W` |
| `group=hitting&gameType=F,D,L,W` | 17 | `F`, `D`, `L`, `W` |

**The pitching game log echoes the type that was asked for into every row it
returns; the hitting log reports the game's own.** Confirmed on one player, one
season, both groups, so it is the group that differs and not the era or the
career. Verlander and Kershaw reproduce the pitching half back to 2006; Ortiz
and Pujols the hitting half back to 2001.

That would have cost a pitcher two things at once. The row's `gameType` is both
the filter (`matchingSplits` keeps only rows whose type was asked for) and the
pill, so a door asking with `P` renders a full sheet for a hitter and an empty
one for a pitcher, with nothing on either to say why — the exact silent,
asymmetric failure the registry's own test file exists to prevent. So:

- `rows.js` exports `POSTSEASON = ['F', 'D', 'L', 'W']`, and the measurement
  sits beside it rather than in a commit message.
- `askableGameTypes` rewrites a requested `P` to those four. It is not a
  different question — both spellings select the same games — only the spelling
  that survives. A facet cannot ask the losing way.
- `seriesAbbr('P')` is `''` on purpose. A row still carrying `P` came from a
  call that asked the wrong question, and a blank pill is the visible end of
  that rather than a confident wrong `WC`.

### The pill is the letter, not `seriesDescription`

The 2026-09-03 note called the schedule's `seriesDescription` ("NL Division
Series") worth more than a mapped letter. It is worth more, and it is still not
what the row wears. The pill sits in a ledger row's meta cell beside the date
and `@ LAD`, on a phone; `DS` fits there and `NL Division Series` does not. It
would also cost bytes on every facet's schedule call, since `SCHEDULE_FIELDS`
is shared with the six regular-season doors that have no use for it. The league
is the one thing the letter drops, and the row already names both clubs.

### The label comes from a career total, not a situation

`careerStatSplits` answers "his career, in these situations", which is what the
other six doors are. The postseason is a career under a different GAME TYPE,
and statsapi keeps the two apart. So `careerSplits.js` grew a second source —
`stats=career&gameType=P`, which returns one row and the right one (Yelich 27 G
/ .218; Scherzer pitching 33 G / 157.1 IP / 3.78 ERA, 2026-09-10) — and
`fetchDoorLabels` became the card's one entry point: it reads whichever source
each registry entry names, in parallel, and returns one Map keyed by door.
`P` is safe there, where an aggregate has no per-row type to poison.

A registry entry therefore names exactly one label source, `sitCode` or
`careerGameType`, and `test/boxlines-card-facets.test.js` pins that — an entry
naming neither would render no label and so never render at all.

### The door/rows margin has a second cause, and this one is not reconcilable either

Yelich's postseason door says 27 games and his sheet renders 27. Scherzer's says
33 and renders 31. The two missing are gamePks 317054 (2011 ALCS) and 345619
(2012 ALCS) — games he really pitched, whose boxscores still carry his line
(6.0 IP / 6 K and 5.2 IP / 10 K). Both were rained out, replayed the same day
under the SAME gamePk, and MLB left the schedule row at `detailedState:
'Postponed'` with no score on it.

The gate drops them, correctly: it asks for the score itself rather than for
one more spelling of a status, which is what keeps the three never-played
postponements out (776691, 777459, 632997). And on the schedule endpoint a
played-but-stuck game is INDISTINGUISHABLE from a never-played one — verified
2026-09-10 that `hydrate=linescore` returns nulls for all five. The only source
that separates them is the game's own boxscore, one call per suspect row, which
is the cost this whole design exists to avoid.

So the margin stands, for the same reason the home/road margin stands: the door
prints MLB's aggregate and the rows print what MLB will confirm game by game.
Do not close it by loosening the gate. If it is ever worth closing, the fix is
a boxscore read for the handful of rows the gate dropped for want of a score —
which is #1002's machinery, not this door's.

### What did not change

The gate. A postseason game on or after the cutoff has no row, an unfinished
one has no row, and a facet still cannot reach around either — `keep` runs last
where it always did, and this facet does not even use it. Pinned by four new
cases in `test/boxlines-rows.test.js`, including that a split still tagged `P`
is dropped by the default AND by the postseason facet.
## Amendment (2026-09-14, issues #999, #1001, #1002): the calendar, the bench, and four headings

Sixteen more doors, and not one of them needed a new data path: eight months
(#999), seven weekdays (#1001) and a hitter's pinch hitting (#1002). What they
did need was a card that can hold twenty doors, which the flat list could not.

### Two facets MLB publishes, verified before they were built

The 2026-09-03 correction above found `sitCodes=ven` returning nothing and
warned that `byMonth` and `byDayOfWeek` answer for one season only. Both of the
remaining calendar codes were therefore checked the same way before a line was
written (2026-09-14, personId 592885 hitting and 656849 pitching):

| source | result |
| --- | --- |
| `careerStatSplits&sitCodes=3,4,5,6,7,8,9,10` | one career row per month, both groups, March through October |
| `careerStatSplits&sitCodes=dmo,dtu,dwe,dth,dfr,dsa,dsu` | one career row per weekday, both groups |
| `careerStatSplits&sitCodes=pH` | one career row; `ph` lower-case returns nothing |

**And, for once, the door and the rows agree exactly.** The home/road doors
carry a margin nothing can reconcile; the calendar doors carry none. Measured
over three careers, MLB's aggregate matched the joined rows for every month and
every weekday, with no exceptions — Yelich 21/221/272/292/290/326/287/16 by
month and 277/198/267/257/161/277/288 by weekday, door and rows, and the same on
Peterson and Vazquez. That is not luck: a month and a weekday are facts about
the date, and the date is the one field the game log and the schedule record
cannot disagree about. A relocated home game moves a park; it does not move a
Tuesday.

### The pinch-hit facet costs nothing, and the issue said it would cost the most

#1002 was the expensive one on this ADR's own framework map: "pinch-hit
appearances need a boxscore per game row, so they belong in the nightly
precompute or behind a cap." The issue specified that literally — one
`/game/{gamePk}/boxscore` per candidate, `battingOrder` and
`gameStatus.isSubstitute`, capped at 40 newest-first with a "Show older", a
memo per gamePk, and a loading hint that counts the boxscores out loud.

None of it was built, because the answer is already in hand. **The hitting game
log carries `positionsPlayed`** — the positions he played that day, in the order
he played them — on every split, and `fields=` keeps it. `['PH']` is a pinch
hitter who was then lifted, `['PH', 'LF']` one who stayed in the field, `['DH',
'LF']` a start. So the facet is a `keep` over the join every other door on the
card already pays for: no cap, no paging, no per-game fetch, nothing to memoize.
It costs 3 KB on a 19 KB season log (Yelich 2024), asked for on every hitting
join rather than only the pinch-hit one, because all of a card's doors share ONE
join and a second differently-shaped join would cost far more than the 16%.

Checked against MLB's own `pH` aggregate: Vazquez 55 rows against a door of 55,
Castro 44, Yelich 46 against 45. The one extra is a game he was announced for
and never completed a plate appearance in — MLB's aggregate counts appearances,
these rows count entrances. Over three careers `PH` never appeared anywhere but
first in the list, so reading `[0]` and asking `includes` are the same question
today; `[0]` is the one that stays right if a fourth career disagrees.

### The card grew four headings, and takes their order from the registry

Seven doors needed no headings. Twenty do: a flat list of twenty ledger rows is
a wall, and the four groups were already in `cardFacets.js` as comments —
**Where**, **When**, **How he got in**, **When it counted** — doing nothing for
the reader. They are now `SECTIONS`, and the card groups by that list rather
than by the registry's order, so a door added in the wrong place files itself
correctly instead of silently reordering the card. A heading with no door under
it does not render.

### The weekdays are chips, because a weekday split is a comparison

The other nineteen doors are ledger rows carrying the whole career line. The
seven weekdays are a compact grid instead. A weekday split is not seven separate
questions; it is one comparison — is he worse on getaway day? — and a comparison
wants its answers side by side, where seven stacked near-identical sentences
bury the differences. The grid is `auto-fit` on a 92px floor, so the track count
follows the width (three across a phone, seven across a desktop column) and no
chip falls below the width its longest line needs. Not a scrolling row: that
would hide the last weekdays behind an edge, which is the one thing a comparison
cannot survive.

A chip prints `chipLine` — games and one rate stat — where a ledger row prints
`careerSplitLine`. Both read the SAME career stat object, so a chip and the
sheet it opens cannot disagree about the career, only about how much of it they
have room to say. `label` therefore stops being the chip's visible text and goes
on being the one thing it was always for: the sheet's headline, verbatim, and
the button's accessible name. The chip keeps the house chevron and drops the
words "See all" — seven of them on one row is noise where one on a line is a
plain promise.

### What did not change

The gate, again. `keep` runs last where it always did; none of these sixteen
doors touches the fetch, the cutoff or the game types; and
`test/boxlines-rows.test.js` pins that a pinch-hit appearance in a game on the
cutoff day still has no row. The registry's own test file grew the case that
matters for a family built from a table rather than written out fifteen times:
each month door's `sitCode` must name the same month its facet does, so an entry
that asks MLB about August and filters rows for September is a failure rather
than a quiet wrong answer.

### #998 and #1003's hitter half are still open, and one of them got cheaper

Neither shipped here. Both want a door whose figures do not exist until the
sheet's fetch has run — `ven` returns nothing, and there is no started/sub
situation code for a hitter — so both are the same open design question: what a
door with no figures on it should look like. That is a decision, not a registry
entry.

**But #1003's hitter half no longer needs a boxscore either.** The schedule
endpoint takes `hydrate=lineups`, which returns the nine starters a side, and
with `fields=…,lineups,homePlayers,awayPlayers,id` it trims to bare ids: +34 KB
on a 53 KB call for 120 games, on the schedule call the join already makes.
Measured 2026-09-14 across six seasons of a club's schedule, **every game that
was actually played carries a full eighteen-name lineup** back to 2008; the only
games missing one are the games with no score, which the gate already drops. So
"did this hitter start?" is answerable for free, and the 40-row cap and paging
that issue specifies are as unnecessary as #1002's were.

`positionsPlayed` alone will NOT answer it, and this is the trap to record: a
hitter's first position is `PH`/`PR` only when he entered as a pinch hitter or
runner. A pure defensive replacement enters and his list reads `['C']`, exactly
like a start. Measured over three careers, that is 63 games wrong on Vazquez, 25
on Castro, 3 on Yelich. Use the lineups.

## Amendment (2026-09-15, issue #1003): the bench, the surface, and a source nobody had asked

Four more doors: a hitter's **Started** and **Came in** (#1003's hitter half, the
last piece of that issue), and **On grass** and **On turf** on both groups. One of
them closes a question this ADR had recorded as a design decision. It was not one.

### #1003 was blocked on a claim that is true of the wrong endpoint

The 2026-09-14 amendment above left this issue open because "there is no
started/sub situation code for a hitter", so its door "cannot print figures at
page load either" — the same open question as #998. That is true, and it is only
true of `situationCodes`. All 602 of them were re-read on 2026-09-15 and there is
no such code; there is also no `Order`-menu or `Position`-menu combination that
makes one, because a pinch hitter occupies a batting slot and a defensive
replacement occupies a position.

**The fielding career carries it.** `stats=career&group=fielding` returns a row
per position a player has played, and every row carries `gamesStarted`. One game
contributes one start, at the position he STARTED at, so the sum over positions
is his career starts; his career games minus that is the bench. One request.

Measured against the truth — the schedule's own lineups, game by game — over
eleven hitters:

| | career G | starts, fielding | starts, lineups | bench, fielding | bench, truth |
| --- | --- | --- | --- | --- | --- |
| Peralta | 2,174 | 2,086 | 2,090 | 88 | 88 |
| Yelich | 1,725 | 1,672 | 1,674 | 53 | 51 |
| Semien | 1,758 | 1,732 | 1,735 | 26 | 25 |
| Soto | 1,195 | 1,180 | 1,185 | 15 | 15 |
| Turang | 608 | 472 | 471 | 136 | 138 |
| Taylor | 646 | 488 | 490 | 158 | 159 |

The starts figure lands within 5 and the BENCH figure — the small one, and the
one a reader looks at — within 2, every time. It reaches as far back as the app
will ever ask: Bonds (debut 1986) returns 2,848 starts of 2,986 games.

So these two doors need no new door SHAPE and no reversal of the fetch-on-tap
rule. They need one new label source, and `careerSplits.js` now names three
rather than two. What they do not carry is a rate stat — a fielding row holds no
batting average — so they print `1,672 G` where their neighbours print five
figures, and `doorLine` is the one function that lets one card hold both.

**The rows come from `hydrate=lineups`, and `positionsPlayed` still will not do
it.** A hitter's first position is `PH` or `PR` only when he entered as a pinch
hitter or runner; a pure defensive replacement enters and his list reads `['C']`,
exactly like a start — 63 games wrong on one career. The lineup array is also in
BATTING ORDER (index 0 is the leadoff man, checked against the boxscore's own
`battingOrder` on gamePk 747043), which is a fact the next facet will want.

### The lineups are a second pass, not a hydrate on the shared call

#1040 assumed `lineups` would ride along on the schedule call the join already
makes. Measured over 73 gamePks, that costs **+65%** — 32.3 KB to 53.4 KB — on
every hitter's join, where two of a card's twenty-five doors need it. Asked on
its own, with `fields=` trimmed to bare ids, the same games cost **23.3 KB**: the
same bytes, and only the reader who opens one of those two doors ever pays them.
So `facetPlan` returns `needsLineups`, `fetch.js` memoizes that pass on the same
key as the join, and the other twenty-three doors are untouched.

`positionsPlayed` went the other way for #1002 (16% on the log, carried by
everyone) and that was right for 16%. This is 65%. The rule the two cases make
together: ride along when it is cheap, go back for it when it is not.

### The surface rides along, because it IS cheap

`hydrate=venue(fieldInfo)` puts `turfType` on the schedule record for **+7%**
(32.3 KB to 34.7 KB over the same 73 gamePks), so it is carried on every facet's
join and the row gains a `surface`.

**It is season-correct, which is the whole reason it is read off the game.**
Chase Field comes back `Grass` for 2016 and 2018 and `Artificial Turf` from 2019
— which is exactly when it was relaid (verified 2026-09-15 on real gamePks at
that park). A static table of today's surfaces, which is how anyone would build
this without checking, would have called eighty-one 2016 games turf.

**And the door and the rows agree to the game**, which puts this pair with the
calendar doors rather than with Home and Road:

| | door (`g`/`t`) | rows |
| --- | --- | --- |
| Yelich | 1,671 / 54 | 1,671 / 54 |
| Frelick | 562 / 67 | 563 / 68 |
| Peterson (pitching) | 148 / 13 | 13 turf rendered against a door of 13 |

### The Came in door's margin has TWO causes, and both are already documented

Yelich's Came in door says 53 and his sheet renders 49. Read that gap as one
number and it looks like a broken facet. It is two known margins stacked:

- **4 of it is the source margin** above — MLB's fielding aggregate against
  MLB's own lineups, the same kind of disagreement Home and Road carry.
- **the rest is the gate**, which drops 22 of Yelich's 1,725 regular-season games
  for want of a score. That is the same arithmetic that makes Scherzer's
  postseason door say 33 over a sheet of 31, and this ADR already says why:
  a played-but-stuck `Postponed` row is indistinguishable from a never-played one
  on the schedule endpoint, and the gate asks for the score rather than for one
  more spelling of a status.

Every one of the 1,703 gated rows got an answer from the lineups — no game came
back without one — so none of the gap is missing lineup data. A game that ever
does come back without one is `null` and belongs to NEITHER door, because "nobody
posted a card" is not evidence that he came off the bench.

### Why the batting order is not here, though it looked free

`sitCodes=b1…b9` return real career rows on both groups, and the lineup array is
already in batting order, so nine more doors look like a table away. They are
not, and the reason is worth recording before someone tries:

**MLB's `bN` counts games with a plate appearance in slot N; a lineup counts who
STARTED there.** A pinch hitter bats in the slot he hit for, and that is usually
the bottom of the order. Measured on 2026-09-15:

| | b1 | b3 | b5 | b7 | b9 |
| --- | --- | --- | --- | --- | --- |
| Yelich, MLB | 451 | 696 | 31 | 13 | **18** |
| Yelich, lineups | 447 | 695 | 24 | 6 | **0** |
| Frelick, MLB | — | 85 | 92 | 105 | **68** |
| Frelick, lineups | — | 85 | 89 | 101 | **42** |

A door reading "Batting ninth: 18 G" over an EMPTY sheet is the exact failure
this ADR's registry test file exists to prevent. So the batting order is not a
registry entry. It wants a door that opens a LIST — the nine slots with his line
at each, folded from the gated rows, each opening its own rows — which is the
same shape #998's 36 ballparks want, and it should be built once for both.

## Amendment (2026-09-15, issue #1031): the stuck rows were played, and the score is recoverable

The 2026-09-02 note above says a postponed game is "a game that was never
played". **That is wrong for almost every such game, and it cost the sheet
rows.** Some games MLB left at `Postponed` were rained out, replayed the SAME
DAY under the SAME gamePk, and the schedule row was never updated. It still
answers `abstractGameState: 'Final'` with no score on either side, so the gate
dropped it — and a door on the Game lines card then counted a game its own sheet
never showed. Scherzer's Postseason door said 33 over a sheet of 31; the two
missing rows are his 2011 and 2012 ALCS starts (gamePks 317054 and 345619).

### How many, and which

Every "Final with no score" row on nine full seasons' schedules — 2011, 2014,
2017, 2019, 2020, 2021, 2023, 2025 and 2026 — measured against the game's own
linescore and play-by-play on 2026-09-15:

| | |
| --- | --- |
| Scoreless `Final` rows | 406 |
| Of those, really played (runs AND plays) | **400** |
| Never played (no runs, no plays) | 6 |

The only other scoreless shape on those schedules is `Preview`/`Scheduled` — a
future game, which the Final check already drops. So the gate was throwing away
one real game for every fifteen it was built to catch, and the three gamePks
this ADR named as "never played" (776691, 777459, 632997) are all in the 400.

Per career, the drop is about 1% of the games: 2 of Scherzer's 33 postseason
starts, 10 of his 498 regular-season ones, 22 of Yelich's 1,725, 33 of Freeman's
2,321, 36 of Jeter's 2,747, and 69 of Cabrera's 2,797 — the worst measured.
Careers that ended before the mid-1970s have none at all: Aaron's 3,298 games,
Rose's 1,419 and Ryan's 807 return no stuck rows, so this is an artifact of the
modern schedule record and not of old data.

### The fix, and why it does not loosen the gate

**The gate still asks for the score.** What changed is where the score may come
from. The schedule endpoint cannot separate a played-but-stuck game from a
never-played one — `hydrate=linescore` answers `runs: null` on both — but the
game's OWN linescore can, and it is the cheapest call in the app:

```
/api/v1/game/{gamePk}/linescore?fields=teams,home,away,runs   ->   47 bytes
```

`rows.js` gained `scorelessGamePks`, which runs the SAME gate and returns only
the games it turned away for want of a score. `fetch.js` reads each one's
linescore and hands the answers back as `recoveredScores`. Three properties make
that safe, and all three are pinned in `test/boxlines-score-recovery.test.js`:

- **Nothing new is asked about.** The recovery list comes out of the gate, so a
  game at or after the cutoff and a game the schedule does not call Final are
  never named, never mind fetched.
- **It fails closed by itself.** A game that was really never played has no runs
  on its linescore either, so it is absent from the map and stays dropped — the
  same answer as today. So does a call that errors.
- **It can only add a row.** A schedule record that has a score keeps it; the
  recovered map is consulted only where the record is empty.

It rides in the memoized JOIN rather than behind a facet, the way
`positionsPlayed` does and the lineups pass does not. The reason is the bug
itself: a door that counts a game its own sheet hides has to close for every
door at once, and the join is the only place all of them share. The cost is one
call per stuck row on the first door opened and nothing after that — 180–280 ms
at six at a time for the careers above.

`SCORE_RECOVERY_CAP` is 150, which no real career approaches. It is a ceiling on
the SOURCE going wrong, not on a long career: if the schedule endpoint ever
stopped scoring games wholesale, the cap is what stops a sheet firing a request
per game, and the gate simply stays as closed as it is today.

### What it closes, measured on the page

Yelich's Game lines card, 2026-09-15, after the fix: Day renders 591 rows and
Night 1,134, which is 1,725 — every regular-season game he has played, where the
two sheets held 1,703 between them before. The 22 linescore calls are made on
the FIRST door opened and none after it, because the recovery rides in the
shared join. Scherzer's Postseason door and its sheet now both say 33.

**And the Came in margin above was mis-split.** That amendment reads the 53-vs-49
gap as "4 of it is the source margin… the rest is the gate", which cannot be
right: 4 and 22 do not fit inside a gap of 4. The true split, now visible: of the
22 games the gate was dropping, 20 were starts and 2 were bench appearances. So
the doors now read

| | door | sheet |
| --- | --- | --- |
| Started | 1,672 | 1,674 |
| Came in | 53 | 51 |

— 1,725 between them, and the residual ±2 is the source margin alone, MLB's
fielding aggregate against MLB's own lineups. It is the same margin Home and
Road carry, it is not this fix's to close, and it can now be read straight off
the card instead of being inferred.

### Scope

Not postseason-specific, and not a facet's problem. Any facet, any era: a
rain-postponed regular-season game replayed the same day under the same gamePk
has the same shape. The postseason door just made it countable.

## Amendment (2026-09-16, issues #1048 and #998): a door that opens a LIST

The 2026-09-15 note above ends "it wants a door that opens a LIST … and it
should be built once for both". It is built, and the batting order is its first
reader. **The shape is general; nothing in it is slot-shaped.**

### What a list door is

A registry entry with a `list` descriptor instead of a `facet`. The sheet behind
it opens on the GROUPS rather than on rows: it fetches the same join with no
narrowing, folds the gated rows into groups, and prints two figures against
each. Tap a group and the same sheet re-renders in rows mode for that group's
own facet. The join is memoized per (person, group, cutoff, gameTypes), so
going in, back out and into another group **costs no requests at all** — every
question reads the rows the first one already fetched.

The descriptor has five members:

| member | the batting order | #998's parks |
| --- | --- | --- |
| `groupBy(row)` | `row.lineupSpot` | `row.venueId` |
| `name(key, newest)` | "Batting first"…"Batting ninth" | the newest row's `venueName` |
| `order` | `'key'` — an order is a sequence | `'games'` |
| `facet(key)` | `{ kind: 'lineupSpot', spot }` | `{ kind: 'venue', venueId }` |
| `title(surname, name)` | "Yelich, batting third" | "Yelich at …" |

`name` takes the group's NEWEST row as a second argument, which is the member
#998 needs and the batting order does not: a park is named by the row, so a club
that renamed its stadium is listed under what it is called now.

### The figures come from the rows, and that is the whole decision

Every other door on this card takes its line from an aggregate MLB publishes and
its rows from the game log, and the two agree or they nearly do. **The batting
order is where they do not** — the measurements are in the 2026-09-15 note, and
`b9` reading 18 games against 0 starts is not a margin, it is a different
question. So a list folds the rows themselves. An entry and the rows behind it
are then the same games, counted once and then shown, and they cannot disagree.

Two figures in the LIST — games, and AVG for a bat or ERA for an arm — because
an entry is one row of a comparison and a comparison is read down a column.

**The group a reader PICKS gets twelve.** That was a correction made on the day
(Gary: "i'd like to see the 34 G, .256 expand"), and it is the right shape: the
list is the comparison, the picked group is where someone went FOR the detail.

| | the twelve |
| --- | --- |
| hitter | G · PA · H · HR · RBI · BB · K · SB, then AVG · OBP · SLG · OPS |
| pitcher | G · GS · IP · H · R · ER · HR · BB · K, then ERA · WHIP · K/9 |

Counts first, rates last — the order a box score is read in, and the order this
app's own stat grids print. The reasoning behind the two sets:

- **the slash line beats OPS alone**, which hides whether he got on base or hit
  for power, and it is the standard way to state a hitter;
- **a pitcher's HR is a ballpark's whole question** — Coors against Oracle is
  that one cell — so the pitching log now asks for `homeRuns`;
- **WHIP and K/9 survive a short sample** (a dozen games at one park) where a
  win-loss record says almost nothing;
- **GS** says whether these were starts or relief outings, which changes what
  every figure above it means.

It cost four field names. A hitter's log gains `plateAppearances`, `hitByPitch`
and `sacFlies` — **on-base cannot be computed honestly without the last two**,
so an earlier draft of this amendment said OPS was unavailable; it is available,
it just had to be asked for. Measured 2026-09-17 on Yelich's 2024 log: **22.0 KB
-> 25.5 KB over 73 games, +16%**, the same price `positionsPlayed` already pays
on the same shared join. TOTAL BASES is not fetched at all: MLB publishes it on
an aggregate and never on a game log, so the fold builds it from the extra-base
hits, which is the identity MLB would have sent.

The rates are pinned against **MLB's own published strings**, not against
themselves: Yelich's October fed back through the fold must come out .444 /
.559 / .630 / 1.189. That catches the OPS rounding in particular — OPS is each
half rounded to three places and THEN added, so .559 + .630 is 1.189 where the
unrounded sum would print 1.188.

**A folded line is not a career line.** On a page carrying `?d=` it stops where
the rows stop. That is more correct than a career aggregate would be, and it is
what makes the entry and its rows agree by construction. Do not "fix" it by
labelling an entry from `careerStatSplits`.

### Three things the shape needed that the issue did not name

1. **A list door names no label source, so the card cannot ask whether it has
   games behind it.** It renders whenever the card renders — but it cannot vouch
   for the card on its own, or a MiLB player with no situational splits would
   get a card holding one door. The card's existence test now reads "at least
   one SOURCED door", and the list rides along.
2. **The list's own fetch still needs the lineups pass.** Grouping by
   `lineupSpot` is worth nothing if every row comes back with a null slot, and
   `needsLineups` lives on the facet. So `facet(null)` — no group named — is the
   list's own question: the same `kind`, with no `keep` narrowing it to a slot,
   which plans the pass and keeps every row that HAS a slot. It is the narrowest
   honest reading of "all the rows this list can describe".
3. **A list door has no headline**, because there is no tapped line to quote.
   Once a group is picked the headline is that entry's own line, verbatim —
   which is the same contract every other door's headline keeps, one level in.

### The lineups pass widened for nothing

`fetchLineupStarts` returned a Map of gamePk to boolean. It now returns the
1-based SLOT, or 0 for "played, did not start", and the two lineup doors derive
their boolean from it. The arrays were already in batting order — index 0 is the
leadoff man, checked against a boxscore's own `battingOrder` on gamePk 747043 —
so the slot was there to be read. One pass, one memo, three doors.

`lineupStart`'s semantics did not move: absent from the map is null ("nobody
posted a card"), 0 is false, 1 through 9 is true. A 0 also means `lineupSpot` is
**null**, not 0 — a bench appearance is not a tenth place in the order.

### #998 came with it, and it cost a descriptor and a name

**By ballpark**, filed under *Where*, both groups. It is 22 lines of registry
and two tests, because everything else was already there: `venueId` and
`venueName` on every row, `{ kind: 'venue', venueId }` in `facets.js`, and
`order: 'games'` as the other sort. That is the evidence that the list is
general rather than a batting order with a seam in it.

Its own trap, measured 2026-09-15 and now pinned by test: **a park's id is
stable and its NAME drifts inside one career.** Nine of Yelich's 36 parks carry
more than one name in his own games — id 32 is Miller Park for 185 and American
Family Field for 372, id 4 is three names. So the GROUP is the id and the NAME
comes off the group's newest row, which the list already had a member for. It
matched MLB's current name on 35 of 36 parks, and the miss is better than a
match: Globe Life Park in Arlington, now Choctaw Stadium, is named as the reader
knew it. **Do not reach for `/api/v1/venues`** — unseasoned it returns SPONSOR
names ("UNIQLO Field at Dodger Stadium"), and a `&season=` call silently omits a
park not in use that season.

Live on Yelich at `?d=2026-06-27`: 35 parks, American Family Field 521 G / .284
at the top, down a tail to parks he saw once. Both of his home parks appear
once, under the name they carry today, with every older game inside them.

`sitCodes=ven` stays dead, three ways over (0 splits; dropped in silence from a
`ven,h,a` list; no `statTypes` entry names a venue). The rows are the only path,
which is where the batting order arrived from the opposite direction — and it is
why one door on this card prints no figures. It opens a list rather than a
line.

### Both lists count October (2026-09-17)

Asked on the live page — does By ballpark include postseason games? It did not,
and it should, for the reason this ADR already gave the calendar doors: **a date
does not stop being October because the game was a division series, and a park
does not stop being Dodger Stadium.** Both lists now carry
`postseason: true` on their facet.

Measured 2026-09-17, regular season against the whole career:

| | regular season | with October |
| --- | --- | --- |
| Betts at Globe Life Field | 9 | **25** (the 2020 neutral-site World Series was 16 of them) |
| Betts at Dodger Stadium | 430 | 462 |
| Yelich at Dodger Stadium | 37 | 44 |
| Scherzer at Nationals Park | 100 | 105 |

**No park is ever ADDED**: over Yelich, Betts and Scherzer, every postseason park
was one he had also played at in the summer. It is the counts this corrects, and
Globe Life Field is where the old answer was badly wrong.

Two things made it cheap and safe:

- **A list door has no label to widen.** A calendar door needs
  `spansPostseason` AND `facet.postseason` because its figure comes from an MLB
  aggregate that has to be summed across game types. A list folds the rows, so
  only the rows' half exists — and a test now pins that a list door must NOT set
  `spansPostseason`, which would send `fetchDoorLabels` after a figure that does
  not exist.
- **Every postseason game carries a full lineup.** That mattered for the batting
  order, where a game with no card has a null slot and would leave the list in
  silence: Yelich 27 of 27, Betts 91 of 91, Arenado 8 of 8.

The cost is the one the calendar doors already pay: a widened door does not
share the join with the regular-season doors, because the game types are in the
join key. A widened list now shares with the months and the weekdays instead.
`fetchSeasons` returns the same seasons either way, so it is the same number of
game-log calls with a few more rows in each.

`calendarTypes` is renamed `widenedTypes` — it was never about the calendar, it
is about a facet that means to count every kind of game.
