Status: needs-triage
Blocked by: 01-data-layer.md

# Box score — give the existing Play of the Game card a Watch affordance

## Summary

**Scope decided 2026-08-06, superseding the PRD's literal "new card" framing**
(see PRD §"Box score" — it describes this as a new card, but the box score
already has a WPA-ranked `PlayOfTheGame` card, `src/api/boxscore.js:635`
`computePlayOfTheGame`, rendered by `PlayOfTheGame` in `BoxScore.jsx`, and has
had one since the app's early commits — ADR-0013 for the WPA/captivating-
index scoring). Decision: **enhance the existing card** with a "Watch"
affordance when a video clip exists for the same play, rather than building
a second, differently-sourced "best play" card that would compete with it.

This means the PRD's "rendered only when the game's content items include a
`player-of-the-game`/`star-of-the-game`/`featured` clip" framing doesn't
apply as written — the card already always renders (when WPA data exists);
the video affordance is additive and conditional, not gating the card's own
existence.

Also folds in the box-score-thumbnail decision from the PRD (a real poster
on the "Watch" affordance, for consistency with the rails in issues 03/04) —
see PRD's box-score section for the spoiler reasoning (a poster on an
already-revealed play adds no new information; memory:
highlight-poster-not-actually-a-spoiler).

**Reminder — do NOT fold in the per-play `AtBatCard` poster.** That's a
separate follow-up issue against the ORIGINAL video-highlights feature (own
worktree/branch, own spoiler-audit re-check of `PlayByPlay.jsx`'s existing
`SealBox` gate) — out of scope here. This issue only touches
`computePlayOfTheGame`/`PlayOfTheGame`.

## 1. Recover a `playId` for the WPA-picked play

`computePlayOfTheGame`'s return (`boxscore.js:661-702`) carries `desc`,
`inning`, `half`, `batterId/Name/TeamAbbr/TeamId/Pos`, scores, `runners[]`,
`fielders[]` — **no `playId`**. Need to determine, via a live check against
a real gamePk (`docs/test-games.md`), whether:

(a) the `/winProbability` entries `computePlayOfTheGame` already reads from
    carry their own play-identifying field usable to look up a terminal
    `playId` (check the raw shape it's already iterating — if there's an
    `about.playId` or similar, this is nearly free), or

(b) it needs a cross-reference back into `feed.liveData.plays.allPlays` by
    `(inning, half, batterId)` — already unique enough per half-inning in
    the overwhelming majority of cases, but confirm there's no ambiguity
    (e.g. the same batter reaching base twice in one half via a very long
    inning) before trusting a match on those three fields alone; fall back
    to also matching `outsBefore` or event index if a collision is found.

Do this as a small research pass first — confirms the join approach (a) vs
(b) before writing the rest of this issue's code, same as the original
video-highlights feature's own `playId` join was verified live before being
relied on (`.scratch/video-highlights/issues/01-highlights-bottom-sheet.md`
§2).

Add the resolved `playId` (nullable) onto `computePlayOfTheGame`'s return
object.

## 2. Look up the clip

In `BoxScore.jsx`, where `potg` is computed inside the existing `SealBox`
reveal render (~line 137): if `potg.playId` is non-null, look it up in the
same `highlightsMap` (`highlightsByPlayId(items)`) already built for
`PlayByPlay` — reuse the existing prop/state, don't fetch or build a second
map. If `GameView`/wherever `highlightsMap` currently lives doesn't already
thread it down to `BoxScore.jsx`, thread it the same way it reaches
`PlayByPlay` today.

Apply the same eligibility rule from issue 01
(`isEligibleForPositiveFilter`) before offering the Watch button — an
`abs`/`challenge`-tagged clip shouldn't get a Watch affordance on the box
score's headline card even though the per-play button in `PlayByPlay` has no
such filter today (that button shows ANY clip for a revealed play,
regardless of sign — this card is specifically claiming "the best play,"
so an excluded-sign clip shouldn't anchor it).

**Decided 2026-08-06: also require a significance tag.** Even though the
play itself is already picked by WPA (not by clip metadata), the Watch
button only appears if the matched clip's `classifyHighlight(...).significance`
is non-null (`player-of-the-game` / `star-of-the-game` / `featured` / etc.,
per issue 01's `SIGNIFICANCE_TAGS`) — closer to the PRD's original framing.
A WPA-picked play with a real but MLB-untagged clip gets no button; that's
accepted, not a bug. So the full gate is: `playId` match → not
`abs`/`challenge` → has a significance tag. This is a narrower filter than
what issues 03/04 apply (those don't require significance, but do require
`teamId`/`playerId` match, which this card doesn't need since it isn't
team-scoped).

## 3. Render — poster + Watch, no new spoiler surface

`PlayOfTheGame` (`BoxScore.jsx` ~line 1101-1150) already renders entirely
inside the box score's single top-level `SealBox` (line 130) — a clip's
poster/title/Watch button here is already behind the seal by construction,
same reasoning as the existing per-play button. Unlike the per-play button
(deliberately plain-text, no poster — see `PlayByPlay.jsx`'s comment at
lines 570-576), **this one does get a real thumbnail** per the PRD's
decision — use whatever poster frame the `content` item exposes (check
`item.image`/`item.thumbnail` shape live; `highlights.js` doesn't currently
extract one, may need a small addition alongside `highlightPlaybacks`).

Tapping opens the same reused `HighlightSheet.jsx` component `PlayByPlay`
already uses — one sheet instance, not a second implementation.

If no eligible clip is found for the picked play (no `playId` match, no
clip, or excluded by §2's filter), render the card exactly as it does
today — no empty state needed, this is purely additive.

## Spoiler audit checklist

- [ ] Poster image and Watch button only ever render inside the existing
      `SealBox` reveal path — confirm no early computation (e.g. an eager
      `useMemo` above the seal) touches `highlightsMap` lookup results
      before reveal, per ADR-0001.
- [ ] Verify via Playwright: 0 poster/Watch nodes for `PlayOfTheGame` before
      reveal, exactly the expected 0-or-1 after reveal depending on whether
      the picked play has an eligible clip.
- [ ] Confirm the poster frame itself doesn't reveal MORE than the card's
      existing text already does (the card already shows the play's
      description, score, and players — a poster of that same play adds no
      new information, per the PRD's reasoning; but double check the poster
      isn't, say, a crowd-reaction shot that reveals the *next* play or a
      teammate celebration implying an outcome not yet in the card's text).

## Where this touches

- `src/api/boxscore.js` — `computePlayOfTheGame`, add resolved `playId`.
- `src/api/highlights.js` — possibly extract a poster/thumbnail URL
  alongside `highlightPlaybacks`, if not already present.
- `src/screens/BoxScore.jsx` — thread `highlightsMap` to where `potg` is
  computed/rendered if not already in scope; `PlayOfTheGame` component gets
  the poster + Watch button + `HighlightSheet` wiring.
- `src/index.css` / relevant partial — `.bs__potg*` gets new poster/button
  styling, consistent weight with the rail thumbnails in issues 03/04.

## Verification plan

1. Live check (§1) confirming the `playId` join approach, documented here
   once verified (mirror the table format
   `.scratch/video-highlights/issues/01-highlights-bottom-sheet.md` §2 used).
2. Find a real recent game where the WPA-picked play also has a
   `player-of-the-game`/`featured` clip; confirm the poster + Watch button
   render and play the correct clip.
3. Find a real recent game where the WPA-picked play has NO matching clip;
   confirm the card renders exactly as it does today (no broken image, no
   dead button).
4. Confirm a game whose picked play's only matching clip is
   `abs`/`challenge`-tagged renders no Watch affordance (may need to
   construct this case manually / mock if not found live within the
   sampling window).
5. Confirm a game whose picked play has a matching clip with NO significance
   tag renders no Watch affordance either — the button requires all three
   conditions (playId match, not abs/challenge, has a significance tag).
5. `npm run lint` and `npm run build` pass clean; add/update the relevant
   `test/*.test.js` coverage for `computePlayOfTheGame`'s new `playId` field.

## Comments
