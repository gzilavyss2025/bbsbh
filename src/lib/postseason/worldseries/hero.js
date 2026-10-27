// The World Series hero's pure parts (#1906; the versus redesign chosen by Gary, 2026-10-20). Pure.
//
//   calendarDays  the Series as day cells, from ledgerModel's `columns`. Nothing here reads a
//                 result: a cell knows its date, its game number and its state, never a run.
//   monthsOf      the calendar head's month label, from those cells.
//   slabPlayers   the hitters drawn on a club's slab, best first, from the hot-bat splits
//                 (fetchHotBatSplits, which end the day before the slate date).
//   spotlightAt   the pair a tap shows; spotlightCount, how many pairs there are.
//   spotlightRoster  a club's whole roster in the order a tap on the art walks it, with a stat line each.
//   storedClip    a player's newest play highlight, from the clubs' stored highlight files.
//   decidedHero   a decided Series' hero: the winner, each game's winner, the Series MVP's slab.
import { gamePath } from '../../route.js'
import { ledgerModel } from './ledger.js'

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

// A decided Series' hero (#2562; layout A, Gary 2026-10-27): it replaces the result banner. Nothing
// is ahead, so no cell is today or next, and every game cell names the club that won it (the
// bracket's and the history file's `winnerId`). The Series MVP is the only player drawn, on his own
// club's side (the 1960 MVP played for the club that lost); with no MVP known, neither side draws one.
// -> null until decided, else { winnerId, gamesPlayed, days, players } (players in slot order).
export function decidedHero(series, mvp = null) {
  if (!series?.decided || !series.winner?.id) return null
  const games = series.games ?? []
  const winnerOf = new Map(games.map((g) => [g.gameNumber, g.winnerId ?? null]))
  const ids = series.slots.map((s) => s.club.id)
  // A slate date past every game: each game is past, so none is today or next. The 'today' cell
  // calendarDays adds when no cell is today is dropped.
  const { columns } = ledgerModel({ clubIds: ids, games, slateDate: '9999-12-31' })
  const days = calendarDays(columns, '9999-12-31')
    .filter((d) => d.kind !== 'today')
    .map((d) => (d.kind === 'game' ? { ...d, winnerId: winnerOf.get(d.gameNumber) ?? null } : d))
  const players = ids.map((id) => (mvp?.playerId && mvp.teamId === id ? { id: mvp.playerId, name: mvp.name } : null))
  return { winnerId: series.winner.id, gamesPlayed: games.length, days, players }
}

// Before Game 1 is played, the slab shows a hitter Gary chose for each club; from then on, the
// rule below. [DECISION: Gary, 2026-10-20: "Before the series starts, show me Yandy Diaz and
// Jake Bauers. Then after each game we can go with best ops 25+ PA."] Keyed by season, then club.
export const PRE_SERIES_PICKS = { 2026: { 139: 650490, 158: 641343 } }
export const MIN_PA = 25

const opsOf = (row) => Number.parseFloat(row.ops)
const hitFigs = (r) => `${Number.isFinite(opsOf(r)) ? r.ops : '—'} OPS · ${r.pa} PA`
const shape = (s) => {
  const row = {
    id: s.player?.id ?? null,
    name: s.player?.fullName ?? '',
    pos: s.position?.abbreviation ?? '',
    pa: Number(s.stat?.plateAppearances) || 0,
    ops: s.stat?.ops ?? '',
    kind: 'hitter',
  }
  return { ...row, figs: hitFigs(row) }
}

// How many hitters the slab cycles through from the hot-bat splits alone, until the roster has loaded.
export const SPOTLIGHT_SIZE = 4

const byOps = (a, b) => opsOf(b) - opsOf(a) || b.pa - a.pa

// -> [{ id, name, pos, pa, ops }], best first, at most `limit`; [] with no splits. `started`: a
// Series game has been played before the slate date. First comes the pre-Series pick (until a
// game is played), then the hitters with MIN_PA or more by OPS (a tie goes to more PA; "-.--"
// parses to NaN and never qualifies), then everyone else by PA.
export function slabPlayers(splits, { clubId, season, started }, limit = SPOTLIGHT_SIZE) {
  const rows = (splits ?? []).map(shape).filter((r) => r.id && r.pa > 0)
  const chosen = started ? null : PRE_SERIES_PICKS[Number(season)]?.[clubId]
  const regulars = rows.filter((r) => r.pa >= MIN_PA && Number.isFinite(opsOf(r))).sort(byOps)
  const rest = rows.filter((r) => !regulars.includes(r)).sort((a, b) => b.pa - a.pa)
  return [...new Set([rows.find((r) => r.id === chosen), ...regulars, ...rest])].filter(Boolean).slice(0, limit)
}

// A tap on the art steps both slabs to the next hitter on each club's list. A club with a shorter
// list wraps on its own, so both slabs show someone while either club has someone to show.
export const spotlightCount = (lists) => Math.max(0, ...lists.map((l) => l.length))
export const spotlightAt = (lists, step) => lists.map((l) => (l.length ? l[step % l.length] : null))

// The whole roster, for the tap to walk. A club names 26 for the Series (POSTSEASON_ROSTER_SIZE in
// api/postseason/roster.js); before it does, the current roster can run longer, so the list is cut at 26.
export const SPOTLIGHT_ROSTER_SIZE = 26

// "62.1" innings is 187 outs: thirds, so two lines sort by what they threw.
const outsOf = (ip) => {
  const [whole, third = '0'] = String(ip ?? '').split('.')
  const n = Number(whole) * 3 + Number(third)
  return Number.isFinite(n) ? n : 0
}
const pitchRow = (s) => ({ id: s.player?.id ?? null, ip: s.stat?.inningsPitched ?? '', era: s.stat?.era ?? '', outs: outsOf(s.stat?.inningsPitched) })
const pitchFigs = (r) => `${Number.isFinite(Number.parseFloat(r.era)) ? r.era : '—'} ERA · ${r.ip} IP`
const byId = (rows) => new Map(rows.filter((r) => r.id).map((r) => [r.id, r]))

// -> [{ id, name, pos, kind, figs }], at most `limit`, for one club. `pool` is
// api/postseason/spotlightPool.js's { roster, hitR, pitP, pitR } plus `hitP`, the postseason hitting
// splits the home already reads; [] without a roster (the caller falls back to slabPlayers).
// Order: the pre-Series pick (until a game is played); postseason hitters by OPS (MIN_PA or more
// first), then by PA; postseason pitchers by innings; then everyone with no October line, hitters
// by regular-season PA and pitchers by innings, the unused last, by jersey. A player with no
// postseason line shows his regular-season one, marked "Season"; with neither, "No stats yet".
export function spotlightRoster(pool, { clubId, season, started }, limit = SPOTLIGHT_ROSTER_SIZE) {
  const people = [...(pool?.roster?.positionPlayers ?? []), ...(pool?.roster?.pitchers ?? [])].filter((p) => p.id)
  const hitP = byId((pool?.hitP ?? []).map(shape).filter((r) => r.pa > 0))
  const hitR = byId((pool?.hitR ?? []).map(shape).filter((r) => r.pa > 0))
  const pitP = byId((pool?.pitP ?? []).map(pitchRow).filter((r) => r.outs > 0))
  const pitR = byId((pool?.pitR ?? []).map(pitchRow).filter((r) => r.outs > 0))
  const chosen = started ? null : PRE_SERIES_PICKS[Number(season)]?.[clubId]
  return people
    .map((p) => {
      // A two-way player is read as a hitter, unless only his pitching has a line.
      const twoWayPitcher = p.position === 'TWP' && !hitP.has(p.id) && !hitR.has(p.id) && (pitP.has(p.id) || pitR.has(p.id))
      const pitcher = p.position === 'P' || twoWayPitcher
      const post = (pitcher ? pitP : hitP).get(p.id)
      const row = post ?? (pitcher ? pitR : hitR).get(p.id)
      const amount = pitcher ? (row?.outs ?? 0) : (row?.pa ?? 0)
      const regular = !pitcher && post && post.pa >= MIN_PA && Number.isFinite(opsOf(post))
      const tier = p.id === chosen ? 0 : regular ? 1 : post ? (pitcher ? 3 : 2) : pitcher ? 5 : 4
      return {
        entry: {
          id: p.id,
          name: p.name,
          pos: p.position,
          kind: pitcher ? 'pitcher' : 'hitter',
          figs: row ? `${pitcher ? pitchFigs(row) : hitFigs(row)}${post ? '' : ' · Season'}` : 'No stats yet',
        },
        tier,
        ops: tier === 1 ? opsOf(post) : 0,
        amount,
        jersey: Number(p.jersey) || 99,
      }
    })
    .sort((a, b) => a.tier - b.tier || b.ops - a.ops || b.amount - a.amount || a.jersey - b.jersey || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map((r) => r.entry)
}

// A player's highlight, from the clubs' stored files (public/data/highlights/{teamId}.json, the
// nightly gen-highlights.mjs; src/api/gamehighlights.js reads them). `files` are those files'
// answers, which hold only clips that already passed the generator's positive-play, non-abs and
// blocklist filters (scripts/lib/highlights.mjs). A hitter's is any play clip crediting him that is not a pitching one (a strikeout of him
// credits the pitcher); a pitcher's is a pitching one. The newest from a game in `gamePks` (the
// Series clubs' postseason games) wins; a player with none there gets his newest from earlier in
// the season, so a bench bat or a reliever who has not played in October still has one to watch.
// Only games dated before the slate date count. Null for none.
export function storedClip(files, player, { slateDate, gamePks }) {
  if (!player?.id) return null
  let postseason = null
  let season = null
  for (const file of files ?? []) {
    for (const game of file?.games ?? []) {
      if (!(game.date < slateDate)) continue
      const clip = (game.clips ?? []).find((c) => c.playerId === player.id && (c.category === 'pitching') === (player.kind === 'pitcher'))
      if (!clip) continue
      const found = { ...clip, gamePk: game.gamePk, date: game.date }
      if (gamePks?.has(game.gamePk) && (!postseason || found.date > postseason.date)) postseason = found
      if (!season || found.date > season.date) season = found
    }
  }
  return postseason ?? season
}
