Status: resolved
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

### 2026-08-06 — implemented (branch `claude/box-score-potg-watch`)

#### §1 research pass: neither (a) nor (b) as written — it's (b) done EXACTLY

The `/winProbability` entries **do** carry their own full `playEvents[]`, each
pitch with a `playId` — which reads like the nearly-free option (a). It isn't
usable: `WIN_PROB_FIELDS` (`api/game.js`) deliberately prunes `playEvents` out
of that fetch because it is ~85% of the payload. Measured cost of putting it
back to recover one string per game:

| gamePk | pruned today | + `playEvents,isPitch,playId` | unpruned |
|---|---|---|---|
| 823035 | 51 KB | 87 KB (+70%) | 939 KB |
| 824891 | 44 KB | 76 KB (+73%) | 845 KB |

So the join goes to the feed instead — but **not** by the `(inning, half,
batterId)` match this issue proposed. A win-prob entry carries its own
`about.atBatIndex`, which is already in `WIN_PROB_FIELDS` (`selectWinProbPath`
reads it for the at-bat-stepping clamp), and that is an **exact** key into
`allPlays`. None of the anticipated collision risk exists, so no `outsBefore`
or event-index fallback was needed.

Verified live against the pinned test games, mirroring the format the original
video-highlights issue used:

| gamePk | win-prob entries | resolved to a play | terminal `playId` matched | clips w/ guid |
|---|---|---|---|---|
| 823035 | 78 | 78 | 78 | 14 |
| 777747 | 78 | 78 | 78 | 12 |
| 778501 | 98 | 98 | 98 | 20 |
| 778442 | 79 | 79 | 79 | 14 |
| 777877 | 67 | 67 | 67 | 8 |
| 824087 | 73 | 73 | 73 | 13 |
| 781572 (AAA) | 76 | 76 | 76 | 0 — no clips at all |
| **total** | **549** | **549** | **549** | |

Zero mismatches, zero misses. `playId` is nullable and resolves null on the
pruned past-game path (`PAST_GAME_FEED_FIELDS` lists neither `playEvents` nor
`playId`) — correct, since the slate flip-card's `.flipback__potg` shows the
description with no Watch affordance. That path was deliberately left
unpruned-for; adding those fields would inflate every final game on a revealed
slate for a button that doesn't exist there.

#### §2 gate: the significance requirement was measured, then dropped

The 2026-08-06 decision to also require a `SIGNIFICANCE_TAGS` hit was reversed
the same day, **by the maintainer, on measurement**. Over 44 games (the 6
pinned MLB test games + every Final 2026-08-02..04), applying the full decided
gate:

| outcome | games |
|---|---|
| Watch button shows | 14 (32%) |
| clip exists but **no significance tag** | **25 (57%)** |
| no clip on the picked play | 3 |
| excluded by `isEligibleForPositiveFilter` | 2 |

57% of games had a real, correctly-matched clip of the WPA-picked play and
would have shown no button. The card's "best play" claim comes from this app's
own WPA ranking (ADR-0013), not from MLB's tagging, so their tag was never a
precondition for it. **Shipped gate: `playId` match → passes
`isEligibleForPositiveFilter`.** The `abs`/`challenge` half of the issue's
reasoning is fully kept — that exclusion lives inside that same filter.

Re-measured with the shipped gate over 45 games: **39 show a button (87%)**, 4
have no clip on the picked play, 2 are excluded by the filter, and **all 39
have a usable 16:9 poster** (0 eligible-but-posterless).

Notable: neither exclusion was `abs`/`challenge` — both were items missing the
`highlight` tag entirely. No `abs`/`challenge` clip landed on a POTG play in
the whole sample, so verification case 4 is a unit test, not a live game (as
the issue anticipated it might have to be).

#### Verification plan results

1. ✅ Live join check — table above.
2. ✅ Game WITH an eligible clip: gamePk 823035 (`/07072026/milstl-2/boxscore`),
   Luis Lara's two-run single, tagged `career-first`, poster present. Poster +
   Watch render, the sheet opens, the clip is the right play. Pinned as an e2e
   fixture.
3. ✅ Game with NO matching clip: gamePk 781572 (AAA, no clips at all) plus
   822943 / 823270 / 824324. Card renders exactly as before — no broken image,
   no dead button.
4. ✅ `abs`/`challenge` clip rejected — unit test (not found live, see above).
5. ✅ Clip with no significance tag — now **accepted**, per the reversal above;
   pinned by a unit test that records why it reads like an omission.
6. ✅ `npm run lint`, `npm test` (1476 tests), `npm run build` all clean.
   New coverage: `test/potg-highlight.test.js` (9 tests) — the join, its four
   null-degradation paths, a `WIN_PROB_FIELDS` allowlist guard on the join key
   (same regression class as `winprob.test.js`), and the gate.

#### Spoiler audit checklist

- [x] Poster and button render only inside the box score's existing top-level
      `SealBox` reveal path. The lookup itself (`eligibleHighlightForPlay`) is
      called inside that reveal render function, beside `computePlayOfTheGame`
      — no eager `useMemo`, nothing hoisted to render top-level (ADR-0001). No
      new `SealBox` was added, and the host seal still has no `onReveal`
      (ADR-0035's constraint is untouched).
- [x] Playwright: `e2e/invariants/spoiler-dom.spec.js` asserts **0**
      `.bs__potgWatch`, **0** `.bs__potgPoster` and 0 `Watch highlight` buttons
      before the tap, then exactly **1** of each after, on a fixture game
      verified to have an eligible clip — so the post-reveal half can't pass
      vacuously. It also pins that the label stays generic and that the button
      opens the shared `HighlightSheet`.
- [x] The poster adds no information the card doesn't already print: it is a
      still of the same play whose description, score and players sit two lines
      above it, inside the same seal. Checked the actual frames on the sampled
      games — they are the play's own action shot (MLB's clip poster is a frame
      of that clip), not a crowd/celebration cutaway implying a later outcome.
      Worth re-checking if MLB ever changes how poster frames are chosen; the
      argument is specifically "same play, already spelled out" and does **not**
      generalize to a surface where the play isn't already in text.

#### Notes for whoever picks this up next

- The button's label is deliberately generic ("Watch"), never the clip's own
  title — MLB's titles narrate the outcome ("Luis Lara's first MLB hit is a
  two-run single"). Same discipline as `PlayByPlay`'s per-play button.
- A poster that fails to load falls back to the plain kraft pill rather than
  leaving a broken frame (`posterFailed` state), so the affordance never
  depends on the image resolving.
- Not folded in, as instructed: the per-play `AtBatCard` poster (a separate
  follow-up against the ORIGINAL video-highlights feature) is untouched.

## Comments

2026-08-18: Closed out during issue-tracker triage — this shipped (highlights-cascade PRs #586-589, #601: src/api/highlights.js, HighlightSheet.jsx, ModalPortal.jsx, HighlightClipCard.jsx, Team/PlayerHighlightsRail all present in src/). No GitHub issue needed.
