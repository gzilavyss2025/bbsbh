# 01 — The tendency derivation (data layer)

Status: `ready-for-agent`
Phase: 1 (no generator change, no backfill)

Add the read-time derivations the card needs. Pure logic only — no component
work here, and everything in this issue is unit-testable, so it lands with tests
in `test/`.

## `src/lib/statTiers.js`

Add a **five-bucket, two-directional** sibling to `tierForZ`. It goes here, not
in `umpires.js`, because this module is already the one place that owns z-score
bucketing (`tierForZ` + `meanAndSd`, shared by umpire accuracy and Game Score).

```js
export const LEAN_TIER_LABELS = {
  veryPitcher: 'Very pitcher friendly',
  pitcher:     'Pitcher friendly',
  neutral:     'Neutral',
  hitter:      'Hitter friendly',
  veryHitter:  'Very hitter friendly',
}

// z is signed toward HITTERS (positive = hands hitters runs).
export function leanTierForZ(z) { … }
```

Cutoffs `±1.0` and `±0.35`. `tierForZ` cannot be reused: it has four buckets, no
neutral band, and is one-directional (higher is better), none of which is true
here.

## `src/api/umpires.js`

### `umpireLeanFor(games)` — the pool-independent per-umpire figure

Net runs handed to **hitters** per game, over an umpire's MLB regular-season
rows only (`level === 'MLB' && gameType === 'R'`, with the same
predates-the-tag defaults `aggregate()` uses):

```
netFavor = Σ (favorAway + favorHome)   over rows where both are non-null
lean     = netFavor / (count of those rows)
```

`favorAway`/`favorHome` are signed toward the batting team, so a positive result
means he hands runs to hitters.

Fallback when no row carries favor (`run-expectancy.json` was never built):
`(season.expanded − season.squeezed) / season.called`, **negated** so the sign
convention matches — a generous zone helps pitchers. Return which of the two was
used so the UI can caption it honestly; the two correlate at −0.856 but they are
not the same number and the card should not imply they are.

### Extend `accuracyIndex(level)`

It already does one memoized pass over the whole file per level. Add to that
pass:

- `leanById` — `Map<String(id), { lean, z, tier, source }>`
- `leanMean` / `leanSd` — from `meanAndSd` over the same qualifying pool
  `rankById` uses (`>= MIN_RANK_GAMES`, `season.accuracy != null`)

**Reuse the existing pass and the existing qualifying pool.** A second pass, or a
second definition of "qualifies", is how the tier pill and the scale start
disagreeing about the same umpire.

### Surface it

- `loadUmpire(id)` → add `lean` (the `leanById` entry, or null below the floor).
- `umpireAccuracySummary(id)` → add `lean` too, so the modal and any future
  lineup-page use don't need the whole record.

### `umpireWatchArea(season, leagueShare)` — the Area to Watch phrase

Phase 1 shape: region only, no handedness. Prefer the 3×3 `cellMiss`-vs-baseline
signal (`umpireZoneCells`'s `over`, which already exists and already backs the
zone map) over the flat `high/low/inside/outside` tallies — it is measured
against the league rather than against itself.

Return `null` when there is no clear signal, the same floor
`accuracyTendency()` already applies (fewer than 5 missed calls). **A card that
says nothing is correct; a card that invents a tendency is not.**

Keep `accuracyTendency()` as-is — it has its own callers and its own phrasing.

## Reference: the statsapi umpire-bio dead end

Recorded here so nobody re-investigates it. `GET /api/v1/people/{umpireId}`
returns exactly these fields, and no more:

```
active, birthCity, birthCountry, birthDate, birthStateProvince, boxscoreName,
currentAge, firstLastName, firstName, fullFMLName, fullLFMName, fullName,
gender, height, id, initLastName, isPlayer, isVerified, lastFirstName,
lastInitName, lastName, link, middleName, nameFirstLast, nameSlug,
primaryPosition, strikeZoneBottom, strikeZoneTop, useLastName, useName, weight
```

No `mlbDebutDate`, no tenure, no crew. `GET /api/v1/umpires` 404s.
`hydrate=xrefId,rosterEntries,education,transactions` adds nothing. There is no
service-time figure to be had from this API — see PRD §2, Band 2 for what to
show instead.

## Tests (`test/umpire-tendency.test.js`)

- `leanTierForZ` boundaries, both directions, including exact `±1.0` / `±0.35`.
- Sign convention: an umpire whose rows sum to positive favor lands on the
  hitter side. **This is the assertion most worth having** — a sign flip here is
  invisible in review and inverts the whole card.
- Fallback path: rows with null favor fall through to the lean formula and report
  `source` accordingly.
- `umpireWatchArea` returns null below the miss floor.
- Level/gameType filtering: an AAA row and a postseason row are both excluded
  from the MLB regular-season lean.
