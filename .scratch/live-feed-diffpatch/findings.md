# Live-feed diffPatch polling — spike findings

Triggered by seeing `paaatrick/playball` (a terminal MLB viewer) poll the live
feed via the MLB Stats API's undocumented `diffPatch` mode instead of
refetching the full `/feed/live` payload every time. bbsbh currently refetches
the full feed on every poll (`src/api/game.js`, `src/hooks/useGameData.js`:
`FEED_POLL_MS = 60_000` normally, `FOLLOW_POLL_MS = 15_000` during Follow
Live / Scores Unlocked). This spike asks: is diffPatch worth adopting?

**Spike only — no `src/` file was touched.** All measurement happened in
`scripts/probe-diffpatch.mjs`, a standalone Node script (never imported by the
app, never run on a cron) that fetches raw feed JSON, applies patches with a
vendored immutable RFC 6902 applier, and diffs the merged result against a
straight full-feed fetch. It prints only byte counts and correctness counts,
never a score.

## How it was measured

`--replay --gamePk=<final game> --interval=<seconds>` walks a **Final**
game's full timestamp history and simulates a poller at the given cadence —
deterministic, and it exercises real event density (subs, scoring innings,
pitching changes) rather than luck-of-the-draw on one live sample. For every
simulated tick it fetches both `diffPatch?startTimecode=...&endTimecode=...`
and a straight `/feed/live?timecode=...`, applies the patch, and
`assert.deepStrictEqual`s the merged result against the fresh full feed.

Game used: gamePk `823035` (2026-07-07 MIL @ STL, game 2 of a doubleheader —
the CLAUDE.md-documented anchor game for subs / position-player-pitching /
challenges, from `docs/test-games.md`). MiLB check: gamePk `816933` (AAA,
2026-07-10).

## Results

| Run | polls | patch responses | fallback rate | apply errors | semantic divergences (on real patches) | gzip reduction |
|---|---|---|---|---|---|---|
| MLB, 60s cadence | 117 | 66 | 44% (51/117) | 0 | **0** | 2.17× |
| MLB, 15s cadence (Follow Live) | 310 | 299 | 3.5% (11/310) | 0 | **0** | **14.2×** |
| AAA (MiLB), 60s cadence | 125 | 70 | 44% (55/125) | 0 | **0** | 2.23× |

Raw summaries: `probe-823035-60s.json`, `probe-823035-15s.json`,
`probe-816933-60s.json`.

**Correctness: clean.** 435 real patch merges across all three runs, zero
apply errors, zero semantic divergences. Every "divergence" counted in the
raw JSON is on a `full-feed-fallback` tick, which is a methodology artifact,
not a patch bug (see below) — the applier itself never produced a wrong
merge.

**Ops observed in the wild:** `add`, `remove`, `replace`, `move`, `copy`.
No `test` op seen, but the applier implements it anyway since the op set
has no documented contract.

**MiLB works.** AAA behaves identically to MLB — same shape switching, same
op set, no special-casing needed. Nothing suggests MiLB needs a different
code path; a caller can treat diffPatch the same way for both, and if it
ever silently fails for a level, the existing full-feed fallback already
covers it (bbsbh's "MiLB degrades gracefully" convention holds without extra
work here).

## The one genuinely surprising finding

The very first single-hop pilot (done inline in the parent conversation,
before this script existed) measured a ~52× gzip reduction on one 60s hop
early in a game. That number was real but **not representative** — it
happened to land in a low-event stretch. Across a full game, the diffPatch
endpoint's patch window appears to be bounded by *elapsed real time* between
`startTimecode` and now, roughly ~200–300s, independent of how much actually
changed. At a 60s poll cadence, ordinary gaps between half-innings, pitching
changes, and replay reviews are long enough to blow past that window often
enough that **44% of ticks fell back to a full feed** — at which point that
tick is exactly as expensive as today's full-feed poll, plus the wasted
diffPatch request that preceded it. Net result: 60s polling only wins ~2.2×
overall, not 52×.

At 15s cadence the story flips: gaps rarely exceed the window (3.5%
fallback), and the win is a real 14×.

One more wrinkle worth recording, found while investigating the divergences:
when diffPatch falls back to a full-feed object, it does **not** exactly honor
the requested `endTimecode` — it returns the closest available snapshot
around that point, occasionally the current/latest state rather than a
precise historical one. That's irrelevant for a live poller (which only ever
wants "now"), but it's why the replay script's divergence count over-reports
during a fallback tick: it's comparing two different moments, not catching an
applier bug. Confirmed directly (see conversation) — a mid-game `endTimecode`
request returned a full feed timestamped ~16s off the request, not the final
state. This is documented here so nobody re-derives it as an "applier bug"
later.

## Go / no-go, against the plan's own bar

The original plan's threshold: go if gzip reduction ≥10× at p50 **and**
fallback rate under ~10% at 60s. Actual:

- **15s cadence (Follow Live): clears it decisively** — 14.2× reduction,
  3.5% fallback, zero correctness issues.
- **60s cadence (default background poll): misses it** — 2.2× reduction,
  44% fallback. That's within the plan's explicit no-go zone ("average
  saving drops below ~3×... the complexity is not worth it").

## Recommendation

**Conditional go, scoped to Follow Live only — not the default 60s poll.**

The 60s background poll is where most of a session's polling happens, and
it's the case where diffPatch buys the least while adding the most risk (a
mutable "last known feed" cache is exactly the shape ADR-0007 already burned
this codebase on once — see the parent conversation's earlier risk writeup
on `useRevealProgress.js`'s identity-keyed cache). Given a ~2× win there
isn't worth taking on a new spoiler-adjacent caching invariant to protect
forever.

Follow Live's 15s cadence is a different case: it already exists specifically
because Scores Unlocked / Follow Live is a heavier polling mode for staying
current on a game the user has explicitly unsealed, so bandwidth reduction
there has a real, narrow payoff (mobile data during exactly the mode most
likely to be run on a cellular connection watching a live game), and the
fallback rate is low enough that the "always correct, just sometimes no
smaller" fallback path stays rare rather than routine.

If this gets picked up as real work (not part of this spike), it needs its
own ADR before touching `src/`, specifically:

- The patch/merge function must always return a **new root object**, never
  mutate in place — this is the load-bearing rule that keeps
  `useRevealProgress.js`'s `derivedRef.current.feed !== feed` identity check
  correct. Should ship with a regression test that fails if the patcher ever
  returns the same reference it was given (pin the ADR-0007 lesson, don't
  just remember it).
  - Consider a real dependency (`fast-json-patch` or similar) over the spike's
    vendored applier before shipping — the vendored one was written to prove
    feasibility, not to be the production implementation. Whatever is used
    must guarantee non-mutation of the base.
- Cache is session-only (in-memory in `useGameData`), keyed on gamePk, and
  dropped on gamePk change — never persisted to `localStorage`/IndexedDB/the
  Cache API. Persisting it would reopen the exact hole ADR-0004's
  `NetworkOnly` service-worker rule closed.
- Apply failure or a post-apply sanity check
  (`merged.gamePk === gamePk`) falls back to a full `/feed/live` fetch,
  matching today's behavior exactly — the worst-case regression stays
  "we silently do what we do today," never a wrong or stale feed.
- Only wire this into the `FOLLOW_POLL_MS` (15s) path in `useGameData.js`,
  not the default 60s poll. Revisit the 60s case only if a future
  measurement (e.g., a shorter default interval, or evidence the ~200–300s
  window is wider than observed here) changes the math.
