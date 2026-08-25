// Century-club pitch data (mlb/aaa; scripts/gen-pitch-arsenal.mjs's own
// sweep) — a season's-worth of CENTURY_MPH+ pitches per pitcher, read from
// the shared SQLite layer (docs/adr/0021) and joined into gen-callouts.mjs's
// starterRecords (docs/callouts.md's veloVariety/centuryClub/veloPeak
// families). Split out of gen-callouts.mjs to keep that file under its line
// budget (ADR-0038) and so the row-shaping below is unit-testable without a
// live DB (see centuryClubFromRows).
import { openDb } from './db.js'

// Pure: SQLite rows -> Map(`${level}:${personId}` -> { count, types,
// seasonMaxVelo }). `count` is his season total of CENTURY_MPH+ pitches at
// that level, `types` each qualifying pitch type's own count + fastest
// reading (most-thrown first), `seasonMaxVelo` his single fastest pitch on
// file at that level regardless of type. Exported separately from
// loadCenturyClub so a test can drive it with a synthetic row array, no
// SQLite involved.
export function centuryClubFromRows(rows) {
  const byKey = new Map()
  for (const r of rows) {
    const key = `${r.level}:${r.person_id}`
    let e = byKey.get(key)
    if (!e) {
      e = { count: 0, types: [], seasonMaxVelo: null }
      byKey.set(key, e)
    }
    e.count += r.century_pitches
    e.types.push({ code: r.code, description: r.description, count: r.century_pitches, maxVelo: r.max_velo })
    if (r.max_velo != null && (e.seasonMaxVelo == null || r.max_velo > e.seasonMaxVelo)) {
      e.seasonMaxVelo = r.max_velo
    }
  }
  for (const e of byKey.values()) e.types.sort((a, b) => b.count - a.count)
  return byKey
}

export async function loadCenturyClub() {
  const db = await openDb()
  const rows = db
    .prepare(
      // GROUPED, because pitch_arsenal_totals now holds one row per SIDE the
      // batter stood on. A pitch type is one entry here however many sides he
      // threw it to, so the counts sum and the hardest reading is the hardest
      // of them — ungrouped, a four-seam would have shown up twice.
      `SELECT person_id, level, code, MIN(description) AS description,
              SUM(century_pitches) AS century_pitches, MAX(max_velo) AS max_velo
       FROM pitch_arsenal_totals
       GROUP BY person_id, level, code
       HAVING SUM(century_pitches) > 0`,
    )
    .all()
  return centuryClubFromRows(rows)
}
