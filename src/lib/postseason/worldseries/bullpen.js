// The bullpen grid for one club (#1906, slice 2). Pure.
//
// SPOILER FOOTING (ADR-0087, ADR-0088). Only games dated BEFORE `slateDate`
// are read, so a box score for the slate date's game is dropped here even if
// the caller handed it in.
//
//   games: [{ gamePk, date, boxscore }]   boxscore: the /game/{pk}/boxscore body; a
//   pitcher's line is teams.{side}.players.ID{n}.stats.pitching (checked live,
//   gamePk 813032: there is no top-level `players`)
//
// A reliever is a pitcher who did not start that game: `pitchers[0]` is the
// starter. Columns are every postseason game the club played before the slate
// date, oldest first (`gameType` rides along so the card can mark the rounds).
// Rows are every pitcher who relieved in any of them, most pitches first. A game
// the club did not play is skipped.
export function bullpenGrid(games, clubId, { slateDate } = {}) {
  const played = []
  for (const g of games ?? []) {
    if (!(g.date < slateDate)) continue
    const teams = g.boxscore?.teams
    const side = teams?.away?.team?.id === clubId ? 'away' : teams?.home?.team?.id === clubId ? 'home' : null
    if (!side) continue
    played.push({ gamePk: g.gamePk, date: g.date, gameType: g.gameType, boxscore: g.boxscore, side })
  }
  played.sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)

  const pitchers = new Map()
  played.forEach((g, col) => {
    const ids = g.boxscore.teams[g.side].pitchers ?? []
    ids.slice(1).forEach((id) => {
      const p = g.boxscore.teams[g.side].players?.[`ID${id}`]
      const n = p?.stats?.pitching?.numberOfPitches
      if (typeof n !== 'number') return
      if (!pitchers.has(id)) pitchers.set(id, { id, name: p?.person?.fullName ?? '', cells: Array(played.length).fill(null), total: 0 })
      const row = pitchers.get(id)
      row.cells[col] = n
      row.total += n
    })
  })

  const rows = [...pitchers.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  return { games: played.map(({ gamePk, date, gameType }) => ({ gamePk, date, gameType })), rows }
}
