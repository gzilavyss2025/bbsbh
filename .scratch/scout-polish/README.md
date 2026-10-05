# Matchup Scout polish — working files

The tracker is GitHub issue #1490; it is built in the PR that carries this folder
(the spec is `docs/scout-design.md` F, the scene decision ADR-0099). These are its
supporting files.

- `mockup.html` — the reviewed mockup (Gary, 2026-10-05). It is a single, self-contained page:
  open it in a browser (`npx vite preview` is not needed; a `file://` open works, but the
  Google Fonts link needs network). It embeds the pair data below. Its `<script>` holds the
  reference code for the two cameras, the stage backdrop, the real-flight math, the verdict
  and ledger logic, and the region map drawing. Port the logic, not the markup: the app uses
  its own tokens, components and SVG (`PitchScene.jsx`), not a canvas.
- `pair-601713-694192.json` — the data for Nick Pivetta (601713) vs Jackson Chourio (694192),
  rebuilt by `pull-data.mjs` with the scout's own pure functions. The mockup's embed is the
  same shape (plus `totals`).
- `pull-data.mjs` — `node .scratch/scout-polish/pull-data.mjs [pitcherId] [hitterId]`. Reads
  `public/data` stores through `loadScout`, `pitcherBoard` and `hitterSide`; then fetches the
  Savant head-to-head CSV (the page's own `savantUrl`) and each game's statsapi feed for playIds.
