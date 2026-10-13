// The per-start pitch mix (#1915): for each pitcher and game, how many of each pitch code
// he threw. Folded in the arsenal sweep, so one --clear-arsenal re-walk fills it too. Its
// own shard set because the pitch-arsenal buckets are at their ceiling: public/data/
// pitch-arsenal-starts/{season}/{NN}.json, `{ season, pit: { pitcherId: { gamePk: { code: n } } } }`,
// in the pitcher's %100 bucket. A gamePk is one game, so the postseason needs no map of its own.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bucketsOf, writeSeasons, writeShards } from '../io.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'pitch-arsenal-starts')

// `pitchers` is aggregateGamePitchTypes's map; its types are keyed `code:stand`.
export function foldStarts(db, { gamePk, level, season }, pitchers) {
  const stmt = db.prepare(`INSERT INTO pitch_arsenal_starts (season, level, person_id, game_pk, code, n) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(person_id, game_pk, code) DO UPDATE SET n = n + excluded.n`)
  for (const [id, p] of pitchers) for (const [key, t] of p.types) stmt.run(season, level, id, gamePk, key.split(':')[0], t.pitches)
}

export function startsBuckets(db, season) {
  const pit = {}
  for (const r of db.prepare('SELECT * FROM pitch_arsenal_starts WHERE season = ? ORDER BY person_id, game_pk, code').all(season)) {
    ;((pit[r.person_id] ??= {})[r.game_pk] ??= {})[r.code] = r.n
  }
  return bucketsOf({ season }, pit, {})
}

// Writes nothing while the season has no row, so the files wait for the first sweep or re-walk.
export async function writeStarts(db, season) {
  const buckets = startsBuckets(db, season)
  if (!buckets.length) return
  await writeShards(join(outDir, String(season)), buckets)
  await writeSeasons(outDir, season)
}
