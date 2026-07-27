# Unresolved scoring conventions

A running catalog of scoring-notation questions that came up during a PR/code
review and turned out to have **no single canonical mark** — checked against
more than one scoring reference and still a genuine judgment call, not
something to guess at in code. Not a bug list; each entry below is a
documented, deliberate gap. Add an entry when a review turns one of these up;
remove or resolve an entry once a real convention (or a product decision) settles it.

Distinct from `.scratch/<feature-slug>/issues/` — those are per-effort and get
archived with the effort; this list is meant to stay put and stay easy to find
across efforts, since the same kind of rare-event ambiguity keeps recurring in
`src/api/playbyplay.js`'s advance-code fallbacks.

## `other_out` — a runner advances on an uncaught third strike, but the
   catcher's recovery throw goes somewhere other than first base

**Where:** `src/api/playbyplay.js`, `ADVANCE_CODES` / `advanceCode` /
`legAdvanceCode` — falls through to the `'GO'` last resort, which is wrong
(no ball was put in play).

**Real example:** gamePk 824247, top 1st — *"Isaac Collins strikes out
swinging, catcher Dillon Dingler to pitcher Troy Melton. Vinnie Pasquantino
to 3rd."* Pasquantino's leg currently reads `GO⁶`.

**Why it's unresolved:** the batter's own advance to 1st on a dropped third
strike has a clear convention (WP or PB, depending on whether the pitch was
catchable with ordinary effort). This is different — a *different* runner
advancing further because the catcher's throw after fielding the strike went
somewhere other than first. No scoring reference checked so far assigns this
a fixed letter; it's described in prose ("advanced on the play"), not coded.

**Checked against:**
- livebaseballscorecards.com — doesn't code advances at all; every
  baserunner move is an uncoded black/red/green arrow between bases, so the
  question doesn't even arise in their notation.
- Official-scorer / SABR-adjacent scoring guides (Scorekeeper's Guide,
  Baseball Rules Academy 9.07) — confirm this is scored descriptively, no
  fixed mark.

## `caught_stealing_3b` — a trail runner takes a base while the lead runner
   is thrown out

**Where:** same fallback chain as above, same file.

**Real example:** 1 occurrence in a 52-game sweep (2026-07-20 … 24); rare
enough that no gamePk is pinned down yet.

**Why it's unresolved:** caught stealing is charged only to the runner
actually thrown out. A trailing runner who also advances is credited "a
stolen base or other advancement **as appropriate**" — SB if he was himself
attempting to steal, otherwise an unlabeled advance. The feed's own
`eventType` for the trailing runner's leg (`caught_stealing_3b`, mirroring
the lead runner's) doesn't distinguish which case this was.

**Checked against:** same two references as above — neither assigns a fixed
letter to the trailing runner's leg; it depends on intent the feed doesn't
expose.

## `sac_bunt_double_play` — is it an at-bat?

**Where:** `src/api/loadScorecard.js`, `NON_AB_EVENTS`.

**The question:** `sac_fly_double_play` is unambiguous — Rule 9.02(a)(1)
excludes a sacrifice fly from at-bats and 9.08(d) still credits one even when
another runner is doubled off, so it was added to `NON_AB_EVENTS` outright (see
`.scratch/pbp-scoring-review/issues/04-sacrifice-double-play-charges-an-at-bat.md`).
A sacrifice BUNT is different: the rule does NOT credit a sacrifice when a
runner is retired attempting to advance on the bunt. The feed's eventType
name (`sac_bunt_double_play`) describes the batter's intent, not necessarily
how MLB's official scorer actually ruled it — so whether this counts as an
at-bat depends on a fact the eventType alone doesn't carry.

**Why it's unresolved:** neither appeared in a three-day sweep of the MLB
slate (2026-07 window), so there's no real gamePk to check against an
official boxscore's AB column yet. Deliberately left out of `NON_AB_EVENTS`
rather than guessed — resolve by finding a real occurrence and checking what
MLB's own boxscore charged.

## How these got triaged

All three surfaced in `.scratch/pbp-scoring-review/issues/` (PR #403's
follow-up review: `03-remaining-advance-code-fallbacks.md`,
`04-sacrifice-double-play-charges-an-at-bat.md`). Decision on the advance
codes: leave the `'GO'` fallback in place rather than swap in an
equally-wrong fixed code — revisit if a future feed field (or a clearer
scoring-committee ruling) narrows the ambiguity. Decision on the sac bunt:
leave it uncounted as neither AB nor sacrifice-excluded until a real example
turns up.
