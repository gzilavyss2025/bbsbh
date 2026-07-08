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
CLAUDE.md — good for `revealDefense`/`revealBattingOrder`/pitcher-line
regressions.

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

## Suspended and resumed game

**2025-05-19 CLE @ MIN** (suspended, resumed 2025-05-21) — gamePk `777861`
Route base: `/05192025/clemin/` (keyed by `officialDate` 2025-05-19, the
original date — verified this is a single gamePk, not two separate games,
even though the schedule endpoint also lists it under 2025-05-21)

Good for anything that assumes a game's `gameDate` maps cleanly to a single
calendar day of play, and for boxscore/pitcher-line completeness across a
game that spanned a multi-day break.

## MiLB thin-data example

**2025-07-06 TOL @ COL (AAA, sportId 11)** — gamePk `781572`
Route base: `/07062025/tolcol/`

No rare event — just a real, finished AAA game for exercising the
graceful-degradation paths (missing weather/coaches/logos, thinner feed)
called out in CLAUDE.md's MiLB conventions. Pick a fresh recent AAA date if
this one ages out of easy access; the pattern is what matters, not this
specific gamePk.

## Categories not included (couldn't verify)

Batting out of order and an overturned replay challenge were searched but
not pinned — no candidate could be confirmed against a live feed with
confidence, so nothing was added rather than guessing. If a good one turns
up, verify it the same way (schedule → gamePk → grep the feed for the actual
event) before adding it here.
