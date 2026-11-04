# src/api/expresslane — the runner functions and the clip resolver

The sealing line in `expresslane/` runs BETWEEN its files rather than around them.
`runners.js` is reveal-only: it names the runner boxes the scoring deck shows beside the batter's, and every
card carries its plate appearance's outcome. `clipIndex.js` is spoiler-free: a URL
resolver, no prose and no result. `eligibility.js` is spoiler-free: whether
film can exist for a game at all.

One rule that directory adds, stated in its headers and not enforceable by the
manifest: the poster rule (no frame outside a revealed play) governs rendering and lives in `src/CLAUDE.md`.

Express Lane's screens, and its staging queue and byte store (`src/lib/expresslane/`), were
deleted when Gameday replaced it (#2566). What stays: `runners.js` (Gameday's scorebook box and the
scorecard read it, ADR-0072), `clipIndex.js` (the play-by-play's Watch and the Scout's pitch modal),
and `eligibility.js`. `rail.js` was deleted (#2842). A new caller of `runners.js` reads it inside a `SealBox` reveal function.
