import { fetchPersonStats } from '../../../../../api/person-fetch.js'
import { fetchFinalScores } from '../../../../../api/boxlines/fetch.js'
import { MLB_LOG_GAME_TYPES } from '../../../../../api/boxlines/rows.js'
import { fetchPitchMixFor } from '../../../../../api/pitchArsenal.js'
import { gameLogView, loggedSplits } from '../../../../../api/person/gameLog.js'
import { DASH, eraOf, num } from '../../../../../api/person/shared.js'
import { ipToOuts, outsToIp } from '../../../../../lib/math/innings.js'
import { PITCH_TYPES } from '../../../../../lib/pitch/pitchTypes.js'
import { teamAbbr } from '../../../../../lib/teams.js'

// The pitcher Game Log's rows (#1851, ADR-0110): one row per game of the season, start or relief
// (Gary, 2026-10-13), newest first.
// gameLogView (api/person/gameLog.js) gives the order, the date, the series tag, the score and the
// decision; this file adds the stat line, the opponent's id for the logo and the pitch mix.
// THE GUARD: fetchFinalScores holds back every game on today's baseball date, and gameLogView
// gives no decision to a row with no score, so a game in progress shows neither.

const isStart = (s) => num(s.stat?.gamesStarted) > 0
// A pitch the table does not know goes last.
const ORDER = PITCH_TYPES.map((t) => t.code)
const rank = (code) => (ORDER.includes(code) ? ORDER.indexOf(code) : ORDER.length)

// `{ code: n }` (one game in the per-start store, which holds relief outings too) -> [{ code, n, pct }] in the fixed order, or null.
function mixOf(byCode) {
  const all = Object.entries(byCode ?? {}).filter(([, n]) => n > 0)
  const total = all.reduce((t, [, n]) => t + n, 0)
  if (!total) return null
  return all.sort(([a], [b]) => rank(a) - rank(b)).map(([code, n]) => ({ code, n, pct: Math.round((100 * n) / total) }))
}

// gameLog splits (season, any game type) -> { rows } or null with no game. `cutoff` keeps the
// days before it (the page's asOf); `scores` is fetchFinalScores' map; `mixes` maps gamePk to the
// per-game store's `{ code: n }`.
export function pitchlogView(splits, { cutoff = null, scores = null, mixes = null } = {}) {
  const view = gameLogView(splits, 'pitching', cutoff, Infinity, { scores })
  if (!view) return null
  const ordered = loggedSplits(splits, cutoff, Infinity)
  const rows = view.rows.map((r, i) => {
    const s = ordered[i]
    const st = s.stat
    const relief = !isStart(s)
    return {
      gamePk: r.gamePk,
      n: ordered.length - i,
      of: ordered.length,
      date: r.date,
      day: s.date,
      gameNumber: s.game?.gameNumber ?? 1,
      home: r.home,
      oppId: s.opponent?.id ?? null,
      opp: s.opponent?.name || r.opp,
      oppAbbr: teamAbbr(s.opponent),
      clubAbbr: teamAbbr(s.team),
      series: r.series,
      post: s.gameType !== 'R',
      relief,
      result: r.runs == null ? null : r.runs > r.oppRuns ? 'W' : r.runs < r.oppRuns ? 'L' : 'T',
      runs: r.runs,
      oppRuns: r.oppRuns,
      // gameLogView's decision is null with no score; with one, a start with no W or L is a
      // no-decision. ND is a start word: a relief outing with none shows none.
      dec: r.runs == null ? null : r.result ?? (relief ? null : 'ND'),
      ip: st.inningsPitched ?? DASH,
      h: num(st.hits),
      r: num(st.runs),
      er: num(st.earnedRuns),
      bb: num(st.baseOnBalls),
      k: num(st.strikeOuts),
      hr: num(st.homeRuns),
      pitches: st.numberOfPitches ?? null,
      strikes: st.strikes ?? null,
      mix: mixOf(mixes?.get(r.gamePk)),
    }
  })
  return { rows }
}

// The key under the rows: every pitch in their bars, in the bars' order.
export const keyOf = (rows) => [...new Set(rows.flatMap((r) => r.mix?.map((m) => m.code) ?? []))].sort((a, b) => rank(a) - rank(b))

// The filter: 'all', 'reg' (the regular season) or 'post'.
export const scopeRows = (rows, scope) => (scope === 'all' ? rows : rows.filter((r) => r.post === (scope === 'post')))

export const games = (n) => `${n} ${n === 1 ? 'game' : 'games'}`

// The table's lines over the loaded seasons, `blocks` = [{ season, rows }] newest first. With
// more than one season, each opens on a divider with its year. In the All view, a divider over
// the regular season and the postseason of a season that has both. `limit` caps the game rows.
export function linesOf(blocks, scope, limit = Infinity) {
  let left = limit
  return blocks.flatMap(({ season, rows: all }) => {
    const scoped = scopeRows(all, scope)
    const rows = scoped.slice(0, left)
    left -= rows.length
    const post = scopeRows(all, 'post').length
    const split = scope === 'all' && post > 0
    const head = blocks.length > 1 ? [{ key: `season-${season}`, divider: String(season), note: all.length ? games(scoped.length) : 'no games on file' }] : []
    return head.concat(
      rows.flatMap((r, i) =>
        split && (i === 0 || r.post !== rows[i - 1].post)
          ? [{ key: `div-${r.gamePk}`, divider: r.post ? 'Postseason' : 'Regular season', note: games(r.post ? post : all.length - post) }, { ...r, key: r.gamePk }]
          : [{ ...r, key: r.gamePk }],
      ),
    )
  })
}

// The season "Load earlier season" fetches next: the one before the oldest loaded, never before
// his debut year (bio.debut). Null when there is none.
export function earlierSeason(loaded, debut) {
  const y = Math.min(...loaded) - 1
  return debut && y >= Number(debut.slice(0, 4)) ? y : null
}

// The totals row over the rows the filter shows. W and L are his decisions on the rows that show one.
export function totalsOf(rows) {
  const sum = (k) => rows.reduce((t, r) => t + r[k], 0)
  const outs = rows.reduce((t, r) => t + ipToOuts(r.ip), 0)
  const era = eraOf(sum('er'), outs)
  return {
    games: rows.length,
    w: rows.filter((r) => r.dec === 'W').length,
    l: rows.filter((r) => r.dec === 'L').length,
    era: era == null ? DASH : era.toFixed(2),
    ip: outsToIp(outs),
    k: sum('k'),
    bb: sum('bb'),
  }
}

// One season's games with their scores and mixes, or null (no game, or the log did not load).
export async function loadPitchlog(personId, season, asOf) {
  const log = await fetchPersonStats(personId, { type: 'gameLog', group: 'pitching', season, gameType: MLB_LOG_GAME_TYPES })
  const games = log.filter((s) => !asOf || s.date < asOf)
  if (!games.length) return null
  const pks = games.map((s) => s.game?.gamePk)
  const [scores, mixes] = await Promise.all([
    fetchFinalScores(games, 'pitching', asOf),
    Promise.all(pks.map((pk) => fetchPitchMixFor(personId, pk, { seasonYear: season }).catch(() => null))),
  ])
  return pitchlogView(games, { cutoff: asOf, scores, mixes: new Map(pks.map((pk, i) => [pk, mixes[i]])) })
}
