# src/screens/gameday/next — the Gameday page

The Gameday page (ADR-0043's 2026-10-27 amendment). No flag: the Gameday step renders this shell.
Plan and record: `docs/gameday-build.md`, the #2566 and #2568 comments.

- `InningViewer` hands the shell its resolved state (`GamedayNextMount`). The advance reuses the
  reveal flow (`revealNextStep`, the next half, the box score); the shell decides nothing.
- `GamedayNextPage` is a fixed 100dvh frame that never scrolls, at any size
  (`e2e/gameday-no-scroll.spec.js`). The tier (`lib/gameday/ladder.js`) is `data-tier` on the root
  and `styles/gameday-next/page.css` names the grid areas; the stage row takes the slack. The bar
  holds the Menu, the "At-bat | Pitch" switch and the advance, which owns the bar's dead space
  (`e2e/reveal-hit-area.spec.js`). There is no "Rest of half".
- The old half page is mounted `hidden` as the engine: it reports the live snapshot (band), the
  step cursor and the runs so far, and its page turn moves halves. Rebuilding the engine is what
  lets it go; until then its parts stay (`components/inning/`, `styles/focus/`).
- Gary's calls this shell keeps: the band uses the score bug's tiles and type; the zone map shows
  only before a tapped play and has a per-game dismiss; a switch hitter stands opposite the
  pitcher's hand; the hero's due-up hides under the checkpoint; the checkpoint's due-up names an
  announced pinch hitter; a pre-pitch pinch hitter is the first sub-step of his own at-bat.
- The band draws through `ScorebugMount` (`Bug` prop), so its reveal clamp stays the only gate on the
  score. Opening the Menu loads nothing: a folded
  block fetches when it shows.
- Panels live in `panels/GamedayPanels.jsx` (`panels.css`): InningViewer hands the cursor as `panels`; every result reads in a `Sealable` (SealBox, up to the step cut); a folded panel draws in the Menu. The line
  score's run cells take a keyboard pick mid page-turn (aria-disabled only), as the old running line did.
- `stage/` is the stage renderer (#2569): `stagePlay` + `stateAt` (pure timeline), `drawStage` (slot-index buffer),
  `StageCanvas` (palette from the `--stage-*` tokens). `stage/swing.js` holds the swing keyframes alone.
- The stage mount (#2573): `useGamedayStage` fills the slot and wraps the advance in the tap rule (`tapRule.js`,
  pure): it plays only a play an armed reveal tap (`advance.reveal`) revealed; anything else rests. `GamedayStage.js`
  reads that play inside a `SealBox` reveal function; the rest frame reads none. `zonemap/` is the zone card and its
  per-game dismiss (`bbsbh:zonemap:{gamePk}`); the tint is `drawStage`'s `zones`, at rest only.
- `hero/` is the hero slot (#2576): `heroMarkup.js` builds it (a `.js` builder, so `npm test` can render it),
  `heroModel.js` is the scorebook box's pure model. It reads the live snapshot's `last` (the last finished
  at-bat as of the cursor, `deriveLiveState`) inside a `SealBox` reveal function. The box has one height per
  tier in `styles/gameday-next/hero.css`; keep it free of pitch-count-driven size.
- `checkpoint/` is the half-end checkpoint (#2572): `checkpointMarkup.js` builds it (`npm test` renders it),
  calling `api/gameday/checkpoint.js` inside a `SealBox` reveal function. InningViewer sets `checkpoint`
  once the half on screen is at or under the mark and its last step is shown; it then takes the stage's
  slot. One page under tabs on the phone, all at T, L, D and under Motion: Reduced (`checkpoint.css`).
- `steps/` is sub-step stepping (ADR-0123, #2570, #2571): `subStep.js` holds the pitch-mode flag
  (`bbsbh:pitchmode:{gamePk}`), the words, `nextSub` (read at the tap; it returns a count only) and the
  stage's key; the cursor is `useRevealProgress`'s `{halfIdx}:{count}:{sub}`. The hero's open box and
  `eventCardMarkup.js` (the stage's lower third) read `openAtBat` inside a `SealBox` reveal function, up to `sub`.
