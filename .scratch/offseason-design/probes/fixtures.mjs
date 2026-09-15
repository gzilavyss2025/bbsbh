// One verified, representative gamePk per shipped winter league, for the issue.
const API = 'https://statsapi.mlb.com'
const L = [[119, 'FALL'], [132, 'MEX'], [135, 'VEN'], [131, 'DOM'], [133, 'PR']]
for (const [id, label] of L) {
  const j = await (await fetch(
    `${API}/api/v1/schedule?sportId=17&leagueId=${id}&startDate=2025-10-01&endDate=2026-02-28&hydrate=team`,
  )).json()
  const seen = new Map()
  for (const d of j.dates ?? []) for (const g of d.games ?? []) if (!seen.has(g.gamePk)) seen.set(g.gamePk, { ...g, date: d.date })
  const played = [...seen.values()].filter(
    (g) => g?.teams?.away?.score != null && g?.teams?.home?.score != null && g.gameType === 'R',
  )
  // Pick one from the middle of the season, a regular 9-inning game.
  for (const cand of played.slice(Math.floor(played.length / 2))) {
    const f = await (await fetch(`${API}/api/v1.1/game/${cand.gamePk}/feed/live`)).json()
    const plays = f?.liveData?.plays?.allPlays ?? []
    const innings = (f?.liveData?.linescore?.innings ?? []).length
    const pit = plays.reduce((n, p) => n + (p.playEvents ?? []).filter((e) => e.isPitch).length, 0)
    const bo = `${(f.liveData.boxscore.teams.away.battingOrder ?? []).length}/${(f.liveData.boxscore.teams.home.battingOrder ?? []).length}`
    if (innings === 9 && bo === '9/9' && plays.length > 60) {
      const away = f.gameData.teams.away
      const home = f.gameData.teams.home
      const slug = `${(away.abbreviation || '').toLowerCase()}${(home.abbreviation || '').toLowerCase()}`
      const [y, m, d] = cand.date.split('-')
      console.log(
        `${label.padEnd(5)} | gamePk ${cand.gamePk} | ${cand.date} | ${away.abbreviation} @ ${home.abbreviation} | ` +
          `${plays.length} plays, ${pit} pitches, ${innings} inn, BO ${bo}, ${(f.liveData.boxscore.officials ?? []).length} umps | ` +
          `route /${label.toLowerCase()}/${m}${d}${y}/${slug}/`,
      )
      console.log(`        ${away.name} at ${home.name} \u00b7 ${f.gameData.venue?.name ?? '?'}`)
      break
    }
  }
}
