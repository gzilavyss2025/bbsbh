# A league ships only if its data cannot make the app state something false

**Status:** Accepted
**Date:** 2026-09-17

## Context

The level rail is `MLB · AAA · AA · A+ · A`. All four minor tabs go dark in
September and stay dark past March — A+ from September 17, A from the 18th, AA
the 25th, AAA the 28th. Measured across 2025-26 that is 175 to 197 dark days
each, against MLB's own 110 (ADR-0074).

Behind `sportId 17` there is professional baseball on the field on **110 days
between October 6 and February 2**, and Tally had no door to it. Seven leagues
sit behind that one sportId: the Arizona Fall League, the Mexican, Venezuelan,
Dominican and Puerto Rican winter leagues, the Australian Baseball League, and
the Caribbean Series. The AFL is the one holding our players — a full-season
roster call returns 42 of them carrying their real affiliate, which is to say
exactly the players whose own tabs went dark in September.

The obvious build is "add what is behind the door". The measurements said not to
(issue #1055, probes in `.scratch/offseason-design/probes/`).

## Decision

**A league ships only if its data cannot make the app state something false.**
Four ship. Three do not, and each is excluded by that one rule rather than by a
judgment about the league.

### The Puerto Rican league is the case that made the rule

It was in an earlier version of this build. The completeness probe asked whether
a play carried **any** pitch event, and it passed — 10 of 10 games.

Asking how **many** is a different question. It records **1.69 pitches per play
against ~3.9** in every other winter league and in MLB itself, on 8 of 8 games
sampled. Reading a feed directly (gamePk 826583) shows what it does: it keeps
the terminal pitch of most at-bats, drops the rest, and zeroes `count` to match,
so the data is internally consistent and factually thin.

That matters here more than it would in most apps. `src/api/derive.js` counts
pitches per half-inning and puts the number **on a scoring surface** — a number
a reader copies onto paper. A half that really took 28 pitches would render as
12.

**The app knows how to hide a stat it does not have.** Velocity is absent at
untracked MiLB parks and every surface degrades to `—`. It has no way to hide
one it has been handed wrong, because nothing about a wrong number looks wrong.
**A plausible false number is worse than a missing one.**

Dropping it costs nothing measurable. It ran entirely inside the other leagues'
spans: the winter has 110 played days with it and 110 without, and there is no
day on which it is the only baseball.

### The other two exclusions are the same rule

- **The Australian Baseball League (595)** — 0 of 4 clubs have a mark on the
  CDN, and the club list is wrong as well: the Sydney Blue Sox played a sampled
  game and are not in the 2025 team list. A club strip of empty squares states
  that these clubs have no marks, which is false.
- **The Caribbean Series (162)** — 13 games, a field that turns over every year,
  and one side with no mark.

### What ships

| League | Chip | id | Clubs | Marks | Pitches/play |
| --- | --- | --- | --- | --- | --- |
| Arizona Fall League | `FALL` | 119 | 6 | 6/6 | 3.97 |
| Liga Mexicana del Pacifico | `MEX` | 132 | 10 | 10/10 | 3.87 |
| Liga Venezuela BP | `VEN` | 135 | 8 | 8/8 | 3.84 |
| Liga de Beisbol Dominicano | `DOM` | 131 | 6 | 6/6 | 3.94 |

Thirty clubs, the same as an MLB level. MLB's own pitches-per-play over the same
check is **3.93**, so these four are indistinguishable from the real thing. 60 of
60 sampled feeds carried placed `allPlays`, both `battingOrder` arrays at 9 or
more, `linescore.innings`, pitch events on 80%+ of plays, and four umpires. **A
winter game is an ordinary game, and the scoring flow needed no change for one.**

The list lives in `src/lib/winter/leagues.js`, with the rule stated above it, and
is mirrored once in `scripts/gen-teams.mjs` so the club strip is built from
exactly those thirty clubs.

## Three things that follow, and are the decision as much as the rule is

### One tab, because four leagues cannot each have one

Median **4** winter leagues play the same day, peaking at 6. A tab each would
make the rail nine entries, and it already wraps at 320px with five. So they
share one conditional `WINTER` tab with a league picker inside it, and `FALL` is
the AFL's chip in that picker rather than a rail tab of its own.

The tab sits **second, right after `MLB`**. The cost is named and accepted: the
ladder splits in the middle, and the rail re-orders itself each October and
February. The reason is that for the months this tab exists it is the only one
with games on it.

### The tab is read off published dates, never off the clock or an absence

The same stance ADR-0074 takes, for the same reason, and it is what makes a past
winter browsable in September. Two traps are recorded in
`src/lib/winter/window.js` and pinned in `test/winter-window.test.js`:

- **A winter league's season is named for the year it STARTS in.** `season=2025`
  answers October 2025 through February 2026. This is a different trap from
  ADR-0074's two-row winter, which splits one winter across two rows at New
  Year; here the whole winter stays on one row, filed under the year it opened.
- **A bare `sportId=17` call is mostly the wrong league.** On three sampled dates
  it returned 15 games across four leagues where `&leagueId=119` returned exactly
  the three AFL ones. Every winter call in the app carries a `leagueId`, and the
  one place that cannot is the reason the club list is generated at build time.

It fails closed at every step, per league. A league whose call fails or answers
empty is not offered; if none are, the rail is exactly what it is today. That is
not hypothetical — on 2026-09-17 the Venezuelan league's 2026-27 schedule had not
been published while the other three had. **A winter that publishes in pieces is
the normal case, not the error case.**

### The chips are read off a league's season, not off the day's game list

A league is offered on every date between its own first and last dated game,
including its off days. A day-based test would delete the `WINTER` tab on a quiet
Christmas and put it back on Boxing Day, re-ordering the level buttons twice in
two days — and MLB's own tab does not disappear on a Monday, it says "No games
scheduled." A winter league's off day means the same thing and reads the same
way, dimmed rather than deleted.

The span still ends: `FALL` leaves the picker after November 14 because the
Arizona Fall League is over, not because it is idle.

## Consequences

- **No spoiler surface changed.** A winter game seals like any other game. The
  four new slugs are slate addresses, and a slate address has never carried a
  score.
- **The roster wire is off on this tab.** `scopeFor` in
  `api/transactions/leagueFeed.js` builds its scope from a bare `sportId=17`
  call, which answers with all seven leagues — and a winter club has no wire
  worth reading. Off is the honest answer, not a missing feature.
- **No film is promised.** `filmCanExist` already requires sportId 1, so it
  answers no for these games without being told to.
- **A favourite club cannot resolve here and is no longer asked to.** Every one
  of these thirty clubs reports `parentOrgName: "Office of the Commissioner"` —
  a composite of six or seven organisations, an affiliate of nothing.
- **A winter game's URL carries no league**, because a game address never has.
  `resolveGame` therefore gains a winter pass that runs only after the five-level
  scan has missed, so an ordinary link pays nothing and a shared winter link
  resolves on a cold load.
- **The rail takes its own row on a phone.** Six cells do not fit beside the
  wordmark at 320px; the strip keeps its min-content floor, so it overlapped the
  lockup. Below the wide breakpoint the six-cell rail is now a full-width row.
- **The next person to find the Australian league now has the reason** it is not
  here, stated as a rule they can apply to whatever they found instead of a
  verdict they have to trust.
