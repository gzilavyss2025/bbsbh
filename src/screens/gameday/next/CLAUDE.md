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
- `hero/` is the hero slot (#2576): `heroMarkup.js` builds it (a `.js` builder, so `npm test` can render it),
  `heroModel.js` is the scorebook box's pure model. It reads the live snapshot's `last` (the last finished
  at-bat as of the cursor, `deriveLiveState`) inside a `SealBox` reveal function. The box has one height per
  tier in `styles/gameday-next/hero.css`; keep it free of pitch-count-driven size.
