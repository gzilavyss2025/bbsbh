Status: resolved

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

**2026-08-06 — implemented and committed** on branch `claude/highlights-cascade`
(worktree `C:\Users\gzilavy\bbsbh-highlights-cascade`), commit `6d6c470`, after
merging `origin/main` (the branch was 31 commits behind; the only conflict was
`public/data/war.json`, resolved to main's newer nightly output). Not pushed, no
PR opened. Files match "Where this touches" exactly, plus three additions noted
below.

### The live spot check found two things that changed the draft

Step 1 of the verification plan was run first, as instructed, and widened when
the first game's response didn't look like a clean per-play feed: 1,150 items
across 41 Final MLB games (2026-07-28..30) plus the four pinned gamePks from
`docs/test-games.md`.

**The good news first: every field name in §1 holds exactly.** `keywordsAll`
entries are `{ type, value, displayName }`; the literal type strings are
`player_id`, `team_id` and `taxonomy`, not the camelCase alternatives. `abs` and
`challenge` are present and behave exactly as the PRD amendment describes. The
one thing §1 flagged as a guess was a guess: `highlight-reel-play` does not
exist. The real family is `-offense`, `-pitching`, `-starting-pitching`,
`-relief-pitching`, `-team`, so `significance` matches by PREFIX and resolves to
the actual tag. (Worth knowing for issues 03/04's ordering: `highlight-reel-
pitching`/`-starting-pitching` each appear about once per game, so their presence
is close to meaningless as a "this one mattered" signal, unlike
`player-of-the-game` at 33/1,150.)

**Two real differences, both checked with Gary before writing the rest:**

1. **`guid` is absent on 54% of content items (619 of 1,150)**, and not only on
   non-play material — "Kyle Manzardo slugs a grand slam in Guardians' win",
   "Gavin Williams strikes out 12 against Reds" and "Chase Burns strikes out
   four" all carry none. §2's blocklist line (`filter((c) => c.guid && ...)`)
   would therefore have silently discarded 95 of the 599 clips that survive the
   filter, and a maintainer would have had no way to name them in the blocklist
   anyway. Clip identity is now `clipId = guid ?? id`, where `id` is a readable
   slug (`reid-detmers-strikes-out-nine-vs-astros`), present on 100% of items and
   unique across the entire sweep. `guid` is stored alongside, untouched — it is
   still the box score's per-play join key, and simply doesn't exist for clips
   that were never tied to one tracked play event.

2. **The `content` array is roughly half non-play material and the draft had no
   gate for it.** `highlights.highlights.items` mixes clips with everything else
   MLB produced around the game. In that one 3-day window: 87 interviews, 62
   manager pressers, 41 recaps, 41 condensed games, 66 Data Viz cards, 17 "Field
   View" alternate angles, Cut4 promos ("Busch Stadium's hot dog promotion"), a
   charity segment — **and 9 injury clips plus an ejection**, which the PRD's
   own risk section had called an unverified blind spot ("we have zero examples
   of ejections, brawls, or injury clips in either sample") with no override
   mechanism. They are routine, not exotic. With only the locked `abs`/
   `challenge` exclusion, a team rail's top entry could be "Jose Franco leaves
   game with right elbow discomfort".

   Gary picked the middle of three options: a positive gate on MLB's own
   `highlight` tag, plus an explicit `NON_PLAY_TAXONOMY` exclusion set
   (`src/api/highlights.js`). Yield ~14.6 clips/game. The other two were
   rejected on evidence: the issue as literally written yields ~22.5/game
   including all of the above, and pulling whole categories via the blocklist
   would mean hand-listing thousands of clips forever; requiring a
   `hitting|pitching|defense` category on top yields ~13.5/game but drops real
   marquee clips, because MLB tags the category inconsistently ("Gavin Williams
   strikes out 12", "Ivan Johnson earns his first MLB hit", and — from the
   original 5-game sample — the `featured` clip of Yelich's walk-off grand slam
   all carry none).

**Non-issues, checked and dismissed.** Multi-`team_id` items exist (96/1,150)
but every one is a recap, condensed game, or challenge clip — zero survive the
gate, so §1's first-match `find('team_id')` is safe as drafted. 24 items carry no
`team_id` at all (a charity segment, one genuinely good game-ending catch); they
can't be filed anywhere and are dropped rather than guessed at.

### What shipped

- **`src/api/highlights.js`** — `classifyHighlight`, `isEligibleForPositiveFilter`,
  `NON_PLAY_TAXONOMY`, `SIGNIFICANCE_TAGS`, and `highlightPoster` (see additions
  below). Header comment states plainly that these are NOT reveal-only, and why.
- **`scripts/lib/highlights.mjs`** *(addition — not in "Where this touches")* —
  the shared per-game body §4 asked the two scripts to share. It's a lib module
  rather than an export from one script into the other because the shared body IS
  the filter policy, and `scripts/lib/` is where this repo already puts helpers
  two generators both need (`io.js`, `args.mjs`, `concurrency.mjs`).
- **`scripts/gen-highlights.mjs`** — nightly, `--days` trailing window (default
  3), `--since`/`--until` for a wider sweep. Scans by game; `Final` + the
  `d.date === g.officialDate` postponed/replay guard; `mapConcurrent` at 6;
  upsert-by-`gamePk`; `writeJsonAtomic` per team.
- **`scripts/gen-highlights-backfill.mjs`** — hand-run, not on the cron, skips
  any gamePk already present in any team file without fetching it.
- **`scripts/highlight-blocklist.json`** — `{ _hint, blocked: [] }`. §2 asked for
  both a flat `[]` and a `_hint` sibling key, which JSON can't do at once; the
  object form wins since `_hint` is the documented convention, and the loader
  accepts a bare array too so trimming it down can't break a run.
- **`src/api/gamehighlights.js`** — the dumb reader, per §5, plus a per-team
  in-memory cache mirroring `war.js`. Filename kept as the issue spelled it
  (all-lowercase) rather than the `gameNotes.js`-style camelCase used elsewhere
  in `src/api/`, since issues 03/04 will import this exact path — worth a
  deliberate rename later if that inconsistency grates.
- **Registration** — all three places (workflow step `id: highlights`, the
  `git add` list, the outcome check) plus the `scripts/CLAUDE.md` catalog entry
  and a `src/api/CLAUDE.md` entry for both modules.
- **`vite.config.js`** — §4 asked whether these files need the
  `vs-team-splits.json` treatment. They do: a 3-day sample is already 6–24 KB
  per club, so a full season across 30 clubs is far past the point of belonging
  on every install, and a user browsing one club's rail needs exactly one file.
  Excluded from precache, added to the existing NetworkFirst runtime rule.
  Confirmed post-build: `dist/data/highlights/` ships all 30 files, and the
  precache manifest (195 entries) contains none of them.
- **`scripts/check-dir-size.mjs`** *(addition)* — `scripts` 67→69 and `src/api`
  83→84. Unavoidable: both directories are already over the guard's cap and on a
  budget, and every `gen-*.mjs` / reader in this repo lives flat in those two
  directories. Raised deliberately with the reason inline, which is what the
  guard asks for.
- **`test/highlights-classify.test.js`** *(addition)* — 16 cases over the pure
  layer, fixtures shaped from real live items: the id coercion, the `guid ?? id`
  fallback, the reel-family resolution, significance priority ordering, and one
  case per excluded category using its actual headline.
- **`public/data/highlights/*.json`** — the 30 team files from the verification
  run are committed. They're genuine generator output and give issues 03/04 real
  data to build against; the nightly job and the backfill both append to them.

### Verification plan — all five steps run

1. **Live spot check** — done first, as instructed; see above. §1's field names
   confirmed, two differences found and resolved with Gary before any other code
   was written.
2. **`gen-highlights.mjs` over a real window** — `--since=2026-07-28
   --until=2026-07-30`: 599 clips from 41 clipped games into 30 team files, all
   valid JSON. Manual check of one clip against the raw `content` response for
   its game (gamePk 824568, "Fernando Cruz induces double play to escape 10th"):
   file says `teamId 147 / category pitching / significance wow / playerId
   518585`; raw says `team_id 147 (New York Yankees)`, `player_id 518585
   (Fernando Cruz)`, taxonomy `pitching, highlight, in-game-highlight, ..., wow`.
   Poster URL and HLS URL both matched real entries in the raw payload. (This
   clip is also a live confirmation that filing per-clip `team_id` handles a
   trade correctly — Cruz's clip files under the Yankees, not the Reds.)
3. **Idempotency** — second run over the same window: **30/30 files
   byte-identical** apart from `generatedAt`, `+0 new game rows`.
4. **Blocklist** — seeded two real entries, one guid-keyed and one slug-keyed
   (a clip with no guid, which is the case the draft would have broken).
   Re-run: 599 → 597, both absent from their team files. Restored the empty
   blocklist and re-ran: back to 599, confirming a removed entry self-heals on
   the next sweep of that game.
5. **`npm test` / `npm run lint` / `npm run build`** — all exit 0 (1,467 unit
   tests; lint includes the raised dir-size budgets; build clean).

### Spoiler audit checklist

- [x] `classifyHighlight`/`isEligibleForPositiveFilter` are pure and reach no
      component — grepped: imported only by `src/api/highlights.js` itself,
      `scripts/lib/highlights.mjs`, and the test file. No `.jsx` importer.
- [x] Generator scans `Final` only — `abstractGameState !== 'Final'` skips, in
      both scripts, so an in-progress game's clips can't enter a file.
- [x] Written team JSON leaks nothing about a game not in the file — shape is
      `{ teamId, generatedAt, games: [{ gamePk, date, clips: [...] }] }`. No
      team-level aggregate, no counts, no schedule. A clip's stored fields are
      `clipId, guid, playerId, category, significance, title, duration, poster,
      playbacks` and nothing else; the raw item's `description` narrates the
      score ("extending the Brewers' lead to 4-2") and is deliberately NOT
      stored, since no rail asked for it.

### Left for issues 02–04 / worth knowing

- **Rail ordering has no magnitude signal to work with.** 441 of 599 clips carry
  no `significance` at all, and the tags that do appear are dominated by the
  once-a-game reel markers. The PRD already flagged this; the live numbers
  confirm chronological is the only honest default.
- **`highlightPoster` is new** and issue 02's box-score poster (tracked as a
  follow-up against the ORIGINAL video-highlights feature, per the PRD) can use
  it as-is rather than resolving cuts by hand.
- **No backfill has been run.** `gen-highlights-backfill.mjs` is written and
  ready but is a ~2,430-game crawl for a full season; running it is a deliberate,
  hand-triggered step, and the rails will look sparse until it happens.
- The four clips per window with no `playerId` (team-level plays like "Pirates'
  around-the-horn double play") land on a team rail but never a player rail.
  That falls out correctly; worth not treating as a bug in issue 04.

## Comments

2026-08-18: Closed out during issue-tracker triage — this shipped (highlights-cascade PRs #586-589, #601: src/api/highlights.js, HighlightSheet.jsx, ModalPortal.jsx, HighlightClipCard.jsx, Team/PlayerHighlightsRail all present in src/). No GitHub issue needed.
