import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const games = db.prepare('SELECT * FROM abs_ingested_games').all()
db.close()
const bad = games.filter(g => { const f = fin[g.game_pk]; return !f || !f.fin })
console.log('ledger games:', games.length, '| no usable final inning:', bad.length)
const by = {}
for (const m of bad) by[m.level] = (by[m.level] ?? 0) + 1
console.log('by level:', JSON.stringify(by))
for (const m of bad.slice(0, 6)) {
  console.log(`  ${m.game_pk} ${m.date} ${m.level} challenges=${m.challenges} -> stored ${JSON.stringify(fin[m.game_pk])}`)
}
const pks = bad.slice(0, 3).map(m => m.game_pk)
for (const pk of pks) {
  const r = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
  const ls = r?.liveData?.linescore ?? {}
  console.log(`  FEED ${pk}: currentInning=${ls.currentInning} scheduled=${ls.scheduledInnings} innings=${(ls.innings??[]).length} state=${r?.gameData?.status?.detailedState}`)
}
