Status: partially fixed — `sac_fly_double_play` added to `NON_AB_EVENTS`
(unambiguous per 9.02(a)(1)/9.08(d)), regression test in
test/scorecard-sac-double-play.test.js. `sac_bunt_double_play` deliberately
left out — tracked as an open judgment call in
docs/unresolved-scoring-conventions.md pending a real example to check
against an official boxscore.

# `sac_fly_double_play` / `sac_bunt_double_play` are charged an at-bat on the Scorecard Lab grid

## What happened

`NON_AB_EVENTS` (`src/api/loadScorecard.js`) lists `sac_fly` and `sac_bunt` but
not their `_double_play` variants — while `SAC_FLY_EVENTS`/`SAC_BUNT_EVENTS`
(`playbyplay.js`) and `classifyOut` (same file as `NON_AB_EVENTS`) all treat
those variants as sacrifices for the batter's own mark. So the batter gets the
sacrifice notation and an at-bat charged, which can't both be right.

## Why it wasn't just fixed

The sac FLY case is clear: Rule 9.02(a)(1) excludes a sacrifice fly from at-bats
and Rule 9.08(d) still credits one when the runner scores after the catch, even
if another runner is doubled off. Fixing that alone is safe.

The sac BUNT case isn't. A sacrifice is not credited when a runner is retired
attempting to advance on the bunt — yet the feed still labels the event
`sac_bunt_double_play`, so it's unclear whether MLB scored a sacrifice at all
(in which case it IS an at-bat) or the eventType name is just descriptive of
the batter's intent. Resolving it needs a real example checked against the
official boxscore's AB column.

Neither variant appeared in a three-day sweep of the MLB slate, so this is
rare — filed rather than guessed.

## Where

`src/api/loadScorecard.js` — `NON_AB_EVENTS`.
