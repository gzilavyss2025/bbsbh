const sched = await (await fetch('https://statsapi.mlb.com/api/v1/schedule?sportId=14&date=2026-08-26')).json()
const g = sched.dates[0].games[0]
const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`)).json()
console.log(g.gamePk, JSON.stringify(feed.gameData.teams.away.sport), feed.gameData.teams.away.name, 'vs', feed.gameData.teams.home.name)
console.log('league', feed.gameData.teams.away.league?.name, '/', feed.gameData.teams.home.league?.name)
for (const n of feed.liveData?.boxscore?.info ?? []) if (/challenge/i.test(`${n.label} ${n.value}`)) console.log('NOTE', n.label, n.value)
