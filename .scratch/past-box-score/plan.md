# Plan: a past game's box score opens by its date

**Status (2026-10-19):** built and verified, and applied to PR #2317 as two commits (box score,
then retiring ADR-0110). Still to do: check the routes in `verify.md` in Chromium, and update
`e2e/invariants/box-score-unlock.spec.js` with a past-game case (e2e only when Gary asks).

## Rule in one line

Schedule date before the slate's today = box score open, no tap, no stored bit. Any status.
Retire ADR-0110 on the player-page Game Log. Everything else is unchanged.

## Decisions (Gary, 2026-10-19)

1. **Past slate cards:** no change. A card never shows a score. Its "Box score ›" button
   now opens a visible score.
2. **ADR-0110:** remove. The player-page Game Log shows score and decision for a game in
   progress today.
3. **Suspended games:** open like any past game. The rule reads the date only.

## Steps

1. **Verify the current state** (read-only, in the container).
   - Done: `GameCard.jsx` shows no score; past Finals and suspended games get a Box score button.
   - Confirm `toApiDate(new Date())` is what the slate uses for "today".
   - Pick gamePks from `docs/test-games.md`: one Final past game, one suspended or
     non-Final past game if listed, today's game if one exists.
2. **Write the failing tests first** (test discipline in `CLAUDE.md`).
   - `test/box-score-opens-by-date.test.js`, for `boxScoreOpensByDate(officialDate, now)`:
     yesterday opens (the status does not matter, a suspended game opens too); today stays
     sealed; tomorrow stays sealed; missing, empty or malformed
     `officialDate` stays sealed; the boundary at 23:59 and 00:00 local time.
   - Watch them fail, then write the function.
3. **Add the predicate.** `boxScoreOpensByDate` as a pure function beside the other date
   helpers in `src/lib/dates.js`. It takes the feed's `officialDate`
   (`feed.gameData.datetime.officialDate`) and an optional `now`, and returns true only for a real
   date before the slate's today.
4. **Wire the box score.** In `src/screens/BoxScore.jsx`: compute `openByDate` outside
   the seal (it is a structural status, not a score) and change the two `SealBox` props:
   `forceRevealed={stamped || boxOpened || openByDate}` and
   `onReveal={stamped || openByDate ? undefined : markBoxOpened}`. Update the comment
   block above the `SealBox` (it says "two openers").
5. **Update the e2e invariant.** `e2e/invariants/box-score-unlock.spec.js`: a past
   game opens with no tap and writes no `bbsbh:boxreveal:*` key; today's game stays
   sealed and still writes the bit on a tap; the innings viewer of the past game still
   seals. Run e2e only because Gary asked for this work; `docs/testing.md` says e2e is
   by request, so ask first.
6. **Docs.**
   - ADR-0101: amend section 1 (box score row) and add a pointer to ADR-0117.
   - ADR-0049: addendum, "a third render-only opener, by date; still only a tap writes".
   - ADR-0035: a one-line note that the stamp is reachable with no tap on a past date.
   - `scripts/check-stamp-surfaces.mjs`: reword the header comment ("already finished
     revealing"). Do not change the allowlists.
   - `CLAUDE.md` (root) spoiler-rule paragraph and `src/CLAUDE.md` "UI-side spoiler
     enforcement": one line each. Root file stays under 200 lines.
   - `CONTEXT.md`: add the term for the new opener beside "Effective reveal".
7. **Retire ADR-0110 on the player page.** Write the failing test first: a game in progress
   today shows its score and decision on the pitcher Game Log. Change the player-page caller
   (`src/screens/player/next/modules/pitchlog/pitchlogView.js`, `gameDetail.js`,
   `StartDetail.jsx`, `index.jsx`) so it asks for today's score. `fetchFinalScores` is called
   only by player-page modules (pitchlog, batlog, photos). Lineup-page Box Lines use
   `fetchBoxLines` with the scored game's date as cutoff, so they are not affected. Gary confirmed (2026-10-19): the
   hitter log and photos open too. It is one default in the shared function. Update `test/player-next-pitchlog.test.js`, `docs/player-hub.md`,
   `src/api/spoiler-manifest.json` if it names 0110, and mark ADR-0110 retired.
8. **Verify.** `npm run lint`, `npm test`, `npm run build`. Then render `?nointro` routes
   in Chromium: a past Final game's `boxscore` section (open), today's game (sealed), the
   same past game's `top1` (sealed). Send Gary screenshots with the routes and gamePks.
9. **PR.** Draft PR from `claude/stoic-volta-n9euwn`. One stack, no Vercel deploy.

## Risks

- **Retiring 0110 must not touch the lineup page.** It uses `fetchBoxLines`, not
  `fetchFinalScores`. Add a test that Box Lines on the lineup page still end the day before
  the scored game.
- **Scope of the change.** Changing the default in `fetchFinalScores` also opens the hitter
  log and photos modules. Gary confirmed this on 2026-10-19.
- **Tap-through spoiler is accepted.** Tonight's starter's Game Log shows tonight's result.
  Gary chose this on 2026-10-19.
- **A resumed suspended game is open while live.** Accepted by the date-only rule.
- **A wrong date check opens today's box score.** The fail-closed unit cases and the
  e2e "today stays sealed" case guard this.
- **`onReveal` fires under a flag.** If it is not withheld, a past box score writes the
  permanent bit. The e2e "writes no key" case guards this.
- **The innings viewer must not read the new flag.** Keep `openByDate` local to the box
  score. Do not put it in `effectiveReveal`.
- **Stamp surface guard.** `check-stamp-surfaces` must pass unchanged apart from its
  comment.

## Out of scope

Slate cards, lineup page, Box Lines, the scorecard, the innings viewer, and stats pages.
