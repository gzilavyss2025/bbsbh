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
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(here, 'schema.sql')
const dataDir = join(here, '..', 'data')

// Add a new group when a new table lands (docs/adr/0021's Phase 2/3 tables).
// A table belongs to exactly one group, matching the workflow that owns it.
// A group's dump is `scripts/data/<group>.sql`.
//
// `bySeason: true` makes it a SEASON GROUP (ADR-0086, #1200): every table has
// a `season` column, the live `<group>.sql` holds only the newest season, and
// each older season is dumped ONCE to `<group>-<season>.sql`, at the first
// dump that sees a newer season, and never rewritten. A nightly run then never
// rewrites a completed season, and no one file grows past GitHub's 50 MB
// warning. Until a newer season has rows, no frozen file exists.
export const GROUPS = {
  'team-snapshots': { tables: ['team_snapshots'] },
  'player-snapshots': { tables: ['player_snapshots'] },
  // Both tables are written by the SAME single hand-run script
  // (gen-postseason-leaders.mjs) — there's no cross-cron collision risk to
  // isolate here, so one group covers both.
  'postseason-player-stats': {
    tables: ['postseason_ingested_games', 'postseason_batting_totals', 'postseason_pitching_totals'],
  },
  // All six foul tables are written by the SAME single generator (gen-fouls.mjs)
  // on the nightly cron — no cross-cron collision to isolate, so one group
  // covers them all, same as postseason-player-stats above.
  fouls: {
    bySeason: true,
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
    tables: ['comeback_win_totals', 'comeback_ingested_games'],
  },
  // Written by the one nightly gen-jerseys.mjs — its own group (not folded
  // into an existing one) since no other generator ever writes this table.
  jerseys: {
    tables: ['jerseys'],
  },
  // Both tables are written by the one nightly gen-pitch-arsenal.mjs — its
  // own group, same as jerseys above.
  'pitch-arsenal': {
    bySeason: true,
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
    tables: ['team_record_games', 'team_record_ingested_games', 'team_record_pitcher_roles'],
  },
  // The MLB postseason's per-game ledger, written by the one
  // gen-postseason-records.mjs. A season group: 1995 to now is thirty-odd
  // seasons and a completed postseason never changes, so each is frozen once.
  'postseason-records': {
    bySeason: true,
    tables: ['postseason_record_games', 'postseason_record_ingested_games', 'postseason_record_pitcher_roles'],
  },
  // All three tables are written by the one nightly gen-abs-challenges.mjs —
  // its own group, same as jerseys/pitch-arsenal/team-records above. The row
  // table stays small (one row per ABS challenge, a few thousand a season
  // across MLB and Triple-A); the ledger carries one row per swept game. The
  // exposure table is the odd one: a SEASON SNAPSHOT rather than an
  // append-only ledger, rewritten a club at a time, so its nightly diff is
  // every row of whichever clubs were swept rather than a handful of appends.
  'abs-challenges': {
    bySeason: true,
    tables: ['abs_challenges', 'abs_ingested_games', 'abs_player_exposure'],
  },
}

// Reconstitutes a fresh in-memory database: apply the schema, then replay
// every group's committed dumps on top (each a no-op before its file exists):
// a season group's frozen `<group>-<season>.sql` files, then its live file.
export async function openDb(dir = dataDir) {
  const db = new DatabaseSync(':memory:')
  db.exec(await readFile(schemaPath, 'utf8'))
  const files = await readdir(dir).catch((err) => {
    if (err.code === 'ENOENT') return []
    throw err
  })
  for (const name of Object.keys(GROUPS)) {
    for (const f of [...files.filter((f) => isFrozenDump(name, f)).sort(), `${name}.sql`]) {
      const dump = await readOr(join(dir, f))
      if (dump?.trim()) db.exec(dump)
    }
  }
  return db
}

const isFrozenDump = (name, f) => f.startsWith(`${name}-`) && /^\d{4}\.sql$/.test(f.slice(name.length + 1))

// A file's text, or null only when it does not exist.
async function readOr(path) {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  if (typeof value === 'bigint') return value.toString()
  return `'${String(value).replace(/'/g, "''")}'`
}

// The tables as plain INSERT statements ordered by primary key (a run's diff
// is just the new/changed rows, not a full reshuffle), for one season or all.
function dumpText(db, tables, season) {
  const lines = []
  for (const table of tables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all()
    const colNames = columns.map((c) => c.name)
    const pkNames = columns
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name)
    const orderBy = pkNames.length ? pkNames.join(', ') : colNames[0]
    const where = season == null ? '' : 'WHERE season = ?'
    const rows = db.prepare(`SELECT * FROM ${table} ${where} ORDER BY ${orderBy}`).all(...(season == null ? [] : [season]))
    for (const row of rows) {
      const values = colNames.map((c) => sqlLiteral(row[c]))
      lines.push(`INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${values.join(', ')});`)
    }
  }
  return lines.length ? lines.join('\n') + '\n' : ''
}

// Re-dumps only the tables in `groupName` to its own file(s). Never touches
// another group's dump. A season group (see GROUPS) freezes each season below
// its newest once, and a season with a frozen file never goes back into the
// live file — the two would replay the same rows twice. A frozen season whose
// rows changed is an error, never a silent drop. When the change is on
// purpose (a backfill, a new column), REFREEZE=1 rewrites the frozen file from
// the rows in memory, which openDb already loaded from it.
export async function dumpGroup(db, groupName, dir = dataDir) {
  const group = GROUPS[groupName]
  if (!group) throw new Error(`unknown dump group: ${groupName}`)
  await mkdir(dir, { recursive: true })
  if (!group.bySeason) return writeFile(join(dir, `${groupName}.sql`), dumpText(db, group.tables))
  const seasons = [
    ...new Set(group.tables.flatMap((t) => db.prepare(`SELECT DISTINCT season FROM ${t}`).all().map((r) => r.season))),
  ].sort((a, b) => a - b)
  let live = ''
  for (const season of seasons) {
    const file = join(dir, `${groupName}-${season}.sql`)
    const text = dumpText(db, group.tables, season)
    const frozen = await readOr(file)
    if (frozen == null && season === seasons.at(-1)) live = text
    else if (frozen == null || process.env.REFREEZE === '1') await writeFile(file, text)
    else if (frozen !== text) {
      throw new Error(`${file} is frozen, but this run changed its ${season} rows. On purpose? Rerun with REFREEZE=1.`)
    }
  }
  await writeFile(join(dir, `${groupName}.sql`), live)
}

// Convenience for one-time/hand-run scripts that touch every group (the
// JSON->SQLite backfill). Ordinary generators should call dumpGroup with
// only the group they own.
export async function dumpAll(db) {
  for (const groupName of Object.keys(GROUPS)) await dumpGroup(db, groupName)
}
