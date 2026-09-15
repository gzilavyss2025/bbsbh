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
  // Every club-game in a game that reached extras
  let multiExtraFail = 0
  const extraFailDist = new Map()      // fails in innings >=10 -> count
  const perInningPairs = []            // club-games failing in 2+ DISTINCT extra innings
  let maxFailsOneExtraInning = 0
  for (const [k, list] of byGT) {
    const gamePk = k.split(':')[0]
    const f = fin[gamePk]
    if (!f || !f.fin || f.fin <= 9) continue
    const fails = list.filter((r) => r.outcome === 'fail')
      .sort((a, b) => a.inning - b.inning || H(a.half) - H(b.half) || a.seq - b.seq)
    const extraFails = fails.filter((r) => r.inning >= 10)
    extraFailDist.set(extraFails.length, (extraFailDist.get(extraFails.length) ?? 0) + 1)
    const innings = [...new Set(extraFails.map((r) => r.inning))]
    if (innings.length >= 2) {
      multiExtraFail += 1
      perInningPairs.push(`${gamePk} t${k.split(':')[1]} final=${f.fin} failedIn=[${innings.join(',')}] totalFails=${fails.length}`)
    }
    for (const i of innings) {
      const n = extraFails.filter((r) => r.inning === i).length
      if (n > maxFailsOneExtraInning) maxFailsOneExtraInning = n
    }
  }
  console.log(`\n=== ${level} — club-games in extra-inning games ===`)
  console.log('fails in innings 10+ :', [...extraFailDist].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '))
  console.log('club-games failing in TWO OR MORE distinct extra innings:', multiExtraFail)
  console.log('most fails by one club within a SINGLE extra inning:', maxFailsOneExtraInning)
  for (const p of perInningPairs.slice(0, 8)) console.log('   ' + p)
}
