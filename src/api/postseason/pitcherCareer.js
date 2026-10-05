import { getJson } from '../statsapi.js'
import { ipToOuts, outsToIp } from '../../lib/math/innings.js'

// ---------------------------------------------------------------------------
// A pitcher's all-time postseason line, ending the day before the cutoff. The
// API's `stats=career` is NOT used: it counts a game in progress, the same
// spoiler `fetchPitcherSeasonLine` (game.js) exists to avoid (ADR-0088). Instead this adds
// the seasons BEFORE `season` (`yearByYear`, finished games only) to
// `thisSeason`, the postseason line that function already returns for the cutoff.
// Rates cannot be averaged, so ERA and WHIP are rebuilt from outs, earned runs,
// hits and walks. A traded arm's season has a keyless combined split; use it,
// else sum the club splits. Returns null for an arm with no postseason games.
// Verified against /api/v1/people/642547/stats?stats=yearByYear&gameType=F,D,L,W
// on 2026-10-05.
// ---------------------------------------------------------------------------

export async function fetchPitcherPostseasonCareer(personId, season, thisSeason = null) {
  if (!personId || !season) return null
  try {
    const data = await getJson(`/api/v1/people/${personId}/stats?stats=yearByYear&group=pitching&gameType=F,D,L,W`)
    const bySeason = new Map()
    for (const s of data.stats?.[0]?.splits ?? []) {
      if (!s.stat || !(Number(s.season) < Number(season))) continue
      const list = bySeason.get(s.season) ?? []
      list.push(s)
      bySeason.set(s.season, list)
    }
    const lines = []
    for (const list of bySeason.values()) {
      const combined = list.find((s) => !s.team)
      for (const s of combined ? [combined] : list) {
        const t = s.stat
        lines.push({
          games: t.gamesPlayed ?? 0,
          gamesStarted: t.gamesStarted ?? 0,
          wins: t.wins ?? 0,
          losses: t.losses ?? 0,
          saves: t.saves ?? 0,
          holds: t.holds ?? 0,
          inningsPitched: t.inningsPitched ?? '',
          strikeOuts: t.strikeOuts ?? 0,
          baseOnBalls: t.baseOnBalls ?? 0,
          hits: t.hits ?? 0,
          earnedRuns: t.earnedRuns ?? 0,
        })
      }
    }
    if (thisSeason) lines.push(thisSeason)
    const sum = (key) => lines.reduce((n, l) => n + (l[key] ?? 0), 0)
    const games = sum('games')
    if (!games) return null
    const outs = lines.reduce((n, l) => n + ipToOuts(l.inningsPitched), 0)
    const hits = sum('hits')
    const walks = sum('baseOnBalls')
    const earned = sum('earnedRuns')
    return {
      games,
      gamesStarted: sum('gamesStarted'),
      wins: sum('wins'),
      losses: sum('losses'),
      saves: sum('saves'),
      holds: sum('holds'),
      era: outs ? ((earned * 27) / outs).toFixed(2) : '',
      inningsPitched: outsToIp(outs),
      strikeOuts: sum('strikeOuts'),
      baseOnBalls: walks,
      whip: outs ? (((hits + walks) * 3) / outs).toFixed(2) : '',
      hits,
      earnedRuns: earned,
    }
  } catch {
    return null
  }
}
