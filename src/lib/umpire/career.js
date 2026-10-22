// The umpire page's career figures (#1565): plate games by season, and one club's
// record with him behind the plate. Two stores, no overlap, joined into one span:
// api/history/umpireHistory.js (2000-2022) and the umpires/ game rows (2023 on).
// The rows also hold Triple-A games and the All-Star Game; the history does not,
// so both are left out here. A tie is a game worked and in no record.
//
// Pure, no fetch. Past seasons only, and a career line is not a score (ADR-0034).

const MIN_CHART_SEASONS = 3 // a bar strip of one or two seasons says nothing
const MIN_BAR_GAMES = 5 // a split of fewer decided games reads as a verdict

// -> { seasons: [{ season, plate, share, partial }], showChart, peakText,
//      record: { wins, losses, winShare, showBar } | null, label }
// `history` is careerSeasons(); `record` is recordWith() or null; `rows` are the
// 'all' view's game rows. `partial` marks the season still being played.
export function umpireCareer({ history = [], record = null, rows = [], teamId, clubName, now = new Date() }) {
  const games = rows.filter((g) => (g.level ?? 'MLB') === 'MLB' && g.gameType !== 'A')
  const plate = new Map()
  for (const h of history) if (h.games > 0) plate.set(h.season, h.byRole.HP ?? 0)
  for (const g of games) {
    const s = Number(g.date.slice(0, 4))
    plate.set(s, (plate.get(s) ?? 0) + (g.role === 'HP' ? 1 : 0))
  }
  const years = [...plate.keys()]
  if (!years.length) return { seasons: [], showChart: false, peakText: '', record: null, label: '' }
  const first = Math.min(...years)
  const last = Math.max(...years)
  const max = Math.max(...plate.values())
  // Playing runs through October's postseason; November starts the winter.
  const live = now.getMonth() < 10 ? now.getFullYear() : null
  const seasons = Array.from({ length: last - first + 1 }, (_, i) => {
    const n = plate.get(first + i) ?? 0
    return { season: first + i, plate: n, share: max ? n / max : 0, partial: first + i === live }
  })

  let wins = record?.wins ?? 0
  let losses = record?.losses ?? 0
  for (const g of games) {
    if (g.role !== 'HP' || g.awayScore == null || g.homeScore == null || g.awayScore === g.homeScore) continue
    const home = g.homeId === teamId
    if (!home && g.awayId !== teamId) continue
    if ((g.homeScore > g.awayScore) === home) wins++
    else losses++
  }
  const peak = seasons.reduce((a, b) => (b.plate > a.plate ? b : a))
  const latest = seasons.at(-1)
  const peakText =
    peak.season === latest.season
      ? `${latest.plate} in ${latest.season}, the most`
      : `${peak.plate} most (${peak.season}) · ${latest.plate} in ${latest.season}`
  return {
    seasons,
    showChart: seasons.length >= MIN_CHART_SEASONS,
    peakText,
    record: wins + losses ? { wins, losses, winShare: wins / (wins + losses), showBar: wins + losses >= MIN_BAR_GAMES } : null,
    label: `${clubName} · ${first === last ? first : `${first}–${last}`}`,
  }
}
