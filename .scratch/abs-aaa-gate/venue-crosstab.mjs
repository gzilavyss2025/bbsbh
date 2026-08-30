// The CORRECTED sweep — see notes.md, "The wrong turn".
//
// The original sweep asked "of the games that carry gameData.absChallenges,
// how many have real MJ reviews?" and found perfect agreement. That question
// cannot fail: it skips every game WITHOUT the key before counting anything,
// which is exactly the class of miss that matters (a real challenge the gate
// would hide).
//
// This one cross-tabulates both directions and groups by VENUE, which is the
// unit the key is actually reported at. The MJ-but-no-key column is the one
// worth reading — a non-zero entry is a park where gameHasAbs hides a row it
// should show.
//
//   node .scratch/abs-aaa-gate/venue-crosstab.mjs 14
//   node .scratch/abs-aaa-gate/venue-crosstab.mjs 11 2026-08-29 2026-07-04
const sportId = Number(process.argv[2] ?? 14)
const dates = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['2026-04-18', '2026-05-02', '2026-05-24', '2026-06-05', '2026-07-11', '2026-08-15', '2026-08-22', '2026-08-29']

const countMj = (feed) => {
  let n = 0
  for (const p of feed.liveData?.plays?.allPlays ?? []) {
    if (p.reviewDetails?.reviewType === 'MJ') n += 1
    for (const e of p.playEvents ?? []) if (e.reviewDetails?.reviewType === 'MJ') n += 1
  }
  return n
}

const byVenue = new Map()
for (const date of dates) {
  const sched = await (
    await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${date}`)
  ).json()
  for (const g of sched.dates?.[0]?.games ?? []) {
    if (g.status?.abstractGameState !== 'Final') continue
    const feed = await (await fetch(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`)).json()
    const venue = feed.gameData?.venue?.name ?? '?'
    const hasKey = feed.gameData?.absChallenges != null
    const mj = countMj(feed)
    const row = byVenue.get(venue) ?? { games: 0, key: 0, mj: 0, mjNoKey: 0, examples: [] }
    row.games += 1
    if (hasKey) row.key += 1
    row.mj += mj
    if (mj > 0 && !hasKey) {
      row.mjNoKey += 1
      if (row.examples.length < 3) row.examples.push(`${g.gamePk} (${date}, ${mj} MJ)`)
    }
    byVenue.set(venue, row)
  }
}

console.log(`sportId ${sportId}, ${dates.length} dates\n`)
console.log('venue'.padEnd(38), 'games  key   MJ   MJ-but-no-key')
for (const [venue, r] of [...byVenue].sort((a, b) => b[1].mjNoKey - a[1].mjNoKey || b[1].games - a[1].games)) {
  const flag = r.mjNoKey > 0 ? '  <-- gate hides a real row' : ''
  console.log(
    venue.slice(0, 37).padEnd(38),
    String(r.games).padStart(4),
    String(r.key).padStart(5),
    String(r.mj).padStart(5),
    String(r.mjNoKey).padStart(8) + flag,
  )
  if (r.examples.length) console.log(' '.repeat(40) + 'e.g. ' + r.examples.join(', '))
}
