# Statcast percentile card — plan

## Context

The player page shows season stat tiles, career register, splits, and
game log, but nothing that answers "who is this guy, really" the way
Baseball Savant's percentile sliders do. `docs/enhancement-proposals.md`
§5 scoped this as the fourth reuse of the `war.js` build-time-fetch
pattern (§5 of `docs/data-enrichment.md`, mandatory per `CLAUDE.md`):
nightly script pulls a bulk/unofficial source → trims to a small static
JSON → app reads it same-origin, session-cached, degrade-to-empty on
failure.

**Key discovery that changes the shape of this feature vs. the original
proposal:** I fetched the real endpoint
(`baseballsavant.mlb.com/leaderboard/percentile-rankings?type=batter|pitcher&year=2026&csv=true`)
rather than the raw Statcast leaderboard the proposal named. It is
CORS-open (`access-control-allow-origin: *`, verified today) and its
columns are **already percentile ranks (0–100)**, not raw stat values —
Savant has done the percentile computation and the qualification-pool
filtering itself (unqualified players simply have blank cells for the
metrics they don't have enough sample for; e.g. a September call-up with
only 18 batted balls has every offensive column blank but `oaa` filled
if he's logged enough defensive innings). This eliminates the need to (a)
fetch a separate raw leaderboard + `sprint_speed` leaderboard and compute
percentiles ourselves, and (b) invent our own PA/pitch qualification
floor — we just pass Savant's own numbers through. Much simpler than
`gen-war.mjs` in this one respect; the rest of the pattern (CSV parsing,
trimming, defensive column-name pinning, loud failure) still applies.

Verified real header rows (2026-07-11, current in-season pool — 543
batter rows / 581 pitcher rows):

```
batter:  player_name,player_id,year,xwoba,xba,xslg,xiso,xobp,brl,brl_percent,
         exit_velocity,max_ev,hard_hit_percent,k_percent,bb_percent,
         whiff_percent,chase_percent,arm_strength,sprint_speed,oaa,
         bat_speed,squared_up_rate,swing_length
pitcher: player_name,player_id,year,xwoba,xba,xslg,xiso,xobp,brl,brl_percent,
         exit_velocity,max_ev,hard_hit_percent,k_percent,bb_percent,
         whiff_percent,chase_percent,arm_strength,xera,fb_velocity,
         fb_spin,curve_spin
```

`player_id` is the MLBAM id (verified against known ids: Betts 605141,
Contreras 661388) — the same id as statsapi's `personId`, so this joins
onto a roster/player exactly like `war.js`'s `xMLBAMID`. Values are
already ints/blank strings; `player_name` is `"Last, First"` (quoted CSV,
commas inside quotes — the parser must handle that).

## 1. Source handling

**URLs** (current season only, like `war.json` — no history file; a
finished season's percentile ranks aren't a repeat-lookup need the way
WAR-by-year is, so skip the `war-history.json` companion pattern for v1):

```
https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=batter&year={season}&csv=true
https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=pitcher&year={season}&csv=true
```

No `Origin` header needed (unlike `gen-war.mjs`'s FanGraphs call) — ACAO
`*` was returned with a bare `curl`, no Origin sent.

**Columns to consume** — 6 for hitters, 7 for pitchers (proposal said
5–7; picked the set that mirrors Savant's own player-page slider and
stays scorebook-legible):

- Batter: `xwoba`, `exit_velocity`, `hard_hit_percent`, `brl_percent`,
  `chase_percent`, `sprint_speed`
- Pitcher: `xera`, `k_percent`, `bb_percent`, `whiff_percent`,
  `chase_percent`, `fb_velocity`, `hard_hit_percent`

Dropped as redundant/less scorebook-relevant: `xba`/`xslg`/`xiso`/`xobp`
(xwOBA subsumes these), `max_ev` (avg EV is the headline number),
`arm_strength`/`oaa`/`bat_speed`/`squared_up_rate`/`swing_length`/`brl`
(raw count, `brl_percent` is the rate), `fb_spin`/`curve_spin`.

**Qualification floor**: none computed by us — pass through Savant's own
blanks as `null`. A row is kept in the output only if **at least one** of
the selected metrics is non-null (drops rows that are 100% blank for our
chosen subset, e.g. a pure defensive replacement with no batted-ball
sample and not in our subset at all — shrinks the file and matches "MiLB
and unranked players degrade to no card" cleanly: not-in-map ⇒ no card).

**Column-name pinning**: read the CSV header row into a `name → index`
map; look up every consumed column by name (not position); throw with a
clear message ("Savant percentile-rankings CSV: expected column
'xwoba' not found — layout may have changed") if any expected column is
missing. This is the "loud failure" mechanism — mirrors `gen-war.mjs`
throwing on non-2xx HTTP, but here catches a silent Savant column rename
too, which is the specific risk `docs/data-enrichment.md` §3 flags.

## 2. Script + workflow

New `scripts/gen-savant-percentiles.mjs`, self-contained (no imports from
`src/`, per the other `gen-*.mjs` cost/bulk scripts), structured like
`gen-war.mjs`:

1. `fetchPercentiles(type)` — GETs one CSV, throws on non-2xx.
2. A tiny local CSV-row parser (quoted fields with embedded commas —
   e.g. `"Whitlock, Garrett"` — and doubled-quote escaping; no npm
   dependency, same "small self-contained script" convention as the rest
   of `scripts/`).
3. Header → index map + the missing-column throw described above.
4. For each data row: read `player_id`; for each of the role's selected
   metrics, `Number(cell)` or `null` if blank; keep the row only if any
   selected metric is non-null; write `map[player_id] = { ...selected }`
   using short camelCase keys (`xwoba`, `ev`, `hardHit`, `brl`, `chase`,
   `sprintSpeed` for batters; `xera`, `k`, `bb`, `whiff`, `chase`,
   `fbVelo`, `hardHit` for pitchers) — trims key-name bytes across ~1,100
   rows and matches how `war.js`'s output uses short keys.
5. Write `public/data/savant-percentiles.json`:
   ```json
   { "season": 2026, "generatedAt": "2026-07-11T...Z", "bat": { "605141": {...} }, "pit": { "676477": {...} } }
   ```
6. `console.log` a one-line summary (row counts), matching `gen-war.mjs`.

**Expected file size**: ~543 batter rows + ~581 pitcher rows, each entry
~60–90 bytes of trimmed JSON ⇒ roughly 35–50 KB per role, **~80–100 KB
total** — same order of magnitude as `war.json` (~25 KB) and nowhere near
`vs-team-splits.json`'s ~3 MB.

**Workflow wiring** (`update-nightly-data.yml`): add a step alongside the
existing eight, same `continue-on-error: true` shape, same commit list:

```yaml
- name: Savant percentiles
  id: savant-percentiles
  continue-on-error: true
  run: node scripts/gen-savant-percentiles.mjs
```

— add `public/data/savant-percentiles.json` to the `git add` line, and
add `steps.savant-percentiles.outcome == 'failure'` to the final
fail-if-any-failed condition. No new job/cron — reuses the single
consolidated 11:00 UTC run (the header comment there already explains
why: avoid the two-cron collision that happened before consolidation).

**PWA precache decision** (`vite.config.js`): **include it in the
default precache** (do NOT add to `globIgnores`/runtime-caching like
`vs-team-splits.json`/`umpires.json`/`game-notes.json`). Rationale: at
~80–100 KB combined it's much closer to `war.json` (precached, no
special rule) than to the excluded multi-MB files; those three are
excluded specifically because they're large AND grow monotonically
(append-only or per-active-roster-player-times-clubs) — this file is
capped at the league's active-ish player pool and regenerated from
scratch nightly, same as `war.json`. No `vite.config.js` change needed at
all beyond the file existing under `public/data/` (the existing
`globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}']` already
picks up any new same-origin JSON automatically).

## 3. App wiring

New `src/api/savantPercentiles.js`, mirroring `src/api/war.js` exactly:
module-level `cached` var, `fetchSavantPercentiles()` does
`fetch('/data/savant-percentiles.json')`, degrades to
`{ season: null, bat: {}, pit: {} }` on any failure, in-memory cached for
the session (file changes once a day).

Add a helper in the same module, `savantPercentilesFor(data, personId,
group)`:
```js
export function savantPercentilesFor(data, personId, group) {
  const key = group === 'pitching' ? 'pit' : 'bat'
  return data?.[key]?.[personId] ?? null
}
```
(mirrors `vsTeamSplitsFor`'s shape — a thin per-player/per-group lookup,
not a fetch.)

**`loadPlayer.js` threading**: add `fetchSavantPercentiles()` to the
existing top-level `Promise.all([fetchPerson, fetchTransactions,
fetchWarData, fetchWarHistory, fetchVsTeamSplits])` (line ~139) — free
after the first player page, same as WAR/vs-team splits. Inside the
per-group `results.map(async (group) => {...})` block (where `block` is
built via `buildBlock`), compute
`savant: savantPercentilesFor(savantData, id, group)` and pass it into
`buildBlock`'s args (or attach it to the returned `{ group, ...,
block }` object and merge onto `block.savant` after — whichever is less
invasive to `buildBlock`'s existing signature in `person.js`; simplest
is attaching directly to `block` after `buildBlock` returns, avoiding
touching `person.js`'s pure-shaping signature at all: `block.savant =
savantPercentilesFor(savantData, id, group)`). No `person.js` changes
needed — this is a pure passthrough lookup, not a derivation, so it
doesn't belong in the pure-shaping module.

**PlayerPage.jsx card placement**: a new `<StatcastPercentiles>`
component, rendered once per block (mirrors `SplitsVsTeam`'s
per-block/per-group placement at line 226-228), positioned **between
"Current season" (`StatGrid`) and `SplitsVsTeam`** — i.e. right after the
`block.otherLevels` map, before the `data.vsTeam` block. This reads as
"here's his season line, here's what the underlying quality of contact
says about it" before drilling into splits vs. a specific opponent —
the same "current, then context" ordering the page already uses.
Renders nothing (returns `null`) when `block.savant` is `null` (MiLB
player, or MLB player under Savant's sample floor for every metric we
kept) — no empty state, consistent with `conversionNote`/`vsTeam`'s
existing "omit the whole section" pattern.

**Bar rendering**: a small presentational component,
`src/components/StatcastPercentiles.jsx` (or inline in `PlayerPage.jsx`
next to `CareerRegister`/`PositionInningsCard` if the maintainer prefers
fewer files — the plan defaults to a new file since `SplitsVsTeam` set
that precedent for a Savant-adjacent card). Layout: one row per metric —
label (e.g. "EXIT VELO"), a horizontal bar filled to `percentile%` width,
and the percentile number in mono tabular figures (reuse the existing
`.stat__v`/tabular-nums typography token — check `src/tokens/typography.css`
for the exact class, likely the same one `Fact`/`Cell` use). Bar track
uses `--surface-card`/a muted card-background var; fill uses ink navy for
mid-range percentiles and the seal's kraft-tape amber (`--seal-cover` or
whatever the accent-positive token is) for standout (≥90th) percentiles —
follow whatever token the existing `Fact`/`StatGrid` badges already use
for "notable" figures rather than inventing a new color; no red/green
traffic-lighting (a low xERA percentile framed as "bad" is a value
judgement the paper-scorebook idiom doesn't currently make anywhere
else — a fastball-velo bar and a chase-rate bar are just facts, styled
identically). Metric labels + order are a small constant array per role
in the new component or `savantPercentiles.js` (`BATTER_METRICS`,
`PITCHER_METRICS`, each `{ key, label }`), not hard-coded JSX repetition.

## 4. Spoiler audit

Season-aggregate percentile ranks (exit velo, chase%, xwOBA, etc.) carry
**no score information** — they're descriptive of a player's skill
profile across the whole season to date, exactly the same footing as the
"Season splits" card and the WAR badge already shown unconditionally on
this spoiler-free page. Nothing here is derived from `playEvents` of a
specific in-progress or future game; it's Savant's own nightly-refreshed
aggregate, one calendar day stale at worst — same staleness profile as
`war.json`, already accepted as fine.

**Does it need the page's `asOf` cutoff?** No — and this is the one place
this card's treatment *diverges* from `SplitsVsTeam`'s "last game" row
(which IS gated on `asOf` because it names a specific past game's stat
line). A season percentile rank has no single-game granularity to leak:
it's a rolling aggregate over the whole season, so there is no way to
point at "the game that pushed his chase% percentile up" the way a game
log row points at a specific result. Compare `block.tiles`
("Current season" `StatGrid`) — those ARE `asOf`-gated (frozen to
"entering today") because they're literal counting stats a viewer could
use to infer "he did something today." Percentile RANK, by contrast, is
a same-season relative-standing figure that moves by fractions of a
percentile point per game for an established player — not usefully
diff-able game-to-game, so no gate is needed and the card can render
unconditionally like `SplitsVsTeam`'s career-totals half. State this
explicitly as the design rationale (mirrors how `war.js`'s
season-long WAR badge is already ungated on `asOf` today — precedent for
"season aggregate ⇒ no cutoff needed" already exists in this codebase).

## 5. Verification plan

1. `node scripts/gen-savant-percentiles.mjs` locally; confirm it writes
   `public/data/savant-percentiles.json`, prints a sane row-count summary,
   and the file is in the ~80–100 KB range predicted above.
2. Spot-check two players by hand against
   `baseballsavant.mlb.com/savant-player/{slug}-{id}` (a hitter and a
   pitcher, e.g. Betts 605141 and a current-season starter) — the
   player-page percentile widget's numbers should match the generated
   JSON's `bat[605141]`/`pit[id]` values exactly (same source, same
   season) for every metric kept.
3. Confirm a clearly-unqualified player (e.g. a just-called-up rookie
   with <50 PA) is either absent from the map or has partial nulls, and
   that `StatcastPercentiles` renders nothing (not a broken bar) for a
   metric that's `null`.
4. `npm run dev`, open a current MLB player's page, confirm the card
   renders between the season tiles and Splits vs Team, bars fill
   proportionally, mono figures align with the rest of the page's
   typography, and a MiLB player's page shows no card at all (no
   layout gap / no console error).
5. `npm run lint` / `npm run build` before any push (per CLAUDE.md).

## Files expected to touch

- `scripts/gen-savant-percentiles.mjs` (new)
- `.github/workflows/update-nightly-data.yml` (new step + git-add + fail-check)
- `src/api/savantPercentiles.js` (new)
- `src/api/loadPlayer.js` (thread fetch + attach `block.savant`)
- `src/components/StatcastPercentiles.jsx` (new)
- `src/screens/PlayerPage.jsx` (render the card per block)
- `src/index.css` / relevant `src/tokens/*.css` (bar styling, reusing
  existing color/typography tokens — likely no new token needed, just
  new classnames)
- (verification only, no edit) `public/data/savant-percentiles.json`
  generated locally to confirm shape before commit
