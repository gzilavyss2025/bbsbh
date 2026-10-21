// The World Series hero's pure parts (#1906; the versus redesign chosen by Gary, 2026-10-20). Pure.
//
//   calendarDays  the Series as day cells, from ledgerModel's `columns`. Nothing here reads a
//                 result: a cell knows its date, its game number and its state, never a run.
//   monthsOf      the calendar head's month label, from those cells.
//   slabPlayer    the hitter drawn on a club's slab, from the hot-bat splits (fetchHotBatSplits,
//                 which end the day before the slate date).
//   playerClip    that hitter's newest play clip, from past games' /content items.
import { classifyHighlight, isEligibleForPositiveFilter } from '../../../api/highlights.js'
import { gamePath } from '../../route.js'

// 'Fri' and 23 from '2026-10-23'. Noon UTC keeps the date on its own day in every zone.
const at = (date) => new Date(`${date}T12:00:00Z`)
const weekdayOf = (date) => (date ? at(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) : '')
const dayOf = (date) => (date ? Number(date.slice(8, 10)) : null)
const monthOf = (date) => at(date).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })

// 'October / November': the months the calendar's dated cells fall in, each once, in order.
export function monthsOf(days) {
  return [...new Set(days.filter((d) => d.date).map((d) => monthOf(d.date)))].join(' / ')
}
const dayAfter = (date) => {
  if (!date) return null
  const d = at(date)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// The World Series format, 2-3-2: an off day after Game 2 and after Game 5, none between the rest.
const OFF_AFTER = new Set([2, 5])

// bracket.js hides an if-needed game's date and gamePk: the live schedule keeping or dropping
// that row can tell how the Series ended. The home page still dates those cells [DECISION: Gary,
// 2026-10-20, "Fix this. Override."], from the FORMAT, never from that row: an undated if-needed
// game gets the day after the game before it, or two days after Game 2 or Game 5. Nothing here
// reads the hidden row, so the bracket's guard holds. Only an if-needed game is dated this way (a
// game that is certain but has no row stays undated), and only to a day after the slate date: a
// projection on or before it would mark a game today or past that the schedule never put there.
// A real date is never replaced. Marks the worked-out ones `projected`.
// `games` are the played games ({ gameNumber, date }), `upcoming` the bracket's list.
export function withFormatDates(games, upcoming, slateDate = '') {
  const dateOf = new Map([...(games ?? []), ...(upcoming ?? [])].filter((g) => g.date).map((g) => [g.gameNumber, g.date]))
  return [...(upcoming ?? [])]
    .sort((a, b) => a.gameNumber - b.gameNumber)
    .map((g) => {
      if (g.date || !g.ifNecessary) return g
      const prev = dateOf.get(g.gameNumber - 1)
      if (!prev) return g
      const date = OFF_AFTER.has(g.gameNumber - 1) ? dayAfter(dayAfter(prev)) : dayAfter(prev)
      if (date <= slateDate) return g
      dateOf.set(g.gameNumber, date)
      return { ...g, date, projected: true }
    })
}

// The path to a section of the focus game. A game is filed under its OWN date, which is not the
// slate date on an off day (Game 1's preview opened on today's slate found no game).
export function nextGamePath(game, slateDate, abbr, section) {
  if (!game?.awayId) return null
  return gamePath(game.date || slateDate, abbr[game.awayId], abbr[game.homeId], section)
}

// The next game: the first future game that is not "if needed".
export function nextGameNumber(columns) {
  return columns.find((c) => c.kind === 'game' && c.state === 'future' && !c.ifNecessary)?.gameNumber ?? null
}

// -> [{ key, kind: 'game' | 'off' | 'today', date, weekday, day, gameNumber, today, next, maybe }]
// One cell per game and one per off day, in order. An off cell is dated the day after the game
// before it (the slate date when it is today). When no cell is today (the days before Game 1),
// a plain 'today' cell goes in before the first later game, so today is always on the strip.
export function calendarDays(columns, slateDate) {
  const next = nextGameNumber(columns)
  const days = []
  let prevDate = null
  for (const c of columns) {
    if (c.kind === 'off') {
      const date = c.today ? slateDate : dayAfter(prevDate)
      days.push({ key: `off-${c.afterGame}`, kind: 'off', date, gameNumber: null, today: Boolean(c.today), next: false, maybe: false })
      continue
    }
    days.push({
      key: `g${c.gameNumber}`,
      kind: 'game',
      date: c.date ?? null,
      gameNumber: c.gameNumber,
      today: c.state === 'today',
      next: c.gameNumber === next,
      maybe: Boolean(c.ifNecessary),
    })
    prevDate = c.date ?? prevDate
  }
  if (!days.some((d) => d.today)) {
    const slot = days.findIndex((d) => !d.date || d.date > slateDate)
    const cell = { key: 'today', kind: 'today', date: slateDate, gameNumber: null, today: true, next: false, maybe: false }
    days.splice(slot === -1 ? days.length : slot, 0, cell)
  }
  return days.map((d) => ({ ...d, weekday: weekdayOf(d.date), day: dayOf(d.date) }))
}

// Before Game 1 is played, the slab shows a hitter Gary chose for each club; from then on, the
// rule below. [DECISION: Gary, 2026-10-20: "Before the series starts, show me Yandy Diaz and
// Jake Bauers. Then after each game we can go with best ops 25+ PA."] Keyed by season, then club.
export const PRE_SERIES_PICKS = { 2026: { 139: 650490, 158: 641343 } }
export const MIN_PA = 25

const shape = (s) => ({
  id: s.player?.id ?? null,
  name: s.player?.fullName ?? '',
  pos: s.position?.abbreviation ?? '',
  pa: Number(s.stat?.plateAppearances) || 0,
  ops: s.stat?.ops ?? '',
})
const opsOf = (row) => Number.parseFloat(row.ops)

// -> { id, name, pos, pa, ops } or null. `started`: a Series game has been played before the
// slate date. The rule: the best OPS among hitters with MIN_PA or more (a tie goes to more PA);
// with nobody at MIN_PA, the most PA. "-.--" parses to NaN and never wins on OPS.
export function slabPlayer(splits, { clubId, season, started }) {
  const rows = (splits ?? []).map(shape).filter((r) => r.id && r.pa > 0)
  if (!rows.length) return null
  const chosen = started ? null : PRE_SERIES_PICKS[Number(season)]?.[clubId]
  const pick = chosen && rows.find((r) => r.id === chosen)
  if (pick) return pick
  const regulars = rows.filter((r) => r.pa >= MIN_PA && Number.isFinite(opsOf(r)))
  if (regulars.length) {
    return regulars.reduce((best, r) => (opsOf(r) > opsOf(best) || (opsOf(r) === opsOf(best) && r.pa > best.pa) ? r : best))
  }
  return rows.reduce((best, r) => (r.pa > best.pa ? r : best))
}

// The games whose clips the play buttons read: each club's last `perClub` postseason games
// before the slate date, from fetchClubGames' rows, once each (a Series game is both clubs').
// Few on purpose: every game is one /content read on page load. Sorted by gamePk, so the list
// (and the fetch key built from it) is the same whichever club comes first.
export function clipSources(clubGames, clubIds, slateDate, { perClub = 3 } = {}) {
  const seen = new Set()
  const out = []
  for (const id of clubIds ?? []) {
    const rows = (clubGames?.[id] ?? []).filter((g) => g.gamePk && g.date && g.date < slateDate)
    const last = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-perClub)
    for (const g of last) {
      if (seen.has(g.gamePk)) continue
      seen.add(g.gamePk)
      out.push({ gamePk: g.gamePk, date: g.date, gameNumber: g.gameNumber ?? 1 })
    }
  }
  return out.sort((a, b) => a.gamePk - b.gamePk)
}

// The player's clip from the newest game that has one: a play highlight tagged with his id.
// `games` are [{ date, gameNumber, clips }], all dated before the slate date (the fetch drops
// the rest). A recap or a condensed game carries no player id, so it never matches. A pitching
// clip can name the hitter too (a strikeout of him), so it never counts as his highlight.
export function playerClip(games, playerId) {
  if (!playerId) return null
  const newest = [...(games ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.gameNumber - a.gameNumber)
  for (const g of newest) {
    const hit = (g.clips ?? []).find((c) => {
      const k = classifyHighlight(c)
      return k.playerId === playerId && k.category !== 'pitching' && isEligibleForPositiveFilter(k)
    })
    if (hit) return hit
  }
  return null
}
