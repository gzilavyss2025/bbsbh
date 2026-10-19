# A past game's box score opens by its date

**Status:** Proposed (draft for Gary's review)
**Date:** 2026-10-19
**Issue:** none; Gary's interview of 2026-10-19
**Amends:** ADR-0101 (section 1 and Alternative B), ADR-0049 (the openers), ADR-0035 (a note on the entry point)
**Relies on:** ADR-0002 (the `SealBox` render function), ADR-0034 ("The cutoff is opt-in now"), ADR-0116

## Context

The spoiler rule protects a game while a reader scores it. Gary's position today, from
an interview on 2026-10-19:

- The seal protects games on the current slate day. A reader who clicks around the site
  has no expectation that results are hidden.
- A reader who opens an older game still wants the at-bat-by-at-bat reveal. Gary likes
  it ("like a video game"). The box score is different. A reader who looks up a finished
  game should not have to tap to see its box score.

ADR-0101 chose the opposite for the box score: "an old game seals like a new one".
Alternative B of that ADR ("open by age") was rejected for the box score. A box score
of an old game needs a tap, and ADR-0049 remembers the tap.

## Decision

**A box score opens with no tap when its game is Final and its schedule date is before
the reader's current slate date. On the schedule date itself, and for a game that is
not Final, the seal stays and works as before.**

### 1. What changes

| Surface | Before | After |
| --- | --- | --- |
| Box score, game is Final, schedule date before today | Sealed, one remembered tap | Open |
| Box score, today's game, or any game not Final | Sealed, one remembered tap | No change |
| Half-inning pages (innings viewer) | Sealed, at-bat stepping | No change, for every date |
| Scorecard, lineup page, Box Lines | As ADR-0047, ADR-0010, ADR-0069 | No change |
| Slate card of a past date | Sealed score, tap to reveal | No change |
| Stats, standings, leader boards, player and team pages | Open | No change |

The day boundary is the slate date. A game is "past" when its `officialDate`
(`gameData.datetime.officialDate`) is earlier than `toApiDate(new Date())`, the same
value that `GameSelect` calls today. The day changes when the slate's day changes.

### 2. How it is built

The box score gains one more render-only opener. `BoxScore.jsx` already passes
`forceRevealed={stamped || boxOpened}` to its `SealBox`. The new flag joins it:

```js
forceRevealed={stamped || boxOpened || openByDate}
onReveal={stamped || openByDate ? undefined : markBoxOpened}
```

- `openByDate` comes from one pure function, `boxScoreOpensByDate(feed, now)`. It returns
  `true` only when the feed is Final and `officialDate` is a real date before today.
  A missing date, an unreadable date, or a feed that is not Final returns `false`. The
  seal fails closed, as in ADR-0049.
- **It persists nothing.** The `onReveal` line is the load-bearing line, as in ADR-0049:
  `SealBox` fires `onReveal` when the box becomes shown by a flag as well as by a tap.
  A bit written for a seal that nobody touched would stay open after the date
  logic changes. A reader who opens a past box score has not chosen to open it, so
  `bbsbh:boxreveal:{gamePk}` stays unwritten.
- **The render function still gates the data.** `SealBox` calls its children only in
  the revealed branch (ADR-0001, ADR-0002). The flag chooses which branch renders. It
  does not change what the render function computes.
- **Nothing reaches `revealedThrough`.** The innings viewer, the scorecard and the
  "pick up your pencil" strip read that mark. They stay as they are (ADR-0049's first
  rule).

### 3. The Game Log stamp

`StampGameButton` renders inside the box score's reveal render function. It is now
reachable on a past date with no tap. This does not break ADR-0035. That ADR's second
amendment already replaced the mint-time reveal check with a rule about WHERE stamp art
may render. The art still renders in only one place, the box score's reveal render, and
that render shows the final score already. `check-stamp-surfaces.mjs` keeps its
allowlists. Only its header comment, which says a reader "finished revealing" a game,
needs new words.

### 4. The feat label

`FeatLabel` (ADR-0101) renders in the same reveal render. On a past date it shows with
the box score. A reader who reaches a game from the feat shelf has seen the feat in the
open already (ADR-0101, section 3). Nothing new leaks.

## Why this does not break the spirit of the rule

The test from ADR-0026 and ADR-0049 is that a departure is consented, scoped, default-safe
and fails closed.

- **Scoped.** One date comparison, on one page. The innings viewer, the scorecard and
  the slate cards keep their seals.
- **Default-safe where it counts.** Today's games, the games a reader scores live, stay
  sealed. The default for a game on the current slate day is byte-identical to today.
- **Fails closed.** A feed with no date, an unparsable date or a non-Final status
  renders sealed.
- **Consent is not a tap here.** This is a change in the rule, not a consented
  override. Gary decided it. A reader who scores a past game blind can still skip the
  box score tab. The at-bat reveal does not read the box score.

## Alternatives considered

### A. Keep the tap, remember it better

ADR-0049 already remembers a tap on every device. Rejected. The tap is a prompt the
reader answers every time for each older game, and the answer is nearly always yes.

### B. Open every Final game, any date

Final means open. Rejected. Tonight's finished game is the one a reader may not have
scored yet. The seal protects that reader, and a Final status says nothing about
whether the reader has watched.

### C. A later rollover, such as 6 AM

A game that ends after midnight would not open early. Rejected. Gary chose the slate's
date roll-over: it is simple and agrees with the date the reader sees on the slate.

### D. Persist the open state as a bit

Writing `bbsbh:boxreveal:{gamePk}` when a past box score opens. Rejected. It would
record a reveal the reader never made, and the bit would outlive the date rule.

## Consequences

- `ADR-0101` section 1 changes for the box score: "Sealed" becomes "Open on a past date".
  Its Alternative B stays rejected for every other surface. A classic game (the planned
  "score a classic game", #1525) now shows its final score on the box score tab. The
  innings viewer stays sealed, so a reader who scores it can avoid that tab.
- A device with the wrong clock moves the boundary. A clock set a day forward opens
  today's box score. This is accepted. The reader controls the device.
- The Scores Unlocked and reveal-all openers are gone (ADR-0116), so the box score has
  three render-only openers and one writer. The `onReveal` rule is the thing to keep: a
  fourth opener must ask whether it, too, must be excluded.
- ADR-0110 (the pitcher Game Log hides a game in progress today) is not changed by this
  ADR. See open question 2 in `.scratch/past-box-score/plan.md`.
