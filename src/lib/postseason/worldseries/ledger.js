// The World Series ledger table's model (#1906, slice 2). Pure.
//
// SPOILER FOOTING (ADR-0087). Past games (official date BEFORE the slate date)
// show their runs openly. The slate date's own game is a seal: its runs are
// read only under `live` (Scores Unlocked). A runsByGame entry for any other
// game is never read, so a Final that landed after the cutoff cannot leak
// through a caller that handed in too much.
//
//   games     bracket worldSeries.games:    { gamePk, gameNumber, date }
//   upcoming  bracket worldSeries.upcoming: { gameNumber, gamePk, date, ifNecessary }
//   runsByGame foldRunsByGame's output, keyed by CLUB id (home/away swap).
//
// Columns: one per game, plus one "off" column where two consecutive dated
// games have a day between them (dayShape decides). An if-necessary game has
// no date, so it never gets an off column before it. Cells per club row:
// runs | seal (one cell per row; `lead` is the row that carries rowSpan=2) |
// empty | off.
import { dayShape } from '../dayShape.js'

const OFF_SHAPES = new Set(['Off day before', 'Travel day before'])

export function ledgerModel({ clubIds, games = [], upcoming = [], runsByGame = {}, slateDate, live = false }) {
  const byNumber = new Map()
  for (const g of games) byNumber.set(g.gameNumber, { gameNumber: g.gameNumber, gamePk: g.gamePk, date: g.date ?? null, ifNecessary: false })
  for (const g of upcoming) {
    if (byNumber.has(g.gameNumber)) continue
    byNumber.set(g.gameNumber, { gameNumber: g.gameNumber, gamePk: g.gamePk ?? null, date: g.date ?? null, ifNecessary: !!g.ifNecessary })
  }
  const gameCols = [...byNumber.values()]
    .sort((a, b) => a.gameNumber - b.gameNumber)
    .map((g) => ({
      kind: 'game',
      ...g,
      state: !g.date || g.date > slateDate ? 'future' : g.date === slateDate ? 'today' : 'past',
    }))

  const columns = []
  gameCols.forEach((col, i) => {
    const prev = gameCols[i - 1]
    if (prev && OFF_SHAPES.has(dayShape({ date: prev.date }, { date: col.date }))) {
      columns.push({ kind: 'off', afterGame: prev.gameNumber, today: prev.date < slateDate && slateDate < col.date })
    }
    columns.push(col)
  })

  const runsFor = (pk, clubId) => {
    const entry = runsByGame[pk]
    if (!entry) return null
    const side = entry.awayId === clubId ? 'away' : entry.homeId === clubId ? 'home' : null
    const v = side ? entry.runs?.[side] : null
    return v == null ? null : v
  }

  const rows = clubIds.map((clubId, rowIdx) => ({
    clubId,
    cells: columns.map((col) => {
      if (col.kind === 'off') return { kind: 'off', today: col.today }
      if (col.state === 'past') {
        const v = runsFor(col.gamePk, clubId)
        return v == null ? { kind: 'empty' } : { kind: 'runs', value: v }
      }
      if (col.state === 'today') {
        if (!live) return { kind: 'seal', lead: rowIdx === 0 }
        const v = runsFor(col.gamePk, clubId)
        return v == null ? { kind: 'empty' } : { kind: 'runs', value: v }
      }
      return { kind: 'empty' }
    }),
  }))

  return { columns, rows }
}
