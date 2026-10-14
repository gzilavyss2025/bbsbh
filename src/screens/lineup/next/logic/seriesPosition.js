const DAY = 86400000
const dayOf = (iso) => Date.parse(`${iso}T00:00:00Z`)

// Which game of a regular-season series a game is: { n, of }, or null for a one-off meeting.
// `games` are the two clubs' meetings this season (api/schedule.js fetchSeasonSeries rows:
// gamePk, apiDate, homeId). A series is the run of meetings at one park on consecutive days
// (a doubleheader is two on one day). That a later game exists is on the schedule and is not a
// result; no score is read.
export function seriesPosition(games, currentGamePk) {
  const list = [...(games ?? [])].sort((a, b) => a.apiDate.localeCompare(b.apiDate) || (a.gameNumber ?? 0) - (b.gameNumber ?? 0))
  const runs = []
  for (const g of list) {
    const run = runs[runs.length - 1]
    const last = run?.[run.length - 1]
    if (last && last.homeId === g.homeId && dayOf(g.apiDate) - dayOf(last.apiDate) <= DAY) run.push(g)
    else runs.push([g])
  }
  const run = runs.find((r) => r.some((g) => g.gamePk === currentGamePk))
  if (!run || run.length < 2) return null
  return { n: run.findIndex((g) => g.gamePk === currentGamePk) + 1, of: run.length }
}
