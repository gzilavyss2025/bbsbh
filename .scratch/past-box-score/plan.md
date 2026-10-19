# Plan: a past game's box score opens by its date

Draft. ADR: `docs/adr/0117-a-past-games-box-score-opens-by-its-date.md`.
Source: Gary's interview, 2026-10-19. No open PRs overlapped at the time of writing.

## Rule in one line

Final game + schedule date before the slate's today = box score open, no tap, no stored bit.
Everything else on the scoring surfaces is unchanged.

## Open questions for Gary (answer before step 3)

1. **Past slate cards.** You said past-date cards keep their own seal, independent of the
   box score. ADR-0116 (B1) made a past Final card the plain `GameCard` that opens the
   box score. I have not yet confirmed from `GameCard.jsx` how a past card shows its
   score today. Step 1 checks it. If the card has no seal now, say whether you want one added
   (new scope) or want the current behavior kept.
2. **ADR-0110.** The pitcher Game Log hides a game in progress today. You said browse
   pages are fully open. I read that as "stats, standings and past results", and kept 0110
   (it protects a game you may be scoring). Confirm, or tell me to remove 0110's exception.
3. **Not-Final past games.** A suspended game from a past date is not Final. The draft keeps
   its box score sealed. Confirm.

## Steps

1. **Verify the current state** (read-only, in the container).
   - Read `GameCard.jsx` and `GameSelect.jsx`: how a past-date card shows or seals its score.
   - Confirm `toApiDate(new Date())` is what the slate uses for "today".
   - Pick gamePks from `docs/test-games.md`: one Final past game, one suspended or
     non-Final past game if listed, today's game if one exists.
2. **Write the failing tests first** (test discipline in `CLAUDE.md`).
   - `test/box-score-opens-by-date.test.js`, for `boxScoreOpensByDate(feed, now)`:
     Final and yesterday opens; Final and today stays sealed; Final and tomorrow stays
     sealed; not Final and yesterday stays sealed; missing, empty or malformed
     `officialDate` stays sealed; the boundary at 23:59 and 00:00 local time.
   - Watch them fail, then write the function.
3. **Add the predicate.** `boxScoreOpensByDate` as a pure function beside the other date
   helpers in `src/lib/dates.js`. It takes the feed's `officialDate` and Final status
   (use `selectIsFinal`, which `BoxScore.jsx` already imports) and `now`.
4. **Wire the box score.** In `src/screens/BoxScore.jsx`: compute `openByDate` outside
   the seal (it is a structural status, not a score) and change the two `SealBox` props:
   `forceRevealed={stamped || boxOpened || openByDate}` and
   `onReveal={stamped || openByDate ? undefined : markBoxOpened}`. Update the comment
   block above the `SealBox` (it says "two openers").
5. **Update the e2e invariant.** `e2e/invariants/box-score-unlock.spec.js`: a past Final
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
7. **Verify.** `npm run lint`, `npm test`, `npm run build`. Then render `?nointro` routes
   in Chromium: a past Final game's `boxscore` section (open), today's game (sealed), the
   same past game's `top1` (sealed). Send Gary screenshots with the routes and gamePks.
8. **PR.** Draft PR from `claude/stoic-volta-n9euwn`. One stack, no Vercel deploy.

## Risks

- **A wrong date check opens today's box score.** The fail-closed unit cases and the
  e2e "today stays sealed" case guard this.
- **`onReveal` fires under a flag.** If it is not withheld, a past box score writes the
  permanent bit. The e2e "writes no key" case guards this.
- **The innings viewer must not read the new flag.** Keep `openByDate` local to the box
  score. Do not put it in `effectiveReveal`.
- **Stamp surface guard.** `check-stamp-surfaces` must pass unchanged apart from its
  comment.

## Out of scope

Slate cards, lineup page, Box Lines, the scorecard, the innings viewer, stats pages, and
ADR-0110 (see question 2).
