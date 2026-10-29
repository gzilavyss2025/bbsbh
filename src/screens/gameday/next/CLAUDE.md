# src/screens/gameday/next — the Gameday page

The Gameday page (ADR-0043's 2026-10-27 amendment). No flag: the Gameday step renders this shell.
Plan and record: `docs/gameday-build.md`, the #2566 and #2568 comments.

- `InningViewer` hands the shell its resolved state (`GamedayNextMount`). The advance reuses the
  reveal flow (`revealNextStep`, the next half, the box score); the shell decides nothing.
- `GamedayNextPage` is a fixed 100dvh frame that never scrolls, at any size
  (`e2e/gameday-no-scroll.spec.js`). The tier (`lib/gameday/ladder.js`) is `data-tier` on the root
  and `styles/gameday-next/page.css` names the grid areas; the stage row takes the slack. The bar
  holds the Menu, the "At-bat | Pitch" switch and the advance, which owns the bar's dead space
  (`e2e/reveal-hit-area.spec.js`); it holds with aria-disabled, never `disabled`, so a tap still ends
  a hold, and the live edge is a polite status. In pitch mode the caught-up advance is a Refresh that reveals nothing (`caughtUpAdvance`). There is no "Rest of half". The compact tiers show SiteHeader and the existing game-section tabs above the band; the wide frame keeps the Menu as its way out (both lineups and the box score; Gary dropped the scorecard and the slate, 2026-10-28),
  and a delay, suspension or failed refresh is a strip under the band (the stage row gives up the
  room; the band keeps `--gd-band-h`).
- P and T keep the wide tiers' side columns as rails (Gary, 2026-10-27): the Due up slides in from the
  left and the arm from the right, by an edge tab or a sideways swipe off the bar; the scrim or Escape
  closes one, and each fetches nothing until first opened. On those tiers the Menu drops the batting order.
- The old half page is mounted `hidden` as the engine: it reports the live snapshot (band), the
  step cursor and the runs so far, and its page turn moves halves. Rebuilding the engine is what
  lets it go; until then its parts stay (`components/inning/`, `styles/focus/`).
- Gary's calls this shell keeps: the band uses the score bug's tiles and type; the batting view and zone map stay
  up through playback (a pitch never blanks them), and have a per-game dismiss; a switch hitter stands opposite the
  pitcher's hand; the hero's due-up hides under the checkpoint; the checkpoint's due-up names an
  announced pinch hitter; a pre-pitch pinch hitter is the first sub-step of his own at-bat.
- The band draws through `ScorebugMount` (the default score bug; `GamedayBand` before a snapshot), so its clamp is the only gate on the
  score. Opening the Menu loads nothing: a folded
  block fetches when it shows.
- Panels live in `panels/GamedayPanels.jsx` (`panels.css`): InningViewer hands the cursor as `panels`; every result reads in a `Sealable` (SealBox, up to the step cut); a folded panel draws in the Menu. The line
  score's run cells take a keyboard pick mid page-turn (aria-disabled only), as the old running line did.
- `stage/` times a revealed play from `stagePlay` + `stateAt` (pure timeline, `play.js`) and mounts only a
  celebration over the batting view. The corner field is gone (Gary, 2026-10-28, #2694); its renderer and art were deleted (#2702).
- The stage mount (#2573): `useGamedayStage` fills the slot and wraps the advance in the tap rule (`tapRule.js`,
  pure): it plays only a play an armed reveal tap (`advance.reveal`) revealed; anything else rests. `GamedayStage.js`
  reads that play inside a `SealBox` reveal function; the rest frame reads none. `zonemap/` is the zone card and its
  per-game dismiss (`bbsbh:zonemap:{gamePk}`). It is the batting view: the batter in tonight's uniform sized to the zone (knees to letters), the pitcher opposite with his line against him, and the at-bat's revealed pitches on the grid (`zonePitches.js`, inside a SealBox, up to the sub-step). A just-finished at-bat or a half read back keeps its batter until the next tap (`holdsFinished`), and so does a trail chip's tap (`replaying`, over the checkpoint too until Next); inside an open at-bat a pinch hitter stands in from his own sub-step. `battingSide.js` resolves both displays, including switch hitters; the batter figure is art, not a link, and the map has no ✕ (the stage's "Zones" button brings a dismissed one back). The figure is always MLB's own Gameday batter (Gary, 2026-10-29): tonight's posted uniform, else the club's usual "immortal" figure, else MLB's generic one (`api/uniforms.js` `fallbackFigureUrls`); the hero's strike-zone sheet tries the same list. The drawn sprite batter was removed.
- The hero's scorebook box copies Gary's hand-scored box: `docs/gameday-reference/scorebook-box.jpg` (match it, do not restyle).
- `hero/` is the hero slot (#2576): `heroMarkup.js` builds it (a `.js` builder, so `npm test` can render it),
  `heroModel.js` is the scorebook box's pure model. It reads the live snapshot's `last` (the last finished
  at-bat as of the cursor, `deriveLiveState`) inside a `SealBox` reveal function. The box has one height per
  tier in `styles/gameday-next/hero.css`; keep it free of pitch-count-driven size.
- `checkpoint/` is the half-end checkpoint (#2572): `checkpointMarkup.js` builds it (`npm test` renders it),
  calling `api/gameday/checkpoint.js` inside a `SealBox` reveal function. InningViewer sets `checkpoint`
  once the half on screen is at or under the mark and its last step is shown; it then takes the stage's
  slot. One page under tabs on the phone, all at T, L, D and under Motion: Reduced (`checkpoint.css`).
  Its Pitching page and the Menu's "Pitching lines" block draw the scorebook's pitching page (both clubs, `#`
  through `K`) from `panels/pitchingLinesMarkup.js`, fed `dayLine.js` `pitchingDayLines` at the step.
- `steps/` is sub-step stepping (ADR-0123, #2570, #2571): `subStep.js` holds the pitch-mode flag
  (`bbsbh:pitchmode:{gamePk}`), the words, `nextSub` (read at the tap; it returns a count only) and the
  stage's key; the cursor is `useRevealProgress`'s `{halfIdx}:{count}:{sub}`. The hero's open box and
  `eventCardMarkup.js` (the stage's lower third) read `openAtBat` inside a `SealBox` reveal function, up to `sub`.
  A substitution is its own sub-step: the engine and panels read `stepCapAt`'s cap, not the stored count (ADR-0123's 2026-10-28 amendment).
  A half read back in pitch mode walks each pitch again (`replayTap`, InningViewer's `replay`): view state inside `useFocusMode`'s cursor, never stored, reveals nothing.
- `cutscene/ballpark/` is the big-play celebration, a sprite system (the code-drawn kit from #2673 was
  removed in the #2676 stack: the sprites replace it), also inspected at `/animation-lab#ballpark`:
  separate character atlases, stadium, palette preparation and finite choreography. `cutscene/integration/`
  selects completed revealed results inside `GamedayStage`'s SealBox subtree; the stage's existing tap rule
  starts/skips it, and a finished one offers Replay (tapRule `replay`), held for the checkpoint too. It fills the stage, cropped not stretched, with the club's mono mark and a ✕ that puts it away (a held ending scene's ✕ gives the stage back to the batting view until Next). A scene whose assets or chunks fail leaves the stage empty. A qualifying ending scene holds
  until bottom Next opens its checkpoint without advancing the game; cold visits retain ordinary read-back.
  Authoring, asset provenance and the next steps live in `docs/ballpark-celebrations.md`.
