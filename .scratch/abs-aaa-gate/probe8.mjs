// Extra-inning refill: can a club exceed 2 FAILED challenges once the game
// goes past 9? Sweep extras games at MLB, Triple-A and the FSL.
import { selectChallengeState } from '../../src/api/challenges.js'
for (const sportId of [1, 11, 14]) {
  const hist = new Map(); let games = 0
  for (const date of ['2026-08-26', '2026-08-20', '2026-08-13', '2026-07-15', '2026-06-10', '2026-05-14', '2026-04-10']) {
    const s = await (await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${date}`)).json()
    for (const g of s.dates?.[0]?.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`)).json()
      const inn = f.liveData?.linescore?.currentInning ?? 9
      if (inn <= 9 || f.gameData.absChallenges == null) continue
      games++
      const st = selectChallengeState(f, Infinity, 'bottom')
      for (const side of ['away', 'home']) {
        const fails = st[side].outcomes.filter((c) => c.outcome === 'fail').length
        hist.set(fails, (hist.get(fails) ?? 0) + 1)
        if (fails > 2) console.log(`  >2 fails in extras: sport ${sportId} pk ${g.gamePk} ${side} fails=${fails} innings=${inn} gameData=${JSON.stringify(f.gameData.absChallenges[side])}`)
      }
    }
  }
  console.log(`sportId ${sportId}: ${games} extras games`, [...hist].sort((a,b)=>a[0]-b[0]))
}
