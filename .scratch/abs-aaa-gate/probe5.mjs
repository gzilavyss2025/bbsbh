import { getJson } from '../../scripts/lib/statsapi.mjs'

const sched = await getJson('/api/v1/schedule?sportId=14&date=2026-08-26')
const g = sched.dates[0].games[0]
const feed = await getJson(`/api/v1.1/game/${g.gamePk}/feed/live`)
console.log(g.gamePk, JSON.stringify(feed.gameData.teams.away.sport), feed.gameData.teams.away.name, 'vs', feed.gameData.teams.home.name)
console.log('league', feed.gameData.teams.away.league?.name, '/', feed.gameData.teams.home.league?.name)
for (const n of feed.liveData?.boxscore?.info ?? []) if (/challenge/i.test(`${n.label} ${n.value}`)) console.log('NOTE', n.label, n.value)
