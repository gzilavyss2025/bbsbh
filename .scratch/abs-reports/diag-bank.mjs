import { openDb } from '../../scripts/lib/db.js'
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
  const failDist = new Map()
  const totalDist = new Map()
  for (const l of byGT.values()) {
    const f = l.filter((r) => r.outcome === 'fail').length
    failDist.set(f, (failDist.get(f) ?? 0) + 1)
    totalDist.set(l.length, (totalDist.get(l.length) ?? 0) + 1)
  }
  console.log(`${level} fails per club-game:`, [...failDist].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '))
  console.log(`${level} challenges per club-game:`, [...totalDist].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '))
}
