// Do our stored rows match the feed's own isOverturned flags, for BOTH clubs in
// the two anomalous games? If yes, the inconsistency is upstream, not ours.
import { openDb } from '../../scripts/lib/db.js'
const db = await openDb()
const H = (h) => (h === 'top' ? 0 : 1)
for (const pk of [815094, 816599]) {
  const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
  // ground truth straight from the feed, in atBat order
  const truth = []
  for (const p of f.liveData.plays.allPlays ?? []) {
    const seen = new Set()
    const take = (rd) => {
      if (!rd || rd.reviewType !== 'MJ') return
      const key = `${p.about.atBatIndex}:${rd.challengeTeamId}`
      if (seen.has(key)) return
      seen.add(key)
      truth.push({
        atBat: p.about.atBatIndex, inning: p.about.inning, half: p.about.halfInning,
        team: rd.challengeTeamId, outcome: rd.isOverturned ? 'success' : 'fail',
      })
    }
    take(p.reviewDetails)
    for (const ev of p.playEvents ?? []) take(ev.reviewDetails)
  }
  const stored = db.prepare('SELECT * FROM abs_challenges WHERE game_pk=? ORDER BY seq').all(pk)
  console.log(`\n=== ${pk} — feed has ${truth.length} MJ reviews, we stored ${stored.length} ===`)
  for (const t of truth.sort((a, b) => a.atBat - b.atBat)) {
    const match = stored.find((s) => s.team_id === t.team && s.inning === t.inning && s.half === t.half && s.outcome === t.outcome)
    console.log(`  atBat ${String(t.atBat).padStart(2)} ${t.half.padEnd(6)}${t.inning} team ${t.team} ${t.outcome.padEnd(7)}` +
      ` -> stored: ${match ? 'MATCH seq' + match.seq : 'MISSING'}`)
  }
  // legality per club, from the feed alone
  for (const team of [...new Set(truth.map((t) => t.team))]) {
    const mine = truth.filter((t) => t.team === team).sort((a, b) => a.atBat - b.atBat)
    let bank = 2
    let bad = null
    for (const c of mine) {
      if (bank <= 0 && !bad) bad = c
      else if (c.outcome === 'fail') bank -= 1
    }
    const bankSide = f.gameData.teams.away.id === team ? 'away' : 'home'
    console.log(`  team ${team} (${bankSide}): feed order ${mine.map((c) => c.outcome === 'success' ? 'W' : 'L').join('')}` +
      ` | feed bank ${JSON.stringify(f.gameData.absChallenges[bankSide])}` +
      ` | ${bad ? 'ILLEGAL at atBat ' + bad.atBat : 'legal'}`)
  }
}
db.close()
