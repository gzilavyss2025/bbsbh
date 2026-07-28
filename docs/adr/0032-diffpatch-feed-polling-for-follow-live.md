# diffPatch feed polling, scoped to Follow Live's tight cadence only

The MLB Stats API has an undocumented `diffPatch` mode
(`/api/v1.1/game/{gamePk}/feed/live/diffPatch?startTimecode=...`): instead of
returning the whole live feed, it returns an array of RFC 6902 JSON-Patch
entries covering everything that changed since `startTimecode`, or — once the
gap grows past roughly 200-300s of real time (no documented contract on the
exact window) — silently degrades to returning a plain full-feed object
instead. `useGameData.js` polls the live feed every `FEED_POLL_MS` (60s)
normally and every `FOLLOW_POLL_MS` (15s) during the Scores Unlocked pass
(ADR-0026/ADR-0027); this ADR is about using diffPatch to shrink that poll's
payload.

## Spike findings (full writeup: `.scratch/live-feed-diffpatch/findings.md`)

A standalone probe script (`scripts/probe-diffpatch.mjs`, deliberately kept
out of `src/`) replayed a real Final game's (gamePk 823035, subs/challenges/
position-player-pitching) full timestamp history at both real poll cadences,
applying each diffPatch response and deep-comparing the merged result against
a straight full-feed fetch at the same tick.

- **Correctness: clean.** 435 successful patch merges across an MLB and an
  AAA game, zero apply errors, zero semantic divergences.
- **The payload win is cadence-dependent, and NOT what a single-hop pilot
  suggested.** At `FOLLOW_POLL_MS` (15s), fallback happened on only 3.5% of
  polls and the net gzip reduction was ~14×. At `FEED_POLL_MS` (60s),
  ordinary gaps between half-innings/pitching changes crossed the endpoint's
  window often enough that 44% of polls fell back to a full feed anyway —
  net reduction only ~2.2×.
- **MiLB (tested on AAA) behaves identically** — no special-casing needed;
  it either works the same way or degrades to the existing full-fetch path.

## The decision

- **Wire diffPatch into `FOLLOW_POLL_MS` only — leave the default 60s poll
  untouched.** The 60s case is where a session spends most of its polling
  time, and it's exactly the case that clears the least benefit (~2×) for
  the most new risk. Not worth taking on a persistent merge cache there. The
  15s cadence already exists because Follow Live/Scores Unlocked is a
  heavier, opt-in mode for someone actively watching a game go — the real
  bandwidth win lands specifically where the user is most likely on a
  cellular connection watching pitch-by-pitch, so the payoff is real and
  narrow rather than a blanket optimization.
- **The merge always returns a fresh root object, never mutates in place.**
  `useRevealProgress.js`'s derived-per-inning cache invalidates on feed
  object IDENTITY (`derivedRef.current.feed !== feed`, ADR-0007) — an
  in-place patcher would leave that check permanently true after the first
  poll, silently freezing every reveal-only derivation at its pre-merge
  state. `src/lib/jsonPatch.js`'s `applyJsonPatch` clones the base once
  before applying any ops (even a zero-entry patch array still clones — see
  its test coverage), and `src/api/game.js`'s `mergeFeedDiff` never returns
  the caller's `base` by reference under any code path.
- **Session-only cache, keyed on gamePk, never persisted.** The last-resolved
  feed + its `metaData.timeStamp` live in a `useRef` inside `useGameData`
  (`feedCacheRef`), reset implicitly whenever it doesn't match the current
  `game.gamePk` — no separate invalidation code needed, since a mismatch
  just falls through to a full fetch. It is never written to
  `localStorage`/IndexedDB/the Cache API; doing so would reopen the exact
  hole ADR-0004's `NetworkOnly` service-worker rule for `statsapi.mlb.com`
  closes.
- **Fail safe to exactly today's behavior.** `mergeFeedDiff` never throws —
  any apply error or a sanity-check mismatch (`merged.gamePk !==
  game.gamePk`) returns `null`, and the caller falls back to
  `fetchGameFeed`, the same full fetch every poll already did before this
  ADR. The worst realistic regression from a diffPatch problem (an
  endpoint shape change, a bad patch) is "we silently do what we already
  do" — never a wrong or stale feed reaching a `SealBox`.
- **Read the latest `spoilersOff` through a ref, not a closure.**
  `useAsync`'s fetch function is only re-created when `game.gamePk` changes
  (its `deps`), so a plain closure over `spoilersOff` would see whichever
  value was current the last time the game changed, not live toggles of the
  Scores Unlocked pass mid-game. `spoilersOffRef.current = spoilersOff` is
  refreshed every render and read inside the fetch closure instead.
- **Vendored applier, not a new dependency — for now.** `src/lib/jsonPatch.js`
  implements the op set observed live (`add`/`remove`/`replace`/`move`/
  `copy`, plus `test` since the wire format has no documented contract on
  what can appear) in ~100 lines, pinned by `test/json-patch.test.js`. A real
  dependency (`fast-json-patch` or similar) is worth reconsidering if the op
  set surprises us in production, but wasn't justified to add for a ~100
  line, fully-tested surface.

## Cost accepted

- One more network request per Follow Live poll cycle in the common case (a
  diffPatch call, kept small; a full-feed fallback call only when the merge
  fails) — but it replaces, not adds to, what was already a full-feed fetch
  every 15s, so the net is fewer bytes, not more requests overall in the
  patch case. In the fallback case (diffPatch's OWN degraded response is
  already a full feed) there's no second call at all — production never
  double-fetches the way the measurement probe deliberately did to compare
  the two paths.
- A second, undocumented statsapi surface (`/feed/live/diffPatch`) with no
  contract to lean on beyond what was observed against real games in the
  spike. If MLB changes its shape or removes it, the fallback path degrades
  silently to today's behavior — no user-visible break expected, just a
  quiet loss of the bandwidth win.

## Known gaps (deliberately recorded, not yet closed)

- **No live-game browser verification yet.** The spike validated correctness
  via full-game *replay* against Final games (deterministic, exercises real
  event density) plus one live single-hop pilot early on. The production
  wiring in `useGameData.js` has not yet been watched end-to-end against a
  real in-progress game with Follow Live/Scores Unlocked turned on. Do that
  before treating this as fully settled — see `docs/test-games.md` for a
  live-friendly candidate, or watch whichever game is actually live when
  this ships.
- **60s default poll left as-is.** Revisit only if a future measurement
  shows the endpoint's real-time window is wider than the ~200-300s observed
  here, or if `FEED_POLL_MS` itself is ever tightened.
