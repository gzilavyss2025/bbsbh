// THE one classifier for World Series events: what each tag means, defined once. The
// hand-run generator (scripts/gen-world-series-events.mjs) and the live callout builder
// both import it. Pure: no I/O, no clock. Contract: .scratch/world-series-callouts/contract.md.
//
// classifyGame(playByPlay, { innings, wta, clubs, game }) -> event rows, one per
// { tag, ...game, club, player, value, wta }. `playByPlay` is the /game/{pk}/playByPlay
// body. `clubs` is { away, home } (club ids). `game` is { pk, date, season, n } and is
// copied onto each row. `wta` is true for a winner-take-all game. `innings` defaults to
// the last play's inning.
//
// A "play" is one entry of allPlays. The last play has the highest atBatIndex, and the
// final score is its result.awayScore / result.homeScore (a schedule row can lack it).
// The tags read result.eventType, never the display `event`: event "Triple" is a HIT.
//
//   grandSlam         home_run with rbi 4.
//   walkOffHr         last play, bottom half, home_run, the home club wins.
//   walkOffGrandSlam  walkOffHr with rbi 4.
//   openingHrPair     the first two plays are both home_run. club: the batting club.
//   pinchHitHr        home_run whose play holds an offensive_substitution event
//                     "Pinch-hitter" for that batter. value: rbi.
//   pinchHitGrandSlam pinchHitHr with rbi 4.
//   extraInningHr     home_run in inning 10 or later.
//   multiHrGame       one batter, 3 or more home runs. value: the count.
//   pitcherHit        wta games only. The result is single, double, triple or home_run, and
//                     the batter is a starting pitcher or has thrown a pitch in a play up to
//                     and including this one. It reads no later play, so the live card (which
//                     may not) gives the same answer as the history.
//   gameEndingDp      the last play's eventType holds "double_play". club: the fielding
//                     club, the one that turned it.
//   triplePlay        eventType triple_play, or a description saying "triple play".
//                     club: the fielding club.
//   extraInnings      innings 10 or more. value: innings. club: null.
//   shutout           a decided game where one club has 0 runs. club: the winner.
//                     value: the winner's runs.
//   bigScore          a club with 10 or more runs. value: runs. One row per club.
//   bigComeback       the winner trailed by 4 or more after some play. value: the
//                     largest deficit. club: the winner.
//   reachedBase       one batter, 5 or more ON_BASE results in the game. value: count.
//   wtaTrailing9      wta games. The score after the last play of inning 8 or earlier;
//                     level gives no row. club: the trailing club. value: 1 if it won,
//                     else 0.
//
// A tied game has no winner: the winner-based tags give it no row.
import { ON_BASE_EVENTS } from '../../api/callout-notes/shared.js'

export const WS_BIG_SCORE = 10
export const WS_BIG_COMEBACK = 4
export const WS_REACHED_BASE = 5
export const WS_MULTI_HR = 3
export const WS_EXTRA_INNINGS = 10

const HITS = new Set(['single', 'double', 'triple', 'home_run'])

const evt = (p) => p.result?.eventType
const rbi = (p) => p.result?.rbi ?? 0
export const batterId = (p) => p.matchup?.batter?.id ?? null
export const isHr = (p) => evt(p) === 'home_run'
const battingSide = (p) => (p.about?.isTopInning ? 'away' : 'home')
const fieldingSide = (p) => (p.about?.isTopInning ? 'home' : 'away')

export const orderedPlays = (pbp) =>
  [...(pbp?.allPlays ?? [])].sort((a, b) => a.about.atBatIndex - b.about.atBatIndex)

// The final score and the side that won ('away', 'home' or null for a tie).
export function finalScore(plays) {
  const last = plays[plays.length - 1]
  const awayRuns = last?.result?.awayScore ?? 0
  const homeRuns = last?.result?.homeScore ?? 0
  const winner = awayRuns === homeRuns ? null : awayRuns > homeRuns ? 'away' : 'home'
  return { awayRuns, homeRuns, winner }
}

export const isGrandSlam = (p) => isHr(p) && rbi(p) === 4

export function isWalkOffHr(last, { winner }) {
  return Boolean(last) && last.about.isTopInning === false && isHr(last) && winner === 'home'
}

export const isOpeningHrPair = (plays) => plays.length >= 2 && isHr(plays[0]) && isHr(plays[1])

export function isPinchHitHr(p) {
  if (!isHr(p)) return false
  return (p.playEvents ?? []).some(
    (e) => e.details?.eventType === 'offensive_substitution'
      && /pinch-hitter/i.test(e.details?.description ?? '')
      && e.player?.id === batterId(p),
  )
}

export const isExtraInningHr = (p) => isHr(p) && p.about.inning >= WS_EXTRA_INNINGS

export const isGameEndingDp = (last) => Boolean(last) && (evt(last) ?? '').includes('double_play')

export const isTriplePlay = (p) => evt(p) === 'triple_play' || /triple play/i.test(p.result?.description ?? '')

// ids that threw a pitch in `plays`.
export const pitcherIds = (plays) => new Set(plays.map((p) => p.matchup?.pitcher?.id).filter(Boolean))

// The two starting pitchers, from the plays: the first arm each side fields. The live card
// reads the lineup instead (boxscore pitchers[0], known before the first pitch).
export function startingPitchers(plays) {
  const first = {}
  for (const p of plays) first[fieldingSide(p)] ??= p.matchup?.pitcher?.id
  return Object.values(first).filter(Boolean)
}

// THE pitcherHit rule: plays[i] is a hit by a starter or by a man who has pitched by then.
export const isPitcherHitAt = (plays, i, starters) =>
  HITS.has(evt(plays[i])) && (starters.includes(batterId(plays[i])) || pitcherIds(plays.slice(0, i + 1)).has(batterId(plays[i])))

// The largest deficit the side `winner` faced after any play.
export function largestDeficit(plays, winner) {
  let worst = 0
  for (const p of plays) {
    const a = p.result?.awayScore ?? 0
    const h = p.result?.homeScore ?? 0
    worst = Math.max(worst, winner === 'home' ? a - h : h - a)
  }
  return worst
}

// Score after the last play of inning 8 or earlier -> { trailing: side, won: 0|1 } or null when level.
export function trailingAfter8(plays, { winner }) {
  const through8 = plays.filter((p) => p.about.inning <= 8)
  const last = through8[through8.length - 1]
  if (!last) return null
  const a = last.result.awayScore
  const h = last.result.homeScore
  if (a === h) return null
  const trailing = a < h ? 'away' : 'home'
  return { trailing, won: trailing === winner ? 1 : 0 }
}

export function classifyGame(pbp, { innings, wta = false, clubs, game = {} } = {}) {
  const plays = orderedPlays(pbp)
  if (!plays.length) return []
  const last = plays[plays.length - 1]
  const score = finalScore(plays)
  const { winner } = score
  const length = innings ?? last.about.inning
  const out = []
  const add = (tag, club, player = null, value = null) =>
    out.push({ tag, ...game, club, player, value, wta })
  const club = (side) => clubs[side]

  const perBatter = new Map()
  const starters = startingPitchers(plays)
  plays.forEach((p, i) => {
    const bat = batterId(p)
    if (isGrandSlam(p)) add('grandSlam', club(battingSide(p)), bat)
    if (isExtraInningHr(p)) add('extraInningHr', club(battingSide(p)), bat)
    if (isPinchHitHr(p)) {
      add('pinchHitHr', club(battingSide(p)), bat, rbi(p))
      if (rbi(p) === 4) add('pinchHitGrandSlam', club(battingSide(p)), bat)
    }
    if (wta && isPitcherHitAt(plays, i, starters)) add('pitcherHit', club(battingSide(p)), bat)
    if (isTriplePlay(p)) add('triplePlay', club(fieldingSide(p)))
    const t = perBatter.get(bat) ?? { side: battingSide(p), hr: 0, base: 0 }
    if (isHr(p)) t.hr += 1
    if (ON_BASE_EVENTS.has(evt(p))) t.base += 1
    perBatter.set(bat, t)
  })
  for (const [bat, t] of perBatter) {
    if (t.hr >= WS_MULTI_HR) add('multiHrGame', club(t.side), bat, t.hr)
    if (t.base >= WS_REACHED_BASE) add('reachedBase', club(t.side), bat, t.base)
  }

  if (isWalkOffHr(last, score)) {
    add('walkOffHr', club('home'), batterId(last))
    if (rbi(last) === 4) add('walkOffGrandSlam', club('home'), batterId(last))
  }
  if (isOpeningHrPair(plays)) add('openingHrPair', club(battingSide(plays[0])))
  if (isGameEndingDp(last)) add('gameEndingDp', club(fieldingSide(last)))
  if (length >= WS_EXTRA_INNINGS) add('extraInnings', null, null, length)

  if (winner) {
    const loserRuns = winner === 'home' ? score.awayRuns : score.homeRuns
    const winnerRuns = winner === 'home' ? score.homeRuns : score.awayRuns
    if (loserRuns === 0) add('shutout', club(winner), null, winnerRuns)
    const deficit = largestDeficit(plays, winner)
    if (deficit >= WS_BIG_COMEBACK) add('bigComeback', club(winner), null, deficit)
  }
  for (const side of ['away', 'home']) {
    const runs = side === 'away' ? score.awayRuns : score.homeRuns
    if (runs >= WS_BIG_SCORE) add('bigScore', club(side), null, runs)
  }
  if (wta) {
    const t = trailingAfter8(plays, score)
    if (t) add('wtaTrailing9', club(t.trailing), null, t.won)
  }
  return out
}
