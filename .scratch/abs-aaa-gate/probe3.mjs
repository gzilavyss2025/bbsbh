// How many challenges can ONE club FAIL in a regulation game? That is the
// discriminator for the starting bank: a 2-challenge start caps regulation
// fails at 2, a 3-challenge start at 3.
import { selectChallengeState } from '../../src/api/challenges.js'
const sportId = Number(process.argv[2])
const dates = process.argv.slice(3)
const hist = new Map()
let games = 0
for (const date of dates) {
  const sched = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${date}`)).json()
  const pks = (sched.dates?.[0]?.games ?? []).filter((g) => g.status?.abstractGameState === 'Final').map((g) => g.gamePk)
  for (const pk of pks) {
    const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
    const innings = feed.liveData?.linescore?.currentInning ?? 9
    if (innings > 9) continue // skip extras: bonus challenges muddy the cap
    const st = selectChallengeState(feed, Infinity, 'bottom')
    games++
    for (const side of ['away', 'home']) {
      const f = st[side].outcomes.filter((c) => c.outcome === 'fail').length
      hist.set(f, (hist.get(f) ?? 0) + 1)
      if (f >= 3) console.log(`  >=3 fails: pk ${pk} ${side} f=${f}`)
    }
  }
}
console.log(`sportId ${sportId}: ${games} regulation games`, [...hist].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k} fails: ${v} club-games`))
