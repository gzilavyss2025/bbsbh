# Live push spike: findings (in progress)

Spike for #2578. No `src/` file changed. The scripts print no score, play or result.

## Before any live game (2026-10-23, from the Claude cloud sandbox)

| Question (from #2578) | Result |
| --- | --- |
| Does the socket accept a connection with no `Origin` (Node 22)? | Yes. Open in 0.6 to 0.8 s. |
| Does it accept a **browser** (unknown 2)? | Yes for one origin. Headless Chromium sent `Origin: http://127.0.0.1:<port>`, got HTTP `101`, and the socket opened (finished game and scheduled game). Not tested: `https://tallybb.com`. Inference: the server does not allowlist origins, since it took an arbitrary local one. |
| What happens for a **finished** game? | The socket opens, then closes at once with code `4400` ("Game is not available for subscription at this time."). Not `4200`. |
| What happens for a **scheduled** game (World Series Game 1, gamePk 849805, before first pitch)? | The socket opens and stays open. No close, no message in 35 s, and no echo of the `Gameday5` keepalive. So one capture can start hours early. |
| Does the patch applier work on real data? | Yes. `selftest.mjs`: 4 real `diffPatch` merges equal the snapshot MLB serves for the same timecode. 0 fallbacks. The applier is immutable and returns a new root for an empty patch. |
| Is the redaction safe? | `selftest.mjs` feeds score-like values through `shape.mjs` and finds no leak. |

## Live measurements

Not yet captured. Planned: winter-league games as a dress rehearsal (Venezuela and Dominican games start at 23:00Z on
2026-10-23), then World Series Game 1 (gamePk 849805, first pitch 2026-10-24T00:00Z).

Still unknown: what a push message contains, how often pushes fire, the age of the patch start at each fetch,
the fallback rate, rain-delay and reconnect behaviour, and whether non-MLB games push.
