// Do the levels below Triple-A carry any ABS ("MJ") review at all?
import { getJson } from '../../scripts/lib/statsapi.mjs'

const dates = ['2026-08-26', '2026-07-15', '2026-05-14']
for (const sportId of [12, 13, 14]) {
  let games = 0, mj = 0, ma = 0
  for (const date of dates) {
    const sched = await getJson(`/api/v1/schedule?sportId=${sportId}&date=${date}`)
    const pks = (sched.dates?.[0]?.games ?? []).filter((g) => g.status?.abstractGameState === 'Final').map((g) => g.gamePk).slice(0, 8)
    for (const pk of pks) {
      const feed = await getJson(`/api/v1.1/game/${pk}/feed/live`)
      games++
      for (const p of feed.liveData?.plays?.allPlays ?? []) {
        for (const r of [p.reviewDetails, ...(p.playEvents ?? []).map((e) => e.reviewDetails)].filter(Boolean)) {
          if (r.reviewType === 'MJ') mj++
          else ma++
        }
      }
    }
  }
  console.log(`sportId ${sportId}: ${games} games, MJ=${mj}, other reviews=${ma}`)
}
