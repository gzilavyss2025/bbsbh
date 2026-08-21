# MiLB wire window backtest

Ran 2026-08-21 against a live 25-day pull ending 2026-08-21, through this
module's own `groupLeagueWide` (no mock data) via a throwaway Node script.

Story counts by level and window length (days), no `affilToOrg`, no
`debutedIds`:

| Level | 3d | 5d | 7d | 10d | 14d |
| --- | --- | --- | --- | --- | --- |
| MLB | 43 | 79 | 110 | 173 | 255 |
| AAA | 37 | 77 | 103 | 159 | 231 |
| AA | 13 | 37 | 45 | 61 | 79 |
| A+ | 16 | 28 | 34 | 46 | 68 |
| A | 14 | 26 | 31 | 51 | 85 |

MLB's shipped window (3 days) targets 41-65 stories (see leagueFeed.js's own
header). AAA lands in that range already. AA/A+/A do not clear it at any
window shown here — full-season MiLB rosters generate far fewer storyworthy
rows per club than an MLB org's own 40-man traffic, even with the
undebuted-signing suppression disabled (that suppression only ever applies at
MLB scope — see `scopeFor` in leagueFeed.js).

Shipped: AA/A+/A read a 7-day window (9-day fetch) — the narrowest of the
sampled points that gets meaningfully closer to MLB's range (45/34/31) without
running past two weeks. Re-run this backtest before changing either level's
window; this was measured once, in late August, when full-season MiLB signing
activity is near its seasonal low (see the raw SC/REL/ASG breakdown below) —
a spring-training or June-signing-period pull would likely show much higher
counts and could argue for narrowing AA/A+/A back toward AAA's own window.

## Method

1. `GET /api/v1/transactions?startDate=2026-07-28&endDate=2026-08-21` — no
   `sportId` filter (matches the existing MLB wire's own request shape).
2. Per level, teams from `GET /api/v1/teams?sportId={11,12,13,14}&activeStatus=Y`.
3. `groupLeagueWide(rows, { mlbTeamIds: <level's own club ids> })` — no
   `affilToOrg` (a level's clubs are already the top set, not folded up to an
   MLB parent) and no `debutedIds` (suppression only wanted at MLB scope).
4. Filtered the returned days to each window length and summed `stories`.

## What's actually in a MiLB level's raw feed

A rough type-code breakdown at AA (452 team-touching rows over 21 days, before
`filterStoryworthy`): 389 `ASG` (affiliate-to-affiliate reassignment — never
storyworthy), 261 `SC` (status changes — mostly injured-list/development-list
housekeeping; ~121 of those are IL-shaped over 21 days and DO clear the
filter), 43 `REL`, 3 `SE`, 2 `RET`, 1 `OPT`, 1 `OUT`. Zero `SFA`/`SGN`/`IFA` at
AA in this 21-day window — full-season affiliates mostly sign earlier in the
year (spring camp, June draft) rather than in mid-August, which is part of why
this particular measurement window undercounts what the feed looks like across
a full season.
