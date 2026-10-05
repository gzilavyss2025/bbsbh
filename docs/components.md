# src/components — bucket detail

Reference moved out of `src/components/CLAUDE.md`. That file keeps each bucket's belongs-test.

## `charts/`

`BallFlight` is `HitChart`'s per-play sibling: the base diamond in the at-bat feed is its handle (hover on a pointer, tap on a phone), and it adds the PATH from the plate that a chart of thirty dots cannot draw. Same marks, same 95-mph ring, one stylesheet (`69-hit-chart.css`). `SprayMap` is the season-long third: the same projection and the same ink, but its data (`api/spray.js`) is spoiler-FREE, so it needs no gate — and it draws a GENERIC field, because a season is sixty parks and picking one would invent a distance (`73-spray-map.css`)

## `bracket/`

**October's home slate (ADR-0087, addendum 2026-10-01):** the transactions rail and dock step aside on the MLB slate in the window; `BracketRail` (wide, from `BRACKET_RAIL_QUERY`) and `BracketDock` (phone, game days only) draw `FullBracket` there instead, and `SurvivorsBoard` (logic: `lib/postseason/survivors.js`) replaces the Off Day grid. The postseason bracket above the home slate during the postseason window (#1224, slices 4, 5, 7): `PostseasonBracket` is the self-contained mount GameSelect.jsx renders (folded ticket view by default, `FullBracket`'s boxes-and-connector-lines "back page" behind "Open the bracket"). Every value comes from `src/api/postseason/bracket.js`'s derived shape and `src/lib/postseason/bracketDisplay.js`'s pure layout helpers — nothing here fetches a score outside that module's own cutoff-gated reads (ADR-0087)

## `postseason/`

Pure logic is in `lib/postseason/` (`dayShape`, `seriesFlow`, `seriesTotals`, `keysVerdict`); CSS in `styles/postseason/series-parts.css` (shared) and `series-live.css` (live page). `SeriesMark` is MLB's round art (`lib/postseason/seriesMarks.js`), white-on-navy, so it goes on a navy band or its own `plate`; it renders nothing for a season with no art, and the slate card, bracket and game masthead draw it too

## `gamehud/`

`ConsoleBand` is focus mode's whole top row (ADR-0043) — the placed scorebug plus exactly one companion: `DueUpConsole` while the half is being scored, or once it is over, `BetweenInnings` — one card that opens on `HalfTally`'s grid and cycles on tap through up to 5 score-free facts (`api/between-innings.js`) before returning to the grid

## `inning/`

`ReferencePanel` is the tabbed shelf (LINEUPS / FIELD / ARMS — which also holds the stat-line row — / EXTRAS, which carries the WPA chart above the umpire Tendencies drawer); `ExtrasFacts` is the card-header block at the foot of EXTRAS

## `player/`

`PlayerHoverCard` is the one PlayerLink triggers (desktop only, `lib/playerHoverStore.js`), mounted once in `App.jsx` and portalled to `<body>`

## `scoring/`

`StruckLine` is the crossed-out name at all four strike sites (the play-by-play card, the lineup card, the defense diamond, the scorecard footer) — one wrapper, so the pencil bar is drawn once and only for a substitution the reader was here for. It replaced four `text-decoration: line-through` rules that each had to name `.plink` a second time; a bar over the wrapper covers the link, which is what `check-strike-links.mjs` was written to catch. **`StrikeZone` is drawn from the camera behind the pitcher**, never the umpire's eye (ADR-0077): the feed's `pX` is measured from behind the plate, so `sx()` in `lib/zone/zoneGeometry.js` negates it and an `R` batter's box sits to the RIGHT of the plate. The mirror is a VIEW — bins on disk stay in the feed's frame and a card draws a stored cell through `viewCol` — and the same view governs `charts/CommandMap` and `charts/GloveTarget`, so all three pitch pictures agree about which side is which

## `sync/`

`OwnerGuards` is the odd one: it makes no request at all — on the sign-in transition it asks, per channel and against that channel's OWN owner key, whether this device's reveal marks, box-score bits and spoiled-day consent belong to the account now signing in, and clears each that does not. App-wide on purpose, because all three are render overrides read synchronously as a scoring surface paints; its header says why a per-screen guard would decide too late. Stamps and books guard themselves inside their own pulls instead, correctly — their adopt replaces a document, which needs the remote

## `teamstats/`

The two leader renderings share `computeLeaders` and the descriptors, not a box model: `TeamLeaders` is the headshot-card board the dedicated leader pages render, `TeamLeadersLedger` the two-block ruled ledger (two `Table`s with named columns, #1132) the team hub renders

## `umpire/`

the Tendencies card and its hosts — the modal, the lineup page's top zone (TeamInfo renders it beside the one fact grid, which the crew's `UmpiresCard` cells share), and focus mode's EXTRAS-tab drawer (`UmpireTendenciesFold`). The tier pill/glyph live in `badges/` — shared with Game Score rankings

## `workload/`

shared by six surfaces (the slate card, the lineup page's board, the player page's mound card, The Pen, the team hub's Roster tab, the innings viewer's ARMS tab). One palette, ticked to the app's own tired thresholds, so a shaded cell and a "likely down" tag can never tell different stories about one outing — every one of them reads a single `tiredFlagsFor` evaluation. `DayStrip` is a CSS grid rather than a flex row on purpose: the rest rail is placed by grid column, so it covers the cells AND the gaps at any width. Their ink is global (`styles/76-workload-marks.css`), not component-imported, because a slate card's dots cannot wait on a route chunk
