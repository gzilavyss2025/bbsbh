# src/api/expresslane — the runner functions, the rail and the clip index

The sealing line in `expresslane/` runs BETWEEN its files rather than around them.
`rail.js` is reveal-only: it is the ordered, complete event list for one half-inning, and
its `description` / `result` / `pitch` fields narrate the play. `runners.js` is reveal-only
too: it names the runner boxes the scoring deck shows beside the batter's, and every
card carries its plate appearance's outcome. `clipIndex.js` is spoiler-free: URLs, a
poster and a duration, no prose and no result. `eligibility.js` is spoiler-free: whether
film can exist for a game at all.

Two rules that directory adds, both stated in those headers and neither enforceable by the
manifest. The rail takes ONE half-inning per call and has no whole-game builder, because a
game-wide rail states how many innings the game ran and so whether it went to extras
(ADR-0008). The other, the poster rule, governs rendering and lives in `src/CLAUDE.md`.

Express Lane's screens, and its staging queue and byte store (`src/lib/expresslane/`), were
deleted when Gameday replaced it (#2566). What stays: `runners.js` (Gameday's scorebook box and the
scorecard read it, ADR-0072), `clipIndex.js` (the play-by-play's Watch and the Scout's pitch modal),
`eligibility.js`, and `rail.js`, which no screen imports now; `runners.js`'s deck tests drive
through it. A new caller of either reveal-only file reads it inside a `SealBox` reveal function.
