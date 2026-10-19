import { DuckDBInstance } from '@duckdb/node-api'
import { rmSync } from 'node:fs'
rmSync('spike.duckdb', { force: true })
const inst = await DuckDBInstance.create('spike.duckdb')
const c = await inst.connect()
await c.run(`CREATE TABLE raw AS SELECT * FROM read_csv('raw/*.csv', all_varchar=true, union_by_name=true, ignore_errors=true, filename=false)`)
const q = async s => (await c.runAndReadAll(s)).getRowObjectsJson()
console.log(await q(`SELECT count(*) n, count(DISTINCT (game_pk, at_bat_number, pitch_number)) dist, count(DISTINCT game_pk) games, min(game_date) mn, max(game_date) mx, count(DISTINCT game_type) gt FROM raw`))
console.log(await q(`SELECT game_type, count(*) n FROM raw GROUP BY 1`))
// typed pitch table, deduped
await c.run(`CREATE TABLE pitch AS SELECT DISTINCT ON (game_pk, at_bat_number, pitch_number)
  CAST(game_pk AS INT) game_pk, CAST(at_bat_number AS INT) ab, CAST(pitch_number AS INT) pn,
  game_date::DATE date, CAST(batter AS INT) batter, CAST(pitcher AS INT) pitcher, stand, p_throws,
  NULLIF(events,'') events, description, NULLIF(pitch_type,'') pt, TRY_CAST(zone AS INT) zn,
  TRY_CAST(plate_x AS DOUBLE) plate_x, TRY_CAST(plate_z AS DOUBLE) plate_z,
  TRY_CAST(hc_x AS DOUBLE) hc_x, TRY_CAST(hc_y AS DOUBLE) hc_y,
  TRY_CAST(launch_speed AS DOUBLE) ev, TRY_CAST(launch_angle AS DOUBLE) la, NULLIF(bb_type,'') bb_type,
  TRY_CAST(balls AS INT) balls, TRY_CAST(strikes AS INT) strikes,
  TRY_CAST(inning AS INT) inning, inning_topbot half, TRY_CAST(outs_when_up AS INT) outs,
  (CASE WHEN on_1b<>'' THEN 1 ELSE 0 END)+(CASE WHEN on_2b<>'' THEN 2 ELSE 0 END)+(CASE WHEN on_3b<>'' THEN 4 ELSE 0 END) bases,
  TRY_CAST(bat_score_diff AS INT) bsd, TRY_CAST(release_speed AS DOUBLE) mph,
  TRY_CAST(bat_speed AS DOUBLE) bat_speed, home_team, away_team, game_type
  FROM raw ORDER BY game_pk, at_bat_number, pitch_number`)
console.log(await q(`SELECT count(*) pitches FROM pitch`))
await c.run(`CREATE TABLE pa AS SELECT * FROM pitch QUALIFY row_number() OVER (PARTITION BY game_pk, ab ORDER BY pn DESC)=1`)
console.log(await q(`SELECT count(*) pas, count(*) FILTER (WHERE events IS NULL) no_event FROM pa`))
console.log(await q(`SELECT events, count(*) n FROM pa GROUP BY 1 ORDER BY 2 DESC LIMIT 12`))
console.log(await q(`SELECT count(*) FILTER (WHERE hc_x IS NOT NULL) hc, count(*) FILTER (WHERE plate_x IS NOT NULL) px, count(*) FILTER (WHERE bat_speed IS NOT NULL) bs, count(*) n FROM pitch`))
