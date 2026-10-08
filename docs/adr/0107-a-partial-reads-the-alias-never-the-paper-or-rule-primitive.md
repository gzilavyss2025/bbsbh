# A partial reads the alias, never the paper or rule primitive

**Status:** Accepted
**Date:** 2026-10-08
**Issue:** #1156 (slice G, the guard)

## Context

Slices A to F swapped every read of `--paper-0..3`, `--rule`, `--rule-soft` and
`--rule-grid` in `src/styles/` to a semantic alias. Nothing stopped a new rule from
reading a primitive again.

## Decision

1. **`check-typography.mjs` fails on any such read in `src/styles/`**, in any property.
   It splits each value on `var(` and reads the token name, so `--paper-0` counts. The
   message names the token it found. It reads a last declaration with no `;`, blanks
   `url(...)` bodies first (a data URI carries `;`), and anchors the property name to a
   declaration start, so a selector colon is not read as one. The other rules in the
   file keep their original value pattern.
2. **No allowlist.** The guard passes on the tree with zero entries.
3. **Scope is `src/styles/` only (Gary, 2026-10-07).** `src/tokens/` defines the
   primitives. `public/learn.css` loads outside the bundle. `posterPaper.js` reads the
   primitives at run time. None is scanned.
4. **`--paper-N: ...;` as a property name is a definition, not a read.** The guard does
   not flag it. No partial defines one.
