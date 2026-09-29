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
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const DB_PATH = join(REPO_ROOT, '.scratch', 'research.duckdb');

// Every cataloged panel: [relative path (globs allowed), notes].
// Two entries use a glob instead of a literal filename because their
// on-disk name carries a date stamp or lives in a sharded directory; a
// glob keeps the view valid as those files are regenerated or added to.
export const PANEL_PATHS = [
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
  '.scratch/team-success/free-agency-market.json',
  '.scratch/team-success/free-agency-market-findings.json',
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
  // The service-clock spike (docs/service-time-debut-clock.md). panel.json is
  // one row per major-league debut 2005-2025 with the season's service line,
  // the wire-resolved roster-add date and the roster-need counts beside it.
  // The 47MB transaction wire it was built from is git-ignored and is not
  // cataloged; rebuild it with .scratch/service-clock/pull.mjs.
  '.scratch/service-clock/panel.json',
  '.scratch/service-clock/controls.json',
  '.scratch/service-clock/k0-blank-rate.json',
  // Historical Top Prospects lists, from TWO publications
  // (.scratch/top-prospects-history/pull.mjs for 2009-2024, pull-ba.mjs for
  // 2005-2008, #946): rows.json is one row per (season, rank, mlbId), 2005-
  // 2024 -- mlbId joins directly to prospect-traits/bio.json above, no
  // crosswalk. Every row carries a `source` field, "mlb-pipeline" or
  // "baseball-america" -- the two rankings are never pooled without checking
  // it (.scratch/prospect-value/panel.mjs filters to "mlb-pipeline" alone).
  // seasons.json is the per-season coverage record (2005-2024): status
  // ("ok"/"unavailable"), list depth, row count, fetch timestamp -- depth is
  // NOT assumed 100 (2009-2011 are top-50 lists; 2020/2021 top out at 99,
  // confirmed not a parsing gap). Deliberately a plain top-level ARRAY for
  // both files, not a {meta,rows} wrapper -- a sibling panel in this wave
  // registered that shape and it threw on every row-grain query; a bare array
  // registers as one row per element with no flattening step needed.
  '.scratch/top-prospects-history/rows.json',
  '.scratch/top-prospects-history/seasons.json',
  // What a ranking is worth in dollars (docs/prospect-ranking-value.md,
  // .scratch/prospect-value/). panel.json is one row per player in the UNION of
  // the ranked population and the 3,061-man debut cohort, carrying the rank
  // facts, the career earnings joined from salaries.csv, and `windowStatus` --
  // the flag that says whether the man's ranking window sat inside a published
  // list at all. A 2006 debut is 'censored', NOT unranked: no list exists for
  // his ranking years. Any query that compares ranked against unranked must
  // filter windowStatus = 'observed-deep' or it is measuring a data gap.
  // Same plain-ARRAY shape as rows.json above, for the same reason; the
  // metadata sits beside it in panel-meta.json rather than wrapping it.
  '.scratch/prospect-value/panel.json',
  '.scratch/prospect-value/panel-meta.json',
  '.scratch/prospect-value/bios.json',
  '.scratch/prospect-value/findings.json',
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

  // ---- Added by #1117: the panels the first catalog missed. ----
  // Contracts: the arbitration-warp spike (.scratch/contracts/).
  '.scratch/contracts/arbitration-warp-panel.json',
  '.scratch/contracts/arbitration-findings.json',
  // Level benchmarks: the org-regression variants and rechecks.
  '.scratch/level-benchmarks/era-hump-org-recheck.json',
  '.scratch/level-benchmarks/org-era-granularity.json',
  '.scratch/level-benchmarks/org-omnibus-transform-check.json',
  '.scratch/level-benchmarks/org-regression-perf.json',
  '.scratch/level-benchmarks/org-regression-transform-levels.json',
  '.scratch/level-benchmarks/org-regression-transform-log.json',
  '.scratch/level-benchmarks/org-regression-transform-sqrt.json',
  // Prospect traits: the follow-up cuts of q1, q2 and q4.
  '.scratch/prospect-traits/q1b-confounds.json',
  '.scratch/prospect-traits/q2b-size-robustness.json',
  '.scratch/prospect-traits/q4-debut-month.json',
  '.scratch/prospect-traits/q4b-month-checks.json',
  // Service clock: the rest of the spike (panel.json and controls.json are above).
  '.scratch/service-clock/debuts.json',
  '.scratch/service-clock/seasons.json',
  '.scratch/service-clock/panel-meta.json',
  '.scratch/service-clock/findings.json',
  '.scratch/service-clock/decisive.json',
  '.scratch/service-clock/mls-defect.json',
  // Service-clock pedigree: does a top pedigree change the call-up clock?
  '.scratch/service-clock-pedigree/panel.json',
  '.scratch/service-clock-pedigree/panel-meta.json',
  '.scratch/service-clock-pedigree/findings.json',
  '.scratch/service-clock-pedigree/power.json',
  '.scratch/service-clock-pedigree/power-exact.json',
  // Team success: the payroll, dead-money and first-club panels.
  '.scratch/team-success/payroll-panel.json',
  '.scratch/team-success/payroll-by-player.json',
  '.scratch/team-success/payroll-rules-panel.json',
  '.scratch/team-success/payroll-rules-findings.json',
  '.scratch/team-success/dead-money-panel.json',
  '.scratch/team-success/paid-no-appearance.json',
  '.scratch/team-success/first-club-cache.json',
  // Top prospects history: the Baseball America names that never debuted.
  '.scratch/top-prospects-history/ba-non-debuts.json',
  // Shipped files that a research spike reads as a source of record.
  'public/data/run-differential.json',
  'public/data/level-tenure-benchmark.json',
  'public/data/prospect-trend.json',
  'public/data/top-prospects.json',
  'public/data/trade-deadline/20*.json', // one file per season; index.json is not data
  'public/data/manager-history/*.json', // 100 shards by person id
  'public/data/milb-history.json',
];

// Tracked JSON that is deliberately NOT a view: [path or directory prefix, why].
// A prefix ends in "/". `node scripts/research-db.mjs --uncovered` lists every
// tracked JSON file under .scratch/ and public/data/ that is in neither list.
// docs/agents/research-database.md repeats these reasons, and
// test/research-db-catalog.test.js keeps the two in step.
export const SKIPPED = [
  // .scratch/: design and probe output, not research panels.
  ['.scratch/design-system/', 'UI measurement output (sheets, boxes, census) from design work; no research question'],
  ['.scratch/abs-reports/design/', 'design canvas file for a page mock-up'],
  ['.scratch/homefeed/canvas/', 'design canvas file for a page mock-up'],
  ['.scratch/offseason-design/', 'design canvas file and a one-off endpoint shape check'],
  ['.scratch/team-one-scroll/canvas/', 'design canvas files and per-club rank probes for a page mock-up'],
  ['.scratch/live-feed-diffpatch/', 'one-off byte-count probes of the live feed (three tiny files)'],
  ['.scratch/level-benchmarks/org-gaps.json', 'empty array; no rows'],
  ['.scratch/team-success/first-club-gamelog-cache.json', 'raw fetch cache of game logs (6 MB); first-club-cache.json holds the result'],
  // public/data/contracts-history/: copies and review queues.
  ['public/data/contracts-history/identity/pending.json', 'review queue of fuzzy matches; the same rowKeys are already in identity/*.json'],
  ['public/data/contracts-history/search-index.json', 'shipped search index (5.8 MB); a slim copy of the identity rows'],
  // public/data/: shipped UI data. Only the files named in PANEL_PATHS are research sources.
  ['public/data/callouts/', 'shipped UI data for callout surfaces'],
  ['public/data/highlights/', 'shipped UI data for the video surface'],
  ['public/data/logos/', 'shipped logo manifests'],
  ['public/data/umpires/', 'shipped UI data for umpire pages'],
  ['public/data/umpire-accuracy/', 'shipped UI data for the umpire accuracy page'],
  ['public/data/glove-target/', 'shipped UI data for the pitch-command surface'],
  ['public/data/spray/', 'shipped UI data for the hit chart'],
  ['public/data/fouls/', 'shipped UI data for the fouls card'],
  ['public/data/pitch-arsenal/', 'shipped UI data for the arsenal card'],
  ['public/data/pitch-arsenal-pool/', 'shipped UI data for the arsenal card'],
  ['public/data/pitch-command/', 'shipped UI data for the command card'],
  ['public/data/long-at-bats/', 'shipped UI data for a callout'],
  ['public/data/schedule-shape/', 'shipped UI data for the schedule page'],
  ['public/data/vs-team-splits/', 'shipped UI data for the matchup card'],
  ['public/data/game-notes/', 'shipped UI data; the research copy is .scratch/game-notes/insights'],
  ['public/data/team-transactions/', 'shipped UI data for the club transactions tab'],
  ['public/data/team-records/', 'shipped UI data: current-season game lists per club, rebuilt nightly'],
  ['public/data/team-contracts/', 'shipped money page data; contracts-history is the historical copy'],
  ['public/data/player-contracts/', 'shipped money page data; contracts-history is the historical copy'],
  ['public/data/milb-alumni/', 'shipped UI data for the club alumni list'],
  ['public/data/milb-pool/', 'shipped UI data: the current MiLB game pool'],
  ['public/data/former-teammates/', 'shipped UI data for a callout'],
  ['public/data/youngest-regulars/', 'shipped UI data; current season only'],
  ['public/data/rookies/', 'shipped UI data; rookies.json is the registered summary'],
  ['public/data/abs-challenges.json', 'shipped UI data for the ABS page'],
  ['public/data/abs-exposure.json', 'shipped UI data for the ABS page'],
  ['public/data/abs-exposure-clubs-aaa.json', 'shipped UI data for the ABS page'],
  ['public/data/abs-exposure-clubs-mlb.json', 'shipped UI data for the ABS page'],
  ['public/data/affiliates.json', 'lookup table (club to affiliates); not a measurement'],
  ['public/data/teams.json', 'lookup table (club names by level); not a measurement'],
  ['public/data/attendance.json', 'shipped UI data; level-benchmarks/attendance-cache.json is the registered research copy'],
  ['public/data/career-matchups.json', 'shipped UI data for a callout'],
  ['public/data/comeback-wins.json', 'shipped score-surface data'],
  ['public/data/season-score.json', 'shipped score-surface data'],
  ['public/data/team-score.json', 'shipped score-surface data'],
  ['public/data/postseason-odds.json', 'shipped score-surface data'],
  ['public/data/command-received.json', 'shipped UI data for the pitch-command surface'],
  ['public/data/target-command.json', 'shipped UI data for the pitch-command surface'],
  ['public/data/doubleheaders.json', 'shipped UI data; small (22 KB)'],
  ['public/data/farm-system.json', 'derived from top-prospects.json and standings for a page; no new measurement'],
  ['public/data/fever-radar.json', 'shipped UI data for the home page'],
  ['public/data/first-scorebook.json', 'shipped UI data for a callout'],
  ['public/data/fouls.json', 'shipped UI data for the fouls card'],
  ['public/data/game-notes-corroboration.json', 'shipped UI data for game notes'],
  ['public/data/gate.json', 'shipped UI data; small (31 KB)'],
  ['public/data/jerseys.json', 'shipped UI data for jersey art'],
  ['public/data/milestones.json', 'shipped UI data for the milestone watch'],
  ['public/data/minors-leaders.json', 'shipped UI data: current season leaders only'],
  ['public/data/nine-keys.json', 'shipped UI data for a callout'],
  ['public/data/postseason-leaders.json', 'shipped UI data; postseason-history.json is the registered source'],
  ['public/data/rehab.json', 'shipped UI data for the rehab tracker'],
  ['public/data/run-expectancy.json', 'shipped run-expectancy table (9 KB); a lookup, not a panel'],
  ['public/data/run-value.json', 'shipped UI data: current season only'],
  ['public/data/salaries.json', 'shipped money page data (current season); contracts-history is the historical copy'],
  ['public/data/savant-matchup.json', 'shipped UI data for the matchup card'],
  ['public/data/savant-percentiles.json', 'shipped UI data: current season only'],
  ['public/data/uniform-names.json', 'shipped UI data for jersey art'],
  ['public/data/umpire-accuracy-summary.json', 'shipped UI data for the umpire accuracy page'],
  ['public/data/workload.json', 'shipped UI data: current season only'],
  ['public/data/workload-summary.json', 'shipped UI data; small (1 KB)'],
  ['public/data/trade-deadline/index.json', 'index of the season files, not data'],
];

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
