# Live push spike: findings

Spike for #2578. No `src/` file changed. The scripts printed no score, play description or result at any point.
The `--diag` switch, which can write play-level path names, was only ever read for a winter-league game.

Measured on 2026-10-23 and 2026-10-24 UTC, from the Claude cloud sandbox:

- **World Series Game 1** (gamePk 849805): about 3 hours of play (the game ran about 3 h 15 min). Two variants ran for the
  whole game (A and G60 below). New connections to the game's socket were refused for about 15 minutes, and the capture had
  no connection for about 13 of them. Two more variants (B and G15) ran for the first 21 minutes of play only.
- **Two winter-league games** (870064 Venezuela, 851488 Dominican Republic), in runs of 28 to 101 minutes.

It is one MLB game. A different game, or a different part of a season, could land differently. The size of the miss is large
enough that this does not change the verdict.

**The numbers here come from the corrected model in `analyze.mjs`** (a code review of the first version found problems
with its baseline and cost accounting; see "Tools"). The data itself was captured by the first version of `capture.mjs`,
which has since been fixed and was not re-run on a live game.

## Verdict against the bar in #2578

The bar (from the earlier spike): at least 10 times smaller at p50 and under 10% fallback, at **both** the 15 s and the
60 s cadence. Sizes are gzip of the re-serialized body. A fallback costs the failed diff **plus** the full feed that has
to be refetched after it, and every reconnect pays a full feed too. The poll baseline is one full feed per tick over the
time the socket was open, costed at the in-play feed size. Verification fetches are not counted (a design that verified
would cost more).

**No-go for the 60 s default poll. No-go for Follow Live on a busy game. The earlier spike's "conditional go" for
Follow Live does not hold up live.**

World Series Game 1, whole game (two stretches per variant, before and after the connection outage):

| Variant | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll | Requests a minute |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A: fetch after each push, 1.5 s minimum gap | 177.4 | 465 | **19.4%** | 1.1% | 3.4 times smaller | 0.9 times (**larger**) | 3.2 |
| G60: at most one fetch per 60 s | 173.1 | 151 | **47.7%** | 1.3% | 4.5 times | 1.1 times | 1.3 |

First 21 minutes of play only, four variants started together:

| Variant | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- | --- |
| A | 20.8 | 58 | 19% | 3.4% | 3.1 times | 0.7 times |
| B: A with the push stamp as the end timecode | 22.4 | 66 | 19.7% | 4.5% | 2.9 times | 0.7 times |
| G15: at most one fetch per 15 s | 22.0 | 55 | 16.4% | 5.5% | 3.8 times | 0.9 times |
| G60 | 16.8 | 17 | 52.9% | 0% | 3.5 times | 0.8 times |

Winter-league games (A unless noted):

| Game and stretch | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- | --- |
| 870064, first run | 40.9 | 119 | 0.8% | 0.8% | 21.6 times | 5.3 times |
| 870064, second run | 100.9 | 296 | 1.4% | 0.7% | 22.4 times | 5.6 times |
| 870064, last run | 28.9 | 42 | 9.5% | 2.4% | 10.9 times | 2.6 times |
| 870064, B | 27.8 | 69 | 7.2% | 1.4% | 7.4 times | 1.8 times |
| 851488 | 39.8 | 111 | 13.5% | 4.5% | 4.2 times | 1.0 times |

The spread between games is itself a finding: a quiet game can clear the 15 s bar, a busy one cannot, and nothing a client
can see in advance says which it will be. The fallback rate decides everything. Patches are small (median 1.2 to 2.1 KB
gzip, p95 3 to 4.5 KB), so when they work the saving is real.

Why it fails at 60 s: pushes arrive about every 17 to 20 s in play (median gap; the mean is about 23 s, 2.6 a minute over the
game). Fetching after each push costs 3.2 requests a minute against 4 for a 15 s timer, about the same, so the push does not
cut requests much and the cost comes from fallbacks. A 60 s minimum gap raised the fallback rate from 19.4% to 47.7%.

## What the push message contains (unknown 1)

One JSON text frame, 212 to 289 bytes, keys in this order: `timeStamp` (a timecode such as `20261023_232707`), `gamePk`
(a string), `updateId` (a 36-character id), `wait` (number), `logicalEvents` (array of strings), `gameEvents` (array of
strings), `changeEvent` (object with one string `type`), `isDelay` (boolean). Pre-game frames have empty `logicalEvents`.
Inference: `timeStamp` is the feed's new `metaData.timeStamp`. In the pre-game sample, frames came in pairs 140 to 250 ms
apart. The server never echoes the `Gameday5` keepalive.

## Why a patch from the live edge is not safe to trust

1. **A fallback body is not consistent with its own stamp.** When `diffPatch` answers with a whole feed, its
   `metaData.timeStamp` is often the request's start stamp (31 of 163 fallbacks in the whole-game World Series runs). In
   replays of stored timecode pairs on game 851488, 3 of 3 conclusive whole-feed bodies differed from the snapshot for their
   own stamp, and their stamps were 4 to 45 s before the requested end. The first version of `capture.mjs` kept such a body
   as the next base, and the next patch then failed to apply. After a fallback the capture now refetches a plain `/feed/live`.
2. **A plain full feed is a safe base only when nothing changed in the last second.** On two live games, mid-play, a plain
   feed equalled the snapshot for its own stamp in 12 of 12 checks. On the finished game 870064 it differed in 4 of 4: the
   plain feed held the final game status, one more game event and the final linescore state, and the snapshot for the same
   stamp did not. Inference: a stamp names one second, the feed keeps changing inside it, and the stored snapshot is an
   earlier state of that second. Then a base can be **ahead** of the snapshot its stamp names, the next patch is computed
   from the snapshot, and it re-applies changes the base already holds. That fits the apply errors (`path not found`,
   `bad index`: 1.1 and 1.3% of fetches in the whole-game runs) and the mismatches below. Not proven.
3. **Fallbacks do not follow start age.** In one run, patches succeeded with starts 159 s old while fallbacks happened at
   38, 41 and 47 s. The earlier spike's "200 to 300 s window" explanation is incomplete. Inference: the server falls back
   for a reason tied to the content of the change, not the age.
4. **A merged feed can differ from the snapshot for the same stamp, and it stays different.** In the whole-game World Series
   runs, **12 independent divergences were found in 50 conclusive verifications (24%)**, and 2 more were repeats of an
   unrepaired one. All 14 mismatch events were in `/liveData/plays`; 4 also in `/liveData/boxscore`, and one each in
   `/gameData/status` and `/gameData/absChallenges`. In the winter-league runs, 3 independent divergences in 116 (at least
   one of them a one-second stamp offset). In the winter game with diagnostics, **one divergence inside the events of a past
   play stayed unrepaired across 9 consecutive verifications while the game advanced six plays (78 to 84)**; later patches
   applied cleanly around it. So a merge can be silently wrong, with no apply error, and stay wrong until a full refetch.
   Only a verification fetch finds it, and that costs a full feed.
5. **Asking for an explicit end does not help.** With the push stamp as `endTimecode`, the merged feed ended on that stamp in
   only 12 of 43 patches (World Series) and 23 of 58 (winter). The server often returns a different end stamp.

The patch applier itself is sound: on stored timecode pairs, 54 of 54 consecutive real patches (game 870064) and 51 of 51
(game 851488) merged to exactly the served snapshot, with 0 errors (`replay-check.mjs`; 6 and 5 steps were inconclusive
because the server served another stamp). The earlier spike also replayed stored pairs and saw 3.5% fallback at a 15 s cadence,
against 16 to 20% here with live-edge requests. Inference: a request from the live edge behaves differently from a request
between two stored timecodes. Not tested directly. **Replay results should not be used to size a live design.**

## Connection behaviour (unknowns 2 and 5)

- A **browser** can connect: headless Chromium sent `Origin: http://127.0.0.1:<port>` and got HTTP `101`, four times out of
  six attempts across a scheduled game, a finished game, a live winter game and the live World Series game. The two failures
  were a bare 1006 with **no handshake response at all**, which looks like a network-level failure and not an origin
  rejection (a rejection would show a status). `https://tallybb.com` as the Origin was not tested.
- A **finished** game: the socket opens, then closes at once with `4400`. A **scheduled** game: it opens and stays open,
  silent.
- Established sockets drop with `1006` now and then (about one every 15 to 50 minutes in the winter runs).
- **The push service sheds load at peak.** Twice the server closed a socket with code `1013` and the reason
  "Service overloaded; retry later." (once with five to seven of my sockets open, once with three). About 40 minutes after I
  started capturing (about 25 minutes into play), new connections to Game 1's socket stopped opening for about 15 minutes:
  they hung or failed within a second, while a winter-league socket that was already open kept receiving pushes. Reconnecting
  with backoff recovered it (11 attempts). During the outage no socket opened, so the backoff escalated normally to 60 s; a
  tight reconnect loop did not cause it. Seven concurrent sockets from one address remain a confounder. A live-update design
  would depend on a socket that is least available when the game matters most.
- Non-MLB games push: both winter-league games sent pushes of the same shape (unknown 6, answered for winter leagues;
  minor-league sportIds 11 to 14 were not live).

## Tools

A code review of the first version found defects in the tools. This is what each meant for the numbers above.

- **`analyze.mjs` model** (fixed): the first version costed the poll baseline at the median of all full fetches, including
  the pre-game feed, left out the full feed fetched after each reconnect, and counted time with the socket down as live. The
  corrected model moved the ratios by up to 25%, all against the push design (for example 3.7 to 3.4 times for variant A
  against a 15 s poll, 28.5 to 21.6 times for the quiet winter run).
- **A mismatch was never repaired** (fixed): the same divergence was counted again at every later check. The winter game's 9
  mismatches were one divergence and 8 repeats. `analyze.mjs` now reports independent divergences; `capture.mjs` repairs the
  merged feed with the snapshot after a mismatch.
- **No effect on the data** (fixed anyway, checked in the event logs): a failed full-feed fetch could stop all later diff
  fetches (there were 0 failed fetches); the "up-to-date" skips of the explicit-end variant inflated the fetch count (there
  were 0); the 164 s stretch with pushes and no fetch was a real quiet spell, not a stall; the reconnect backoff reset on
  every open (no socket opened during the outage); abandoned sockets kept their handlers; `--maxMinutes` was not enforced on an
  open socket; close reasons were printed for most codes, against the file's own rule.
- **Push-shape counts in `summary.json` were meaningless** (fixed): the key embedded the timecode, so every push was a "new
  shape". The counts were not used here.
- **Tested after the fixes, not on a live game:** a simulation replaying stored data (33 patches merged, an injected bad
  snapshot found and repaired, a reconnect during a request dropped its stale patch), a finished game (closes 4400 and ends),
  a silent scheduled game (`--maxMinutes` ends it), and an interrupt. The fixed `capture.mjs` has not seen a real push stream.
- The container killed detached processes about five minutes after the session went idle (seen once), so a long capture needs
  the session kept busy.

## What this does not show

One MLB game. Not tested: a rain delay, a long review, `https://tallybb.com` as the Origin, minor-league games
(sportIds 11 to 14), or a design that uses the push only as a signal for a lean `fields=`-pruned fetch of the live feed,
which avoids the stamp problem and might be worth its own measurement. Verification fetches are not in the traffic model.

## Recommendation

Do not build push-triggered `diffPatch`. On a busy game the saving is 3.4 to 4.5 times against a 15 s timer and none
against a 60 s timer; handling failure needs a full-feed refetch and a verification step that cancel most of the saving;
and the live edge returns states a stamp cannot name, so some merges are wrong without an error and stay wrong. If live
freshness is the goal, test the push as a **signal** to fetch a lean feed. Close #2578 with this write-up, or keep it open
for that one measurement.
