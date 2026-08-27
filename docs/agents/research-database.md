# The research database

A local, embedded DuckDB layer over the JSON panels the research diaries
already write. It is a query convenience, not a new data source: it never
copies data, and it changes nothing about the app's architecture.

**This never touches the shipped app.** The root `CLAUDE.md` describes the
app's game-data path: every device queries `statsapi.mlb.com` directly. This
tool runs on one machine, at dev time, by hand. It never runs in the shipped
app, never runs in CI, and never runs on
Vercel. The JSON files under `.scratch/` and `public/data/` stay the one
source of truth; DuckDB only makes them queryable with SQL joins instead of
a fresh Node script that re-reads and re-parses the same files on every
spike.

## Why it exists

The Contender Diary (`docs/agents/contender-diary.md`,
`docs/team-success-research.md`) and the prospect-research diary
(`docs/agents/research-diary.md`) both write precomputed panel files per
spike — team-season or player-season grain — under `.scratch/`. A later
spike often needs an earlier spike's panel too, and until now that meant
writing another one-off Node script to read and join the JSON by hand. This
tool makes that reuse structural: one catalog of what panels exist, and one
real SQL join layer over all of them.

## Where it lives and how to run it

The loader is `scripts/research-db.mjs`. Run it directly:

```
node scripts/research-db.mjs
```

It (re)builds every cataloged view in `.scratch/research.duckdb` and prints
a smoke test — a real join between two Contender Diary panels. The command
is idempotent: every view is `CREATE OR REPLACE`, so running it again after
a panel changes just picks up the new data.

The database file is derived, not authored — it stores view definitions
only, no copied rows, and it rebuilds from the JSON in under a second. It is
git-ignored, the same way other rebuildable `.scratch` caches are. Re-run
the loader after pulling a branch that changed a panel.

**To query interactively**, open the same file from a script or the `duckdb`
CLI:

```js
import { DuckDBInstance } from '@duckdb/node-api';
const instance = await DuckDBInstance.create('.scratch/research.duckdb');
const conn = await instance.connect();
const rows = await conn.runAndReadAll('SELECT * FROM team_success_outcome_ladder_by_team LIMIT 5');
```

View definitions carry absolute paths, so a query resolves the same way no
matter what directory the caller runs from.

**Package**: `@duckdb/node-api` (a devDependency), not the older `duckdb`
package — DuckDB's own docs mark `duckdb` deprecated. Both are MIT-licensed,
embedded, no server, no account, same as DuckDB itself.

## What the catalog covers

56 cataloged panels become 69 views, spanning every panel the Contender
Diary, the prospect-research diary, and the blockage-exit-reason spike have
produced, plus the public leaderboard files those spikes joined against
(`public/data/war.json`, `rookies.json`, `war-history/*.json`, and more).
The full, current list of paths is the `PANEL_PATHS` array at the top of
`scripts/research-db.mjs` — read that array before this document; it is the
one place the list cannot drift out of date.

Most panels need no hand-written schema. A small generic rule decides the
shape: a bare id-keyed dict collapses to one row per key; a bare scalar
array becomes a `value` column; anything else keeps its natural
`read_json_auto` shape, with any nested id-keyed dict inside it flattened
into a `<view>__<column>` companion view. Two panels needed an explicit,
hand-written schema instead — `outcome-ladder.json` and `roster-age.json`
each nest a team-keyed object inside a season record, too small (about 30
keys) for DuckDB to infer as a map on its own. Their views,
`team_success_outcome_ladder_by_team` and `team_success_roster_age_by_team`,
are the smoke-test join.

## Before a new spike re-pulls statsapi: check the catalog first

**This is the point of the tool.** Before writing a new script that fetches
from `statsapi.mlb.com` for a panel a spike needs, check whether the panel
already exists:

1. Run `node scripts/research-db.mjs` and read the printed view list, or
   open `.scratch/research.duckdb` with the `duckdb` CLI and run
   `SHOW TABLES`.
2. Skim `PANEL_PATHS` in `scripts/research-db.mjs` for a file that already
   holds the season, team, or player grain you need.
3. If a close match exists, query it — a `JOIN` across two existing views is
   almost always cheaper than a new statsapi pull, and it avoids drifting
   from data another spike already validated.

A pull from statsapi is still the right call when no existing panel covers
the question, or when the question needs a freshness the cached panel does
not have. The catalog only removes the *needless* repeat pull — check it
before assuming one is needed.

## Adding a new panel

When a spike produces a JSON panel worth keeping for later reuse:

1. Add its path to `PANEL_PATHS` in `scripts/research-db.mjs`. Use a glob
   (`some-dir/*.json`) if the file is sharded or its name carries a date
   stamp — two entries already do this, and the comment beside each one
   explains why.
2. Run `node scripts/research-db.mjs` and confirm it registers with no
   error. Most panels need nothing else.
3. If the new panel nests a keyed object with roughly 30 or fewer keys — too
   few for DuckDB to infer a `MAP` on its own — write an explicit schema
   function, following `registerOutcomeLadderByTeam` in the same file as
   the template.
4. Update this document's panel count if it changed by a round number worth
   noting; the authoritative list stays the `PANEL_PATHS` array itself.
