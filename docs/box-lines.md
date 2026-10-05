# Box Lines — the doors, the measurements, and the history

Reference moved out of `src/components/CLAUDE.md`. The rules stay in
`src/api/boxlines/CLAUDE.md` (the registry) and `src/components/boxlines/CLAUDE.md` (the
sheet). Issue numbers below are the slices that built each part.

## The name

"Box Lines" is the internal name. Alternatives weighed: Stubs (reads as a code stub in a
prompt) and Receipts (already My Tally's sync receipt). It never renders; on the page the
door says `See all ›` and the sheet's head note says `Game lines · {facet}`, which is the
vocabulary the sheet's own hints already use ("Pulling his game lines…").

## The sheet

- `BoxLinesDoor` is a full button reset because the user agent's `padding: 1px 6px` used
  to start the line's ink 6px right of the rows above it.
- Since #997 the shell is handed its facet (`sheet.facet`, `api/boxlines/facets.js`) plus an
  optional `note` and `title`, both defaulting to the club case, so a caller that names
  only an opponent needs nothing new.
- It opens from two doors: the lineup page's "Career vs MIL" line (a pitcher against the
  club he faces) and the player page's Splits vs team card.
- A list sheet (#1048) opens on the groups: the nine spots in the batting order (#1048)
  and a career's 36 ballparks (#998). Tap a group and the sheet shows twelve figures
  folded from the same rows (`foldStats`): a hitter's counts then his slash line, a
  pitcher's counts then ERA/WHIP/K9. It costs no requests, because every group reads the
  rows the listing pass already fetched.

## The doors that are lit

Twenty-odd doors: Home, Road, On grass, On turf, Day, Night, the eight months (#999), the
seven weekdays (#1001), Postseason, a hitter's Pinch hitting (#1002) and his Started /
Substitution (#1003), and for a pitcher only Started and In relief. Two list doors are lit:
`By spot in the order` (hitters only, #1048) and `By ballpark` (both groups, #998). The
second cost a descriptor and a name, which is the evidence the shape is general.

- The month and weekday doors cost nothing and, unlike Home/Road, their figures match the
  rows exactly: a date is the one field the game log and the schedule cannot disagree
  about. October means every October game, and a Sunday in the World Series is a Sunday.
- No November door exists: sitCode `11` returns nothing.
- Pinch hitting reads the hitting game log's own `positionsPlayed` (`['PH', 'LF']` entered
  as a pinch hitter and stayed in), so it needs no boxscore, no cap and no paging, whatever
  #1002 specifies.
- The Postseason door (#1006) is the one that is not free. Its rows wear a round pill
  (WC/DS/LCS/WS).
- On grass / On turf ride on `hydrate=venue(fieldInfo)`, which adds 7% to the shared
  schedule call. Chase Field is grass through 2018 and turf from 2019.
- Started / Substitution are the only doors with a request of their own. Folding the
  lineups into the shared call would cost 65%, where two doors of twenty-five want them.

## Measurements

- The card folds the eight months and the seven weekdays behind one row each, so it opens
  at ten lines rather than twenty-five.
- A park list names a group from its newest row because nine of a career's 36 parks carry
  more than one name inside it.
- Both lists count October: a park does not stop being Dodger Stadium because the game was
  a division series. Betts at Globe Life Field is 9 games without October and 25 with it.
