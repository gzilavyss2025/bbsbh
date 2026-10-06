# The pitch sweep keeps the postseason beside the regular season

**Status:** Accepted
**Date:** 2026-10-02
**Issue:** #1411 Part A (parent #1408)

## Context

The Matchup Scout (#1408) shows a pitcher's pitch mix and locations for the
regular season, the postseason, or both. `gen-pitch-arsenal.mjs` read
`gameType=R` only, so the store had no postseason pitches.

Three things must not change:

- Every existing card shows the regular season only.
- The committed dump has 46,490 lines of 2026 regular-season data. A new key
  must not need a re-walk of those games.
- `exportCommandMap` writes `byCode[code][stand] = hand`, and
  `exportPitchArsenal` adds every row of a pitch type. A postseason row in
  either place would overwrite or add onto a regular-season row.

## Decision

1. **MLB reads its postseason.** The schedule request for sportId 1 asks for
   `R,F,D,L,W`. Triple-A asks for `R` only, because its postseason game types
   are not verified. The `Final` check and the `officialDate` de-duplication
   do not change. The ledgers key on `game_pk`, so a postseason game is swept
   once.
2. **A `scope` column in the key.** `pitch_arsenal_totals` and
   `pitch_command_cells` get `scope TEXT NOT NULL DEFAULT 'R'`, with a CHECK
   for `'R'` or `'P'`. It is second in each key, after `season`. A game's
   scope comes from its `gameType`. Two values, not one per round: the page
   needs Regular, Postseason and All, and All is the sum of the two parts.
3. **Old rows load as regular season.** A dump line names its columns, so a
   line with no `scope` takes the default. No migration and no re-walk.
4. **Old readers read `'R'` only.** Both exports take a scope and default to
   `'R'`. The callout readers (`century-club.mjs`, `arsenal-side.mjs`) say
   `scope = 'R'`. The similarity pools and `all/` stay regular season only.
5. **The postseason is a new key beside `pit`.** Each `pitch-arsenal` and
   `pitch-command` bucket keeps `pit` as before and adds `post`, the same shape
   for the postseason. A reader that knows only `pit` never sees it. A pitcher
   who threw only in the postseason is in `post` only.

## Consequences

- With the first 9 postseason games of 2026 swept on a copy, the output of
  every existing reader was the same, byte for byte, as before (40 MB of reader
  output, every pitcher, both levels, every side and pitch type).
- The dump writes every column on every line, so the new column rewrites the
  whole `scripts/data/pitch-arsenal.sql` once (18.7 MB to about 19.2 MB, with
  no new rows). `test/season-store.test.js` compares a re-dump with the
  committed dump, so the PR that adds the column also commits the migrated
  dump, as #1200 did.
- A postseason arm adds about 0.7 KB to his `pitch-arsenal` bucket and about
  1.4 KB to his `pitch-command` bucket. `test/bucket-shards.test.js` now has a
  `pitch-command` ceiling.
- Phase 2 (#1411 Parts B to D) reads `post`. The hitter grid uses the same
  `scope` column.
- Older postseason games are outside the 3-day nightly window. Backfill them
  by hand with `--since=<date> --sports=1`.

## Addendum (2026-10-06, #1503): the player page reads `post`

The player Analytics tab's Pitches and Command cards take a Regular, Postseason
or All scope (`?scope=post|all`, absent is Regular; also `localStorage`, never My
Tally). Regular still reads `pit` only and is unchanged. Postseason reads `post`.
All adds the two buckets (`arsenalScoped`, `combineCommandEntries`), never one
over the other. A pitcher with no postseason pitches gets no control. "Pitches
like" and the `all/` pools stay regular season (point 4).

## Addendum (2026-10-06, #1514): ABS challenges keep the postseason beside the regular season

`gen-abs-challenges.mjs` already swept `R,F,D,L,W` but kept no game type, so
October was counted inside the regular-season figures. Owner decision: split it.

- **The scope is on the game only.** `abs_ingested_games.scope` (`'R'` or `'P'`,
  DEFAULT `'R'`, last column). A challenge row takes its game's scope through
  `game_pk` (`inScope`), so a row and its game can never disagree, and
  `abs_challenges` lines in the dump do not change. A game-keyed table needs no
  scope in its key: one game has one part of the season.
- **Both levels read their postseason.** Triple-A's postseason is `gameType` W
  (the two league championships, checked on the 2026 schedule). Its National
  Championship Game is type C, which the sweep does not ask for.
- **One report file a scope.** `abs-challenges.json` stays the regular season, so
  an old reader reads `'R'` only. `abs-challenges-post.json` and
  `abs-challenges-all.json` sit beside it. All is a fresh count over both parts,
  never one part added onto the other. The exposure files divide regular-season
  challenges only, because their roster denominators are regular-season totals.
- **The backfill set the scope by `gamePk`,** from the schedule's postseason
  game types: 17 MLB and 6 Triple-A games, and nothing else in the dump changed.
  Regular plus postseason equals the old totals; All equals the old file.
  `--recheck` sets the scope too, so the nightly job keeps it right.
- `/abs-challenges` has Regular, Postseason and All (`?scope=post|all`, also
  `localStorage`, never My Tally), shown only for a level with a postseason game
  on file (`postGames`, per level). Under Postseason the biggest MLB overturn
  names its round and game ("ALDS • G1", one schedule read) in place of its date.
