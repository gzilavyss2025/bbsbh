// Shared SQLite helpers for the gen-*.mjs generators (docs/adr/0021).
//
// The committed source of truth is TEXT dumps (scripts/data/*.sql, plain
// INSERT statements) rather than a binary .db file, so PR diffs stay
// reviewable and the git packfile doesn't accumulate binary blobs on every
// nightly commit. Each generator run reconstitutes a throwaway in-memory
// database from schema.sql + every group's dump, writes to it, then
// re-dumps only the group(s) it owns.
//
// Dumps are split ONE FILE PER GROUP, not one shared file, so two generators
// on independently scheduled cron workflows can never silently clobber each
// other's table: a single shared dump, fully rewritten on every run, would
// let whichever workflow pushes second overwrite the other's table with a
// stale copy it read before the other's push landed — the exact class of
// collision update-nightly-data.yml's own header comment describes having
// already happened once with separate JSON-committing crons. Splitting by
// group means each workflow's commit only ever touches the file(s) it owns,
// restoring the same per-file isolation the all-JSON setup had. openDb()
// still loads every group's dump so cross-table queries (e.g. the
// season_grade view) see the full picture; only dumpGroup() is scoped.
//
// Uses node:sqlite (built into Node >=22.5, stable since Node 26) rather
// than better-sqlite3 specifically because the nightly workflows run `node
// scripts/gen-*.mjs` directly with no `npm install` step — a built-in avoids
// adding install latency and avoids native-binary platform risk.
import { DatabaseSync } from 'node:sqlite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(here, 'schema.sql')
const dataDir = join(here, '..', 'data')

// Add a new group when a new table lands (docs/adr/0021's Phase 2/3 tables).
// A table belongs to exactly one group, matching the workflow that owns it.
export const GROUPS = {
  'team-snapshots': { file: join(dataDir, 'team-snapshots.sql'), tables: ['team_snapshots'] },
  'player-snapshots': { file: join(dataDir, 'player-snapshots.sql'), tables: ['player_snapshots'] },
  // Both tables are written by the SAME single hand-run script
  // (gen-postseason-leaders.mjs) — there's no cross-cron collision risk to
  // isolate here, so one group covers both.
  'postseason-player-stats': {
    file: join(dataDir, 'postseason-player-stats.sql'),
    tables: ['postseason_ingested_games', 'postseason_batting_totals', 'postseason_pitching_totals'],
  },
  // All six foul tables are written by the SAME single generator (gen-fouls.mjs)
  // on the nightly cron — no cross-cron collision to isolate, so one group
  // covers them all, same as postseason-player-stats above.
  fouls: {
    file: join(dataDir, 'fouls.sql'),
    tables: [
      'foul_ingested_games',
      'foul_batter_totals',
      'foul_batter_pa_high',
      'foul_pitcher_totals',
      'foul_team_totals',
      'foul_league_innings',
      'foul_pitch_types',
      'foul_game_totals',
      'foul_team_pitch_types_batting',
      'foul_team_pitch_types_pitching',
    ],
  },
  // Both comeback tables are written by the one nightly gen-comeback-wins.mjs —
  // one group, same as fouls/postseason above.
  'comeback-wins': {
    file: join(dataDir, 'comeback-wins.sql'),
    tables: ['comeback_win_totals', 'comeback_ingested_games'],
  },
  // Written by the one nightly gen-jerseys.mjs — its own group (not folded
  // into an existing one) since no other generator ever writes this table.
  jerseys: {
    file: join(dataDir, 'jerseys.sql'),
    tables: ['jerseys'],
  },
  // Both tables are written by the one nightly gen-pitch-arsenal.mjs — its
  // own group, same as jerseys above.
  'pitch-arsenal': {
    file: join(dataDir, 'pitch-arsenal.sql'),
    tables: ['pitch_arsenal_totals', 'pitch_arsenal_ingested_games', 'pitch_command_cells', 'pitch_command_ingested_games'],
  },
  // All three tables are written by the one nightly gen-team-records.mjs — its
  // own group, same as jerseys/pitch-arsenal above. The largest group by row
  // count (one row per club per game, at five levels — roughly 20,600 rows a
  // season), which a primary-key-ordered TEXT dump handles fine: a nightly run
  // appends ~130 rows and the diff shows exactly those. The role table beside
  // them is the one that RE-writes rather than appends — a pitcher's season
  // totals move every time he throws — but only for the arms that worked that
  // night, so its nightly diff is the same handful of lines.
  'team-records': {
    file: join(dataDir, 'team-records.sql'),
    tables: ['team_record_games', 'team_record_ingested_games', 'team_record_pitcher_roles'],
  },
  // Both tables are written by the one nightly gen-abs-challenges.mjs — its
  // own group, same as jerseys/pitch-arsenal/team-records above. The row table
  // stays small (one row per ABS challenge, a few thousand a season across MLB
  // and Triple-A); the ledger carries one row per swept game.
  'abs-challenges': {
    file: join(dataDir, 'abs-challenges.sql'),
    tables: ['abs_challenges', 'abs_ingested_games'],
  },
}

// Reconstitutes a fresh in-memory database: apply the schema, then replay
// every group's committed dump on top (each a no-op before its file exists).
export async function openDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(await readFile(schemaPath, 'utf8'))
  for (const group of Object.values(GROUPS)) {
    try {
      const dump = await readFile(group.file, 'utf8')
      if (dump.trim()) db.exec(dump)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
  return db
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'bigint') return value.toString()
  return `'${String(value).replace(/'/g, "''")}'`
}

// Re-dumps only the tables in `groupName` to its own file, as plain INSERT
// statements ordered by primary key (a run's diff is just the new/changed
// rows, not a full reshuffle). Never touches another group's dump file.
export async function dumpGroup(db, groupName) {
  const group = GROUPS[groupName]
  if (!group) throw new Error(`unknown dump group: ${groupName}`)
  const lines = []
  for (const table of group.tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all()
    const colNames = columns.map((c) => c.name)
    const pkNames = columns
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name)
    const orderBy = pkNames.length ? pkNames.join(', ') : colNames[0]
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all()
    for (const row of rows) {
      const values = colNames.map((c) => sqlLiteral(row[c]))
      lines.push(`INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${values.join(', ')});`)
    }
  }
  await mkdir(dataDir, { recursive: true })
  await writeFile(group.file, lines.length ? lines.join('\n') + '\n' : '')
}

// Convenience for one-time/hand-run scripts that touch every group (the
// JSON->SQLite backfill). Ordinary generators should call dumpGroup with
// only the group they own.
export async function dumpAll(db) {
  for (const groupName of Object.keys(GROUPS)) await dumpGroup(db, groupName)
}
