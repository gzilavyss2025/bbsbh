# Live push spike: findings (in progress)

Spike for #2578. No `src/` file changed. The scripts print no score, play or result.

## Before any live game (2026-10-23, from the Claude cloud sandbox)

| Question (from #2578) | Result |
| --- | --- |
| Does the socket accept a connection with no `Origin` (Node 22)? | Yes. Open in 0.4 to 0.8 s. |
| Does it accept a **browser** (unknown 2)? | Yes for one origin. Headless Chromium sent `Origin: http://127.0.0.1:<port>`, got HTTP `101`, and the socket opened. Not tested: `https://tallybb.com`. Inference: the server does not allowlist origins, since it took an arbitrary local one. |
| Finished game? | The socket opens, then closes at once with code `4400`. Not `4200`. |
| Scheduled game (before first pitch)? | The socket opens and stays open and silent. A capture can start hours early. The server never echoes the `Gameday5` keepalive. |

## First live data (winter-league games, 2026-10-23, 7 minutes each, two games)

Games 870064 (Venezuela) and 851488 (Dominican Republic). The socket serves winter-league games (unknown 6, first answer).

**What a push message contains (unknown 1).** One JSON text frame, 212 to 289 bytes. Keys, in order:
`timeStamp` (a timecode, for example `20261023_232707`), `gamePk` (a string), `updateId` (a 36-character id),
`wait` (number), `logicalEvents` (array of strings), `gameEvents` (array of strings), `changeEvent` (object with one
string `type`), `isDelay` (boolean). Pre-game pushes had empty `logicalEvents`. Inference: `timeStamp` is the new
`metaData.timeStamp` of the feed, so a client could ask `diffPatch` for exactly that end timecode. Not tested yet.
In the pre-game sample, pushes came in pairs 140 to 250 ms apart.

**How often (unknown 3).** Median gap between pushes 16 to 21 s, three pushes a minute, in play.

**Push-triggered `diffPatch`.** Most fetches returned a patch. On the 7-minute sample, 28 to 30 times smaller (gzip of
the re-serialized body) than a full feed. 2 of 2 verification merges equalled the snapshot served for the same timecode.

**A `diffPatch` fallback is a trap.** Three of 24 fetches on one game (870064; the other game had none) returned a whole feed with a start age of only
9, 21 and 25 s. The earlier spike assumed fallbacks come only from a stale start (a 200 to 300 s window). They also
come from fresh starts. Worse: the whole-feed body is **not** consistent with its own `metaData.timeStamp`. Replaying
game 870064 (`replay-check.mjs`, one fallback in 60 steps), the body differed from the snapshot for its own stamp, and
its stamp was the request's start stamp. One replayed case; more are needed. The first version of `capture.mjs` kept that body as the base for the next patch. The next patch then failed to
apply ("bad index"). A plain `/feed/live` body does equal the snapshot for its own stamp (12 of 12,
`own-stamp-check.mjs`). **So after a fallback a client must refetch a plain full feed, never keep the fallback body.**
`capture.mjs` does that from the second capture run on. A fallback therefore costs the failed diff plus a full feed,
which is worse than a plain poll.

**The patch applier.** 44 and 59 consecutive real patches merged to exactly the served snapshot, 0 apply errors
(`replay-check.mjs`, game 870064). The one error in the live run came from the bad base above, not from the applier.

## Still to measure

World Series Game 1 (gamePk 849805, first pitch 2026-10-24T00:00Z): fallback rate over a full game, the age of the
patch start at each fetch, gzip reduction, the cost of a rain delay or reconnect, and what a browser receives.
The go or no-go against the bar in #2578 (at least 10 times smaller at p50 and under 10% fallback) waits for that.
