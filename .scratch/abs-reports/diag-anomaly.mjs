import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const games = db.prepare('SELECT * FROM abs_ingested_games').all()
const dead = games.filter(g => { const f = fin[g.game_pk]; return (!f || !f.fin) && (g.challenges ?? 0) > 0 })
for (const g of dead) {
  console.log('ledger row:', JSON.stringify(g))
  const rows = db.prepare('SELECT * FROM abs_challenges WHERE game_pk = ?').all(g.game_pk)
  for (const r of rows) console.log('   challenge:', r.inning, r.half, r.role, r.outcome, r.player_name)
  const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.game_pk}/feed/live`)).json()
  const ls = f?.liveData?.linescore ?? {}
  console.log('   feed state:', f?.gameData?.status?.detailedState, '| abstract:', f?.gameData?.status?.abstractGameState,
    '| currentInning:', ls.currentInning, '| plays:', (f?.liveData?.plays?.allPlays ?? []).length)
  console.log('   resumed/rescheduled from:', f?.gameData?.game?.resumeDate ?? f?.gameData?.game?.resumedFrom ?? 'n/a')
}
db.close()
