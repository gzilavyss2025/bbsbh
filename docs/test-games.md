# Pinned test games

A pack of real, verified gamePks for exercising bbsbh's edge cases without
hunting for a live game every session. Each was resolved via the MLB Stats
API schedule endpoint and the rare event was confirmed directly in that
game's live feed (`/api/v1.1/game/{gamePk}/feed/live`) — not just a news
headline — so the gamePk/route below is safe to navigate straight to.

Route shape: `/{MMDDYYYY}/{away}{home}/{section}` (see `src/lib/route.js`).
Sections: `lineup1`, `lineup2`, `top{n}`/`bottom{n}`, `boxscore`.

## Anchor game: subs, position player pitching, challenges

**2026-07-07 MIL @ STL, game 2 of a doubleheader** — gamePk `823035`
Route base: `/07072026/milstl-2/`
Final: MIL 10, STL 2.

Pinch runners, defensive substitutions where players moved back to a
position they'd started the game at, a position player pitching, and replay
challenges. This is the game that originally surfaced the
`isPitcherByTrade`/`allPositions` starting-position bug documented in
CLAUDE.md — good for `defenseEntering`/`lineupEntering`/pitcher-line
regressions. Its subs are almost all announced between innings (pre-pitch),
with a couple of in-inning ones (the top-6 PH, top-7 PR), so it exercises both
the "shown entering the half" and "held back until you reveal in" paths.

## Triple play

**2025-04-05 ATH @ COL** — gamePk `778442`
Route base: `/04052025/athcol/`

Top of the 2nd (atBatIndex 9): Jacob Wilson grounds into a 5-4-3 triple
play. Good for `PlayByPlay` / pitcher-line inning-ending edge cases (three
outs on one play, no separate at-bats for the two runners retired).

## Immaculate inning

**2025-05-18 TB @ MIA** — gamePk `777877`
Route base: `/05182025/tbmia/`

Top of the 4th: Cal Quantrill (MIA) strikes out the side on 9 pitches (3
strikeouts × 3 pitches each). Good for pitch/whiff-count derivations in
`derive.js` and the pitcher-line K count.

## Cycle

**2025-03-31 CHC @ ATH** — gamePk `778501`
Route base: `/03312025/chcath/`

Carson Kelly (CHC) hits for the cycle: 4-for-4, 1B/2B/3B/HR, 5 RBI. Good for
box-score batting-line rendering and the box score's notable-performance
notes.

## Walk-off grand slam

**2025-05-27 BOS @ MIL** — gamePk `777747`
Route base: `/05272025/bosmil/`

Bottom of the 10th: Christian Yelich hits a walk-off grand slam. Final MIL
5, BOS 1. Good for extra-innings unlock behavior (`unlocked` in
`InningViewer`) plus a game that ends mid-inning (no bottom-of-9 tie regular
ending) combined with a big single-play swing in win probability.

Also the canonical **placed runner** game — both halves of the 10th, the two
cases side by side. Top: Trevor Story is placed at 2nd, takes 3rd on Abraham
Toro's single, and is stranded there (dotted ghost path, one inked leg,
`1B⁸`). Bottom: Joey Ortiz is placed, takes 3rd, and scores on the slam — his
run alone rides `earned: false` (the official-scoring rule treats the
automatic runner as having reached on an error), so his is the circled
unearned diamond. The bottom half is also the regression case for the run
tally: four runs score, and before the placed runner had a card of his own the
stepped linescore cell counted three.

## Suspended and resumed game

**2025-05-19 CLE @ MIN** (suspended, resumed 2025-05-21) — gamePk `777861`
Route base: `/05192025/clemin/` (keyed by `officialDate` 2025-05-19, the
original date — verified this is a single gamePk, not two separate games,
even though the schedule endpoint also lists it under 2025-05-21)

Good for anything that assumes a game's `gameDate` maps cleanly to a single
calendar day of play, and for boxscore/pitcher-line completeness across a
game that spanned a multi-day break.

## Sacrifice the batter was not retired on

**2026-07-25 BLX @ CHA (AA, sportId 12)** — gamePk `818035`
Route base: `/07252026/blxcha/`

Bottom of the 8th (atBatIndex 70): "Carlos Sanchez hits a sacrifice bunt.
Fielding error by third baseman Andrew Fischer. Kien Vu to 2nd. Carlos Sanchez
to 1st." A sacrifice is still credited when a misplay is all that kept the
batter from being retired, so the feed carries `eventType: sac_bunt` with
`result.isOut: false` and a lone `f_fielding_error` credit on the batter's own
leg — no putout, no out number. Good for `scorebookCode`'s sacrifice branch
(`SAC E5`, a reach, not the "SAC 5U" unassisted putout the error credit used to
be mistaken for) and for anything that assumes a sacrifice means an out.

Its no-error twin is **2026-07-20 SF @ KC** — gamePk `824087`, bottom of the
9th: two `sac_bunt` plays where nobody was retired and no error was charged
(the defense never played the batter), each carrying only an `f_fielded_ball`
credit → `SAC FC`.

## MiLB thin-data example

**2025-07-06 TOL @ COL (AAA, sportId 11)** — gamePk `781572`
Route base: `/07062025/tolcol/`

No rare event — just a real, finished AAA game for exercising the
graceful-degradation paths (missing weather/coaches/logos, thinner feed)
called out in CLAUDE.md's MiLB conventions. Pick a fresh recent AAA date if
this one ages out of easy access; the pattern is what matters, not this
specific gamePk.

## Triple-A ABS challenges

**2026-08-26 BUF @ ROC (AAA, sportId 11)** — gamePk `815863`
Route base: `/08262026/bufroc/`

Three real ABS challenges at a level the box-score row used to hide (issue
#957): Rochester wins one in the top 1st, Buffalo loses one in the top 2nd
and another in the top 3rd. One sits at the play level and two at the pitch
level, so it exercises both of the places a review can hide. Captured, field-trimmed, and committed as
`test/fixtures/game-815863.trimmed.json` (rebuild it with
`.scratch/abs-aaa-gate/build-fixture.mjs`), so `challenges.test.js` proves
the half-clamp on real Triple-A data offline.

**2026-08-29 SWB @ WOR (AAA, sportId 11)** — gamePk `815489`
Route base: `/08292026/swbwor/`

One plate appearance here (bottom 3rd) carries TWO distinct Worcester
challenges, one of each outcome — the shape that used to be undercounted
(issue #963), since the old primitive kept one challenge per play and dropped
the failure. The row now reads `1-2 · none left` for SWB and `1-1 · 1 left`
for WOR, agreeing exactly with the feed's own `gameData.absChallenges` bank.

**2026-07-11 CLR @ TAM, game 2 of a doubleheader (A, sportId 14)** — gamePk `820258`
Route base: `/07112026/clrtam-2/`

The densest ABS game pinned here, and the regression anchor for issues #963
and #965: nine real challenges, two of them `reviewType: "MZ"` (a type that
occurs only at Single-A), and one at-bat carrying two distinct ones. It is
also at George M. Steinbrenner Field, the one park that runs the challenge
system and reports no `gameData.absChallenges` bank (issue #964), so the row
reaches the page through the venue allowlist rather than the key. Captured as
`test/fixtures/game-820258.trimmed.json`. Clearwater 4-1, Tampa 2-2.

## Winter ball — one verified game per shipped league

The four leagues behind `sportId 17` that Tally ships (ADR-0078, issue #1055).
Each was read straight out of its own live feed on 2026-09-17: **9 innings, 4
umpires, both batting orders at 9, and ~4 pitches per play** — MLB's own figure
over the same check is 3.93, so a winter game is an ordinary game and the
scoring flow needs nothing added for one.

**These routes carry no league segment**, and that is not an omission. A GAME's
address has never named a league (`/{MMDDYYYY}/{away}{home}/{section}`); the
league lives on the SLATE's address (`/fall/10252025`). It is why `resolveGame`
needs a winter pass at all — a shared winter link arrives with nothing on it to
say which league to look in.

| League | gamePk | Date | Game | Route base |
| --- | --- | --- | --- | --- |
| `FALL` | `825662` | 2025-10-25 | Peoria Javelinas at Glendale Desert Dogs, Camelback Ranch | `/10252025/pejgdd/` |
| `MEX` | `826078` | 2025-11-23 | Charros de Jalisco at Algodoneros de Guasave | `/11232025/jalgsv/` |
| `VEN` | `829914` | 2025-11-20 | Navegantes del Magallanes at Bravos de Margarita | `/11202025/magmar/` |
| `DOM` | `826281` | 2025-11-25 | Toros del Este at Leones del Escogido | `/11252025/toresc/` |

**2025-10-06 PEJ @ SCO** — gamePk `825618`, route base `/10062025/pejsco/`
The Arizona Fall League's 2025 opener, and the first winter game of that season
anywhere. Carries weather and both probable pitchers as well.

### The counter-example — keep it

**2025-12-05 CAG @ PON** — gamePk `826583`, route base `/12052025/cagpon/`

Liga Roberto Clemente, the Puerto Rican winter league, which Tally deliberately
does **not** ship. 83 plays and **148 pitch events — 1.78 per play**, against
~4 everywhere else. The feed keeps the terminal pitch of most at-bats, drops
the rest, and zeroes `count` to match, so it is internally consistent and
factually thin: a half-inning that really took 28 pitches would render as 12 on
a scoring surface.

Everything else about it passes — 9 innings, 4 umpires, 9/9 batting orders —
which is exactly why it is pinned here. A completeness check that asks whether a
play has *any* pitch event passes this game. Use it to test that a thin-pitch
league stays excluded.

### Slate days worth having

- **Multi-league days**, for the league picker: `2025-10-16`, `2025-10-18`,
  `2025-11-04` — four leagues, 15 games each.
- **A single-league day**: `2025-10-08` — the AFL alone, before the other three
  open. The picker draws nothing, because one league is not a choice.
- **FALL out of season**: `2025-12-15` — three chips, and the Mexican league in
  season with no game that day.
- **The last day of a winter**: `2026-02-02`, and `2026-02-03` for the day the
  tab is gone.

## Categories not included (couldn't verify)

Batting out of order and an overturned replay challenge were searched but
not pinned — no candidate could be confirmed against a live feed with
confidence, so nothing was added rather than guessing. If a good one turns
up, verify it the same way (schedule → gamePk → grep the feed for the actual
event) before adding it here.
