import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const games = db.prepare('SELECT * FROM abs_ingested_games').all()
const rows = db.prepare('SELECT level, COUNT(*) n FROM abs_challenges GROUP BY level').all()
db.close()
const chal = Object.fromEntries(rows.map(r => [r.level, r.n]))
for (const level of ['MLB', 'AAA']) {
  const gs = games.filter(g => g.level === level)
  const dead = gs.filter(g => { const f = fin[g.game_pk]; return !f || !f.fin })
  const played = gs.length - dead.length
  const n = chal[level]
  console.log(`${level}: ledger ${gs.length} games, ${dead.length} never played (0 innings), ${played} real`)
  console.log(`   per game published ${(n / gs.length).toFixed(3)}  |  over games actually played ${(n / played).toFixed(3)}`)
  const withChal = dead.filter(g => (g.challenges ?? 0) > 0).length
  console.log(`   of the dead ones, ${withChal} carry a challenge (expect 0)`)
}
