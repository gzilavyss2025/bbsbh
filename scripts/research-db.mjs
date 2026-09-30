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
// This is the FIRST thing a research spike opens (#1117). Before a spike pulls
// anything from statsapi, read the catalog in docs/agents/research-database.md
// and query what exists. Flags:
//   node scripts/research-db.mjs --sql "SELECT ... FROM <view> LIMIT 5"
//   node scripts/research-db.mjs --markdown    # the view list, with row counts
//   node scripts/research-db.mjs --uncovered   # tracked JSON that is not a view
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

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DB_PATH = join(REPO_ROOT, '.scratch', 'research.duckdb');

// The lists live in scripts/data/research-db-panels.json, not here: this file
// hit the 600-line size guard when the catalog grew. That file holds
//   panels  every tracked JSON that becomes a view (a glob reads many files as
//           one view; a sharded directory or a dated name needs one),
//   unnest  the array columns that also get a `<view>__<column>` view,
//   skipped tracked JSON that is deliberately NOT a view, with the reason,
//   notes   why a panel is shaped the way it is.
// docs/agents/research-database.md is the catalog a person reads.
const LISTS = JSON.parse(readFileSync(join(REPO_ROOT, 'scripts', 'data', 'research-db-panels.json'), 'utf8'));
export const PANEL_PATHS = LISTS.panels;
export const UNNEST_COLUMNS = LISTS.unnest;
export const SKIPPED = LISTS.skipped;

// Panels whose money fields mix numbers and free text ("forfeited",
// "non-tendered"). By default DuckDB types a field from a few rows of the first
// 32 files, guesses a number, and the view then throws on the first text value.
// sample_size = -1 with a high maximum_sample_files reads every row of every
// file first, so a mixed field is typed JSON. Found by #1117: a full scan of the
// terms view threw on salaries-54.json before this.
const FULL_SCAN = new Set(['public/data/contracts-history/terms/*.json']);

// A glob's own text would leak into the view name (`20*.json` gives
// `public_trade_deadline_20`), so a glob that needs a clean name gets one here.
const VIEW_NAMES = {
  'public/data/trade-deadline/20*.json': 'public_trade_deadline',
};

function viewNameFor(relPath) {
  if (VIEW_NAMES[relPath]) return VIEW_NAMES[relPath];
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
  const extra = FULL_SCAN.has(relPath) ? ', sample_size = -1, maximum_sample_files = 100000' : '';
  const src = `read_json_auto('${absPath(relPath)}', maximum_object_size = ${MAX_JSON_OBJECT_BYTES}${extra})`;
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
  for (const col of UNNEST_COLUMNS[relPath] ?? []) {
    const arrName = `${name}__${col.toLowerCase()}`;
    await conn.run(
      `CREATE OR REPLACE VIEW ${arrName} AS SELECT u.* FROM (SELECT unnest(${quoteIdent(col)}) AS u FROM ${name})`
    );
    created.push(arrName);
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

// CREATE OR REPLACE never removes a view whose path left PANEL_PATHS, so a
// database built from an older list kept dead views (#1117 saw one). Drop every
// view first: the file holds view definitions only, so nothing is lost.
async function dropAllViews(conn) {
  const reader = await conn.runAndReadAll('SELECT view_name FROM duckdb_views() WHERE NOT internal');
  for (const { view_name } of reader.getRowObjectsJson()) {
    await conn.run(`DROP VIEW IF EXISTS ${quoteIdent(view_name)} CASCADE`);
  }
}

export async function buildAllViews(conn, { verbose = false } = {}) {
  await dropAllViews(conn);
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
  // Imported here, not at the top, so a test can import PANEL_PATHS and
  // SKIPPED without loading the DuckDB native binding.
  const { DuckDBInstance } = await import('@duckdb/node-api');
  const instance = await DuckDBInstance.create(DB_PATH);
  const conn = await instance.connect();
  return { instance, conn };
}

// Does a tracked path match a PANEL_PATHS entry (literal or glob)?
export function globToRegExp(glob) {
  return new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
}

export function isRegistered(path, panelPaths = PANEL_PATHS) {
  return panelPaths.some((p) => (p.includes('*') ? globToRegExp(p).test(path) : p === path));
}

export function isSkipped(path, skipped = SKIPPED) {
  return skipped.some(([p]) => (p.endsWith('/') ? path.startsWith(p) : p === path));
}

// Tracked JSON under .scratch/ and public/data/ that is neither a view nor on
// the skip list. New research output shows up here until someone triages it.
function listUncovered() {
  const out = execFileSync('git', ['ls-files', '--', '.scratch', 'public/data'], {
    cwd: REPO_ROOT,
    maxBuffer: 64 * 1024 * 1024,
  }).toString();
  return out
    .split('\n')
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !isRegistered(f) && !isSkipped(f));
}

// One Markdown table row per view, from a real build. Row counts are counted,
// not guessed. Use it to check the catalog in docs/agents/research-database.md.
async function printMarkdown(conn, views) {
  console.log('| View | Source | Rows |');
  console.log('| --- | --- | --- |');
  for (const [view, src] of views) {
    let rows = 'error';
    try {
      const r = await conn.runAndReadAll(`SELECT count(*) AS n FROM ${quoteIdent(view)}`);
      rows = String(r.getRowObjectsJson()[0].n);
    } catch (err) {
      rows = `error: ${err.message.split('\n')[0].slice(0, 60)}`;
    }
    console.log(`| \`${view}\` | \`${src}\` | ${rows} |`);
  }
}

const USAGE = `Usage: node scripts/research-db.mjs [flag]
  (none)           rebuild every view and run the smoke join
  --sql "<query>"  rebuild, then run one SQL query and print the rows
  --markdown       rebuild, then print the view list as a Markdown table
  --uncovered      list tracked JSON that is neither a view nor skipped (no build)
Catalog and rules: docs/agents/research-database.md`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return;
  }
  if (args.includes('--uncovered')) {
    const un = listUncovered();
    console.log(un.length ? un.join('\n') : 'Nothing uncovered: every tracked JSON is a view or is skipped.');
    console.log(`\n${un.length} uncovered file(s).`);
    return;
  }
  const sqlAt = args.indexOf('--sql');
  if (sqlAt !== -1) {
    const query = args[sqlAt + 1];
    if (!query) {
      console.error('--sql needs a query string.\n\n' + USAGE);
      process.exitCode = 2;
      return;
    }
    const { conn } = await openResearchDb();
    await buildAllViews(conn);
    const reader = await conn.runAndReadAll(query);
    console.table(reader.getRowObjectsJson());
    conn.closeSync();
    return;
  }
  if (args.includes('--markdown')) {
    const { conn } = await openResearchDb();
    const views = await buildAllViews(conn);
    await printMarkdown(conn, views);
    conn.closeSync();
    return;
  }

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

// Run only when invoked as a script, so a test can import the lists above.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
