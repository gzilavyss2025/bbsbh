# Wire replies — spec (agreed with Gary, 2026-11-03)

A roster move that exists because of an earlier one "replies" to it on the
transactions list, the way iMessage shows a reply. Mock-up (option A, chosen):
https://claude.ai/artifact/XvXm42nZxXK9W8o5nhh4P7

## Layout (option A)

- The reply stays on its own day, in date order.
- Above it: a faded quote of the move it answers (two lines at most), joined by
  a thin curved line. Tapping the quote scrolls to the original when it is on
  the page.
- A reply that answers more than one move quotes them all ("Replying to 2 moves").

## Which moves reply (cause and effect only)

1. **Traded, then re-placed on the injured list** by the new club (JoJo Romero,
   Aug. 3, 2026). The note already names the trade (PR #2789).
2. **Designated, then its outcome**: the trade, release, outright or claim that
   resolves it.
3. **Claimed, then optioned.**
4. **A spot opens, then the move that fills it**, by the active-roster count:
   - The roster must be back at its target: 26; 28 from Sept. 1. A doubleheader
     or special event ALLOWS one more (27th man), it does not require one.
   - Opening a spot: injured list (7-, 10-, 15-day), paternity, bereavement,
     restricted list, "roster status changed" (an unnamed list; 54 of 99 in
     2026 came back within 30 days, median 2), option, designation, release,
     trade away.
   - Filling one: recall, selected contract, any "activated" (from a list, or
     with no list: a return or a new arrival), a trade arrival when the club is
     short.
   - A transfer to the 60-day list changes nothing on the 26 (it frees a 40-man
     spot).
   - The fill may be filed **one day either way** of the opening.
   - No role matching (pitcher for pitcher). It is about the count.
   - Skip the reply when the count does not balance, or when the club-day holds
     a row the rule cannot read. A missing reply looks like today; a wrong one
     says something false.
   - Ignore everything after the regular season (October list-clearing).
   - Before Opening Day, moves set the roster; they reply to nothing.

## The 27th man (built, uncommitted on claude/local-dev-server-a09a9a)

- A call-up on the club's doubleheader day, or on a special-event day, that
  goes back down by the next day. The feed never says "27th man".
- A special event is a named game at a NEUTRAL park (Field of Dreams,
  Williamsport, Mexico City, Las Vegas in 2026). Home openers, heritage days and
  makeups carry a name too, at home; they are not events.
- Special-event extra men must be position players (MLB rule; Bo Naylor, C, at
  the 2026 Little League Classic).
- Its note says so; its reply quotes the GAME ("Replying to Brewers at Royals ·
  Games 1 and 2 · April 4") and links to that game's lineup page. Teams and
  date only, never a score.

## Stress test (2026 regular season replay)

Each club's count, rebuilt from its moves, lands on target on **95.9%** of
4,798 game days with the rules above (same-day only). The misses, by hand:
fills filed a day off (covered by the one-day window), trade-deadline arrivals
with no "activated" row (covered by "trade arrival fills when short"), and a
designation of a player not on the active roster (40-man only). Scripts:
`stress*.mjs` in the session's temp folder, not kept.

## Roster rules, verified

- 26 active through Aug. 31, 13 pitchers max; 28 from Sept. 1, 14 max
  (mlb.com/glossary/transactions/26-man-roster).
- Doubleheader 27th man, that day only, not counted toward the pitcher limit
  (mlb.com/glossary/transactions/27th-man).
- Special events: the Commissioner may add a player for games in a non-MLB city
  or with unusual travel; position player only (baseball-reference "27th Man
  Rule"; 2025 Speedway Classic, Rickwood Field reporting).
- The roster endpoint's daily counts are NOT reliable (Astros: 24 and 25 in
  April, 27 on Sept. 1). Rebuild the count from moves.
