# Scores Unlocked and the slate's reveal-all are removed

**Status:** Accepted
**Date:** 2026-10-18
**Issue:** none; Gary's decision of 2026-10-18
**Retires:** ADR-0026, ADR-0028, ADR-0032
**Amends:** ADR-0022, ADR-0042, ADR-0048, ADR-0049, ADR-0055, ADR-0087

## Context

Two features on the slate opened many seals at once:

- **Scores Unlocked** (ADR-0026), the "Live scores" day pass. One consent tap
  unsealed every score for one day, on every scoring surface. A day you agreed to
  stayed open on every device you own.
- **Reveal all results**, the slate chip and its phone bar. One tap flipped every
  Final card on a past day to a result face (the flip card), with storyline pills,
  a "Game of the Night" crown, a filter bar, and condensed-game posters.

Gary decided on 2026-10-18 to remove both, end to end. The app is a second screen
for a reader who keeps score on paper. A switch that shows every score at once
works against that, and it was the largest surface the spoiler rule had to guard.
Two choices were made with the removal:

- **Decision 1 (B1).** A past day's Final card is now the plain `GameCard`, and it
  opens the box score: `onBoxScore={() => onPick(g, dateStr, 'boxscore')}`. The box
  score keeps its own seal. The flip card and everything that fed it go.
- **Decision 2.** The World Series home loses its seal. Today's game shows no score
  slot at all — no seal, no button — where the hero and the ledger showed one.

## Decision

### What is removed

- **The pass.** The slate switch and its consent sheet, the `scoresUnlocked.*` copy
  group, `src/lib/scoresUnlocked.js`, `src/hooks/useScoresUnlocked.js`, and the
  GameView `.modestrip` banner.
- **The spoiled-day record and its sync.** `src/lib/spoiledDays.js`,
  `src/components/sync/SpoiledDaysCloudSync.jsx`, `api/spoiled-days.js`, its sync
  channel and claim, its owner guard, the My Tally rows ("Scores Unlocked", "Days
  you unsealed") and the merge-receipt line.
- **The slate's live score line.** `fetchSlateScores`, `src/lib/slateScoreLine.js`,
  `GameCard`'s `ScoreLine` and its CSS and contrast pairs. The slate model
  (`normalizeGame`) stays score-free, and the slate now makes no score request.
- **Follow Live.** `selectLiveEdge`, `shouldFollowLiveEdge` and their helpers in
  `src/api/liveEdge.js`, the innings viewer's follow effect, and the action bar's
  pass-only "Live · {inning}" state.
- **The pass-only feed path (ADR-0032).** The 15s poll, `fetchGameFeedDiff`,
  `mergeFeedDiff` and `src/lib/jsonPatch.js`. A live game polls the full feed every
  60s, as it did with the pass off.
- **Toggle-consent analytics (ADR-0028).** `src/lib/analytics.js`. The pass was its
  only caller. Page analytics (`<Analytics />` in `main.jsx`) stay.
- **The reveal-all chain.** The chip, `RevealAllBar`, `revealedAll`, the `.daystate`
  row and its scope note, `.datenav--lg`, `PastGameFlipCard.jsx`,
  `useDayCardMeta.js`, the filter bar (`ResultFilterBar`, `FILTER_CHIPS`), the
  crown's reorder (`reorderGameOfTheNight`), the day's condensed-game index read
  (`fetchDayVideos`), and `src/api/dayHighlights.js` (`classifyGameCards` and the
  signal scanners, whose only caller was `useDayCardMeta`).
- **The postseason seals.** The `live` and `onRevealScores` props on the World
  Series home, its hero and its ledger, and the `live` option on
  `usePostseasonBracket` and `useWorldSeriesHome`.

### What stays

Stamp In (ADR-0042) and its own `ConsentModal`; the stamp override (ADR-0048); the
box score's open bit (ADR-0049); `revealedThrough` and `useRevealProgress`;
`SealBox`; the Game Log; ADR-0055's "Caught up" state and `selectLiveHalf` /
`selectCatchUpTarget` with the `.liveedge` CSS; `FlipCard.jsx`,
`BoxScoreSkeleton.jsx`, `GameResultFace.jsx` and `usePastGameSignals.js`, which
Stamp In, the postseason series pages, the design lab and the player page still use.

### The new `effectiveReveal`

`effectiveReveal({ stamped, revealedThrough, unlocked, actualCount })` has one
opener. When `stamped` is false it is the identity. When it is true, the render mark
covers the whole game and `commitReveals` is false. The return shape is unchanged.
The box score's seal is `forceRevealed={stamped || boxOpened}` and
`onReveal={stamped ? undefined : markBoxOpened}`.

### Leftover data

- **localStorage.** `bbsbh:scoresUnlocked`, `bbsbh:spoiledDays` and
  `bbsbh:spoiledDaysOwner` have no reader. They are ignored, and "Erase my Tally
  data" sweeps them with every other `bbsbh:` key.
- **`bbsbh:prompts`.** The `scores-unlocked-local` id is not a prompt id now, so
  `parsePrompts` drops it on read.
- **Redis.** `spoiled:{userId}` has no writer. `DELETE /api/account` still erases
  it, so old data is removed when a reader asks.
- **The copy store.** A saved `scoresUnlocked.*` override is an unknown id now, so
  `sanitizeOverrides` drops it on read.

## Consequences

- `api/` has thirteen functions, not fourteen; twelve never render or fetch a
  score.
- ADR-0087's decision 4 ("Scores Unlocked does not apply here") and its 2026-09-30
  addendum ("revealing the day's live scores moves the bracket") are moot: there is
  no pass to apply.
- **Follow-ups.** The data layer keeps an inert `{ live }` option, default false,
  that no caller passes: `src/api/postseason/bracket.js`, `src/api/postseason/fetch.js`,
  `src/api/postseason/worldSeriesHome.js` and `src/lib/postseason/worldseries/ledger.js`,
  with their tests. A later change can delete it. The nightly highlights job still
  writes `public/data/highlights/day/{MMDDYYYY}.json`, which nothing reads now; that
  generator step can go too.
- The removed e2e spec (`e2e/invariants/scores-unlocked.spec.js`) and the unit tests
  for the removed code (`scores-unlocked`, `spoiled-days`, `analytics`, `live-edge`,
  `game-feed-diff`, `json-patch`, and the `dayHighlights` half of
  `day-highlights.test.js`) are deleted with it. The slate-order tests moved to
  `test/slate-order.test.js`.
