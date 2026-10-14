import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { fetchFinalScores } from '../../../../../api/boxlines/fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { fetchBatterGameFouls } from '../../../../../api/fouls.js'
import { gameLogView, loggedSplits, withGameFouls } from '../../../../../api/person/gameLog.js'
import { DASH, num, rate3 } from '../../../../../api/person/shared.js'

// The batter Game Log's rows (#1890, board "BatterGameLog"): one row per game of the season,
// newest first, matching the pitcher log (../pitchlog/pitchlogView.js).
// gameLogView gives the order, the date, the series tag and the club's score; withGameFouls joins
// the pitches seen, whiffs and fouls. THE GUARD: fetchFinalScores holds back every game on
// today's baseball date, and gameLogView gives no result to a row with no score.

// The columns, in the board's order; `card` is the place in LogTable's card look. index.jsx adds the
// cell renderers. The stat keys read the row by key, never by position.
const stat = (key, label) => ({ key, label, card: 'cell' })
export const COLUMNS = [
  { key: 'game', label: 'Game', card: 'head' },
  { key: 'result', label: 'Result · Pos', card: 'end' },
  stat('ab', 'AB'),
  stat('r', 'R'),
  stat('h', 'H'),
  stat('d2', '2B'),
  stat('d3', '3B'),
  stat('hr', 'HR'),
  stat('rbi', 'RBI'),
  stat('bb', 'BB'),
  stat('k', 'K'),
  stat('sb', 'SB'),
  stat('avg', 'AVG'),
  { key: 'seen', label: 'Seen', card: 'foot' },
  { key: 'bar', label: 'Whiffs · fouls · other', card: 'foot' },
]

// gameLog splits (season, any game type) -> { rows } or null with no game. `cutoff` keeps the days
// before it (the page's asOf); `scores` is fetchFinalScores' map; `fouls` is fetchBatterGameFouls'.
export function batlogView(splits, { cutoff = null, scores = null, fouls = null } = {}) {
  const view = withGameFouls(gameLogView(splits, 'hitting', cutoff, Infinity, { scores }), fouls)
  if (!view) return null
  const ordered = loggedSplits(splits, cutoff, Infinity)
  const rows = view.rows.map((r, i) => {
    const s = ordered[i]
    const st = s.stat
    const ab = num(st.atBats)
    const seen = r.pitchesSeen ?? (num(st.numberOfPitches) || null)
    const bar = r.whiffs != null && r.fouls != null && seen != null
    return {
      gamePk: r.gamePk,
      n: ordered.length - i,
      date: r.date,
      home: r.home,
      oppId: s.opponent?.id ?? null,
      opp: s.opponent?.name || r.opp,
      series: r.series,
      post: s.gameType !== 'R',
      result: r.result,
      runs: r.runs,
      oppRuns: r.oppRuns,
      pos: s.positionsPlayed?.map((p) => p.abbreviation).join('/') || DASH,
      ab,
      r: num(st.runs),
      h: num(st.hits),
      d2: num(st.doubles),
      d3: num(st.triples),
      hr: num(st.homeRuns),
      rbi: num(st.rbi),
      bb: num(st.baseOnBalls),
      k: num(st.strikeOuts),
      sb: num(st.stolenBases),
      hbp: num(st.hitByPitch),
      sf: num(st.sacFlies),
      avg: ab ? rate3(num(st.hits) / ab) : DASH,
      seen,
      whiffs: bar ? r.whiffs : null,
      fouls: bar ? r.fouls : null,
      other: bar ? Math.max(seen - r.whiffs - r.fouls, 0) : null,
    }
  })
  return { rows }
}

// The filter: 'all', 'reg' (the regular season) or 'post'.
export const scopeRows = (rows, scope) => (scope === 'all' ? rows : rows.filter((r) => r.post === (scope === 'post')))

// The totals strip over the rows the filter shows. A rate with no denominator prints a dash.
export function totalsOf(rows) {
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0)
  const [ab, h, bb, hbp, sf] = ['ab', 'h', 'bb', 'hbp', 'sf'].map(sum)
  const tb = h + sum('d2') + 2 * sum('d3') + 3 * sum('hr')
  const pa = ab + bb + hbp + sf
  return {
    games: rows.length,
    avg: ab ? rate3(h / ab) : DASH,
    obp: pa ? rate3((h + bb + hbp) / pa) : DASH,
    slg: ab ? rate3(tb / ab) : DASH,
    hr: sum('hr'),
    rbi: sum('rbi'),
  }
}

// One season's games with their scores and fouls, or null (no game, or the log did not load).
export async function loadBatlog(personId, season, asOf) {
  const log = await fetchPersonStats(personId, { type: 'gameLog', group: 'hitting', season, gameType: MLB_LOG_GAME_TYPES })
  const games = log.filter((s) => !asOf || s.date < asOf)
  if (!games.length) return null
  const [scores, fouls] = await Promise.all([
    fetchFinalScores(games, 'hitting', asOf),
    fetchBatterGameFouls(personId, { seasonYear: season }).catch(() => null),
  ])
  return batlogView(games, { cutoff: asOf, scores, fouls })
}
