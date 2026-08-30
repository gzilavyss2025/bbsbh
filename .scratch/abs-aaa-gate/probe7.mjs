// What does gameData.absChallenges mean? Is `hasChallenges` a SYSTEM flag or
// an "at least one challenge happened" flag? Probe across levels and states.
async function look(pk, tag) {
  const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
  let mj = 0
  for (const p of f.liveData?.plays?.allPlays ?? [])
    for (const r of [p.reviewDetails, ...(p.playEvents ?? []).map((e) => e.reviewDetails)].filter(Boolean))
      if (r.reviewType === 'MJ') mj++
  console.log(
    `${tag} pk=${pk} sport=${f.gameData.teams.away.sport?.id} lg=${f.gameData.teams.away.league?.name} ` +
    `state=${f.gameData.status?.abstractGameState}/${f.gameData.status?.detailedState} mjInFeed=${mj}`,
  )
  console.log('   absChallenges =', JSON.stringify(f.gameData.absChallenges ?? '(key absent)'))
}
// levels
async function firstOf(sportId, date, pred = () => true, n = 3) {
  const s = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${date}`)).json()
  return (s.dates?.[0]?.games ?? []).filter(pred).slice(0, n).map((g) => g.gamePk)
}
for (const [sid, date] of [[1, '2026-08-26'], [11, '2026-08-26'], [12, '2026-08-26'], [13, '2026-08-26'], [14, '2026-08-26']]) {
  for (const pk of await firstOf(sid, date, (g) => g.status?.abstractGameState === 'Final')) await look(pk, `L${sid}`)
}
// a AAA game where one club made zero challenges, and 816544 (away 0)
await look(816544, 'AAA-away-zero')
// today's / an upcoming scheduled game (pregame)
const today = new Date().toISOString().slice(0, 10)
for (const pk of await firstOf(1, today, (g) => g.status?.abstractGameState === 'Preview', 2)) await look(pk, 'MLB-pregame')
for (const pk of await firstOf(11, today, (g) => g.status?.abstractGameState === 'Preview', 2)) await look(pk, 'AAA-pregame')
