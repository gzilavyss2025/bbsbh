# Live push spike: findings

Spike for #2578. No `src/` file changed. The scripts printed no score, play description or result at any point.
The `--diag` switch, which can write play-level path names, was only ever read for a winter-league game.

Measured on 2026-10-23 and 2026-10-24 UTC, from the Claude cloud sandbox:

- **World Series Game 1** (gamePk 849805): about 3 hours of play (the game ran about 3 h 15 min). Two variants ran for the
  whole game (A and G60 below), with a gap of about 13 minutes where the socket refused new connections. Two more variants
  (B and G15) ran for the first 21 minutes of play only.
- **Three winter-league games** (870064 Venezuela, 851488 Dominican Republic): 28 to 100 minutes each.

It is one game for the MLB result. A different game, or a different part of a season, could land differently. The size of
the miss is large enough that this does not change the verdict.

## Verdict against the bar in #2578

The bar (from the earlier spike): at least 10 times smaller at p50 and under 10% fallback, at **both** the 15 s and the
60 s cadence. Sizes are gzip of the re-serialized body. A fallback costs the failed diff **plus** the full feed that has
to be refetched after it. The poll baseline is one full feed per tick over the same live stretch (`analyze.mjs`).

**No-go for the 60 s default poll. No-go for Follow Live on a busy game. The earlier spike's "conditional go" for
Follow Live does not hold up live.**

World Series Game 1, whole game (two stretches per variant, before and after the connection outage):

| Variant | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll | Requests a minute |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A: fetch after each push, 1.5 s minimum gap | 177.7 | 465 | **19.4%** | 1.1% | 3.7 times smaller | 0.9 times (**larger**) | 3.2 |
| G60: at most one fetch per 60 s | 174.1 | 151 | **47.7%** | 1.3% | 4.8 times | 1.2 times | 1.3 |

First 21 minutes of play only, four variants started together:

| Variant | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- |
| A | 58 | 19% | 3.4% | 3.2 times | 0.8 times |
| B: A with the push stamp as the end timecode | 66 | 19.7% | 4.5% | 2.8 times | 0.7 times |
| G15: at most one fetch per 15 s | 55 | 16.4% | 5.5% | 3.8 times | 0.9 times |
| G60 | 17 | 52.9% | 0% | 3.6 times | 0.9 times |

Winter-league games (A unless noted):

| Game | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- | --- |
| 870064, first 41 min | 41 | 119 | 0.8% | 0.8% | 28.5 times | 7.0 times |
| 870064, B | 27.9 | 69 | 7.2% | 1.4% | 8.9 times | 2.2 times |
| 851488 | 39.8 | 111 | 13.5% | 4.5% | 4.4 times | 1.1 times |

The spread between games is itself a finding: a quiet game can clear the 15 s bar, a busy one cannot, and nothing a client
can see in advance says which it will be. The fallback rate decides everything. Patches are small (median 1.2 to 2.1 KB
gzip, p95 3 to 4.5 KB), so when they work the saving is real.

Why it fails at 60 s: pushes arrive about every 17 to 20 s in play (2.6 a minute over the game). Gating on a push does not
slow the request rate below a 15 s timer, and a 60 s minimum gap raised the fallback rate from 19.4% to 47.7%.

## What the push message contains (unknown 1)

One JSON text frame, 212 to 289 bytes, keys in this order: `timeStamp` (a timecode such as `20261023_232707`), `gamePk`
(a string), `updateId` (a 36-character id), `wait` (number), `logicalEvents` (array of strings), `gameEvents` (array of
strings), `changeEvent` (object with one string `type`), `isDelay` (boolean). Pre-game frames have empty `logicalEvents`.
Inference: `timeStamp` is the feed's new `metaData.timeStamp`. In the pre-game sample, frames came in pairs 140 to 250 ms
apart. The server never echoes the `Gameday5` keepalive.

## Why a patch from the live edge is not safe to trust

1. **A fallback body is not consistent with its own stamp.** When `diffPatch` answers with a whole feed, its
   `metaData.timeStamp` is often the request's start stamp (31 of 163 fallbacks in the whole-game World Series runs), and in
   the replayed case its content differed from the snapshot for that stamp. The first version of `capture.mjs` kept that
   body as the next base, and the next patch then failed to apply. A plain `/feed/live` body does equal the snapshot for
   its own stamp (12 of 12, `own-stamp-check.mjs`), so a client must refetch one after any fallback. That is the double
   cost counted above.
2. **Fallbacks do not follow start age.** In one run, patches succeeded with starts 159 s old while fallbacks happened at
   38, 41 and 47 s. The earlier spike's "200 to 300 s window" explanation is incomplete. Inference: the server falls back
   for a reason tied to the content of the change, not the age.
3. **A merged feed can differ from the snapshot for the same stamp.** In the whole-game World Series runs, **14 of 50
   conclusive verifications (28%)** differed. All 14 differed in `/liveData/plays`; 4 also in `/liveData/boxscore`, and one
   each in `/gameData/status` and `/gameData/absChallenges`. Inference: a boxscore difference points at game state, not only a late
   tracking field. Winter-league runs had about 10 of 116. In one winter game with diagnostics, the mismatches had the same
   stamp, the same number of plays and events, and differed only inside `playEvents`. **The cause is not established.** One
   guess was that stored snapshots are revised after the fact; refetching the latest stamp's snapshot found no change
   (0 of 6). Another is that several updates share one second (stamps have one-second resolution). Neither was confirmed.
   Apply errors (`path not found`, `bad index`) were 1 to 1.3% of fetches in the whole-game runs. A mismatch with no error
   means a merge can be wrong **silently**, and only a verification fetch, which costs a full feed, finds it.
4. **Asking for an explicit end does not help.** With the push stamp as `endTimecode`, the merged feed ended on that stamp in
   only 12 of 43 patches (World Series) and 23 of 58 (winter). The server often returns a different end stamp.

The patch applier itself is sound: 44 and 59 consecutive real patches merged to exactly the served snapshot with 0 errors
(`replay-check.mjs`, game 870064, using stored timecode pairs). That is also why the earlier spike, which replayed stored
pairs, saw 3.5% fallback at a 15 s cadence: stored-to-stored requests behave differently from requests at the live edge.
**Replay results should not be used to size a live design.**

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
  started capturing (about 25 minutes into play), new connections to Game 1's socket stopped opening for about 15 minutes: they hung or failed within a second, while a
  winter-league socket that was already open kept receiving pushes. Reconnecting with backoff recovered it (11 attempts). A
  live-update design would depend on a socket that is least available when the game matters most.
- Non-MLB games push: both winter-league games sent pushes of the same shape (unknown 6, answered for winter leagues;
  minor-league sportIds 11 to 14 were not live).

## Bugs in my own capture, found live

All fixed in `capture.mjs`: (1) a fallback body was used as the next base (above); (2) after a failed reconnect that raised
`error` and never `close`, the process exited silently with code 0 because nothing kept the event loop alive (three
captures vanished); (3) a connection stuck in CONNECTING was never timed out and retries stopped after 8. The container
also killed detached processes about five minutes after the session went idle (seen once), so a long capture needs the
session kept busy.

## What this does not show

One MLB game. Not tested: a rain delay, a long review, `https://tallybb.com` as the Origin, minor-league games
(sportIds 11 to 14), or a design that uses the push only as a signal for a lean `fields=`-pruned fetch of the live feed,
which avoids the stamp problem and might be worth its own measurement.

## Recommendation

Do not build push-triggered `diffPatch`. On a busy game the saving is under 4 times against a 15 s timer and none against
a 60 s timer; handling failure needs a full-feed refetch and a verification step that cancel most of the saving; and
the live edge returns states a stamp cannot name, so some merges are wrong without an error. If live freshness is the goal,
test the push as a **signal** to fetch a lean feed. Close #2578 with this write-up, or keep it open for that one measurement.
