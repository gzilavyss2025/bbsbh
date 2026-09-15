import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const rows = db.prepare('SELECT * FROM abs_challenges').all()
db.close()
const H = (h) => (h === 'top' ? 0 : 1)
for (const level of ['MLB', 'AAA']) {
  const byGT = new Map()
  for (const r of rows) {
    if (r.level !== level) continue
    const k = `${r.game_pk}:${r.team_id}`
    if (!byGT.has(k)) byGT.set(k, [])
    byGT.get(k).push(r)
  }
  let extras = 0, reg = 0, thirdInExtras = 0
  const examples = []
  for (const [k, l] of byGT) {
    const fails = l.filter((r) => r.outcome === 'fail')
      .sort((a, b) => a.inning - b.inning || H(a.half) - H(b.half) || a.seq - b.seq)
    if (fails.length < 3) continue
    const gamePk = k.split(':')[0]
    const f = fin[gamePk]
    const wentExtras = f && f.fin > 9
    if (wentExtras) extras++; else reg++
    if (fails[2].inning > 9) thirdInExtras++
    if (examples.length < 4) {
      examples.push(`${gamePk} t${k.split(':')[1]} finalInn=${f?.fin} fails at ` +
        fails.map((x) => `${x.half.slice(0,1)}${x.inning}`).join(','))
    }
  }
  console.log(`${level}: club-games with 3+ fails = ${extras + reg}` +
    ` | game went to extras: ${extras} | regulation: ${reg} | THIRD fail came in extras: ${thirdInExtras}`)
  for (const e of examples) console.log('   ' + e)
}
