// Per TAB: how long is each of Tally's five level tabs actually empty?
const API = 'https://statsapi.mlb.com'
const SPORTS = [
  { id: 1, label: 'MLB' },
  { id: 11, label: 'AAA' },
  { id: 12, label: 'AA' },
  { id: 13, label: 'A+' },
  { id: 14, label: 'A' },
  { id: 17, label: 'WIN (no tab today)' },
]
const START = '2025-09-01'
const END = '2026-04-15'

function runs(days) {
  const out = []
  let run = null
  for (const d of days) {
    if (!d.n) {
      if (!run) run = { from: d.date, to: d.date, days: 1 }
      else { run.to = d.date; run.days++ }
    } else if (run) { out.push(run); run = null }
  }
  if (run) out.push(run)
  return out
}

for (const s of SPORTS) {
  const j = await (await fetch(
    `${API}/api/v1/schedule?sportId=${s.id}&startDate=${START}&endDate=${END}`,
  )).json()
  const seen = new Set()
  const byDate = new Map()
  const typesByDate = new Map()
  for (const d of j.dates ?? []) {
    for (const g of d.games ?? []) {
      if (seen.has(g.gamePk)) continue
      seen.add(g.gamePk)
      if (g?.teams?.away?.score == null || g?.teams?.home?.score == null) continue
      byDate.set(d.date, (byDate.get(d.date) || 0) + 1)
      if (!typesByDate.has(d.date)) typesByDate.set(d.date, new Set())
      typesByDate.get(d.date).add(g.gameType)
    }
  }
  const days = []
  for (let t = Date.parse(START + 'T12:00:00Z'); t <= Date.parse(END + 'T12:00:00Z'); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10)
    days.push({ date: iso, n: byDate.get(iso) || 0, types: [...(typesByDate.get(iso) || [])].join('') })
  }
  const r = runs(days).filter((x) => x.days >= 3)
  console.log(`\n=== ${s.label} (sportId ${s.id}) — gaps of 3+ days ===`)
  r.forEach((x) => console.log(`  ${x.from} -> ${x.to}  ${x.days} days`))
  const last = days.filter((d) => d.n).at(-1)
  const busy = days.filter((d) => d.n)
  console.log(`  played days: ${busy.length}; first ${busy[0]?.date} (${busy[0]?.types}); last ${last?.date} (${last?.types})`)
}
