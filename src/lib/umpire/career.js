// The umpire page's career figures (#1565): plate games by season, and one club's
// record with him behind the plate. Two stores, no overlap, joined into one span:
// api/history/umpireHistory.js (2000-2022) and the umpires/ game rows (2023 on).
// The rows also hold Triple-A games and the All-Star Game; the history does not,
// so both are left out here. A tie is a game worked and in no record.
//
// Pure, no fetch. Spoiler-free: past seasons, and a career line is not a score (ADR-0034).

// -> { seasons: [{ season, plate, share }], record: { wins, losses, winShare } | null, caption }
// `history` is careerSeasons(); `record` is recordWith() or null; `rows` are the
// 'all' view's game rows.
export function umpireCareer({ history = [], record = null, rows = [], teamId, name, clubName }) {
  const games = rows.filter((g) => (g.level ?? 'MLB') === 'MLB' && g.gameType !== 'A')
  const plate = new Map()
  for (const h of history) if (h.games > 0) plate.set(h.season, h.byRole.HP ?? 0)
  for (const g of games) {
    const s = Number(g.date.slice(0, 4))
    plate.set(s, (plate.get(s) ?? 0) + (g.role === 'HP' ? 1 : 0))
  }
  const years = [...plate.keys()]
  if (!years.length) return { seasons: [], record: null, caption: '' }
  const first = Math.min(...years)
  const last = Math.max(...years)
  const max = Math.max(0, ...plate.values())
  const seasons = Array.from({ length: last - first + 1 }, (_, i) => {
    const n = plate.get(first + i) ?? 0
    return { season: first + i, plate: n, share: max ? n / max : 0 }
  })

  let wins = record?.wins ?? 0
  let losses = record?.losses ?? 0
  for (const g of games) {
    if (g.role !== 'HP' || g.awayScore === g.homeScore) continue
    const home = g.homeId === teamId
    if (!home && g.awayId !== teamId) continue
    if ((g.homeScore > g.awayScore) === home) wins++
    else losses++
  }
  const span = first === last ? `${first}` : `${first}-${last}`
  return {
    seasons,
    record: wins + losses ? { wins, losses, winShare: wins / (wins + losses) } : null,
    caption: `${clubName} with ${name} behind the plate, ${span}`,
  }
}
