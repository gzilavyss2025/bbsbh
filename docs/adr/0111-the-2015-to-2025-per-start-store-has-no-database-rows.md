# The 2015 to 2025 per-start store has no database rows and no frozen dump

**Status:** Accepted
**Date:** 2026-10-14

## Context

The Game Log's pitch-mix bar reads `public/data/pitch-arsenal-starts/{season}/{NN}.json`
(`fetchPitchMixFor`). Only 2026 is on file, so every earlier season shows "No pitch mix on file".
Gary wants 2015 to 2025 on file.

`gen-pitch-arsenal.mjs` can fill the store, but it also builds the arsenal, command and
hitter-grid stores. It keeps all of them in SQLite (ADR-0021), and a frozen season is a dump in git
(ADR-0086). That is about 45 to 60 MB of SQL per season. Its per-start table also adds on conflict
(`n = n + excluded.n`), so a second run on a frozen season fails without `REFREEZE=1`.

## Decision

`scripts/gen-pitch-starts.mjs` fills the per-start store for one earlier season, MLB only. It has no
SQLite rows and writes no dump. It writes the same shards that `foldStarts`, `startsBuckets` and
`mphBuckets` give, and a test pins that they are equal. It is hand-run and is not on the cron.

A season enters `seasons.json` only after `--verify` passes (coverage, box score check, unknown codes,
shard size and bucket).

The 2026 store and its nightly path are unchanged. They still come from `gen-pitch-arsenal.mjs`.

## Why

The data is immutable: a Final game does not change. A database row would only hold the data until the
next write, and a dump would add about 15 MB of SQL per season to git for a store that is already a
committed file. The shards are the record. A resume needs only the shards, and a repeat run cannot
add a game twice.

## Alternatives considered

**Run `gen-pitch-arsenal.mjs` for each season.** It writes the other three stores and the dumps, which
Gary does not want for these seasons.

**Add a flag to `gen-pitch-arsenal.mjs`.** The file is long and its fold adds on conflict. A second
mode would carry both problems.
