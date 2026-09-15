import { openDb } from '../../scripts/lib/db.js'
import { readFile } from 'node:fs/promises'
const fin = JSON.parse(await readFile('.scratch/abs-reports/final-innings.json','utf8'))
const db = await openDb()
const rows = db.prepare('SELECT * FROM abs_challenges').all()
db.close()
const H = (h) => (h === 'top' ? 0 : 1)

// Does a club that still HOLDS a challenge entering the 10th get another on
// top (always +1), or only a club that is EMPTY (top-up to one)?
for (const level of ['MLB', 'AAA']) {
  const byGT = new Map()
  for (const r of rows) {
    if (r.level !== level) continue
    const k = `${r.game_pk}:${r.team_id}`
    if (!byGT.has(k)) byGT.set(k, [])
    byGT.get(k).push(r)
  }
  // bucket by how many fails the club had BEFORE the 10th
  const buckets = new Map()
  let worstSingleInning = null
  for (const [k, list] of byGT) {
    const gamePk = k.split(':')[0]
    const f = fin[gamePk]
    if (!f || !f.fin || f.fin <= 9) continue
    const fails = list.filter((r) => r.outcome === 'fail')
    const regFails = fails.filter((r) => r.inning <= 9).length
    const extraFails = fails.filter((r) => r.inning >= 10)
    const key = `${regFails} reg fails`
    const b = buckets.get(key) ?? { clubGames: 0, maxExtraFails: 0, maxInOneInning: 0 }
    b.clubGames += 1
    if (extraFails.length > b.maxExtraFails) b.maxExtraFails = extraFails.length
    for (const i of new Set(extraFails.map((r) => r.inning))) {
      const n = extraFails.filter((r) => r.inning === i).length
      if (n > b.maxInOneInning) b.maxInOneInning = n
      if (!worstSingleInning || n > worstSingleInning.n) {
        worstSingleInning = { n, gamePk, team: k.split(':')[1], inning: i, regFails }
      }
    }
    buckets.set(key, b)
  }
  console.log(`\n=== ${level} — clubs in extra-inning games, by regulation fails ===`)
  for (const [k, b] of [...buckets].sort()) {
    console.log(`  ${k}: ${String(b.clubGames).padStart(4)} club-games | most fails in extras ${b.maxExtraFails} | most in ONE extra inning ${b.maxInOneInning}`)
  }
  if (worstSingleInning) console.log('  busiest single extra inning:', JSON.stringify(worstSingleInning))
}
