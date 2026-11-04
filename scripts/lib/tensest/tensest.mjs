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

// How many ranks each list keeps (ties may run a list a little past it).
export const LEAGUE_SIZE = 50
export const TEAM_SIZE = 25

// A play below this never reaches a list: the 25th tensest at-bat of any club's
// season sits far above it (about 6 for a club's 5,400 at-bats; the league's 50th
// is 9.99). Keeping the floor low lets the generator hold only a few hundred
// plays in memory, and `assertFloorHolds` fails the run if a list ever reaches it.
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

// Highest first; the game and play order only make the output stable.
const byTense = (a, b) => b.li - a.li || a.pk - b.pk || a.i - b.i

// Rank a list and keep every row whose rank is at most `size`. Rows that share a
// leverage index share a rank (1, 1, 3), the way a leaderboard counts.
export function rankTop(rows, size) {
  const sorted = [...rows].sort(byTense)
  const out = []
  let rank = 0
  let prev = null
  for (let k = 0; k < sorted.length; k += 1) {
    if (sorted[k].li !== prev) {
      rank = k + 1
      prev = sorted[k].li
    }
    if (rank > size) break
    out.push({ ...sorted[k], rank })
  }
  return out
}

const keyOf = (r) => `${r.pk}:${r.i}`

// Fold new rows into a ranked list. A row already in the list (same game and play)
// is replaced, never doubled, so a game that is read twice is harmless.
export function mergeTop(existing, incoming, size) {
  const byKey = new Map()
  for (const r of existing ?? []) byKey.set(keyOf(r), r)
  for (const r of incoming) byKey.set(keyOf(r), r)
  return rankTop([...byKey.values()], size)
}

// The empty store, and one batch of rows folded into it. Each play lands in three
// lists: the whole league, the club that was batting, and the club that was pitching.
// A game with plays to read: Final, and neither postponed ('D') nor cancelled ('C').
// A cancelled game also reports abstractGameCode 'F' but has no winProbability.
export const isPlayedFinal = (g) =>
  g.status?.abstractGameCode === 'F' && g.status?.codedGameState !== 'D' && g.status?.codedGameState !== 'C'

export const emptyStore = () => ({ league: [], teams: {} })

export function addRows(store, rows) {
  const incoming = { league: [], teams: {} }
  for (const r of rows) {
    const batting = r.top ? r.aw : r.hm
    const pitching = r.top ? r.hm : r.aw
    incoming.league.push(r)
    for (const [id, side] of [[batting, 'bat'], [pitching, 'pit']]) {
      const t = (incoming.teams[id] ??= { bat: [], pit: [] })
      t[side].push(r)
    }
  }
  const league = mergeTop(store.league, incoming.league, LEAGUE_SIZE)
  const teams = { ...store.teams }
  for (const [id, t] of Object.entries(incoming.teams)) {
    const had = teams[id] ?? { bat: [], pit: [] }
    teams[id] = { bat: mergeTop(had.bat, t.bat, TEAM_SIZE), pit: mergeTop(had.pit, t.pit, TEAM_SIZE) }
  }
  return { league, teams }
}

// A full list whose last row sits at the floor may have lost rows beneath it. Fail
// loudly rather than publish a table that is short. A list that is not yet full
// (early in a season) holds every play at or above the floor, so it is complete.
export function assertFloorHolds(store) {
  const lists = [
    ['league', store.league, LEAGUE_SIZE],
    ...Object.entries(store.teams).flatMap(([id, t]) => [[`${id} bat`, t.bat, TEAM_SIZE], [`${id} pit`, t.pit, TEAM_SIZE]]),
  ]
  for (const [name, rows, size] of lists) {
    const last = rows.at(-1)
    if (last && last.rank >= size && last.li <= LI_FLOOR) {
      throw new Error(`tensest list "${name}" reaches the ${LI_FLOOR} floor; lower LI_FLOOR`)
    }
  }
}
