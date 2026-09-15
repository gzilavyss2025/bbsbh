// How much does MLB's roster wire actually carry in the offseason? The rail's
// window is 3 days (5 fetched). If the wire is to LEAD the offseason page, a
// quiet window is the case that decides the design.
const WINDOWS = [
  ['2025-11-03', '2025-11-07'], // week one of the winter
  ['2025-11-17', '2025-11-21'], // 40-man deadline
  ['2025-12-06', '2025-12-10'], // winter meetings
  ['2025-12-24', '2025-12-28'], // the dead week
  ['2026-01-05', '2026-01-09'], // arbitration filing
  ['2026-01-19', '2026-01-23'], // mid-January
  ['2026-02-02', '2026-02-06'], // just before camp
  ['2026-06-10', '2026-06-14'], // an in-season window, for scale
]
for (const [a, b] of WINDOWS) {
  const j = await (await fetch(
    `https://statsapi.mlb.com/api/v1/transactions?startDate=${a}&endDate=${b}`,
  )).json()
  const rows = j.transactions ?? []
  const byType = {}
  for (const r of rows) byType[r.typeDesc] = (byType[r.typeDesc] || 0) + 1
  const top = Object.entries(byType).sort((x, y) => y[1] - x[1]).slice(0, 4)
  console.log(
    `${a}..${b}  rows ${String(rows.length).padStart(4)}  ${top.map(([k, v]) => `${k}:${v}`).join('  ')}`,
  )
}
