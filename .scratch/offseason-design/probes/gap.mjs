// How long is the offseason REALLY? Count days with at least one professional
// game in statsapi, across every sport Tally could plausibly show, over the
// 2025-26 offseason.
const API = 'https://statsapi.mlb.com'
const SPORTS = [
  { id: 1, label: 'MLB' },
  { id: 11, label: 'AAA' },
  { id: 12, label: 'AA' },
  { id: 13, label: 'A+' },
  { id: 14, label: 'A' },
  { id: 16, label: 'ROK' },
  { id: 17, label: 'WIN' },
]
const START = '2025-09-15'
const END = '2026-04-05'

const byDate = new Map()
for (const s of SPORTS) {
  const r = await fetch(
    `${API}/api/v1/schedule?sportId=${s.id}&startDate=${START}&endDate=${END}`,
  )
  const j = await r.json()
  const seen = new Set()
  for (const d of j.dates ?? []) {
    for (const g of d.games ?? []) {
      if (seen.has(g.gamePk)) continue
      seen.add(g.gamePk)
      // Only a game that was actually PLAYED counts as baseball on that day.
      const played =
        g?.teams?.away?.score != null && g?.teams?.home?.score != null
      if (!played) continue
      const key = d.date
      if (!byDate.has(key)) byDate.set(key, {})
      const bucket = byDate.get(key)
      const tag = `${s.label}:${g.gameType}`
      bucket[tag] = (bucket[tag] || 0) + 1
    }
  }
  console.error(s.label, 'rows', seen.size)
}

const days = []
for (let t = Date.parse(START + 'T12:00:00Z'); t <= Date.parse(END + 'T12:00:00Z'); t += 86400000) {
  const iso = new Date(t).toISOString().slice(0, 10)
  days.push({ date: iso, games: byDate.get(iso) || null })
}

// Find runs of empty days.
const gaps = []
let run = null
for (const d of days) {
  if (!d.games) {
    if (!run) run = { from: d.date, to: d.date, days: 1 }
    else { run.to = d.date; run.days++ }
  } else if (run) { gaps.push(run); run = null }
}
if (run) gaps.push(run)

console.log(JSON.stringify({ gaps, days }, null, 1))
