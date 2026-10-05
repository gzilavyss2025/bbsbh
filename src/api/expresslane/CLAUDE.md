# src/api/expresslane — the Express Lane rail and clip index

`expresslane/` is the newest, and the spoiler line runs BETWEEN its two files
rather than around them. `rail.js` is reveal-only: it is the ordered, complete
event list for one half-inning, and its `description` / `result` / `pitch`
fields narrate the play. `clipIndex.js` is spoiler-free: URLs, a poster and a
duration, no prose and no result. Two rules that directory adds, both stated in
those headers and neither enforceable by the manifest. The rail takes ONE
half-inning per call and has no whole-game builder, because a game-wide rail
states how many innings the game ran and so whether it went to extras
(ADR-0008).

Tier 3 — the staging queue, the film gate and the on-device byte store —
is NOT here: it holds no baseball, only playIds and Blobs, so it lives in
`src/lib/expresslane/` (`staging.js`, `byteStore.js`, `runner.js`, `hold.js`).
`hold.js` is the one to read before touching the deck: a play with film on the
screen arrives HELD, and the hold is a CAP rather than a cover — it hands
`expressDeck` the cursor row with `isTerminal: false`, so the box, the chip and
the runners' diamonds are never computed (ADR-0071).
`.scratch/express-lane/PRD.md` carries the reasoning and the measurements.
