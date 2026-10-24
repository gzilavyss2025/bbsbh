# Live push spike: findings

Spike for #2578. No `src/` file changed. The scripts printed no score, play description or result at any point.
The `--diag` switch, which can write play-level path names, was only ever read for a winter-league game.

Measured on 2026-10-23 and 2026-10-24 UTC, from the Claude cloud sandbox: **about 21 minutes of play in World Series
Game 1** (gamePk 849805, four variants started together) and **three winter-league games** (870064 Venezuela, 851488
Dominican Republic, 28 to 41 minutes each). This is **not** one full live game: the World Series socket stopped accepting
new connections after about 40 minutes (see "Connection behaviour"). The numbers are firm enough to say the bar is
missed by a wide margin on a busy MLB game. They are too few to put a rate on it.

## Verdict against the bar in #2578

The bar (from the earlier spike): at least 10 times smaller at p50 and under 10% fallback, at **both** the 15 s and the
60 s cadence. Sizes are gzip of the re-serialized body. A fallback costs the failed diff **plus** the full feed that has
to be refetched after it. The poll baseline is one full feed per tick over the same live stretch (`analyze.mjs`).

**No-go for the 60 s default poll. No-go for Follow Live on a busy game. The earlier spike's "conditional go" for
Follow Live does not hold up live.**

| Run (World Series Game 1, in play) | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- | --- |
| A: fetch after a push, 1.5 s minimum gap | 20.9 | 58 | 19% | 3.4% | 3.2 times smaller | 0.8 times (**larger**) |
| B: same, with the push stamp as end timecode | 22.1 | 66 | 19.7% | 4.5% | 2.8 times | 0.7 times |
| G15: at most one fetch per 15 s | 21.8 | 55 | 16.4% | 5.5% | 3.8 times | 0.9 times |
| G60: at most one fetch per 60 s | 17.3 | 17 | **52.9%** | 0% | 3.6 times | 0.9 times |

| Run (winter league) | Live min | Fetches | Fallback | Apply error | vs a 15 s poll | vs a 60 s poll |
| --- | --- | --- | --- | --- | --- | --- |
| 870064, A | 41 | 119 | 0.8% | 0.8% | 28.5 times | 7.0 times |
| 870064, B | 27.9 | 69 | 7.2% | 1.4% | 8.9 times | 2.2 times |
| 851488, A | 39.8 | 111 | 13.5% | 4.5% | 4.4 times | 1.1 times |

The spread is the finding. A quiet game (870064, A) clears the 15 s bar and nearly clears the 60 s one. A busy game, or a
different quiet one, does not. The fallback rate decides everything, and it does not follow a rule a client could predict
(see below). Patches themselves are small: a median of 1.2 to 1.8 KB gzip in the World Series runs.

Why it fails at 60 s: pushes arrive about every 20 s in play (p50 gap 18 to 21 s, three a minute). Gating on a push does not
slow the request rate below a 15 s timer, and at a 60 s minimum gap half the fetches fall back.

## What the push message contains (unknown 1)

One JSON text frame, 212 to 289 bytes, keys in this order: `timeStamp` (a timecode such as `20261023_232707`), `gamePk`
(a string), `updateId` (a 36-character id), `wait` (number), `logicalEvents` (array of strings), `gameEvents` (array of
strings), `changeEvent` (object with one string `type`), `isDelay` (boolean). Pre-game frames have empty `logicalEvents`.
Inference: `timeStamp` is the feed's new `metaData.timeStamp`. In the pre-game sample, frames came in pairs 140 to 250 ms apart.
The server never echoes the `Gameday5` keepalive.

## Why a patch from the live edge is not safe to trust

1. **A fallback body is not consistent with its own stamp.** When `diffPatch` answers with a whole feed, its
   `metaData.timeStamp` is often the request's start stamp (16 of 43 fallbacks in the World Series runs), and in the replayed
   case its content differed from the snapshot for that stamp. The first version of `capture.mjs` kept that body as the next
   base, and the next patch then failed to apply. A plain `/feed/live` body does equal the snapshot for its own stamp
   (12 of 12, `own-stamp-check.mjs`), so a client must refetch one after any fallback. The result is the double cost above.
2. **Fallbacks do not follow start age.** In one run, patches succeeded with starts 159 s old while fallbacks happened at 38,
   41 and 47 s. The earlier spike's "200 to 300 s window" explanation is incomplete. Inference: the server falls back for a
   reason tied to the content of the change, not the age.
3. **A merged feed can differ from the snapshot for the same stamp.** In the World Series runs, 8 of 17 conclusive
   verifications mismatched, always in `/liveData/plays` (A 2 of 4, B 2 of 6, G15 4 of 6, G60 0 of 1). Winter-league runs had
   2 of 44 (one of them was a one-second stamp offset, now counted as inconclusive). Inference: timecodes have one-second
   resolution while updates and late-arriving tracking data land inside the same second, so a stamp does not name one state.
   A patch built on the stored snapshot can then be applied to a base that already has, or still lacks, some of its changes.
   That also fits the apply errors (`path not found`, `bad index`: 1 to 5 per run, 0.8 to 5.5% of fetches), and it means some
   merges may be wrong **without** an error. Only a verification fetch finds those, and that fetch costs a full feed.
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
- Established sockets drop with `1006` now and then: 6 drops across the four runs that lasted 20 to 41 minutes (for example
  2 in 41 minutes). One server-sent `1013` ("try again later") appeared while five to seven of my sockets were open. Reconnecting works most of the time.
- After about 40 minutes of capture, **new connections to the World Series game's socket stopped opening**: they hang in
  connecting, or fail within a second, and kept doing so through at least 8 minutes of backoff, while a winter-league socket
  that was already open kept receiving pushes. Inference: load or per-client limiting on the busiest game, made worse by my
  many parallel sockets and reconnects. Not confirmed. A live-update design would depend on a socket that is least
  available when the game matters most.
- Non-MLB games push: both winter-league games sent pushes of the same shape (unknown 6, answered for winter leagues;
  minor-league sportIds 11 to 14 were not live).

## Bugs in my own capture, found live

All fixed in `capture.mjs`: (1) a fallback body was used as the next base (above); (2) after a failed reconnect that raised
`error` and never `close`, the process exited silently with code 0 because nothing kept the event loop alive (three
captures vanished); (3) a connection stuck in CONNECTING was never timed out and retries stopped after 8. The container
also killed detached processes about five minutes after the session went idle (seen once), so a long capture needs the
session kept busy.

## What this does not show

One busy MLB game for about 21 minutes of play, not a full game; three winter-league games. The World Series fallback rate
(16 to 20%) may move over a game. Not tested: a rain delay, a long review, `https://tallybb.com`, minor-league games
(sportIds 11 to 14), or a design that uses the push only as a signal for a lean `fields=`-pruned fetch of the live feed,
which avoids the stamp problem and might be worth its own measurement.

## Recommendation

Do not build push-triggered `diffPatch`. The saving is 3 times at best on a busy game against a 15 s timer, and none against
a 60 s timer; the failure handling needs a full-feed refetch and a verification step that cancel most of the saving; and
the live edge returns states a stamp cannot name. If live freshness is the goal, test the push as a **signal** to fetch
a lean feed. Close #2578 with this write-up, or keep it open for that one measurement.
