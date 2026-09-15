// Dump every ABS review in the two anomalous games, straight from the feed,
// with no interpretation by our own code.
const GAMES = [[815094, 102], [816599, 416]]
for (const [pk, teamId] of GAMES) {
  const f = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
  const away = f.gameData.teams.away
  const home = f.gameData.teams.home
  console.log(`\n===== gamePk ${pk} — ${away.name} (${away.id}) at ${home.name} (${home.id}) =====`)
  console.log('bank:', JSON.stringify(f.gameData.absChallenges))
  console.log('looking at team', teamId)
  for (const p of f.liveData.plays.allPlays ?? []) {
    const about = p.about ?? {}
    const lines = []
    // play-level review
    if (p.reviewDetails) {
      lines.push(`   PLAY-level reviewDetails: ${JSON.stringify(p.reviewDetails)}`)
    }
    for (const ev of p.playEvents ?? []) {
      if (ev.reviewDetails) {
        lines.push(`   pitch ${ev.pitchNumber} code=${ev.details?.code} desc="${ev.details?.description}" review=${JSON.stringify(ev.reviewDetails)}`)
      }
    }
    if (!lines.length) continue
    console.log(` atBat ${about.atBatIndex} ${about.halfInning} ${about.inning} | batter ${p.matchup?.batter?.fullName} | pitcher ${p.matchup?.pitcher?.fullName}`)
    for (const l of lines) console.log(l)
  }
}
