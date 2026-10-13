// The per-start pitch mix (#1915): for each pitcher and game, how many of each pitch code
// he threw. Folded in the arsenal sweep, so one --clear-arsenal re-walk fills it too. Its
// own shard set because the pitch-arsenal buckets are at their ceiling: public/data/
// pitch-arsenal-starts/{season}/{NN}.json, `{ season, pit: { pitcherId: { gamePk: { code: n } } } }`,
// in the pitcher's %100 bucket. `mph` (#1933) rides beside `pit` in the same shape, the mean start
// speed to one decimal, left out for a code with no speed. A gamePk is one game, so the postseason needs no map of its own.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bucketsOf, writeSeasons, writeShards } from '../io.js'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', 'pitch-arsenal-starts')

// `pitchers` is aggregateGamePitchTypes's map; its types are keyed `code:stand`.
export function foldStarts(db, { gamePk, level, season }, pitchers) {
  const stmt = db.prepare(`INSERT INTO pitch_arsenal_starts (season, level, person_id, game_pk, code, n) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(person_id, game_pk, code) DO UPDATE SET n = n + excluded.n`)
  const speed = db.prepare(`INSERT INTO pitch_arsenal_start_speed (season, level, person_id, game_pk, code, speed_sum, speed_n) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(person_id, game_pk, code) DO UPDATE SET speed_sum = speed_sum + excluded.speed_sum, speed_n = speed_n + excluded.speed_n`)
  for (const [id, p] of pitchers) {
    for (const [key, t] of p.types) {
      const code = key.split(':')[0]
      stmt.run(season, level, id, gamePk, code, t.pitches)
      if (t.velocityN) speed.run(season, level, id, gamePk, code, t.velocitySum, t.velocityN)
    }
  }
}

export function startsBuckets(db, season) {
  const pit = {}
  for (const r of db.prepare('SELECT * FROM pitch_arsenal_starts WHERE season = ? ORDER BY person_id, game_pk, code').all(season)) {
    ;((pit[r.person_id] ??= {})[r.game_pk] ??= {})[r.code] = r.n
  }
  const mph = {}
  for (const r of db.prepare('SELECT * FROM pitch_arsenal_start_speed WHERE season = ? AND speed_n > 0 ORDER BY person_id, game_pk, code').all(season)) {
    ;((mph[r.person_id] ??= {})[r.game_pk] ??= {})[r.code] = Math.round((r.speed_sum / r.speed_n) * 10) / 10
  }
  const buckets = bucketsOf({ season }, pit, {})
  for (const [, b] of buckets) for (const id of Object.keys(b.pit)) if (mph[id]) (b.mph ??= {})[id] = mph[id]
  return buckets
}

// Writes nothing while the season has no row, so the files wait for the first sweep or re-walk.
export async function writeStarts(db, season) {
  const buckets = startsBuckets(db, season)
  if (!buckets.length) return
  await writeShards(join(outDir, String(season)), buckets)
  await writeSeasons(outDir, season)
}
