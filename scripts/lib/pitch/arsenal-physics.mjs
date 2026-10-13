// The physics half of the arsenal sweep (#1908 part b): per pitch type, a sum and a
// count of release point, movement, extension, flight time and spin. The feed paths
// were checked on a live MLB game (823035) and a live Triple-A game (815863): all
// seven are on every pitch of both. A pitch missing one adds to no count of it.
// Columns are `<snake>_sum` / `<snake>_n` in schema.sql, in PHYS_FIELDS order.
import { PHYS_FIELDS } from '../../../src/api/pitchArsenal.js'

// field -> [decimals the file keeps, where the feed puts it in pitchData]. The precision
// is Savant's own (tenths of a foot or inch, whole rpm) and flight time to the hundredth:
// the largest pitch-arsenal bucket has to stay under test/bucket-shards.test.js's ceiling.
const SOURCE = {
  x0: [1, (d) => d.coordinates?.x0],
  z0: [1, (d) => d.coordinates?.z0],
  pfxX: [1, (d) => d.coordinates?.pfxX],
  pfxZ: [1, (d) => d.coordinates?.pfxZ],
  extension: [1, (d) => d.extension],
  plateTime: [2, (d) => d.plateTime],
  spinRate: [0, (d) => d.breaks?.spinRate],
}
// A mean over fewer pitches than this is not shipped: it is noise, and it is the bulk of the rows.
export const MIN_PHYS_N = 5
const snake = (f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
// Sums and counts interleaved, so a row's columns and an accumulator line up.
export const PHYS_COLS = PHYS_FIELDS.flatMap((f) => [`${snake(f)}_sum`, `${snake(f)}_n`])

const KEY = 'season, scope, person_id, level, code, stand'

// The upsert into pitch_arsenal_physics: run(season, scope, personId, level, code, stand, ...acc).
export const physStmt = (db) => db.prepare(
  `INSERT INTO pitch_arsenal_physics (${KEY}, ${PHYS_COLS.join(', ')})
   VALUES (?, ?, ?, ?, ?, ?${', ?'.repeat(PHYS_COLS.length)})
   ON CONFLICT(${KEY}) DO UPDATE SET
     ${PHYS_COLS.map((c) => `${c} = pitch_arsenal_physics.${c} + excluded.${c}`).join(',\n     ')}`,
)

// For the totals export: SELECT columns and the join that adds a row's physics (0 when none).
export const PHYS_SELECT = PHYS_COLS.map((c) => `, COALESCE(p.${c}, 0) AS ${c}`).join('')
export const PHYS_JOIN = `LEFT JOIN pitch_arsenal_physics p ON ${KEY.split(', ').map((k) => `p.${k} = t.${k}`).join(' AND ')}`

export const emptyPhys = () => new Array(PHYS_COLS.length).fill(0)

// Add one pitch's pitchData to an accumulator from emptyPhys().
export function addPhys(acc, pitchData) {
  PHYS_FIELDS.forEach((f, i) => {
    const v = SOURCE[f][1](pitchData ?? {})
    if (!Number.isFinite(v)) return
    acc[2 * i] += v
    acc[2 * i + 1] += 1
  })
}

// Add a totals row's physics columns into an accumulator.
export const foldPhysRow = (acc, row) => PHYS_COLS.forEach((c, i) => { acc[i] += row[c] })

// { phys: [means in PHYS_FIELDS order, null where no pitch had it] }, or {} when none did.
export function physMeans(acc) {
  const means = PHYS_FIELDS.map((f, i) => {
    if (!(acc[2 * i + 1] >= MIN_PHYS_N)) return null
    const k = 10 ** SOURCE[f][0]
    return Math.round((acc[2 * i] / acc[2 * i + 1]) * k) / k
  })
  return means.some((m) => m != null) ? { phys: means } : {}
}

// Forget one season's arsenal half at the levels in the run, so the next sweep re-walks
// it: `gen-pitch-arsenal.mjs --clear-arsenal=<season> --since=<its first day>`. Only
// the arsenal tables go: the command and hitter ledgers stay, so those halves are
// not folded in a second time. The wipe takes the whole season, so the rebuild must
// reach its end: --until is refused, and a --since after the first game on file (at
// these levels) would lose games. `args` is the parsed command line.
export function clearArsenalSeason(db, season, levels, { since, until }) {
  if (!since) throw new Error('--clear-arsenal needs --since=<first day>')
  if (until) throw new Error('--clear-arsenal refuses --until: the wipe takes the whole season, the re-walk must reach its end')
  const first = db.prepare(`SELECT MIN(date) AS d FROM pitch_arsenal_ingested_games WHERE season = ? AND level IN (${levels.map(() => '?').join(', ')})`).get(season, ...levels).d
  if (first && first < since) throw new Error(`--since=${since} is after the first game on file (${first}): the re-walk would lose games`)
  for (const t of ['pitch_arsenal_totals', 'pitch_arsenal_physics', 'pitch_arsenal_starts', 'pitch_arsenal_start_speed', 'pitch_arsenal_ingested_games']) {
    for (const level of levels) db.prepare(`DELETE FROM ${t} WHERE season = ? AND level = ?`).run(season, level)
  }
}

// After a re-walk: the games whose feed fetch failed were good data before the wipe.
export const rewalkFailures = (failed) => failed.length
  ? `${failed.length} game(s) failed and are missing from the re-walk: ${failed.map((g) => `${g.gamePk} (${g.level})`).join(', ')}. ` +
    'Run the same command again WITHOUT --clear-arsenal to fetch them, and do not commit before it ends clean.'
  : null
