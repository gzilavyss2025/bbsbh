# A local DuckDB layer queries the research JSON — it never touches the shipped app

Two research programs — the Contender Diary (`docs/agents/contender-diary.md`)
and the prospect-research diary (`docs/agents/research-diary.md`) — each write
precomputed panel files under `.scratch/` per spike, at team-season or
player-season grain. A later spike often needs an earlier spike's panel, and
until now that meant a fresh one-off Node script to read and merge the JSON
by hand, every time. `scripts/research-db.mjs` fixes the *reuse* problem, not
the storage problem: it registers every cataloged panel as a DuckDB view over
`read_json_auto()`, so a new spike starts from a SQL `JOIN` instead of another
hand-rolled merge.

## Why this never touches the shipped app

Root `CLAUDE.md` describes the shipped app's game-data path: every device
queries `statsapi.mlb.com` directly. This tool never touches that path:

- **It never runs in the shipped app.** No import from `src/`, no build
  step, no Vercel function, no CI job. It is a script a developer runs by
  hand, on their own machine, at dev time.
- **It copies no data.** Every view is `read_json_auto()` pointed at the
  JSON file on disk. The file stays the one source of truth; DuckDB
  re-reads it fresh on every query.
- **The catalog database is a rebuilt artifact, not a store.** It holds view
  definitions only, rebuilds in under a second, and is git-ignored — the
  same treatment other rebuildable `.scratch` caches already get.

## Package choice: `@duckdb/node-api`, not `duckdb`

DuckDB's own docs and its README mark the older `duckdb` npm package
deprecated — its last release targets DuckDB 1.4.x, with no 1.5.x planned.
`@duckdb/node-api` is the actively published, officially recommended
replacement (native Promises, no `duckdb-async` wrapper needed). Both are
MIT-licensed. Installed as a devDependency: nothing about the production
bundle changes.

## Scope

56 cataloged panels, 69 views: every panel the Contender Diary, the
prospect-research diary, and the blockage-exit-reason spike have produced,
plus the public leaderboard files those spikes already join against. A
generic rule decides most views' shape (an id-keyed dict becomes one row per
key; a scalar array becomes a `value` column); two panels needed an
explicit, hand-written schema because their nested keyed object is too small
for DuckDB to infer as a map on its own. `docs/agents/research-database.md`
is the full write-up: where the loader lives, the run command, and the
instruction that matters most — check the catalog before a new spike
re-pulls statsapi for a panel that already exists.

## Consequences

- A future research program — not just these two diaries — can register its
  own panels here rather than building a parallel join layer.
- The JSON panels are still what a generator writes and what a diary entry
  cites. DuckDB is read-only convenience on top, never a rewrite target.
- No spoiler surface: every cataloged panel is season-grain research data,
  none of it a live score, and nothing here renders to a reader.
