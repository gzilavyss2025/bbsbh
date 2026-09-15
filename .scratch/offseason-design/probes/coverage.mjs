// If the Puerto Rican league is dropped, how many DAYS of coverage are lost?
const API = 'https://statsapi.mlb.com'
const L = { 119: 'FALL', 132: 'MEX', 135: 'VEN', 131: 'DOM', 133: 'PR' }
const days = new Map()
for (const id of Object.keys(L)) {
  const j = await (await fetch(
    `${API}/api/v1/schedule?sportId=17&leagueId=${id}&startDate=2025-10-01&endDate=2026-02-28`,
  )).json()
  const seen = new Set()
  for (const d of j.dates ?? []) for (const g of d.games ?? []) {
    if (seen.has(g.gamePk)) continue
    seen.add(g.gamePk)
    if (g?.teams?.away?.score == null) continue
    if (!days.has(d.date)) days.set(d.date, new Set())
    days.get(d.date).add(L[id])
  }
}
const all = [...days.keys()].sort()
const withPR = all.length
const withoutPR = all.filter((d) => [...days.get(d)].some((x) => x !== 'PR')).length
const onlyPR = all.filter((d) => [...days.get(d)].every((x) => x === 'PR'))
console.log('played days with all five leagues :', withPR, `(${all[0]} -> ${all.at(-1)})`)
console.log('played days without PR            :', withoutPR)
console.log('days PR is the ONLY baseball      :', onlyPR.length, onlyPR.slice(0, 10).join(', ') || '(none)')
