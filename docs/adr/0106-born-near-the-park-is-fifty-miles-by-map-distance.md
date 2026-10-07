# "Born near the park" is 50 miles by map distance

**Status:** Accepted
**Date:** 2026-10-07
**Issue:** #1598 (source: #1585; builds on ADR-0100)

## Context

The game preview's "Born near the park" line (#1585) matched a player's birth city to
the park's city, exactly. Many parks found few players or none:

- **A park in a suburb.** Globe Life Field is in Arlington, Texas. Dallas and Fort Worth
  did not count.
- **A park in a named district.** The feed puts Citi Field in "Flushing" and Yankee
  Stadium in "Bronx". Retrosheet files most New York City births under "New York" or
  "Brooklyn".
- **Two spellings.** "St. Louis" and "Saint Louis", "Montréal" and "Montreal".
- **Nationals Park found no one.** The feed says "District of Columbia". Retrosheet says
  "D.C.". 111 players born in Washington did not show.

Facts checked on 2026-10-07:

- The game feed's `venue.location` has `defaultCoordinates` (`latitude`, `longitude`)
  and a `postalCode` (gamePk 823570, Citi Field). All MLB parks and all 32 AAA venues
  have numeric coordinates. Placeholder venues ("TBD", "AL Stadium") have none.
- Retrosheet's `biofile0.csv` has a birth city, state and country. It has no zip code
  and no coordinates.

## Decision

1. **"Near" is map distance: a birth city within 50 miles of the park, in a straight
   line.** Gary chose map distance over a zip-code or metro-area match, and over a
   hand-made list of cities for each park (2026-10-07). Gary chose 50 miles over 25 and
   10. The line keeps its label, and the name rule stays the same (four names, newest
   birth year first, ADR-0100).
2. **GeoNames gives each birth city a map point, at build time.** `gen-bio-history.mjs`
   reads `cities500.txt`, `admin1CodesASCII.txt` and `countryInfo.txt` from
   `https://download.geonames.org/export/dump/`. The pure half is
   `scripts/lib/open-data/gazetteer.mjs`. A US birth matches on city and state, and any
   other birth on city and country. Names compare without accents, case or punctuation,
   with "St.", "Ste.", "Ft." and "Mt." spelled out. When two places have the same name,
   the place with the larger population wins, and a place's own name wins over an
   alternate name. Two small alias tables cover the names GeoNames does not use
   ("D.C.", "England", "West Germany", and others).
3. **GeoNames is CC BY 4.0, so it gets a credit line.** `GEONAMES_CREDIT` is in
   `scripts/lib/open-data/credits.mjs`. Each birthplace file and the About page print it.
4. **A birthplace file is one map cell, 2 degrees by 2 degrees.** Its name is its
   south-west corner (`40_-74.json`). Inside, players group by their city's map point,
   rounded to two decimals. The reader (`bornNear` in `src/api/history/birthplaces.js`)
   reads every cell that a 50-mile circle around the park touches (one to four files)
   and keeps the points within 50 miles. The park's point comes from
   `parkPoint(venue.location)` in `src/lib/history/pick.js`.
5. **The data stays history.** The line is an open surface with no SealBox (ADR-0034,
   ADR-0100). Nothing here reads a game or a score.

## Measured

The first run (2026-10-07) placed 20,403 of the 22,261 players who have a birth city,
which is 91.7%. `cities1000.txt` placed 89.7%. The 1,858 players not placed are mostly
born in a district of a city that GeoNames does not list as a city: Río Piedras (35) and
Santurce (31) in San Juan, Roxbury (15) in Boston. The generator prints the ten places
that missed the most players. There are 411 files. The largest is `40_-76.json`
(northern New Jersey and eastern Pennsylvania), at 56 KB.

Players within 50 miles: Arlington 249, Truist Park 235, Nationals Park 432, Citi Field
1,106, Rogers Centre 75, American Family Field 118.

## Consequences

- The city-name index (`{ab}.json`, `bornIn`, `birthplaceKey`) is gone. Nothing else
  read it.
- A player born in a place that GeoNames does not list is not on the line. If that
  matters later, a small alias table in `gazetteer.mjs` can map a district to its city.
- A park near another club's park shares many names with it (Citi Field and Yankee
  Stadium). That is true at 50 miles and was accepted.
- A placeholder venue, or a feed with no coordinates, shows no line.
