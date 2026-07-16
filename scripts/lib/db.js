// Shared SQLite helpers for the gen-*.mjs generators (docs/adr/0021).
//
// The committed source of truth is TEXT dumps (scripts/data/*.sql, plain
// INSERT statements) rather than a binary .db file, so PR diffs stay
// reviewable and the git packfile doesn't accumulate binary blobs on every
// nightly commit. Each generator run reconstitutes a throwaway in-memory
// database from schema.sql + every group's dump, writes to it, then
// re-dumps only the group(s) it owns.
//
// Dumps are split ONE FILE PER GROUP, not one shared file, because two of
// these tables are written by generators on DIFFERENT, independently
// scheduled cron workflows: game_scores by gen-game-score.mjs (every 10
// minutes, update-game-score.yml) and team_snapshots by
// gen-team-score.mjs/gen-season-score.mjs (once nightly,
// update-nightly-data.yml). A single shared dump, fully rewritten on every
// run, would let whichever workflow pushes second silently clobber the
// other's table with a stale copy it read before the other's push landed —
// the exact class of collision update-nightly-data.yml's own header comment
// describes having already happened once with separate JSON-committing
// crons. Splitting by group means each workflow's commit only ever touches
// the file(s) it owns, restoring the same per-file isolation the all-JSON
// setup had. openDb() still loads every group's dump so cross-table queries
// (e.g. the season_grade view) see the full picture; only dumpGroup() is
// scoped.
//
// Uses node:sqlite (built into Node >=22.5, stable since Node 26) rather
// than better-sqlite3 specifically because the nightly/game-score workflows
// run `node scripts/gen-*.mjs` directly with no `npm install` step — a
// built-in avoids adding install latency to the 10-minute game-score cron
// and avoids native-binary platform risk.
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
  'game-scores': { file: join(dataDir, 'game-scores.sql'), tables: ['game_scores'] },
  'team-snapshots': { file: join(dataDir, 'team-snapshots.sql'), tables: ['team_snapshots'] },
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
