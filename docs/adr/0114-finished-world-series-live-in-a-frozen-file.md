# Finished World Series live in a frozen file

**Status:** Accepted (2026-10-16). The maintainer approved the design.
**Date:** 2026-10-16
**Relies on:** ADR-0014, ADR-0087 (the postseason cutoff is a date, not a seal), ADR-0088.

## Context

The World Series callouts (gzilavyss2025/bbsbh#2235) compare tonight's game with every
earlier World Series game, from 1903. The history is 121 Series and 707 games.

A static file that a generator rewrites after tonight's game would hold tonight's events.
The browser would load those events in the network response before the reader reveals
them. That breaks the root `CLAUDE.md` spoiler rule: a score-revealing value must not
exist in the DOM or the network response before the reader reveals it.

## Decision

1. Finished Series live in a frozen file in `public/data/world-series/`. A hand-run
   generator (`scripts/gen-world-series.mjs`) writes it after each World Series. No cron
   runs it.
2. The current Series reaches the app only through the nightly callouts shard
   (`scripts/gen-callouts.mjs`), cut at the slate date.
3. Every history lookup takes the game's own date as `before`. It returns only rows with
   `date < before`. It fails closed when `before` is missing.
4. No code reads Scores Unlocked (`useScoresUnlocked`, `spoilersOffFor`).
5. The reader is `cutoff-gated` in `src/api/spoiler-manifest.json`, with an importer list.
6. One classifier decides what a tag means. The generator and the live builder import it.

## Consequences

- The frozen file adds a season by hand, once a year, after the World Series ends.
- The current Series needs the shard. The frozen file cannot show it.
- Every lookup needs a date. A call with no date throws.
- The file stays small: about 96 KB, 10.7 KB gzipped. Its budget is 100 KB, and a test
  fails past it.
