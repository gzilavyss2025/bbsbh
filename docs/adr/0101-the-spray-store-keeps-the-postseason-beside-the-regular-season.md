# The spray store keeps the postseason beside the regular season

**Status:** Accepted
**Date:** 2026-10-06
**Issue:** #1513 (one of the four files in #1445)

## Context

The player page's spray map showed a batter's regular-season balls in play only.
`gen-spray.mjs` asked the schedule for `gameType=R`, so a hitter's October balls
were missing.

Unlike the pitch stores, the committed shards ARE the store
(`public/data/spray/{season}/{NN}.json`). There is no dump to migrate.

Three things must not change:

- Every regular-season chart. With Regular selected, a reader must get what it
  got before.
- The `bat` map. A reader that knows only `bat` must see the same bytes.
- The ledger. `scripts/data/spray-ingested.json` keys on the gamePk, which is
  unique across game types, so a postseason game is swept once.

## Decision

1. **MLB reads its postseason.** The schedule request for sportId 1 asks for
   `R,F,D,L,W`. Triple-A asks for `R` only, because its postseason game types are
   not verified (ADR-0094). The `Final` check, the strictly-before-today check and
   the `officialDate` de-duplication do not change.
2. **A `post` map beside `bat`.** A bucket keeps `bat` as before and adds `post`,
   the same entry shape, for the postseason. A bucket with no postseason batter has
   no `post` key. The marker is the key, not a per-row column: a column would
   change every row, so every shard would rewrite and every old reader would have
   to filter.
3. **Never blended.** A home-run chart and a hard-hit rate read as season facts,
   so twelve October balls inside five hundred would be invisible. The card shows
   Regular, Postseason or All. All is the two entries added (`combineSprayEntries`),
   never a third stored row.
4. **Regular is the card.** The card floor (`MIN_SPRAY_BIP`) and the card's
   existence are decided on `bat`. Postseason and All take no floor: October is a
   handful of games, and a floor would hide the balls the reader came to see. A
   thin sample shows as grayed split chips with their own counts.
5. **No postseason, no control.** `sprayView` adds `scoped.P` and `scoped.A` only
   for a batter with at least one postseason ball in play.

## Consequences

- Measured 2026-10-06 after a hand backfill of the first 17 postseason games
  (`--since=2026-09-28 --sports=1`): 807 balls in play, 137 batters. The `bat` map
  of every bucket was identical to before, and `sprayView` for all 1,137 batters
  matched. The largest bucket went from 147,161 to 148,190 bytes. A second sweep
  swept 0 games.
- The 2026 postseason is about three times that size, so the largest bucket lands
  near 151 KB. The 160 KB ceiling in `test/bucket-shards.test.js` holds.
- Older postseason games are outside the nightly window. Backfill by hand with
  `--since=<date> --sports=1`. The 2026 run above covered 2026-09-28 to 2026-10-06.
- Open question for the owner: the same marker would let a pitcher-side spray card
  read October. Nothing reads the stored `pitcherId` today.
