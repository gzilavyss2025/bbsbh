// The series' "flow": one win-probability panel per game, drawn from one club's
// side, laid out in game order (SeriesFlow.jsx). Pure geometry-free math: each
// panel is a list of { x, y } with x in 0..1 across the game's plays and y in
// 0..100, the perspective club's win chance.
//
// SPOILER FOOTING (ADR-0087). A panel with points exists only for a COUNTED
// game, one that went Final before the cutoff: the caller passes those games as
// `results` and nothing else has a signal to read. Today's game and the games
// still to play come back as empty slots (`kind: 'today'` / `'ahead'`) with no
// points, whatever `signalsByPk` holds. The slot COUNT is the bracket's own
// (`results` + today + upcoming, worked out from the heading-in wins), never
// the live skeleton's.
//
// Reads the raw winProbability array (`homeTeamWinProbability`, 0-100, one
// entry per completed play) directly. api/winprob.js's selectWinProbPath is
// reveal-only and importer-gated; this page's games are not sealed, but the
// manifest line stays where it is.

const EVEN = 50

// One game's points, from `perspectiveId`'s side. The game opens even, so the
// line starts at 50. `homeId` says which side the club was on; with no home
// club (the game cards read failed) there is no side to draw from, so the
// panel gets no line rather than a guess that could draw a win as a loss.
export function gamePoints(winProb, homeId, perspectiveId) {
  if (!Array.isArray(winProb) || homeId == null) return { points: [], low: null, high: null }
  const flip = homeId !== perspectiveId
  const plays = winProb.filter(
    (e) => typeof e?.homeTeamWinProbability === 'number' && e.about?.inning != null,
  )
  if (plays.length === 0) return { points: [], low: null, high: null }
  const ys = [EVEN, ...plays.map((e) => (flip ? 100 - e.homeTeamWinProbability : e.homeTeamWinProbability))]
  const points = ys.map((y, i) => ({ x: i / (ys.length - 1), y }))
  let low = null
  let high = null
  plays.forEach((e, i) => {
    const y = ys[i + 1]
    const at = { pct: y, inning: e.about.inning, half: e.about.isTopInning ? 'top' : 'bottom' }
    if (!low || y < low.pct) low = at
    if (!high || y > high.pct) high = at
  })
  return { points, low, high }
}

// results: [{ gamePk, gameNumber, winnerId }] counted games, in order.
// today: { gameNumber } | null. upcoming: [{ gameNumber }] (today excluded).
// homeIdByPk: { [gamePk]: homeClubId }. signalsByPk: { [gamePk]: { winProb } }.
export function flowPanels({ results, today, upcoming }, signalsByPk, perspectiveId, homeIdByPk) {
  const panels = (results ?? []).map((g) => {
    const { points, low, high } = gamePoints(
      signalsByPk?.[g.gamePk]?.winProb,
      homeIdByPk?.[g.gamePk],
      perspectiveId,
    )
    return { kind: 'played', gameNumber: g.gameNumber, gamePk: g.gamePk, winnerId: g.winnerId, points, low, high }
  })
  if (today) panels.push({ kind: 'today', gameNumber: today.gameNumber, points: [] })
  for (const g of upcoming ?? []) panels.push({ kind: 'ahead', gameNumber: g.gameNumber, points: [] })
  return panels
}

// The finished series page's input to flowPanels, from postseason-history.json
// games (each with both scores): every game counted, no today, nothing ahead.
// A finished series is over, so its winners are open facts on that page.
export function historyFlowBuckets(games) {
  return {
    results: (games ?? []).map((g) => ({
      gamePk: g.gamePk,
      gameNumber: g.gameNumber,
      winnerId: g.awayScore > g.homeScore ? g.awayTeamId : g.homeTeamId,
    })),
    today: null,
    upcoming: [],
  }
}
