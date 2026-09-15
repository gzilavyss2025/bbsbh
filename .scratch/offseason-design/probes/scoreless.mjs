// The 87 A+ 2025 rows my pool excluded: what are they, and are any of them
// actually scoreable? (A postponed game reports Final with no score, but most
// scoreless rows turn out to be games that WERE played -- see the #1031 note.)
const j = await (await fetch(
  'https://statsapi.mlb.com/api/v1/schedule?sportId=13&season=2025&gameType=R',
)).json()
const seen = new Map()
for (const d of j.dates ?? []) for (const g of d.games ?? []) if (!seen.has(g.gamePk)) seen.set(g.gamePk, { ...g, date: d.date })
const scoreless = [...seen.values()].filter(
  (g) => g?.teams?.away?.score == null || g?.teams?.home?.score == null,
)
const byStatus = {}
for (const g of scoreless) byStatus[g.status.detailedState] = (byStatus[g.status.detailedState] || 0) + 1
console.log('scoreless rows:', scoreless.length, byStatus)

// Ask each one's own linescore -- 47 bytes, and it is the only thing that tells
// a played game from an unplayed one.
let played = 0
const playedPks = []
for (const g of scoreless) {
  try {
    const ls = await (await fetch(
      `https://statsapi.mlb.com/api/v1/game/${g.gamePk}/linescore?fields=teams,home,away,runs`,
    )).json()
    if (ls?.teams?.home?.runs != null && ls?.teams?.away?.runs != null) { played++; playedPks.push(g.gamePk) }
  } catch { /* leave it out of the pool */ }
  await new Promise((s) => setTimeout(s, 60))
}
console.log('of those, really played:', played, playedPks.slice(0, 10))
