# The live feed stays a full poll; push-triggered `diffPatch` is not adopted

**Status:** Accepted
**Date:** 2026-10-26
**Issue:** #2578 (the spike), PR #2641. Extends ADR-0116, which retired ADR-0032.

## Context

ADR-0032 chose to wire `diffPatch` into the 15 s Follow Live poll only. It rested on a replay of a finished game
at stored timecodes: 14 times smaller at 15 s with 3.5% fallbacks, and a conditional go. ADR-0116 removed the pass
that ran that poll (Scores Unlocked) and the code with it. A live game now fetches the whole feed every 60 s
(`FEED_POLL_MS` in `src/hooks/useGameData.js`).

Spike #2578 asked whether MLB's push socket could bring the idea back: a push tells the app when the game changed,
so the app fetches a small patch right after, instead of on a timer. Gary asked for a measurement against a live game.

## What was measured (2026-10-23, from a cloud sandbox)

About three hours of World Series Game 1 (two variants for the whole game, two for the first 21 minutes) and two
winter-league games. Details and the wire facts are in `docs/MLB_STATS_API.md`, "The push socket and `diffPatch` at the
live edge". The bar was the earlier spike's: at least 10 times smaller and under 10% fallbacks, at both cadences.

- **Fetching after each push** used 3.4 times fewer bytes than a 15 s full poll and slightly more than a 60 s poll (0.9),
  with 19.4% fallbacks. A 60 s minimum gap gave 47.7% fallbacks. A fallback costs the failed diff plus a full feed.
- **A quiet game cleared the 15 s bar** (21.6 times, 0.8% fallbacks), a busy one did not. Nothing a client can see in
  advance says which kind a game is.
- **The live edge is not consistent.** A fallback body carries a stamp that does not match its content. A merged feed
  differed from the snapshot for the same stamp in 24% of checks on Game 1, and one divergence stayed wrong across nine
  checks with no apply error. Only a verification fetch, which costs a full feed, finds it.
- **The socket sheds load at peak.** The server answered "Service overloaded; retry later." twice, and new connections
  to Game 1 stopped opening for about 15 minutes.
- **The earlier replay overstated the saving.** Stored timecode pairs merge exactly. Requests from a stamp to "now" do not.

## Decision

1. **The live feed is fetched whole, every 60 s.** Nothing changes in `src/`.
2. **`diffPatch` is not adopted**, with or without the push socket. The patch endpoint and the socket stay documented
   in `docs/MLB_STATS_API.md` as measured and unused.
3. **Do not size a live design from a replay of stored timecode pairs.** Measure against a live game.
4. **If a tight poll ever returns**, start from a plain full feed and treat the push only as a signal to fetch. Measure
   that first. It was not measured here. It avoids the stamp problem, and its cost is one full feed per push.

## Why this is enough

- The app is a second screen for a reader who keeps score on paper. The reader steps through a game at their own pace
  and reveal clamps what they see, so a feed that is up to 60 s old costs nothing the reader can feel (inference).
- Gameday (#2566) paces on the reader's taps, so it needs no push-fast data either (inference).

## Cost accepted

- The 60 s poll keeps fetching a full feed (tens of KB gzip) a minute while a game is live. That is today's cost, and
  ADR-0032 already found the 60 s case the one that gains least.
- A push-driven refresh that lands within seconds of a play stays out of reach. Nothing in the product asks for it.

## What was not tested

Rain delays and long reviews, minor-league games below Triple-A (winter leagues pushed the same way), and
`https://tallybb.com` as the `Origin` of a browser connection. The scripts, the event logs' summaries and the write-up
are in history: `git show 7b20c78c:.scratch/live-push-spike/findings.md`.
