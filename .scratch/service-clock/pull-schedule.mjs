// Games per date, so the day the LEAGUE actually opened can be told from the
// day the season's first game was played. Five seasons in this window open
// overseas — 2008 Japan, 2012 Japan, 2014 Australia, 2019 Japan, 2024 Seoul,
// 2025 Tokyo — with two clubs playing one or two games and then a gap of a week
// before the other twenty-eight start. Counting days of the season from the
// overseas game makes those seasons look long and puts the first fortnight of
// real baseball where a normal season's third week sits.
import { writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
const out = {}
for (let y = 2005; y <= 2025; y++) {
  const r = await fetch(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=${y}-01-01&endDate=${y}-12-31&fields=dates,date,totalGames`,
  )
  const jj = await r.json()
  const days = (jj.dates ?? []).map((d) => ({ date: d.date, games: d.totalGames }))
  out[y] = days
  const first = days[0]
  // The league opener: the first date on which at least ten games are played.
  const major = days.find((d) => d.games >= 10)
  process.stderr.write(
    `${y} first ${first.date} (${first.games}g)  league opener ${major.date} (${major.games}g)  gap ${Math.round((Date.parse(major.date) - Date.parse(first.date)) / 86400000)}d\n`,
  )
}
await writeFile('schedule-days.json', JSON.stringify(out))
