// If every winter league got a tab, HOW MANY tabs would the rail carry on a
// given day? The rail already wraps to two rows at 320px with five.
const API = 'https://statsapi.mlb.com'
const NAMES = {
  119: 'AFL', 132: 'LMP', 135: 'LVBP', 131: 'LIDOM', 133: 'PWL', 595: 'ABL', 162: 'CS',
}
const j = await (await fetch(
  `${API}/api/v1/schedule?sportId=17&startDate=2025-10-01&endDate=2026-02-28&hydrate=team`,
)).json()
const seen = new Set()
const byDate = new Map()
for (const d of j.dates ?? []) {
  for (const g of d.games ?? []) {
    if (seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    if (g?.teams?.away?.score == null || g?.teams?.home?.score == null) continue
    const lg = g.teams.away.team.league?.id
    if (!byDate.has(d.date)) byDate.set(d.date, new Set())
    byDate.get(d.date).add(lg)
  }
}
const hist = {}
let worst = { n: 0 }
for (const [date, set] of [...byDate].sort()) {
  hist[set.size] = (hist[set.size] || 0) + 1
  if (set.size > worst.n) worst = { n: set.size, date, leagues: [...set].map((x) => NAMES[x] || x) }
}
console.log('days by number of winter leagues playing:', JSON.stringify(hist))
console.log('busiest day:', JSON.stringify(worst))
// Plus MLB/MiLB tabs that are alive on those same days.
const overlapOct = [...byDate].filter(([d]) => d >= '2025-10-01' && d <= '2025-11-14')
console.log('Oct 1 - Nov 14: days', overlapOct.length,
  '| median leagues', overlapOct.map(([, s]) => s.size).sort((a, b) => a - b)[Math.floor(overlapOct.length / 2)])
