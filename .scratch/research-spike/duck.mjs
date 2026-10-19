import { DuckDBInstance } from '@duckdb/node-api'
import { readFileSync } from 'node:fs'
const inst = await DuckDBInstance.create(':memory:'); const c = await inst.connect()
const ms = async f => { const s = performance.now(); const r = await f(); return [performance.now() - s, r] }
for (const [name, dir] of [['pa', 'out/pa-col'], ['pitchonly', 'out/pitchonly-col']]) {
  const cols = JSON.parse(readFileSync(`${dir}/00.json`, 'utf8')).cols
  const STR = new Set(['stand','throws','event','pt','desc','bb'])
  const sel = cols.map((k, i) => `unnest(from_json(c[${i + 1}], '["${STR.has(k) ? 'VARCHAR' : 'DOUBLE'}"]')) AS ${k}`).join(', ')
  const [tl] = await ms(() => c.run(`CREATE TABLE ${name} AS SELECT ${sel} FROM read_json('${dir}/*.json', format='auto', columns={season:'INT', cols:'VARCHAR[]', c:'JSON[]'})`).catch(async e => { console.log('json[] fail', e.message.slice(0, 120)); throw e }))
  const n = (await c.runAndReadAll(`SELECT count(*) n FROM ${name}`)).getRowObjectsJson()[0].n
  const where = `event='home_run' AND stand='L' AND throws='L' AND pt='SI' AND hcx IS NOT NULL AND degrees(atan2(hcx-125.42, 198.27-hcy)) < -15 AND px > 17.0/12/6 AND px <= 17.0/12/2` + (name === 'pitchonly' ? ' AND paEnd=1' : '')
  const times = []; for (let i = 0; i < 5; i++) { const [t] = await ms(() => c.runAndReadAll(`SELECT gamePk, d FROM ${name} WHERE ${where} ORDER BY d DESC, gamePk DESC LIMIT 1`)); times.push(t) }
  times.sort((a, b) => a - b)
  console.log(name, 'rows', n, 'load', tl.toFixed(0), 'ms', 'query median', times[2].toFixed(2), 'ms')
}
