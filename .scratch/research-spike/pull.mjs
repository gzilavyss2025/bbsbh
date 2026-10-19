// Spike for #2311: one month of Savant daily CSVs (regular season, June 2026).
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
const days = []
for (let d = 1; d <= 30; d++) days.push(`2026-06-${String(d).padStart(2, '0')}`)
const log = []
for (const day of days) {
  const f = `raw/${day}.csv`
  if (!existsSync(f)) {
    const p = new URLSearchParams({ all: 'true', type: 'details', hfGT: 'R|', hfSea: '2026|', game_date_gt: day, game_date_lt: day })
    const r = await fetch(`https://baseballsavant.mlb.com/statcast_search/csv?${p}`)
    if (!r.ok) { console.log(day, 'HTTP', r.status); continue }
    writeFileSync(f, await r.text())
    await new Promise(r => setTimeout(r, 400))
  }
  const t = readFileSync(f, 'utf8')
  const n = t.split('\n').length - 2
  log.push([day, n])
  console.log(day, n, n >= 25000 ? 'CAP!' : '')
}
