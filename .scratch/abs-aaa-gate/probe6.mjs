// (a) any gameData-level flag naming ABS / challenge? (b) per-league split within a sportId.
const feed = await (await fetch('https://statsapi.mlb.com/api/v1.1/game/815863/feed/live')).json()
const hits = []
;(function walk(o, path, depth) {
  if (depth > 5 || o == null || typeof o !== 'object') return
  for (const [k, v] of Object.entries(o)) {
    if (/challenge|abs|review|autom/i.test(k)) hits.push(`${path}.${k} = ${JSON.stringify(v).slice(0, 120)}`)
    walk(v, `${path}.${k}`, depth + 1)
  }
})(feed.gameData, 'gameData', 0)
console.log('gameData keys:', Object.keys(feed.gameData).join(', '))
console.log('gameData matches:', hits.length ? hits : '(none)')
console.log('flags:', JSON.stringify(feed.gameData.flags ?? null))
console.log('gameInfo:', JSON.stringify(feed.gameData.gameInfo ?? null).slice(0,300))
console.log('game:', JSON.stringify(feed.gameData.game ?? null))
console.log('away league:', JSON.stringify(feed.gameData.teams.away.league))

console.log('--- sportId 14 per-league ---')
const byLeague = new Map()
for (const date of ['2026-08-26', '2026-07-15', '2026-05-14']) {
  const sched = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=14&date=${date}`)).json()
  for (const g of sched.dates?.[0]?.games ?? []) {
    if (g.status?.abstractGameState !== 'Final') continue
    const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`)).json()
    const lg = f.gameData.teams.away.league?.name ?? '?'
    let mj = 0
    for (const p of f.liveData?.plays?.allPlays ?? [])
      for (const r of [p.reviewDetails, ...(p.playEvents ?? []).map((e) => e.reviewDetails)].filter(Boolean))
        if (r.reviewType === 'MJ') mj++
    const cur = byLeague.get(lg) ?? { games: 0, mj: 0, withChal: 0 }
    cur.games++; cur.mj += mj; if (mj) cur.withChal++
    byLeague.set(lg, cur)
  }
}
for (const [lg, v] of byLeague) console.log(`  ${lg}: ${v.games} games, ${v.withChal} with a challenge, ${v.mj} challenges`)
