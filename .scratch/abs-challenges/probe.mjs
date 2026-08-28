import { getJson } from '../../scripts/lib/statsapi.mjs'
import { selectChallengeState } from '../../src/api/challenges.js'

for (const pk of process.argv.slice(2)) {
  const feed = await getJson(`/api/v1.1/game/${pk}/feed/live`)
  const sportId = feed?.gameData?.teams?.away?.sport?.id
  const st = selectChallengeState(feed, Infinity, 'bottom')
  const all = [...st.away.outcomes, ...st.home.outcomes]
  console.log(`\n=== gamePk ${pk} sport=${sportId} state=${feed?.gameData?.status?.abstractGameState} challenges=${all.length}`)
  const officials = feed?.liveData?.boxscore?.officials ?? []
  console.log('officials:', officials.map((o) => `${o.officialType}=${o.official?.id}:${o.official?.fullName}`).join(' | '))
  for (const c of all) {
    const play = feed.liveData.plays.allPlays.find((p) => p.about?.atBatIndex === c.atBatIndex)
    const ev = (play?.playEvents ?? []).find((e) => e.isPitch && e.pitchNumber === c.pitchNumber)
    const bx = feed.liveData.boxscore.teams[c.side]?.players?.[`ID${c.playerId}`]
    console.log(JSON.stringify({
      side: c.side, outcome: c.outcome, inning: c.inning, half: c.half,
      player: c.playerName, playerId: c.playerId, heur: c.isHeuristic, pitchNo: c.pitchNumber,
      batter: play?.matchup?.batter?.id, pitcher: play?.matchup?.pitcher?.id,
      boxPos: bx?.position?.abbreviation ?? null,
      code: ev?.details?.code, call: ev?.details?.description,
      count: ev?.count, pX: ev?.pitchData?.coordinates?.pX, pZ: ev?.pitchData?.coordinates?.pZ,
      szT: ev?.pitchData?.strikeZoneTop, szB: ev?.pitchData?.strikeZoneBottom,
      batSide: play?.matchup?.batSide?.code,
    }))
    if (ev?.reviewDetails) console.log('  reviewDetails(pitch):', JSON.stringify(ev.reviewDetails))
    else if (play?.reviewDetails) console.log('  reviewDetails(play):', JSON.stringify(play.reviewDetails))
  }
}
