# Reveal-only selectors live in isolated modules, called only from a reveal render path

Score-revealing computations (per-inning R/H/E/LOB and full-game totals,
pitch/whiff/Statcast derivations, live defensive alignment, live
batting-order subs) are impossible to un-render once they've touched the DOM
— a fetch-then-hide approach would need every future caller to remember to
hide it, and one forgotten `useMemo` would leak a score before the user asked
for it. Instead, every score-revealing selector lives in its own
"reveal-only" module (`src/api/linescore.js`, `src/api/derive.js`), and the
convention is enforced by never calling any of them at render top-level or
inside an eagerly-evaluated `useMemo` — only from inside a `SealBox`'s reveal
render function (ADR-0002). `src/api/select.js` is the deliberate contrast: it
holds only spoiler-free selectors (lineups, umpires, venue, rosters) and
touches no runs/hits/errors, so it's safe to call anywhere.

**Amended by ADR-0010.** The live defensive alignment and batting-order subs
(`src/api/defense.js`, `src/api/battingorder.js`) were originally reveal-only
too, taking the half being revealed and returning the starting nine plus subs
*through that half*. They have since been reframed as `defenseEntering` /
`lineupEntering` — the alignment/lineup as it stands *entering* a half (before
its first pitch), a caller-gated pre-pitch selector like `selectPrePitchChanges`
(ADR-0003) rather than a reveal-only one. Sub timing is still spoiler-adjacent,
so the caller must gate them to `halfIndex <= revealedThrough + 1`.

**Amended by ADR-0026/0027 (no change to the contract).** The two consented
spoiler departures add no reveal-only call site and relax nothing here. Scores
Unlocked feeds a render-only mark (`effectiveReveal`) into the same components,
so a reveal-only selector still runs only inside a `SealBox`'s revealed branch —
the pass changes *which* branch renders, not the lazy-invocation rule.
`selectLiveEdge` (`src/api/liveEdge.js`) is deliberately **not** reveal-only: it
reports how far the game has progressed (a half-index) and never touches
runs/hits/errors, so it is safe to call at render top-level — but it is not
plain spoiler-free either, since "how far along the game is" is itself
information. It is guarded instead by its consent argument (null unless
`following === true`), a third classification catalogued in `src/api/CLAUDE.md`.
