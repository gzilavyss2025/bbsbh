Status: needs-triage

# Highlights cascade — schema extraction, nightly per-team precompute, blocklist hook

## Summary

Foundation issue for the whole cascade (see `../PRD.md`). Adds the
`keywordsAll`-derived schema (`playerId`, `teamId`, `category`,
`significance`) on top of the raw MLB `content` items `src/api/highlights.js`
already fetches, a shared "is this clip eligible for the positive-highlights
filter" predicate, a nightly incremental generator that writes one small
JSON file per MLB team under `public/data/highlights/`, a one-time backfill
script for the rest of the season, and the empty blocklist hook. Issues 02–04
(box score, team rail, player rail) all depend on this landing first.

**Schema and filter rules are locked by the PRD** (verified live against 45
clips/5 games + a 117-game full-season Ortiz sweep) — this issue is
implementation, not re-derivation. Don't re-verify the `teamId`-is-the-sign
rule or the `abs`/`challenge` exclusion from scratch; do a quick live spot
check (one gamePk) to confirm the `keywordsAll` field names below still match
today's feed, per root `CLAUDE.md`'s "verify feed field paths against a live
game" convention — MLB's `content` endpoint is undocumented and PRDs go
stale.

## 1. Extend `src/api/highlights.js` — new pure extraction + filter exports

This file exists and ships today (`fetchHighlights`, `highlightsByPlayId`,
`highlightPlaybacks` — see header comment, spoiler-reveal-only for the
per-play join). The new exports below are **plain data transforms, not
reveal-only** — they run inside a Node generator with no DOM at all, and (for
the team rail) inside a live fetch whose *result* is spoiler-neutral once the
game is decided (see §3 of the PRD's "How it operates"). Add them to the same
file since they operate on the same raw `content` items; don't create a
parallel module.

```js
// A per-play clip's classification, derived from keywordsAll. Locked schema
// — see .scratch/highlights-cascade/PRD.md ("Locked schema").
export function classifyHighlight(item) {
  const kw = item?.keywordsAll ?? []
  const find = (type) => kw.find((k) => k.type === type)?.value ?? null
  const taxonomy = kw.filter((k) => k.type === 'taxonomy').map((k) => k.value)
  return {
    guid: item?.guid ?? null,
    playerId: find('player_id') ? Number(find('player_id')) : null,
    teamId: find('team_id') ? Number(find('team_id')) : null,
    category: taxonomy.find((t) => ['hitting', 'pitching', 'defense'].includes(t)) ?? null,
    significance: SIGNIFICANCE_TAGS.find((t) => taxonomy.includes(t)) ?? null,
    taxonomy,
  }
}

const SIGNIFICANCE_TAGS = [
  'wow', 'top-play', 'featured', 'player-of-the-game', 'star-of-the-game',
  'clutch-moment', 'highlight-reel-play', 'career-first', 'season-first',
  'milestone', 'mlb-debut', 'gold-glove-award',
]

// Excludes abs/challenge-taxonomy clips at the source — PRD amendment,
// the team_id sign is unreliable for these (tags the participant, not who
// benefited). Apply BEFORE any teamId/playerId filtering, never after.
export function isEligibleForPositiveFilter(classified) {
  return !classified.taxonomy.some((t) => t === 'abs' || t === 'challenge')
}
```

Confirm the exact `taxonomy`/`highlight-reel-*` value(s) and the literal
`type` strings (`player_id` vs `playerId`, `team_id` vs `teamId`) against a
live `content` response for a recent gamePk before writing this — the PRD's
prose names them informally; the actual JSON keys need a live check
(`docs/test-games.md` has verified gamePks). `highlight-reel-*` in the PRD
schema comment is a family, not one literal string — confirm what the actual
suffix values are (e.g. `highlight-reel-play`, `highlight-reel-catch`?) and
match all of them, not just one guess.

## 2. Blocklist hook — stub, empty

New `scripts/highlight-blocklist.json`:
```json
[]
```
with a header note (JSON has no comments — use a `_hint` sibling key, same
convention as `scripts/milb-history-seed.json`'s `_hint` field) explaining
the shape (`{guid, reason}`) and that it's hand-edited, never generated.
Reader: the generator (§3) loads it once and drops any clip whose `guid` is
present, in the same filtering pass as the `abs`/`challenge` exclusion —
before a clip is ever filed under a team. No existing script in this repo
does an exact Set-membership blocklist filter (checked — `milbHistory.js`'s
seed is a date-range lookup, not a blocklist), so this is new, small code:

```js
const blocklist = new Set(JSON.parse(await readFile('highlight-blocklist.json', 'utf8'))
  .filter((e) => e.guid).map((e) => e.guid))
const eligible = classified.filter((c) => c.guid && !blocklist.has(c.guid))
```

## 3. New nightly generator: `scripts/gen-highlights.mjs`

Model on `scripts/gen-umpire-accuracy.mjs`'s incremental/append-only shape
(read prior state, scan only new/recent games, upsert-by-gamePk, recompute
any derived aggregate fresh from the merged rows every run — don't
accumulate an aggregate incrementally). Key differences from that template:

- **Scan by game, not team** (PRD: "each game belongs to two teams;
  scanning per-team schedules would double-fetch"). Build `targets` from
  `/api/v1/schedule?sportId=1&...` restricted to `Final` MLB games in the
  trailing window (`--days=N`, default small, mirrors
  `gen-umpire-accuracy.mjs`'s `--days=3` default), same postponed/replay
  dedup guard (`d.date === g.officialDate`) that script already uses.
- **One `fetchHighlights(gamePk)` call per game** (reuse `src/api/
  highlights.js`, don't re-implement the endpoint call), `mapWithConcurrency`
  capped low (6–8, matching the two existing templates).
- **Per game: classify → filter (abs/challenge, then blocklist) → file each
  surviving clip under BOTH its `teamId` and its `playerId`**, into one
  in-memory `Map<teamId, item[]>` for this run's new games.
- **One output file per MLB team**: `public/data/highlights/{teamId}.json`,
  shape:
  ```json
  { "teamId": 158, "generatedAt": "...", "games": [
    { "gamePk": 823357, "date": "2026-07-12",
      "clips": [ { "guid": "...", "playerId": 664040, "category": "hitting",
                    "significance": "featured", "title": "...",
                    "playbacks": { "hls": "...", "mp4": "..." } } ] }
  ] }
  ```
  Store `title` and resolved `playbacks` (via the existing
  `highlightPlaybacks(item)`) in the written file — the rails need them to
  render without re-fetching; don't make readers re-derive playback URLs
  from a raw MLB shape they don't have. **Do not store `keywordsAll` or any
  raw MLB payload verbatim** — only the fields above; keeps files small
  (PRD's 150–400KB/team sizing assumes this) and avoids shipping fields the
  filter logic already collapsed into `category`/`significance`.
- **Dedup/merge by `gamePk`** exactly like `gen-umpire-accuracy.mjs`'s
  `upsertGame` — read the existing 30 team files (only the ones touched by
  this run's new games), merge new `games` entries in by `gamePk`, sort
  newest-first, write back with `writeJsonAtomic` (from `scripts/lib/io.js`,
  same as the template). A corrupt existing file must abort that team's
  write, not silently rebuild and drop history (same principle
  `gen-umpire-accuracy.mjs`'s header comment states).
- **A game's clips are filed under whichever team a clip's `teamId` says AT
  THE TIME** (PRD: handles mid-season trades correctly for free) — this
  falls out naturally from filing per-clip `teamId`, not per-game
  home/away teams; don't "helpfully" file all of a game's clips under both
  participating clubs.

### Registration — the 3-place checklist this repo has already gotten wrong twice

Per `scripts/CLAUDE.md` and `.github/workflows/update-nightly-data.yml`'s own
postmortem comments (`gen-comeback-wins.mjs`, `gen-jerseys.mjs` both silently
dropped output for days from missing one of these):
1. New step in `update-nightly-data.yml`: `node scripts/gen-highlights.mjs`,
   `continue-on-error: true`, same pattern as neighboring steps.
2. Add `public/data/highlights/` to the workflow's `git add` list.
3. Add the step to the final "Fail if any generator errored" outcome check.

Separately (not one of the 3, but don't skip it either): add an entry to
`scripts/CLAUDE.md`'s generator catalog.

## 4. One-time backfill: `scripts/gen-highlights-backfill.mjs`

Model on `scripts/gen-rookies-backfill.mjs`: **not on the cron** (header
comment says so explicitly, same as that file and `gen-war-history.mjs`).
`--since=YYYY-MM-DD --until=YYYY-MM-DD` (default: start of the current
season through yesterday), sweeps every `Final` MLB game in range not
already present in any team file's `games[].gamePk`, same
classify→filter→file logic as §3 (share the per-game processing function
between the two scripts rather than duplicating the classify/filter/file
body — the two scripts differ only in how they source `targets` and how they
write, per the existing `gen-rookies.mjs`/`gen-rookies-backfill.mjs` pairing
convention. Since this file is much bigger than that pairing (~207 lines for
a single season vs. potentially several seasons of clips here), consider
whether `public/data/highlights/{teamId}.json` needs the same "outside the
PWA precache" treatment `vs-team-splits.json` got once this runs — check
that file's registration (or lack of it) in `vite.config.js`'s precache list
before deciding, since the PRD explicitly cites `vs-team-splits.json`'s size
threshold as the comparison point.

## 5. Reader — thin, dumb, shared by issues 03 and 04

New `src/api/gamehighlights.js` (reader side, separate from `highlights.js`'s
live-fetch side — mirrors how e.g. `war.js` is a thin static-file reader
while a different module does live fetching, per `src/api/CLAUDE.md`'s
build-time-fetch pattern):

```js
export async function fetchTeamHighlights(teamId) {
  try {
    const res = await fetch(`/data/highlights/${teamId}.json`)
    if (!res.ok) return { games: [] }
    return await res.json()
  } catch {
    return { games: [] }
  }
}
```
No filtering logic here (PRD: "the shipped JSON only ever contains clips
already past that filter... readers stay dumb"). `TeamHighlightsRail` reads
its own team's file as-is; `PlayerHighlightsRail` reads the same file for the
player's current team and filters client-side to `clip.playerId === playerId`
— that filter is fine to leave in the *rail* component, not this reader,
since it's identity-scoping, not content-filtering.

## Spoiler audit checklist

- [ ] `classifyHighlight`/`isEligibleForPositiveFilter` are pure functions
      with no rendering path — confirm neither is imported from any
      component file directly without going through the reveal-only or
      decided-games gating the PRD specifies (issues 02–04 own that gating,
      this issue just needs to not accidentally export something that makes
      it easy to get wrong).
- [ ] The generator only scans `Final` games — confirm the schedule query's
      status filter, same as `gen-umpire-accuracy.mjs`'s guard, so an
      in-progress game's clips never enter a precomputed file.
- [ ] Written team JSON files contain no field that reveals anything about a
      game NOT in that file (i.e. no team-level aggregate that leaks a
      future/undecided game's existence) — spot check one file's shape.

## Where this touches

- `src/api/highlights.js` — add `classifyHighlight`, `isEligibleForPositiveFilter`.
- `scripts/highlight-blocklist.json` (new) — empty seed.
- `scripts/gen-highlights.mjs` (new) — nightly incremental generator.
- `scripts/gen-highlights-backfill.mjs` (new) — one-time backfill, hand-run.
- `src/api/gamehighlights.js` (new) — static-file reader for issues 03/04.
- `.github/workflows/update-nightly-data.yml` — 3-place registration (§3).
- `scripts/CLAUDE.md` — new generator catalog entry.
- `vite.config.js` — check/adjust PWA precache list if team files are large
  enough to warrant exclusion (see §4).

## Verification plan

1. Live spot check against a recent gamePk (`docs/test-games.md`) confirming
   `keywordsAll` field names match §1's assumptions; adjust the extraction
   if MLB's shape has drifted since the PRD's research.
2. Run `gen-highlights.mjs --days=7` locally against real games; confirm
   output files land under `public/data/highlights/`, are valid JSON, and a
   known clip's `teamId`/`category`/`significance` match manual inspection
   of the raw `content` response for that game.
3. Run `gen-highlights.mjs` a second time over the same window; confirm
   idempotent output (same file, `generatedAt` aside) — validates the
   upsert-by-`gamePk` merge.
4. Add a fake `{guid, reason}` entry to `highlight-blocklist.json` for a
   clip known to be in the test window; re-run; confirm that clip is now
   absent from its team's file.
5. `npm test`, `npm run lint`, `npm run build` all pass clean.

## Comments
