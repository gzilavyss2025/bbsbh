const pk = Number(process.argv[2])
const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${pk}/feed/live`)).json()
for (const p of feed.liveData.plays.allPlays) {
  const locs = []
  if (p.reviewDetails?.reviewType === 'MJ') locs.push(['PLAY', p.reviewDetails])
  for (const e of p.playEvents ?? []) {
    if (e.reviewDetails?.reviewType === 'MJ') locs.push([`EV pitch#${e.pitchNumber} idx${e.index}`, e.reviewDetails])
  }
  if (!locs.length) continue
  console.log(`--- atBat ${p.about.atBatIndex} ${p.about.halfInning} ${p.about.inning} :: ${p.result.description ?? ''}`)
  for (const [loc, r] of locs) {
    console.log(`    ${loc}  team=${r.challengeTeamId} overturned=${r.isOverturned} player=${r.player?.fullName} `)
  }
}
