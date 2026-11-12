// The pure half of gen-tensest.mjs: turning one play from MLB's winProbability feed
// into a row, and keeping the tensest rows of a season in ranked lists.
//
// "Tense" is MLB's own leverage index (`leverageIndex` on each winProbability play):
// 1.0 is an average at-bat, and the feed stops at 9.99. It is a lookup of the game
// situation (inning, score, outs, runners), so it ties a lot. A tie keeps every row
// that shares a rank, so a list can run past its size by a few rows rather than cut
// a tie in half.
//
// The generator is a top-level script (importing it runs it), so everything worth a
// unit test lives here (scripts/CLAUDE.md).

// The page's own order (src/api/tensest/rank.js), so the file and the page agree.
import { byTense } from '../../../src/api/tensest/rank.js'

// The file keeps every play at or above this (about 2,700 a season): far below what
// the page's ranked lists need (a club's 25th tensest sits near 6), and the set the
// sliced board (#2981) filters.
export const LI_FLOOR = 4

const POS = {
  'left fielder': 'left', 'center fielder': 'center', 'right fielder': 'right', shortstop: 'short',
  'third baseman': 'third', 'second baseman': 'second', 'first baseman': 'first',
  pitcher: 'the pitcher', catcher: 'the catcher',
}

function direction(desc) {
  const hr = /to (left|right) center field/.exec(desc)
  if (hr) return `${hr[1]}-center`
  const f = /to (left|center|right) field\b/.exec(desc)
  if (f) return f[1]
  const lead = desc.split('.')[0]
  for (const [k, v] of Object.entries(POS)) if (new RegExp(`\\b${k}\\b`).test(lead)) return v
  return ''
}

export const lastName = (full) => {
  const p = String(full).trim().split(' ')
  return /^(Jr\.?|Sr\.?|II|III|IV)$/.test(p.at(-1)) ? p.slice(-2).join(' ') : p.at(-1)
}

// Last names of the runners the play's own text says scored. A suffix keeps its
// period out of the way first ("Fernando Tatis Jr. scores."), since the name pattern
// stops at a period.
export function scorers(desc) {
  const out = []
  const text = String(desc).replace(/\b(Jr|Sr)\./g, '$1')
  for (const m of text.matchAll(/(?<=^|[.,] )([A-Z][^.,]*?) scores\./g)) out.push(lastName(m[1]).replace(/ (Jr|Sr)$/, ' $1.'))
  return out
}

const list = (xs) =>
  xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`

// What the batter did, in parts: the verb ("singled to center"), whether the pitcher
// reads as "off" (a hit) or "against" (an out), and the runners who scored
// (", scoring Yelich", or ''). An event it has no words for falls back to the feed's
// own event name.
export function playParts(play) {
  const ev = String(play?.result?.event ?? '').toLowerCase()
  const desc = String(play?.result?.description ?? '')
  const runs = scorers(desc)
  const dir = direction(desc)
  const to = dir ? ` to ${dir}` : ''
  const scoring = runs.length ? `, scoring ${list(runs)}` : ''
  const out = (verb, { hit = false, scores = false } = {}) => ({ verb, hit, scoring: scores ? scoring : '' })
  if (ev === 'single') return out(`singled${to}`, { hit: true, scores: true })
  if (ev === 'double') return out(`doubled${to}`, { hit: true, scores: true })
  if (ev === 'triple') return out(`tripled${to}`, { hit: true, scores: true })
  if (ev === 'home run') {
    const n = runs.length + 1
    const kind = n === 1 ? 'a solo homer' : n === 2 ? 'a two-run homer' : n === 3 ? 'a three-run homer' : 'a grand slam'
    return out(`hit ${kind}${to}`, { hit: true })
  }
  if (ev.includes('sac fly')) return out(`hit a sacrifice fly${to}`, { scores: true })
  if (ev.includes('sac bunt')) return out('bunted', { scores: true })
  if (ev.includes('strikeout')) {
    if (ev.includes('double play') || /double play/.test(desc)) return out('struck out into a double play')
    return out(/called out on strikes/.test(desc) ? 'struck out looking' : 'struck out swinging')
  }
  if (ev === 'triple play') return out('hit into a triple play')
  // The event name decides a double play, not any mention of one in the text.
  if (ev.includes('double play') || /\bdp\b/.test(ev)) return out('grounded into a double play')
  if (ev === 'groundout') return out(`grounded out${to}`, { scores: true })
  if (ev === 'flyout') return out(`flew out${to}`, { scores: true })
  if (ev === 'lineout') return out(`lined out${to}`, { scores: true })
  if (ev === 'pop out' || ev === 'popout') return out(`popped out${to}`)
  if (ev === 'forceout' || ev === 'force out') return out('hit into a force out', { scores: true })
  if (ev === 'walk') return out(runs.length ? 'walked in a run' : 'walked')
  if (ev === 'intent walk') return out(runs.length ? 'was walked on purpose, forcing in a run' : 'was walked on purpose')
  if (ev === 'hit by pitch') return out(runs.length ? 'was hit by a pitch, forcing in a run' : 'was hit by a pitch')
  if (ev.includes('error')) return out('reached on an error', { scores: true })
  if (ev.includes('fielders choice') || ev.includes("fielder's choice")) return out('reached on a fielder\u2019s choice', { scores: true })
  if (ev.includes('interference')) return out('reached on catcher\u2019s interference', { scores: true })
  return out(ev || 'batted')
}

// The batter's line as one string: "singled to center, scoring Yelich".
export const describePlay = (play) => {
  const { verb, scoring } = playParts(play)
  return verb + scoring
}

// The game's numbers the page links and labels with: `gn` the doubleheader game (only when
// past 1, as the box score's URL needs it) and `sg` the game of a postseason series
// ("NLDS G1"). Kept off the row when absent, so the file stays small.
export function gameNumbers(game) {
  const out = {}
  if (game?.gameNumber > 1) out.gn = game.gameNumber
  if (game?.gameType !== 'R' && game?.seriesGameNumber > 0) out.sg = game.seriesGameNumber
  return out
}

// One game's plays -> the rows worth keeping. `game` is a schedule row
// ({ gamePk, gameType, officialDate, teams: { away, home } }).
export function playRows(game, plays) {
  const rows = []
  const away = game.teams.away
  const home = game.teams.home
  ;(plays ?? []).forEach((p, i) => {
    const li = Number(p?.leverageIndex)
    if (!(li >= LI_FLOOR) || !p.matchup?.batter || !p.matchup?.pitcher || !p.about) return
    rows.push({
      pk: game.gamePk,
      i,
      d: game.officialDate,
      gt: game.gameType,
      ...gameNumbers(game),
      aw: away.team.id,
      hm: home.team.id,
      as: away.score ?? null,
      hs: home.score ?? null,
      inn: p.about.inning,
      top: p.about.isTopInning ? 1 : 0,
      li,
      bid: p.matchup.batter.id,
      bn: p.matchup.batter.fullName,
      pid: p.matchup.pitcher.id,
      pn: p.matchup.pitcher.fullName,
      what: describePlay(p),
      // The park, from the schedule game: not the home club's, because of neutral sites.
      vid: game.venue?.id ?? null,
      vn: game.venue?.name ?? null,
    })
  })
  return rows
}

// One game's rows, or an error when the feed has no plays at all. A Final game always
// has plays, so an empty answer means MLB has not published the feed yet; throwing
// keeps the game off the generator's done list so the next run reads it again.
export function gameRowsOrThrow(game, plays) {
  if (!Array.isArray(plays) || plays.length === 0) throw new Error(`no winProbability plays for game ${game.gamePk}`)
  return playRows(game, plays)
}

const keyOf = (r) => `${r.pk}:${r.i}`

// A game with plays to read: Final, and neither postponed ('D') nor cancelled ('C').
// A cancelled game also reports abstractGameCode 'F' but has no winProbability.
export const isPlayedFinal = (g) =>
  g.status?.abstractGameCode === 'F' && g.status?.codedGameState !== 'D' && g.status?.codedGameState !== 'C'

// The season's flat list of tense plays (#2981), tensest first: every play at or
// above LI_FLOOR, kept whole so the page can slice it by batter, pitcher, park and
// club. A play already in the list (same game and play) is replaced, never doubled,
// so a game read twice is harmless.
export function mergePlays(existing, incoming) {
  const byKey = new Map()
  for (const r of existing ?? []) byKey.set(keyOf(r), r)
  for (const r of incoming) byKey.set(keyOf(r), r)
  return [...byKey.values()].sort(byTense)
}
