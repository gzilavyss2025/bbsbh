# src/screens/gameday/next — the new Gameday shell

Behind `?look=new` on the Gameday step (`isLookNew`, `useTier.js`). Plan: `docs/gameday-build.md`;
design: `.scratch/gameday-design/`. Without the flag `InningViewer` renders as it always did.

- `InningViewer` hands the shell its resolved state (`GamedayNextMount`). The advance control reuses
  today's reveal flow (`revealNextAtBat`, the next half, the box score); the shell decides nothing.
- `GamedayNextPage` is a fixed 100dvh frame, no scroll. The tier (`lib/gameday/ladder.js`) is
  `data-tier` on the root and `styles/gameday-next/page.css` names the grid areas; the stage row
  takes the slack. Slots for the stage, hero and panels are empty and labelled until prompts 7 to 9.
- Today's half page is mounted `hidden` as the engine: it reports the live snapshot (band) and the
  step cursor. Prompts 7 to 12 replace it block by block; the last one deletes it.
- The band draws through `ScorebugMount` (`Bug` prop), so its reveal clamp stays the only gate on the
  score. A folded block is a name in the menu until its prompt builds it; opening the menu loads
  nothing.
- Panels (prompt 8) live in `panels/GamedayPanels.jsx` (`panels.css`): InningViewer hands the cursor as `panels`; every result reads in a `Sealable` (SealBox, up to the step cut); a folded panel also draws in the menu.
- `stage/` is the stage renderer (#2569): `stagePlay` + `stateAt` (pure timeline), `drawStage` (slot-index buffer),
  `StageCanvas` (palette from the `--stage-*` tokens). `GamedayNextPage`'s `stage` prop fills the slot; the mount and tap rule are prompt 10. `stage/swing.js` holds the swing keyframes alone.
