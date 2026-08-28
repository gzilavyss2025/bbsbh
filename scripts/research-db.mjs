#!/usr/bin/env node
// research-db.mjs — a local, research-only DuckDB query layer over the JSON
// panels the research diaries (Contender Diary, prospect-research) already
// write under .scratch/ and public/data/.
//
// This is a dev tool. It never runs in the shipped app and it never copies
// data: every view below is a live SQL wrapper around read_json_auto()
// pointed straight at the JSON file on disk. The JSON stays the source of
// truth; DuckDB only makes it queryable with SQL joins instead of ad hoc
// Node scripts that re-read and re-parse the same files spike after spike.
//
// Run it directly:
//   node scripts/research-db.mjs
// It (re)builds every view in .scratch/research.duckdb and prints a smoke
// test: a real join between two Contender Diary panels on (year, teamId).
//
// To query interactively from another script, open the same file:
//   import { DuckDBInstance } from '@duckdb/node-api';
//   const instance = await DuckDBInstance.create('.scratch/research.duckdb');
//   const conn = await instance.connect();
//   const rows = await conn.runAndReadAll('SELECT * FROM team_success_outcome_ladder_by_team LIMIT 5');
// The DuckDB CLI (if installed) can also open that file directly — the view
// definitions carry absolute paths, so they resolve the same way regardless
// of the caller's working directory.
//
// ---------------------------------------------------------------------
// Package choice: @duckdb/node-api (not the older `duckdb` package).
// DuckDB's own docs (docs/clients/node_neo) and its README call the old
// `duckdb` npm bindings deprecated: the last release for `duckdb` targets
// DuckDB 1.4.x, with no 1.5.x release planned. @duckdb/node-api is the
// actively published, officially recommended replacement — native Promises,
// no need for the separate duckdb-async wrapper. Both are MIT-licensed;
// DuckDB itself is MIT-licensed, embedded, no server, no account.
// ---------------------------------------------------------------------
//
// Why persist to disk (.scratch/research.duckdb) instead of :memory:?
// A DuckDB VIEW stores its SQL text, not a snapshot — read_json_auto still
// re-reads the JSON file fresh on every query. Persisting the catalog costs
// nothing but the (sub-second) time to run this script, and it means a
// future session — or the plain `duckdb` CLI — can open the .duckdb file
// and start querying without re-running this loader. The file is a rebuilt
// artifact (like a lockfile's resolution, not like the JSON it reads), so
// it is git-ignored; re-run this script any time the panel set changes.
//
// How each panel becomes a view (generic, not hand-written per file):
//   1. DESCRIBE the panel's `read_json_auto(path)` shape.
//   2. If it is a bare top-level dict (one column, MAP-typed — DuckDB
//      infers MAP once an object passes ~200 distinct keys, which every
//      id-keyed cache here does) the view IS the flattened table: one row
//      per key, its struct fields expanded to columns.
//   3. If it is a bare top-level array of scalars (one column, not a MAP,
//      e.g. a JSON array of ints), the view exposes that column as `value`.
//   4. Otherwise (a metadata-wrapped object, or a plain array of records)
//      the view is the row shape read_json_auto already gives — one row
//      per array element, or one row of typed columns for a wrapper
//      object. Any MAP-typed column found inside it (there can be more
//      than one, e.g. war.json's four leaderboards) also gets its own
//      `<view>__<column>` flattened companion view, via the same rule
//      as step 2.
// This covers every panel without guessing a bespoke schema for each one.
// It does NOT recurse more than one map level deep (a map-of-maps stays a
// map value in the flattened row) — good enough for ad hoc research SQL;
// go bespoke with an explicit read_json() schema, per DuckDB's own advice,
// if a specific panel needs full normalization.
//
// The two exceptions are hand-written with an explicit read_json() schema:
// outcome-ladder.json and roster-age.json both nest a team-keyed object
// *inside* each season, and that inner object has only ~30 keys — under
// DuckDB's MAP-inference threshold, so auto-detection would keep it a
// wide STRUCT (one field per team id) instead of rows. Forcing the schema
// is exactly the case the DuckDB docs call out for explicit read_json().
// These two views share a (year, teamId) key and are the smoke-test join.

import { DuckDBInstance } from '@duckdb/node-api';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DB_PATH = join(REPO_ROOT, '.scratch', 'research.duckdb');

// Every cataloged panel: [relative path (globs allowed), notes].
// Two entries use a glob instead of a literal filename because their
// on-disk name carries a date stamp or lives in a sharded directory; a
// glob keeps the view valid as those files are regenerated or added to.
const PANEL_PATHS = [
  '.scratch/team-success/outcome-ladder.json',
  '.scratch/team-success/roster-age.json',
  '.scratch/team-success/roster-age-cache.json',
  '.scratch/team-success/postseason-experience.json',
  '.scratch/team-success/postseason-usage.json',
  '.scratch/team-success/postseason-boxscore-cache.json',
  '.scratch/team-success/prior-postseason-cache.json',
  '.scratch/team-success/october-texture-findings.json',
  '.scratch/team-success/roster-age-deadline.json',
  '.scratch/team-success/roster-age-deadline-cache.json',
  '.scratch/team-success/trade-deadline-panel.json',
  '.scratch/team-success/tenure-lag-panel.json',
  '.scratch/team-success/mlb-field-cache.json',
  '.scratch/team-success/milb-field-cache.json',
  '.scratch/team-success/exit-reason-mix.json',
  '.scratch/team-success/exit-reason-mix-findings.json',
  '.scratch/level-benchmarks/raw.json',
  '.scratch/level-benchmarks/dates.json',
  '.scratch/level-benchmarks/homegrown-cohort.json',
  '.scratch/level-benchmarks/homegrown-panel.json',
  '.scratch/level-benchmarks/milb-cohort-cache.json',
  '.scratch/level-benchmarks/milb-mlb-cache.json',
  '.scratch/level-benchmarks/perf-pool.json',
  '.scratch/level-benchmarks/draft-cache.json',
  '.scratch/level-benchmarks/attendance-cache.json',
  '.scratch/level-benchmarks/standings-cache.json',
  '.scratch/level-benchmarks/teamstats-cache.json',
  '.scratch/level-benchmarks/context-panel.json',
  '.scratch/level-benchmarks/homegrown-outcomes.json',
  '.scratch/level-benchmarks/homegrown-duration-model.json',
  '.scratch/level-benchmarks/homegrown-winning.json',
  '.scratch/level-benchmarks/homegrown-precheck.json',
  '.scratch/level-benchmarks/team-windows.json',
  '.scratch/level-benchmarks/orgmap-ext.json',
  '.scratch/level-benchmarks/orgmap-wide.json',
  '.scratch/level-benchmarks/era-hump.json',
  '.scratch/level-benchmarks/org-regression.json',
  '.scratch/level-benchmarks/org-timing.json',
  '.scratch/level-benchmarks/org-variance-components.json',
  '.scratch/level-benchmarks/findings.json',
  '.scratch/prospect-traits/bio.json',
  '.scratch/prospect-traits/awards.json',
  '.scratch/prospect-traits/mlb.json',
  '.scratch/prospect-traits/arsenal.json',
  '.scratch/prospect-traits/league.json',
  '.scratch/prospect-traits/award-catalog.json',
  '.scratch/prospect-traits/q1-rookie-traits.json',
  '.scratch/prospect-traits/q2-size.json',
  '.scratch/prospect-traits/q3-pitchers.json',
  '.scratch/prospect-traits/q5-final-four.json',
  '.scratch/blockage/incumbent-ids.json',
  '.scratch/blockage/incumbent-bio.json',
  '.scratch/blockage/exits.json',
  '.scratch/blockage/deepen.json',
  '.scratch/blockage/confound.json',
  '.scratch/blockage/check.json',
  '.scratch/blockage/findings.json',
  'public/data/postseason-history.json',
  'public/data/rookies.json',
  'public/data/war.json',
  'public/data/war-history/*.json', // sharded directory, not one file
  'public/data/all-star-rosters.json',
  'public/data/awards-history.json',
  '.scratch/game-notes/insights/verdicts-*.json', // filename carries a date stamp
  // Extension-value spike (W3.3, docs/contracts-extension-value.md): a
  // season-by-season price-of-a-win panel derived from free_agency.csv, and
  // the extensions.csv outcomes it prices.
  '.scratch/contracts-extensions/fa-war-price.json',
  '.scratch/contracts-extensions/extension-outcomes.json',
  // Historical contract identity crosswalk (scripts/gen-contracts-identity.mjs):
  // one row per source-CSV row, keyed on real MLB id like every panel above.
  // A row with no confident id has mlbId = null, confidence != 'exact'/'fuzzy'
  // -- see docs/adr/0066-a-contract-row-with-no-confident-id-stays-unresolved.md.
  'public/data/contracts-history/identity/extensions.json',
  'public/data/contracts-history/identity/arbitration.json',
  'public/data/contracts-history/identity/free_agency.json',
  'public/data/contracts-history/identity/salaries.json',
  // The season-players candidate pool itself (scripts/gen-contracts-season-players.mjs)
  // -- sharded one file per season, same glob pattern as war-history above.
  'public/data/contracts-history/season-players/*.json',
  // The dollar terms behind each identity row above (scripts/gen-contracts-shards.mjs):
  // one row per rowKey, keyed the same way -- sharded per source file, same glob
  // pattern as war-history and season-players above.
  'public/data/contracts-history/terms/*.json',
  // Per-player shards of the same rows, grouped by personId instead of rowKey
  // (scripts/gen-contracts-shards.mjs) -- sharded across 100 files, same glob
  // pattern as war-history and season-players above.
  // KNOWN ISSUE: all 100 shards hold a term field that mixes a number and
  // a free-text value in the same shard (e.g. "non-tendered",
  // "1 y/$2.325+opt") -- term: 100 shards, club_offer: 78, settled_salary:
  // 65, player_request: 8. DuckDB's nested-struct auto-detection infers
  // those fields as numeric, so the view registers but a full scan of its
  // flattened companion view (*__players) throws a cast error. Deferred:
  // this needs a hand-written schema, the same way
  // registerOutcomeLadderByTeam/registerRosterAgeByTeam already do for
  // their panels. Do not add one here without a decision; see
  // docs/agents/research-database.md.
  'public/data/contracts-history/player/*.json',
];

function viewNameFor(relPath) {
  let p = relPath.replace(/\\/g, '/');
  p = p.replace(/\.json$/, '');
  p = p.replace(/^\.scratch\//, '');
  p = p.replace(/^public\/data\//, 'public_');
  p = p.replace(/[^a-zA-Z0-9]+/g, '_');
  p = p.replace(/^_+|_+$/g, '');
  return p.toLowerCase();
}

function absPath(relPath) {
  return join(REPO_ROOT, relPath).replace(/\\/g, '/');
}

// DuckDB's JSON reader caps a single parsed object at 16 MB by default.
// A couple of panels here (level-benchmarks/raw.json, prospect-traits/mlb.json)
// are one big top-level object past that, so raise the cap for every read —
// harmless for the small panels, required for the large ones.
const MAX_JSON_OBJECT_BYTES = 200 * 1024 * 1024; // 200 MB

function quoteIdent(name) {
  return `"${name.replace(/"/g, '""')}"`;
}

// Build the SQL that turns one MAP-typed column into one row per key,
// with the value's struct fields expanded to columns where possible.
function flattenMapColumnSql(fromExpr, colName, mapType) {
  const col = quoteIdent(colName);
  const valueType = mapType.replace(/^MAP\(VARCHAR,\s*/i, '').replace(/\)$/, '');
  const base = `(SELECT unnest(map_keys(${col})) AS key, unnest(map_values(${col})) AS v FROM ${fromExpr}) t1`;
  if (/^STRUCT\(.*\)\[\]$/.test(valueType)) {
    // key -> list of records (e.g. a roster): one row per record, still tagged with the key.
    return `SELECT key, item.* FROM (SELECT key, unnest(v) AS item FROM ${base}) t2`;
  }
  if (/^STRUCT\(.*\)$/.test(valueType)) {
    // key -> one record: expand it to columns directly.
    return `SELECT key, v.* FROM ${base}`;
  }
  // key -> a scalar (or a still-nested map/list) — leave the value as-is.
  return `SELECT key, v AS value FROM ${base}`;
}

// Register one panel as one or more views. Returns the view names created.
async function registerPanel(conn, relPath) {
  const name = viewNameFor(relPath);
  const src = `read_json_auto('${absPath(relPath)}', maximum_object_size = ${MAX_JSON_OBJECT_BYTES})`;
  const desc = await conn.runAndReadAll(`DESCRIBE SELECT * FROM ${src}`);
  const cols = desc.getRowObjectsJson();
  const mapCols = cols.filter((c) => c.column_type.startsWith('MAP('));

  if (cols.length === 1 && mapCols.length === 1) {
    // The whole file is one big id-keyed dict — the view IS the tidy table.
    const sql = flattenMapColumnSql(src, cols[0].column_name, cols[0].column_type);
    await conn.run(`CREATE OR REPLACE VIEW ${name} AS ${sql}`);
    return [name];
  }

  if (cols.length === 1 && mapCols.length === 0) {
    // A top-level JSON array of scalars — expose the lone column as `value`.
    await conn.run(
      `CREATE OR REPLACE VIEW ${name} AS SELECT ${quoteIdent(cols[0].column_name)} AS value FROM ${src}`
    );
    return [name];
  }

  // General case: a metadata-wrapped object, or an array of records that is
  // already tidy. Keep it as read_json_auto shapes it.
  await conn.run(`CREATE OR REPLACE VIEW ${name} AS SELECT * FROM ${src}`);
  const created = [name];
  for (const c of mapCols) {
    const flatName = `${name}__${viewNameFor(c.column_name + '.json')}`;
    const sql = flattenMapColumnSql(name, c.column_name, c.column_type);
    await conn.run(`CREATE OR REPLACE VIEW ${flatName} AS ${sql}`);
    created.push(flatName);
  }
  return created;
}

// The two explicit-schema exceptions: each nests a team-keyed object
// (only ~30 keys — under DuckDB's MAP-inference threshold) inside a
// season record, so auto-detection alone would leave "teams" as a wide
// per-team-id STRUCT instead of unnestable rows. Force the schema.
async function registerOutcomeLadderByTeam(conn) {
  const path = absPath('.scratch/team-success/outcome-ladder.json');
  const schema = `{
    generatedAt: 'TIMESTAMP',
    source: 'VARCHAR',
    ladderKey: 'MAP(VARCHAR, VARCHAR)',
    seasons: 'STRUCT(
      year BIGINT, era VARCHAR, shortSeason BOOLEAN, championTeamId BIGINT,
      teams MAP(VARCHAR, STRUCT(
        madePostseason BOOLEAN, seed BIGINT, wonDivision BOOLEAN,
        furthestRound VARCHAR, ladder BIGINT, wonAnyRound BOOLEAN
      ))
    )[]'
  }`;
  await conn.run(`
    CREATE OR REPLACE VIEW team_success_outcome_ladder_by_team AS
    SELECT
      s.year AS year,
      t.key::INTEGER AS teamId,
      t.value.madePostseason AS madePostseason,
      t.value.seed AS seed,
      t.value.wonDivision AS wonDivision,
      t.value.furthestRound AS furthestRound,
      t.value.ladder AS ladder,
      t.value.wonAnyRound AS wonAnyRound
    FROM (
      SELECT UNNEST(seasons) AS s
      FROM read_json('${path}', columns = ${schema}, maximum_object_size = ${MAX_JSON_OBJECT_BYTES})
    ) sq, UNNEST(map_entries(s.teams)) AS tq(t)
  `);
}

async function registerRosterAgeByTeam(conn) {
  const path = absPath('.scratch/team-success/roster-age.json');
  const schema = `{
    generatedAt: 'TIMESTAMP',
    source: 'VARCHAR',
    method: 'VARCHAR',
    seasons: 'STRUCT(
      year BIGINT, leagueBattingAge DOUBLE, leaguePitchingAge DOUBLE,
      teams MAP(VARCHAR, STRUCT(
        battingAge DOUBLE, battingPA BIGINT, battingN BIGINT,
        pitchingAge DOUBLE, pitchingIP DOUBLE, pitchingN BIGINT,
        battingAgeRelative DOUBLE, pitchingAgeRelative DOUBLE
      ))
    )[]'
  }`;
  await conn.run(`
    CREATE OR REPLACE VIEW team_success_roster_age_by_team AS
    SELECT
      s.year AS year,
      t.key::INTEGER AS teamId,
      t.value.battingAge AS battingAge,
      t.value.battingPA AS battingPA,
      t.value.pitchingAge AS pitchingAge,
      t.value.pitchingIP AS pitchingIP,
      t.value.battingAgeRelative AS battingAgeRelative,
      t.value.pitchingAgeRelative AS pitchingAgeRelative
    FROM (
      SELECT UNNEST(seasons) AS s
      FROM read_json('${path}', columns = ${schema}, maximum_object_size = ${MAX_JSON_OBJECT_BYTES})
    ) sq, UNNEST(map_entries(s.teams)) AS tq(t)
  `);
}

async function buildAllViews(conn, { verbose = false } = {}) {
  const allViews = [];
  for (const relPath of PANEL_PATHS) {
    try {
      const created = await registerPanel(conn, relPath);
      allViews.push(...created.map((v) => [v, relPath]));
      if (verbose) console.log(`  ${relPath} -> ${created.join(', ')}`);
    } catch (err) {
      console.error(`  FAILED: ${relPath} -> ${err.message}`);
    }
  }
  await registerOutcomeLadderByTeam(conn);
  await registerRosterAgeByTeam(conn);
  allViews.push(
    ['team_success_outcome_ladder_by_team', '.scratch/team-success/outcome-ladder.json (explicit schema, team-season grain)'],
    ['team_success_roster_age_by_team', '.scratch/team-success/roster-age.json (explicit schema, team-season grain)']
  );
  return allViews;
}

async function openResearchDb() {
  if (!existsSync(dirname(DB_PATH))) mkdirSync(dirname(DB_PATH), { recursive: true });
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();
  return { instance, conn };
}

async function main() {
  console.log(`Building research views in ${DB_PATH} ...`);
  const { conn } = await openResearchDb();
  const views = await buildAllViews(conn, { verbose: true });
  console.log(`\n${views.length} views registered over ${PANEL_PATHS.length} cataloged panels.\n`);

  console.log('--- Smoke test: outcome-ladder JOIN roster-age on (year, teamId) ---');
  console.log('(2023 season, first 5 teams by teamId)\n');
  const reader = await conn.runAndReadAll(`
    SELECT
      o.year,
      o.teamId,
      o.madePostseason,
      o.seed,
      o.ladder,
      ROUND(r.battingAge, 2) AS battingAge,
      ROUND(r.pitchingAge, 2) AS pitchingAge,
      ROUND(r.battingAgeRelative, 3) AS battingAgeRelativeToLeague
    FROM team_success_outcome_ladder_by_team o
    JOIN team_success_roster_age_by_team r
      ON o.year = r.year AND o.teamId = r.teamId
    WHERE o.year = 2023
    ORDER BY o.teamId
    LIMIT 5
  `);
  console.table(reader.getRowObjectsJson());

  conn.closeSync();
  console.log(`\nDone. Reopen this database any time with:\n  DuckDBInstance.create('${DB_PATH.replace(/\\/g, '/')}')`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
