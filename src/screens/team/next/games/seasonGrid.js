import { gamePath } from '../../../../lib/route.js'
import { isMlbTeamId } from '../../../../lib/teams.js'

// The season grid's model (the Games band): the club's whole schedule laid out as weeks of seven
// days. Pure and fed one list, so node can test it. `schedule` is `fetchTeamSchedule`'s rows,
// whose `won`, `runs` and `oppRuns` the loader already cut at `?d=`; this file never reads a
// game's Final status, so a result newer than the cutoff stays off the page. Open surface
// (ADR-0034): a decided game shows its score, and links to the box score. A game not decided
// links to the lineup page, as the old season strip did.

const MS = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const GRID_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const toMs = (apiDate) => {
  const [y, m, d] = apiDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10)
// Monday is 0, Sunday 6: the week the grid draws.
const dayIndex = (ms) => (new Date(ms).getUTCDay() + 6) % 7

// w and l are decided games. next is the page's own day when that game is not decided. Every other
// game is still to play.
export function gameState(g, refDate) {
  if (g.won === true) return 'w'
  if (g.won === false) return 'l'
  return refDate && g.apiDate === refDate ? 'next' : 'todo'
}

function gameLabel(g, state, doubled) {
  const result = state === 'w' || state === 'l' ? `${state === 'w' ? 'won' : 'lost'}${g.runs != null && g.oppRuns != null ? ` ${g.runs} to ${g.oppRuns}` : ''}` : 'not decided'
  return [
    g.apiDate,
    `${g.isHome ? 'vs' : 'at'} ${g.opponent.name}`,
    g.round,
    doubled ? `Gm ${g.gameNumber}` : '',
    result,
  ]
    .filter(Boolean)
    .join(' · ')
}

function cellGame(g, refDate, doubled) {
  const state = gameState(g, refDate)
  const decided = state === 'w' || state === 'l'
  const score = decided && g.runs != null && g.oppRuns != null ? `${g.runs}–${g.oppRuns}` : ''
  const mark = `${g.isHome ? '' : '@'}${g.opponent.abbreviation}`
  return {
    key: g.gamePk,
    state,
    post: g.gameType !== 'R',
    isHome: g.isHome,
    dayNight: g.dayNight ?? '',
    opponentId: g.opponent.id,
    opponentName: g.opponent.name,
    doubled,
    // The one-colour mark names an MLB opponent in a whole-day cell. A split day has no room for it,
    // and a club with no mono art keeps its abbreviation.
    logo: !doubled && isMlbTeamId(g.opponent.id),
    // A split day has no room for both lines: each half prints its score, else its opponent.
    mark: doubled ? score || mark : mark,
    score: doubled ? '' : score,
    path: gamePath(g.apiDate, g.away.abbreviation, g.home.abbreviation, decided ? 'boxscore' : 'lineup1', g.gameNumber),
    label: gameLabel(g, state, doubled),
  }
}

function allStarCell(a) {
  return {
    key: `allstar-${a.apiDate}`,
    state: 'asg',
    post: false,
    isHome: false,
    dayNight: '',
    opponentId: null,
    opponentName: '',
    logo: false,
    doubled: false,
    mark: 'ASG',
    score: '',
    path: gamePath(a.apiDate, a.away.abbreviation, a.home.abbreviation, 'lineup1', a.gameNumber),
    label: `${a.apiDate} · All-Star Game · ${a.away.name} vs ${a.home.name}`,
  }
}

// The filters over the grid. A game the filter does not match fades; nothing is removed.
export function filterOptions({ hasPost = false, hasDayNight = false } = {}) {
  const base = [
    { value: 'all', label: 'All' },
    { value: 'home', label: 'Home' },
    { value: 'away', label: 'Away' },
    { value: 'wins', label: 'Wins' },
    { value: 'losses', label: 'Losses' },
  ]
  if (hasDayNight) base.push({ value: 'day', label: 'Day' }, { value: 'night', label: 'Night' })
  if (hasPost) base.push({ value: 'post', label: 'Postseason' })
  return base
}

export function matchesFilter(cell, filter) {
  switch (filter) {
    case 'home':
      return cell.state !== 'asg' && cell.isHome
    case 'away':
      return cell.state !== 'asg' && !cell.isHome
    case 'wins':
      return cell.state === 'w'
    case 'losses':
      return cell.state === 'l'
    case 'day':
      return cell.dayNight === 'day'
    case 'night':
      return cell.dayNight === 'night'
    case 'post':
      return cell.post
    default:
      return true
  }
}

// weeks: Monday to Sunday, from the week of the first game to the week of the last. A week carries
// its month label (the month whose 1st it holds; the first week names its own), whether it holds a
// postseason game, and `postLead` on the first of them, where the gold Postseason band opens. A
// club with no postseason game gets no band, and the grid simply ends.
export function buildSeasonGrid(schedule, allStarGame, refDate) {
  if (!schedule?.length) return null
  const perDay = new Map()
  const add = (apiDate, item) => {
    if (!perDay.has(apiDate)) perDay.set(apiDate, [])
    perDay.get(apiDate).push(item)
  }
  for (const g of schedule) add(g.apiDate, g)
  const counts = new Map([...perDay].map(([date, list]) => [date, list.length]))
  const dayCells = new Map()
  for (const [date, list] of perDay) {
    dayCells.set(
      date,
      list.map((g) => cellGame(g, refDate, list.length > 1)),
    )
  }
  if (allStarGame?.apiDate) {
    const list = dayCells.get(allStarGame.apiDate) ?? []
    list.push(allStarCell(allStarGame))
    dayCells.set(allStarGame.apiDate, list)
  }

  const dates = [...dayCells.keys()].sort()
  const first = toMs(dates[0])
  const last = toMs(dates[dates.length - 1])
  const start = first - dayIndex(first) * MS
  const count = Math.floor((last - start) / MS / 7) + 1

  const weeks = []
  for (let w = 0; w < count; w++) {
    const days = []
    let label = ''
    let post = false
    for (let d = 0; d < 7; d++) {
      const ms = start + (w * 7 + d) * MS
      const date = toIso(ms)
      const games = dayCells.get(date) ?? []
      if (games.some((g) => g.post)) post = true
      if (!label && (new Date(ms).getUTCDate() === 1 || w === 0)) label = MONTHS[new Date(ms).getUTCMonth()]
      days.push({ date, games })
    }
    weeks.push({ key: toIso(start + w * 7 * MS), label, post, postLead: false, days })
  }
  const firstPost = weeks.findIndex((w) => w.post)
  if (firstPost >= 0) {
    weeks[firstPost].postLead = true
  }
  // Day and Night chips need the field on every game: a game without it would fade under both.
  const hasDayNight = schedule.every((g) => g.dayNight)
  return { weeks, hasPost: firstPost >= 0, hasDayNight, doubleHeaders: [...counts.values()].filter((n) => n > 1).length }
}
