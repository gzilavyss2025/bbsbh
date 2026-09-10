# A contract row is named by its content, never by its address

Every row of the four historical contract exports carries a `rowKey`. That key
is the join between the crosswalk ADR-0066 builds, the dollar terms
`gen-contracts-shards.mjs` writes, the search index, a player's shard, and —
the part no rebuild can repair — the identity corrections ADR-0067 stores in
Redis, outside this repository.

The key used to be the row's POSITION in its source file. `salaries#24340` meant
"row 24340 of `salaries.csv`" and nothing more.

## What that cost

Twenty-three front-office rows were removed from `salaries.csv`. The row counts
reconciled. `npm run lint` exited 0. All 3,447 unit tests passed. The data was
wrong anyway:

```
PROBE salaries#24340
  identity/salaries.json : "Giles, Marcus", mlbId 279578, season 2004
  salaries.csv[24340]    : 2004,"Hernandez, Adrian",sp,,425000
```

The first divergence sat at index 24335, so **every 2000–2004 salary row — 3,014
of them — pointed at the wrong person.** Nothing threw and nothing warned,
because under a positional key there was nothing to detect: rows 0 to 27,325
still "matched" byte for byte. They just meant different people.

The rows were restored. The interim rule that came out of it — **flag, never
delete**, `scripts/data/contracts/executives.csv` as a VIEW over the rows rather
than a removal — still stands, and `docs/contracts-data-caveats.md` records it.
But it is a convention, and the next person to edit a source CSV does not
necessarily know why they must not.

## The decision

**A row's key is a hash of the row's own content, scoped to its source file.**
`scripts/lib/contract-row-key.mjs` mints it; the module's header carries the
detail. Three inputs:

1. **The source file.** The same man appears in all four exports, and his salary
   row and his extension row are different facts about different deals.
2. **The row's key cells** — a stated per-source subset, not every column. A key
   over every cell would be maximally distinguishing and maximally brittle:
   correcting a mistyped salary or filling in a blank agent would change the
   row's key and orphan the correction a human saved against it. The key columns
   answer WHO and WHICH DEAL, and a repair outside that set leaves the row's
   identity alone.
3. **An occurrence ordinal** among rows whose key cells are identical.

That third input is not a hedge against hash collisions. It is there because
`salaries.csv` holds 27 pairs of genuinely identical rows — one worksheet row
the original export duplicated. Content cannot separate two rows that have no
difference, so the ordinal says "the second identical row" and changes only when
a row identical to that one is added before it or removed.

Measured on the real files: 36,366 rows, 36,366 distinct keys. Of the 88
duplicate `(year, player)` pairs in `salaries.csv`, the 35 that are two
different men sharing a name and the 26 obligation rows separate on content
alone; the 27 verbatim repeats fall to the ordinal.

## The residual, stated plainly

Deleting the FIRST of two byte-identical rows re-keys the survivor. That is the
smallest coupling the problem admits, and it is confined to rows that are
already indistinguishable. Every other row in the file is untouched by any
insert, delete or reorder.

**Deleting a row is still not allowed**, and the reason has simply changed. It
no longer re-points the row's neighbours. It does still make that row's key
cease to exist, which orphans any override saved against it, and it still breaks
`salaries_summary.csv`'s reconciliation.

## Three couplings the key carried without saying so

A positional key is three things at once — a name, an order, and an address —
and only the first is obvious. Replacing it had to replace all three.

**It was the display order.** `gen-contracts-shards.mjs` sorted a player's deals
by season, then by the numeric part of the key. A hash carries no order, and
reaching for one anyway would not have failed loudly: `Number()` of a hash is
`NaN`, the language reads a `NaN` comparator result as "these two are equal",
and 220 rows across 110 player-seasons would have quietly reordered with the
suite still green. The order now comes from the row's own content — the newer
signing, the larger stated figure — and a test pins it. A reader inherits it,
because `contractsHistory.js` re-sorts on season alone and a stable sort leaves
everything below season where the generator left it.

**It was the terms bucket.** A row's dollar terms live in
`terms/{sourceFile}-{n}.json`, and `n` was `Math.floor(index / 500)` — arithmetic
that grew with the file for free. The bucket is now a slice of the key's own
hash modulo a stated per-source divisor (`TERMS_BUCKET_COUNT` in
`src/lib/shardKey.js`, beside `shardKey100` for the reason that file already
gives). The divisors reproduce what the positional scheme produced: 56 files for
`salaries.csv` at 433–544 rows each, 12, 5 and 2 for the others. Because a
divisor is stated rather than derived, a test asserts the realised sizes stay in
band, and a second test asserts every shipped bucket holds only rows whose key
names that bucket — the writer and the reader, checked against the artifacts.

**It was the shape a stored override is validated against.**
`api/contract-identity.js` accepted `#\d+` only. It accepts BOTH shapes now, and
must keep doing so for as long as an un-migrated correction can still sit in
Redis: that endpoint drops what it does not match, so rejecting the old shape
would hide a stored correction from the migration written to move it. The two
alternatives are disjoint by length — a positional index is at most five digits
across these four files, a content hash is always sixteen hex characters — so
accepting both costs nothing in precision.

## The migration is the risky half

`scripts/migrate-contract-row-keys.mjs` moves the stored overrides. It is a dry
run unless told otherwise, it prints the old key, the row that key resolves to
now, the new key and the row the new key resolves to — read back through the
regenerated crosswalk, not restated — and it refuses to guess. A correction it
cannot map is reported and left in place.

Two decisions inside it are worth stating. It writes to Redis **directly** rather
than through `PATCH /api/contract-identity`, because `mergeOverrides` re-stamps
`correctedBy` and `correctedAt` with the caller's identity and would erase who
made each decision and when. And its cross-check — does the corrected player
resemble the name on the row? — reuses `nameSimilarity`, the matcher's own
scorer, so the check agrees with the pipeline by construction rather than
drifting from it.

The mapping rests on one assumption it cannot verify from the inside: that the
CSV has not changed since an override was written. Nothing can recover the
original if it has, and that irreversibility is the whole reason the key stopped
being positional. What the script can do is show the evidence and stop, which is
what the flag is for.

## The assertion that was missing

Nothing compared the crosswalk's row count to the CSV's. Now
`test/contract-row-key.test.js` does, over the real files rather than a fixture,
and it goes further than a count: every key in the crosswalk must be the key that
row's own content mints. Run against the incident, the count assertion fails at
27,349 against 27,326 and the key assertion fails at index 24335 — the exact row
the original probe found.
