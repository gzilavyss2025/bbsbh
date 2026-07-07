# Uniforms & alternate-logo research (verified 2026-07-07 against live endpoints)

Every claim below was verified with real HTTP requests today (including `Origin:`
headers to confirm CORS grants). Sample game: gamePk 823036 (MIL@STL 2026-07-06 F).

## 1. Uniforms — SOLVED: statsapi has a full uniforms endpoint family

The "what are they wearing tonight" problem does not require a hand-built
database. statsapi.mlb.com publishes both the per-team catalog of uniform
options AND the per-game assignment of what each team actually wore. Same host
as everything else: CORS `access-control-allow-origin: *`, no key, GET only.

### `GET /api/v1/uniforms/team?teamIds={ids}&season=2026` — the options catalog

Returns `uniforms[].uniformAssets[]`, one entry per asset with:
- `uniformAssetText` — the human label, exactly the taxonomy a scorer wants:
  Brewers 2026 (16 assets) = Home Cream Jersey/Pants, Road Grey Pants, Road
  Powder Blue Jersey, Alt 1 Pinstripe Jersey/Pants, Alt 2 Navy Blue Jersey,
  City Connect 2.0 Jersey/Pants/Hat, Primary All Navy Hat, Alt Yellow Front
  Hat, plus event hats (Jackie Robinson Day, Armed Forces Day, Fourth of July,
  Hall of Fame Weekend).
- `uniformAssetType.uniformAssetTypeCode` — `J` jersey / `P` pants / `C` cap.
- `uniformAssetCode` — e.g. `158_jersey_5_2026` (teamId + piece + slot + season).
- `uniformAssetId`, `active`, `startSeason`/`endSeason`.

`teamIds` is REQUIRED (omitting it errors) but takes a comma list — all 30 MLB
clubs in one call (verified: 30 teams, 488 assets total for 2026).

**MiLB: not covered.** A AAA team (Nashville, 553) returns an empty
`uniformAssets:[{}]`. The Brewers' 2025 *catalog* is likewise empty, yet 2025
*game* assignments exist (see below) — catalog depth is patchy before 2026.

### `GET /api/v1/uniforms/game?gamePks={pks}` — what they actually wore

Returns per game `{gamePk, home:{id, teamName, uniformAssets[]}, away:{...}}` —
typically three assets per team (jersey + pants + hat). Verified correct for
823036: Brewers in Alt 2 Navy Blue Jersey / Road Grey Pants / Alt Yellow Front
Hat; Cardinals in Home Whites / Primary Red Hat. Takes a comma list of gamePks
(a whole slate in one call).

- **Coverage**: 8/8 games on the 2026-07-06 MLB slate populated. A sampled 2025
  game (777224) is also populated, so history goes back at least a season.
- **Timing**: NOT populated at Preview — today's games (checked ~6h before
  first pitch) return bare `{gamePk}` with no home/away. It fills in around
  game time (exact trigger unobserved — likely when the data operators post it,
  near Warmup/first pitch). Callers must treat "missing" as "not posted yet",
  per the app's standard degradation convention.
- **Event-hat caveat**: the 2026-04-15 Brewers game (Jackie Robinson Day)
  assignment lists the standard Primary All Navy Hat, not the catalog's
  "Jackie Robinson Day Hat" — special-event caps exist in the catalog but are
  not reliably reflected in per-game assignments.
- The live feed (`feed/live`) contains ZERO uniform data (grepped a full
  payload) — this endpoint is the only source.

### Spoiler analysis

Uniform identity is spoiler-FREE: what a team wears reveals nothing about the
score, and the assignment doesn't change as the game unfolds. Safe to fetch and
render on the staging screens (TeamInfo / GameView masthead) or in the
`scripts/game-buzz.mjs` GAME NOTES flow. The only wrinkle is timing: it may
still be empty when the user stages a game pregame, so render it
behind the usual "not posted yet" fallback and let Refresh pick it up.

## 2. Alternate logos (Barrelman, City Connect marks) — NOT on any MLB CDN

Re-verified today, extending the sweep recorded in `src/lib/teams.js`:

**What the mlbstatic team-logos CDN serves** (all verified 200 with real art):
- `https://www.mlbstatic.com/team-logos/{id}.svg` — base (in use today)
- `team-primary-on-light/{id}.svg`, `team-cap-on-light/{id}.svg`,
  `team-wordmark-on-light/{id}.svg` (in use today) — plus **`-on-dark`
  versions of all three** (verified live; not currently used since every app
  surface is light paper).
- `https://midfield.mlbstatic.com/v1/team/{id}/spots/{size}` — the circular
  "spot" avatar (primary mark in a roundel).

**What does not exist**: `team-secondary-*`, `team-alternate-*`,
`city-connect/*`, `team-city-connect-*` all 404. No path keyed by
`uniformAssetCode` serves art anywhere we could find.

**Trap for future probing**: `midfield.mlbstatic.com/v1/team/{id}/<anything>`
returns HTTP 200 `image/svg+xml` for ANY path — a generic "Exhibition Team
logo" fallback (md5 5f4d7fdd…, 9057 bytes). Status codes alone cannot discover
midfield endpoints; hash-compare against the fallback.

**Third parties**: ESPN's CDN (`a.espncdn.com/i/teamlogos/mlb/500[-dark|/scoreboard]/mil.png`)
serves only primary-mark treatments. SportsLogos.net has every alternate
(Barrelman, CC marks) but returns 403 on hotlinking and is unlicensed fan-run —
not wireable.

**Conclusion / recommendation**: there is no id-keyed public source for
alternate marks. If the sketch sheet should offer Barrelman / City Connect
logos, the honest path is a small curated set of SVGs checked into `public/`
(hand-picked per team of interest, starting with the Brewers), exposed as extra
entries alongside `LOGO_VARIANTS` with a "local asset" flag. The uniforms
catalog above can supply the *labels* (which alternates exist per team) even
though it carries no imagery.
