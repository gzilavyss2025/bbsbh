# Heritage Pass

Heritage Pass is an optional ticket-style rendering of existing `game:final`
stamp facts. It supplements the revealed box score and the Game Log passport;
it does not mint a second collectible or replace the circular stamp.

## Boundaries

- `src/lib/heritage/pass.js`: documented adapter over `stampGameFacts`' return
  contract; known competition, level, postseason round, series game and date.
  Reuses `roundNameAt` and `SPORT_LABEL`. Accepts only Final games with both
  nonnegative integer run totals. No fetch, storage, or score derivation.
- `src/components/heritage/HeritagePass.jsx`: semantic text and existing
  `TeamLogo` fallbacks, with scalable SVG engraving and restrained paper grain.
  Full names and venue wrap; missing optional facts are omitted.
  The approved design uses existing Big Shoulders Display and Bungee fonts,
  navy knockout marks, an engraved competition ribbon and a divided ticket stub.
  Source-provided `locationName` and `teamName` separate the city from the nickname;
  older facts without those fields retain the full name. Uneven ink transfer,
  small edge breaks and paper grain use the existing deterministic `stampSeed`,
  so a game's impression remains stable across renders. The navy-band header uses the same local MLB/MiLB knockout
  art as the passport cover. Small secondary team marks use the existing CDN
  primary/cap/wordmark variants, sanitized and converted with `monoLogoSvg`.
  Shape fingerprints exclude the primary mark; unavailable or historically
  unsafe variants use an engraved baseball ornament. Requests and conversions
  are shared by team identity across the collection. No new logo catalog or
  team-specific exceptions are introduced.
- `HeritagePassPages.jsx`: four passes per display page, one column on a phone
  and as many 250px columns as fit on larger screens. Reads the same book stamp
  list and facts as `PassportBook`; never alters its placements or pagination.
- Facts producers preserve absent sport/type as null rather than asserting MLB
  regular season. The circular stamp already treats unknown sport as its default
  ring and absent type as no postseason label. Schedule facts also carry optional
  `seriesDescription` and `seriesGameNumber`. `gameNumber` retains its existing
  doubleheader meaning. The live feed does not provide a series game number;
  that field is omitted on the box score instead of adding a second request.

## Records, game number and city (Gary, 2026-10-29)

- Under each header mark: the club's record after this game. A regular-season
  pass reads it from its own facts (`record` per side, the feed's leagueRecord,
  this game included; all three producers keep it). In the postseason the feeds
  report only the SERIES record, so `useClubRecord` asks `src/api/heritage/records.js`
  for the club's year of games (one ~50 KB request per club and season, shared)
  and `yearRecordThrough` adds every postseason game through this one to the final
  regular-season record. 2022 World Series Game 1 reads Phillies 97-77, Astros
  113-57. Older facts without `record` take the same request.
- The ribbon numbers a regular-season game by the reader's favorite club's season
  game when that club played, else the home club's (`seasonGame`). Postseason
  passes keep the series game.
- The city line is `passCity`: the franchise name ("New York", not the feed's
  "Flushing"), else the full name minus the nickname, else `locationName`.
- Header marks are larger. A badge mark whose first shape is a dark disc (the
  Brewers' roundel) knocks that disc out (`badgeFieldPins`), so its art reads on
  the navy band; of all 30 MLB clubs' header picks, only the Brewers' changes.

## Stadium artwork

The component accepts an optional `artwork={{ src, alt }}`; it never resolves a
venue itself. Callers (the box score and `HeritagePassPages`) pass
`heritageArt(game.venue)` from `src/lib/heritage/art.js`, which maps a `parkKey`
to `public/heritage-art/{parkKey}.webp`. Eighteen parks have art (Gary, 2026-10-29;
redrawn and extended 2026-10-30): American Family Field, Chase Field, Citi Field,
Comerica Park, Coors Field, Daikin Park, Dodger Stadium, Fenway Park, Globe Life
Field, Nationals Park, Oracle Park, Sutter Health Park, Target Field, T-Mobile Park,
Tropicana Field, Truist Park, Wrigley Field, Yankee Stadium. Each is a navy engraving
exported from Gary's PNG at 900px wide, WebP quality 80, transparent outside the
drawing. Dodger Stadium, Fenway, Tropicana and Wrigley arrived on solid halftone
grounds; their skies were cut out by an edge flood fill (blur, fill from the frame,
close small gaps, feather), so a redraw should arrive transparent instead. The slot
is wider than most drawings, so `object-fit: contain` preserves the complete
engraving, bottom-aligned above the stub. Taller drawings leave side space inside
the frame's inner rule rather than cropping roofs, signs, or foregrounds. Every game at those parks gets its art, whatever the year; `FORMER`
maps Miller Park (before 2021) to American Family Field. The drawings keep their
sponsor and club marks by Gary's choice (2026-10-29). Any other park, and a file that fails to load, leaves the engraved venue
name. Add a park by adding its webp and one line to `ART`, then check its crop on `/heritage-pass-preview`.

## Where it renders

The box score mounts the pass after its existing statistical section, inside
`BoxScoreBody`, which is mounted only by `SealBox`'s reveal render function.
The component's own Final check is additional protection, not the reveal gate.
Date-opened and stamped-game behavior remain the host's existing rules.

The Game Log's **Circular stamps / Heritage Passes** control defaults to stamps.
It changes this visit's display only. The original book, placement flow, tray,
season collection, and local/cloud storage contract remain available. Placement
or stamp options temporarily show the circular book. Unresolved pass facts keep
their date and an unavailable-details message.

`scripts/check-stamp-surfaces.mjs` enforces import allowlists for both pass
components and forbids them on the same no-art surfaces as circular stamps.

## Development preview and real records

Run `npm run dev` and open `/heritage-pass-preview?nointro`.
`App.jsx` gates its import with `import.meta.env.DEV`; the fixed records do not
ship in the production bundle. The preview shows regular season, postseason,
MiLB, artwork-free and metadata-omitted cases, a failed-artwork toggle, a sealed
souvenir, and the paginated collection.

`src/screens/heritage/fixtures.json` contains snapshots from the MLB schedule
API, checked on 2026-10-29. Each record includes its source URL and check date:

| gamePk | Date | Game | Final |
| --- | --- | --- | --- |
| 823035 | 2026-07-07 | Milwaukee at St. Louis | 10–2 |
| 715724 | 2022-10-28 | Philadelphia at Houston, World Series Game 1 | 6–5 |
| 815625 | 2026-04-08 | St. Paul at Toledo, Triple-A | 4–3 |
| 823762 | 2026-07-20 | New York Mets at Milwaukee (stadium artwork) | 3–8 |

To reproduce, fetch `/api/v1/schedule?gamePks=823035,715724,815625,823762&hydrate=linescore,team,venue`
on `https://statsapi.mlb.com`, then run each schedule row through
`stampGameFacts`. The metadata-omitted case removes optional fields from 823035;
it invents no replacement values. Layout stress checks may alter displayed text
in the browser only; those values are not game records or saved fixtures.

## Verification

`test/heritage-pass.test.js` covers final-only eligibility, missing/invalid runs,
zero and unusual scores, unknown metadata, MLB/MiLB round vocabulary, series
number separation, date validation and non-mutating pagination. Run the existing
stamp/passport suites too. Browser checks cover 320/390/820/1180/1440px widths,
artwork failures, long names, the real box score reveal gate, and switching modes
without changing saved placements.
