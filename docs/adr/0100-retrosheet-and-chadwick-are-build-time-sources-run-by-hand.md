# Retrosheet and Chadwick are build-time sources, run by hand

**Status:** Accepted
**Date:** 2026-10-06

## Context

Tally wants history that MLB's Stats API does not hold: family links between
players first, more datasets later. Two open sources hold it.

- **Retrosheet's biographical files.** `https://www.retrosheet.org/downloads/biodata.zip`
  is 1.4 MB. `biofile0.csv` has 27,049 people. `relatives.csv` has 1,329 rows.
- **The Chadwick Bureau register.** `people-{0-9,a-f}.csv` under
  `https://raw.githubusercontent.com/chadwickbureau/register/master/data/`. It has
  526,894 rows, about 4.2 MB per file. 135,208 rows carry an MLBAM id.

The spike (2026-10-06) measured the join. All 19,277 person ids in
`public/data/war-history/` match a register row, and each has a Retrosheet id.
89.2% of the ids in `manager-history/` match, and most of the rest are staff who
never played pro ball. A top prospect who never reached MLB matches on MLBAM id and
carries no Retrosheet, Baseball-Reference or FanGraphs id.

## Licences

- **Chadwick Bureau register:** Open Data Commons Attribution License 1.0. It needs
  a credit.
- **Retrosheet:** free use, commercial use included, if this statement appears
  prominently: "The information used here was obtained free of charge from and is
  copyrighted by Retrosheet. Interested parties may contact Retrosheet at 20 Sunset
  Rd., Newark, DE 19711." Do not reword it.

## Decision

1. **Build time only.** A hand-run generator reads the files and writes static JSON
   under `public/data/`. The app never fetches Retrosheet or the register. This
   data is history, so a surface shows it open (ADR-0034).
2. **Hand-run, on no cron.** A source changes a few times a year. The generator
   catalog says what runs each one (`docs/scripts/generators.md`). The output has no
   `generatedAt`, so a re-run with the same input writes the same bytes, and the
   file carries an `EXCEPT` entry in `check-data-freshness.mjs`.
3. **Downloads go outside the repo.** A downloaded file is untrusted data.
   `scripts/lib/open-data/download.mjs` saves one URL into a new, empty folder and
   refuses a folder inside the repo or a folder that holds a file. A generator takes
   the extracted paths as arguments and never downloads.
4. **The credits live in one file:** `scripts/lib/open-data/credits.mjs`. A
   generator copies them into the data it writes (a `credit` array), so a surface
   prints them beside the data. The About page prints both. A test pins the About
   text to the file.
5. **Ids bridge through the register.** `scripts/lib/open-data/retro-bridge.mjs`
   builds Retrosheet id to MLBAM id and back. A row with only one of the two ids
   does not bridge, and the bridge reports how many rows did not.
6. **A shard keys on the player's MLBAM id** with `shardKey100`
   (`src/lib/shardKey.js`), like every other per-player store.

## First dataset: family links

`scripts/gen-family-ties.mjs` writes `public/data/family-ties/{NN}.json`. The reader
is `src/api/person/family/family.js`, classified spoiler-free.

The direction of `relatives.csv` was checked, not assumed. A row reads "id1 is the
relation of id2". Every dated Father, Grandfather, Great Uncle and Father-in-Law row
has the older man as id1. One label is backwards: "Great Grandson" also has the
older man as id1, so the generator reads it as "Great Grandfather". A label the
generator does not know fails the run.

## Second dataset: on this day and birthplaces

`scripts/gen-bio-history.mjs` writes `public/data/on-this-day/{MM-DD}.json` and
`public/data/birthplaces/{ab}.json` from `biofile0.csv`. The readers are
`src/api/history/onThisDay.js` and `birthplaces.js`, both spoiler-free.

These shards key on the day and on the city, not on the MLBAM id (decision 6 is for
per-player stores). The key must be one the reader can compute from the page: a month
and day, or a venue city. A month's file was 415 KB, because debuts bunch in April and
September, so each day is a file (the largest is 21 KB). The first letter of the city
gave a 185 KB file, so the first two letters are the key (the largest is 93 KB).

**Superseded for birthplaces by ADR-0106 (2026-10-07).** The birthplace files now key
on a map cell, and "near the park" is 50 miles by map distance. GeoNames places each
birth city, under its own credit line.

Only players count (a row with `debut_p`), and no deaths are read. The `HOF` column
holds the word `HOF` on 325 rows and is empty on the rest. The generator does not use it.

## Consequences

- A new open source follows this shape: a hand-run generator, a pure half in
  `scripts/lib/open-data/`, a credit line in `credits.mjs`, an ADR line if the
  licence differs.
- The register is 16 files of 4 MB. Nobody commits it.
- A player with no MLBAM id has no shard, and his relatives show his name with no
  link.
