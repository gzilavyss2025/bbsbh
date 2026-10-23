# A partial reads the green by its job, never `--field` or `--field-deep`

**Status:** Accepted
**Date:** 2026-10-23
**Issue:** #2529. Extends ADR-0107.

## Context

`--field` did five jobs and partials read it by name, so "which green is a link" took a
hand scan (#2522). On 2026-10-22: `--field` 65 reads, `--field-deep` 52.

## Decision

1. Each job has a token; no value changed. `--accent-positive` (win, on-base, mark fill),
   `--accent-positive-deep` (chip text and border, hatch), `--accent-hover`,
   `--focus-ring`, `--accent-fallback` / `--accent-fallback-deep` (no club colour),
   `--accent-ball` (scout ball call), `--draw-turf` / `--draw-turf-deep` (grass drawn on
   the pregame scoreboard).
2. **`check-typography.mjs` fails on a read of `--field` or `--field-deep` in
   `src/styles/`**, the same check as ADR-0107's primitives. `--field-deep` stays a primitive.
3. Every token has a line in `.design-sync/build/usage-data.json`.
4. JSX that names `--field` (Pill `ink`, RookiePill) is outside the guard's scope.
