# Spec: the at-bat replay shows the count and the bases

Status: built in #1858 (Gary's decisions of 2026-10-12 apply: tap to play everywhere, balls and strikes only). Slice 2 differs: bases come from per-card `basesBefore`/`basesAfter` snapshots in `halfInningFeed.js`, not from `runnersOnBase`.

## Most of this already shipped

The animated at-bat replay is on `main` (merge of #1683, 2026-10-07):

- `components/playbyplay/pitcherCard/AtBatReplay.jsx` and
  `lib/pitcherCard/atBat.js` play every pitch of a revealed plate appearance
  in `PitchScene`, along its measured flight. A bar reads "Pitch N of M" and
  the call. Tap a pitch to play it alone.
- Phone: a "Replay" button opens `ReplaySheet`. Wide: the scene sits in the
  focus rail and autoplays the last at-bat.

What ScriMLB has and Tally does not: **the ball-strike count and outs update
with each pitch, and the runners on the diamond change after the last pitch.**
This spec adds only that. Everything else in ScriMLB's version is worse than
ours (a fixed zone instead of the batter's, the catcher's view, missing
coordinates set to 0, the score written into the card).

The draft console spec (`.scratch/at-bat-console/spec.md`, #1389, PR #1669)
plans a "stage" (S3) and a runners chip (S4) that overlap this. Build this as
part of that plan, not as a second design. Slice 5 reconciles the two.

## Data

- **Count after each pitch:** `playEvents[].count` on that pitch's own event.
  Automatic calls move the count with no pitch (`isPitch: false`), so read
  each pitch's count from its event, never from its index.
  `expresslane/rail.js:78-90` (`rowCount`) already does this, privately.
- **Outs:** the entry's `outNumber` / `outAt`.
- **Bases before and after:** `api/expresslane/runners.js` `runnersOnBase`.
- `pitchCardInfo` (`api/playbyplay/pitchInfo.js:111`) builds `pitchDetails`
  today, with no count. Add it there.
- Pitches without tracking are dropped from the scene, so the scene's indexes
  can skip pitches. Key every step by the pitch's own number `no`.

## Spoiler rule

All of this is reveal-only and stays inside the revealed at-bat card, which is
inside the half's `SealBox` render function (ADR-0002). `pitchInfo.js` and
`expresslane/runners.js` are reveal-only in `spoiler-manifest.json`. A new
importer of `runnersOnBase` needs a manifest entry. The half remounts on
navigation, so the replay needs no "already played" memory.

## Motion

- **Phone: never autoplay.** Play starts on a tap.
- **Under reduced motion** (`hooks/preferences/motionIsReduced.js`), show the end
  state (final count, final bases) and let the reader step with the pitch chips.
  Today the replay disappears under reduced motion. This is an improvement.
- Completed plate appearances only (`entry.live == null`). A live one changes
  with every pitch and has no end state yet.
- Fixed sizes for the count strip and the diamond, so nothing moves while it
  plays (ADR-0046).
- New motion gets an Animation Lab entry (`animlab/motionDemos.jsx`) and a
  `docs/motion.md` line.

## Slices

| # | What | Files (≤ 5) | Pattern | Done test |
|---|---|---|---|---|
| 1 | Count on each pitch | `api/playbyplay/pitchInfo.js`, a new test | `rail.js` `rowCount` | A test that fails first: the count after each pitch in a PA with an automatic call (gamePk 823430, top 7) |
| 2 | Pure step model `{ no, balls, strikes, outs }` plus bases before and after | `lib/pitcherCard/replaySteps.js`, a test, `spoiler-manifest.json`, `src/api/CLAUDE.md` | `lib/pitcherCard/atBat.js` | Steps keyed by `no` survive a pitch with no tracking; bases match `runnersOnBase` |
| 3 | Count strip and diamond in `ReplayScene`, driven by `PitchScene`'s `onActive(idx)` | `AtBatReplay.jsx`, `PitchScene.jsx` (an `onDone` if needed), `styles/pitcher-card/card.css` | the ref-driven bar in `PitchScene` | 390 px screenshot of gamePk 823169, bottom 1, mid-play; no height change between steps |
| 4 | Gates: tap to play on phone, reduced-motion end state, completed PAs only | `AtBatReplay.jsx`, `animlab/motionDemos.jsx`, `docs/motion.md`, `components/playbyplay/CLAUDE.md` | the OVR card's tap gate | With `data-motion="reduced"` the full count shows at once; a live PA has no replay button |
| 5 | Fold into the console plan | `.scratch/at-bat-console/spec.md` | — | S3/S4 point at this work |

**Caps to know before you start:** `PlayByPlay.jsx` is at 800 of 800 lines and
`13-play-by-play.css` at 600 of 600, so neither takes a new line. Keep the work
in `pitcherCard/` (7 files), `lib/pitcherCard/` (4), and `card.css` (464 of 600).
If the bases-before-the-PA must pass through `PlayByPlay.jsx` as a prop, free
lines there first, in its own slice.

Model: Sonnet for slices 1, 2 and 5; Opus for slices 3 and 4.

## Out of scope

- A flat 400 ms drop-in like ScriMLB. Our flights are measured; keep them.
- Pitch colours by type. `pitchMark` colours need a paper-ground tone first
  (`docs/pitch-types.md`).
- A bat drawing (Gary said not yet, in the console spec).

## Questions for Gary

1. Keep the wide-screen autoplay of the last at-bat, or tap to play everywhere?
2. Show outs in the count strip ("2-1, 1 out"), or balls and strikes only?
