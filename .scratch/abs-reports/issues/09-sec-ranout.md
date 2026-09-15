The "Out of challenges" section on `/abs-challenges`. Depends on the export cut and on the page split.

**Design:** https://claude.ai/artifact/DdXwqNvni67o4MrJB3wkgY — artboard "Q3 - Out of challenges".

## What it is

- Two slabs: the size of the earliest band (9 clubs in MLB), and how often it happens at all (1 in 4 club-games, 1,140 of 4,508)
- A distribution chart of the inning a club's second loss came in, with the band's own bar in clay and the pooled extras bar hollow
- The band itself as rows: club, opponent, the half and inning, the date, and for each of the two failed challenges who asked, what was called, and how far off the edge it was

## Every name is a link

The shipped boards on this page already use `PlayerLink`, `ClubCell` and `UmpireLink`. This board names about fourteen players, nine clubs and nine games; none of them should be plain text. The game link needs a game route, which takes the club abbreviations — `FoulTrackerPage.jsx` has the batched `fetchGamesByPk` precedent.

> **SPOILER RULE.** Club, opponent, date, inning, the call and the miss distance only. **No score, no winner, no run total, nothing one can be read from.** `/abs-challenges` is classed `spoiler-free` and `check-spoiler-manifest` gates it.

## Acceptance

- Reads the `summary` it is given, so the level chip switches it to Triple-A, where the band is 13 clubs
- Diacritics preserved in every name. The feed carries them and so does the rest of the app
- Verified in a browser at 390px and 960px, local URL in the handoff
