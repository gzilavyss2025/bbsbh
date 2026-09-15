// Same completeness check probe 1b used on the MiLB levels, run across the
// winter leagues: what the scoring flow actually reads.
const API = 'https://statsapi.mlb.com'
const LEAGUES = [[119, 'AFL'], [132, 'LMP'], [135, 'LVBP'], [131, 'LIDOM'], [133, 'PWL'], [162, 'CS']]
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
for (const [id, label] of LEAGUES) {
  const j = await (await fetch(
    `${API}/api/v1/schedule?sportId=17&leagueId=${id}&startDate=2025-10-01&endDate=2026-02-28`,
  )).json()
  const seen = new Map()
  for (const d of j.dates ?? []) for (const g of d.games ?? []) if (!seen.has(g.gamePk)) seen.set(g.gamePk, g)
  const played = [...seen.values()].filter(
    (g) => g?.teams?.away?.score != null && g?.teams?.home?.score != null,
  )
  const rnd = mulberry32(id)
  const pool = played.map((g) => g.gamePk).sort(() => rnd() - 0.5)
  const picks = pool.slice(0, Math.min(10, pool.length))
  let ok = 0
  const fails = []
  for (const pk of picks) {
    try {
      const f = await (await fetch(`${API}/api/v1.1/game/${pk}/feed/live`)).json()
      const plays = f?.liveData?.plays?.allPlays ?? []
      const box = f?.liveData?.boxscore?.teams ?? {}
      const placed = plays.filter((p) => p?.about?.inning && p?.about?.halfInning).length
      const pitches = plays.reduce((n, p) => n + (p.playEvents ?? []).filter((e) => e.isPitch).length, 0)
      const withPitch = plays.filter((p) => (p.playEvents ?? []).some((e) => e.isPitch)).length
      const good =
        plays.length > 0 && placed === plays.length &&
        (box.away?.battingOrder ?? []).length >= 9 && (box.home?.battingOrder ?? []).length >= 9 &&
        (f?.liveData?.linescore?.innings ?? []).length > 0 &&
        pitches > 0 && withPitch / plays.length >= 0.8
      if (good) ok++
      else fails.push(`${pk}(plays ${plays.length}, BO ${(box.away?.battingOrder ?? []).length}/${(box.home?.battingOrder ?? []).length}, pitch ${pitches})`)
    } catch (e) { fails.push(`${pk} ERR`) }
    await new Promise((s) => setTimeout(s, 100))
  }
  console.log(`${label.padEnd(6)} played ${String(played.length).padStart(4)} | sampled ${picks.length} | scoreable ${ok}` + (fails.length ? ` | FAILS ${fails.slice(0, 2).join('; ')}` : ''))
}
