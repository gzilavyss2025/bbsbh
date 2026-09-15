// Pitch DEPTH, not just presence. A game with a pitch on every play but only
// 1.8 pitches per plate appearance is missing most of its pitch events, and
// the scoring flow counts pitches per half (derive.js).
const API = 'https://statsapi.mlb.com'
const L = [[119, 'FALL'], [132, 'MEX'], [135, 'VEN'], [131, 'DOM'], [133, 'PR'], [1, 'MLB (scale)']]
function pick(a, n, seed) { const o = a.slice(); let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); return o.sort(() => r() - 0.5).slice(0, n) }
for (const [id, label] of L) {
  const url = id === 1
    ? `${API}/api/v1/schedule?sportId=1&startDate=2025-06-01&endDate=2025-06-14&gameType=R`
    : `${API}/api/v1/schedule?sportId=17&leagueId=${id}&startDate=2025-10-01&endDate=2026-02-28`
  const j = await (await fetch(url)).json()
  const seen = new Map()
  for (const d of j.dates ?? []) for (const g of d.games ?? []) if (!seen.has(g.gamePk)) seen.set(g.gamePk, g)
  const played = [...seen.values()].filter((g) => g?.teams?.away?.score != null && g.gameType === 'R')
  const picks = pick(played.map((g) => g.gamePk), 8, id + 13)
  const ratios = []
  for (const pk of picks) {
    const f = await (await fetch(`${API}/api/v1.1/game/${pk}/feed/live`)).json()
    const plays = f?.liveData?.plays?.allPlays ?? []
    const pit = plays.reduce((n, p) => n + (p.playEvents ?? []).filter((e) => e.isPitch).length, 0)
    if (plays.length) ratios.push(pit / plays.length)
    await new Promise((s) => setTimeout(s, 90))
  }
  ratios.sort((a, b) => a - b)
  const med = ratios[Math.floor(ratios.length / 2)]
  const lean = ratios.filter((r) => r < 2.5).length
  console.log(
    `${label.padEnd(12)} median ${med.toFixed(2)} pitches/play | range ${ratios[0].toFixed(2)}-${ratios.at(-1).toFixed(2)} | thin games (<2.5) ${lean}/${ratios.length}`,
  )
}
