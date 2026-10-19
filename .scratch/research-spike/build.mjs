// Writes the three grains as 100 batter-keyed shards each (shardKey100 pattern) and measures gzip.
import { DuckDBInstance } from '@duckdb/node-api'
import { mkdirSync, rmSync, writeFileSync, readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const inst = await DuckDBInstance.create('spike.duckdb')
const c = await inst.connect()
const rows = async s => (await c.runAndReadAll(s)).getRowObjectsJson()
const sk = id => String(Math.abs(id) % 100).padStart(2, '0')
const r1 = v => (v == null ? null : Math.round(Number(v) * 10) / 10)
const r2 = v => (v == null ? null : Math.round(Number(v) * 100) / 100)
const day = d => Math.round((Date.parse(d) - Date.parse('2026-01-01')) / 864e5) // days since Jan 1
const num = v => (v == null ? null : Number(v))
const PA_COLS = ['gamePk','ab','d','batter','pitcher','stand','throws','event','inn','half','outs','bases','balls','strikes','bsd','pt','px','pz','hcx','hcy','ev','la','bb']
const paRow = p => [num(p.game_pk), num(p.ab), day(p.date), num(p.batter), num(p.pitcher), p.stand, p.p_throws, p.events, num(p.inning), p.half === 'Top' ? 0 : 1, num(p.outs), num(p.bases), num(p.balls), num(p.strikes), num(p.bsd), p.pt, r2(p.plate_x), r2(p.plate_z), r1(p.hc_x), r1(p.hc_y), r1(p.ev), r1(p.la), p.bb_type]
const PITCH_COLS = ['gamePk','ab','pn','pt','px','pz','zone','mph','balls','strikes','desc','bat_speed']
const pitchRow = p => [num(p.game_pk), num(p.ab), num(p.pn), p.pt, r2(p.plate_x), r2(p.plate_z), num(p.zn), r1(p.mph), num(p.balls), num(p.strikes), p.description, r1(p.bat_speed)]
// pitch-only: every pitch row carries the PA-level fields (hands, event, game state) too.
const FULL_COLS = ['gamePk','ab','pn','d','batter','pitcher','stand','throws','event','inn','half','outs','bases','bsd','pt','px','pz','zone','mph','balls','strikes','desc','hcx','hcy','ev','la','bb','bat_speed','paEnd']
const fullRow = (p, pa) => [num(p.game_pk), num(p.ab), num(p.pn), day(p.date), num(p.batter), num(p.pitcher), p.stand, p.p_throws, pa.events, num(p.inning), p.half === 'Top' ? 0 : 1, num(p.outs), num(p.bases), num(p.bsd), p.pt, r2(p.plate_x), r2(p.plate_z), num(p.zn), r1(p.mph), num(p.balls), num(p.strikes), p.description, r1(pa.hc_x), r1(pa.hc_y), r1(pa.ev), r1(pa.la), pa.bb_type, r1(p.bat_speed), p.pn === pa.pn ? 1 : 0]

const pas = await rows(`SELECT * FROM pa ORDER BY game_pk, ab`)
const pitches = await rows(`SELECT * FROM pitch ORDER BY game_pk, ab, pn`)
const paMap = new Map(pas.map(p => [`${p.game_pk}-${p.ab}`, p]))

function write(name, cols, items, keyOf, rowOf, mode) {
  rmSync(`out/${name}`, { recursive: true, force: true }); mkdirSync(`out/${name}`, { recursive: true })
  const buckets = {}
  for (const it of items) (buckets[sk(keyOf(it))] ??= []).push(rowOf(it))
  let raw = 0, gz = 0, n = 0
  for (const [k, rs] of Object.entries(buckets)) {
    const body = mode === 'col'
      ? { season: 2026, cols, c: cols.map((_, i) => rs.map(r => r[i])) }
      : { season: 2026, cols, r: rs }
    const s = JSON.stringify(body)
    writeFileSync(`out/${name}/${k}.json`, s)
    raw += s.length; gz += gzipSync(s, { level: 9 }).length; n += rs.length
  }
  console.log(name.padEnd(14), mode, 'rows', n, 'shards', Object.keys(buckets).length, 'raw', (raw/1e6).toFixed(2)+' MB', 'gz', (gz/1e6).toFixed(2)+' MB')
  return { raw, gz, n }
}
const out = {}
for (const mode of ['row', 'col']) {
  out['pa_' + mode] = write('pa-' + mode, PA_COLS, pas, p => p.batter, paRow, mode)
  out['pitch_' + mode] = write('pitch-' + mode, PITCH_COLS, pitches, p => paMap.get(`${p.game_pk}-${p.ab}`).batter, pitchRow, mode)
  out['full_' + mode] = write('pitchonly-' + mode, FULL_COLS, pitches, p => p.batter, p => fullRow(p, paMap.get(`${p.game_pk}-${p.ab}`)), mode)
}
writeFileSync('out/sizes.json', JSON.stringify(out, null, 1))
