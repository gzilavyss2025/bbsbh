import { getJson } from '../statsapi.js'
import { gamePath } from '../../lib/route.js'

// Replies on the transactions list: a roster move that exists BECAUSE of an
// earlier one shows a faded quote of the move it answers (MoveRow.jsx draws it).
// Cause and effect only, and a missing reply is always better than a wrong one,
// so every rule below says nothing when it cannot be sure.
//
// It reads each story's `moves` — [personId, kind] per row, written by
// rosterKind in teamTransactions.js. An older nightly file without them simply
// draws no replies until the next regeneration.
//
// The four rules (docs/transactions-wire.md §5 has the roster underneath):
// 1. A player traded in, then placed on the injured list by his new club the
//    same day, replies to the trade (JoJo Romero, Brewers, 2026-08-03).
// 2. The outright, release, trade or lost claim that resolves a designation
//    replies to the designation.
// 3. An option after a waiver claim replies to the claim.
// 4. A move that fills an active-roster spot replies to the move that opened
//    it — by the COUNT alone, no pitcher-for-pitcher matching. Only inside the
//    regular season (`season`), only for a club-day the rule can read whole,
//    and only when its openings and fills balance, alone or with the next day
//    (a fill may be filed a day either side of its opening). A doubleheader's
//    or special event's 27th man never balances, so draws nothing here.
//
// 5. A 27th man (a call-up for a doubleheader or a special event, back down by
//    the next day) replies to his GAME, not a move: gameReply below. Neither
//    his call-up nor his trip back down moves the count.
//
// A roster move and its date carry no score, so none of this is sealed.

const OPENS = new Set(['il', 'list', 'opt', 'des', 'rel'])
const FILLS = new Set(['cu', 'se', 'act', 'claim'])
// Rows that change the 26-man not at all, or did so on another move's day.
const NEUTRAL = new Set(['il60', 'out', 'lost', 'none'])
const RESOLVES_DES = new Set(['out', 'rel', 'trade-out', 'lost'])

const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// days: [{ date, stories }] in any order, every club mixed (the wire) or one
// club (its ledger). season: { start, end } regular-season dates, or null.
// extraMen: the confirmed 27th men, [{ team, date, playerId }] from
// extraManCandidates checked against the schedule; the count leaves out both
// halves of each one's trip.
// Returns { [storyId]: [{ id, date }] } — the stories each one replies to.
export function findReplies(days, { season = null, extraMen = [] } = {}) {
  const entries = []
  for (const day of days ?? []) {
    for (const s of day.stories ?? []) {
      if (s.moves?.length) entries.push({ id: s.id, team: s.teamId ?? 0, date: day.date, moves: s.moves })
    }
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const out = {}
  const add = (reply, quoted) => {
    if (reply.id === quoted.id) return
    const list = (out[reply.id] ??= [])
    if (!list.some((q) => q.id === quoted.id)) list.push({ id: quoted.id, date: quoted.date })
  }
  const latestBefore = (e, pid, kind, sameDayOnly) => {
    let found = null
    for (const o of entries) {
      if (o === e || o.team !== e.team || o.date > e.date) continue
      if (sameDayOnly && o.date !== e.date) continue
      if (o.moves.some(([p, k]) => p === pid && k === kind)) found = o
    }
    return found
  }

  for (const e of entries) {
    for (const [pid, kind] of e.moves) {
      // A story telling both halves itself is not a reply.
      const own = (k) => e.moves.some(([p, kk]) => p === pid && kk === k)
      let q = null
      if (kind === 'il' && !own('trade-in')) q = latestBefore(e, pid, 'trade-in', true)
      else if (RESOLVES_DES.has(kind) && !own('des')) q = latestBefore(e, pid, 'des', false)
      else if (kind === 'opt' && !own('claim')) q = latestBefore(e, pid, 'claim', false)
      if (q) add(e, q)
    }
  }

  if (season?.start && season?.end) countReplies(entries, season, extraMen, add)
  return out
}

function countReplies(entries, season, extraMen, add) {
  // A 27th man's call-up and the option that ends his trip are the game's, not
  // the roster's.
  const trip = (e, pid, kind) =>
    (kind === 'cu' || kind === 'se' || kind === 'opt') &&
    extraMen.some((m) => m.team === e.team && m.playerId === pid && (e.date === m.date || e.date === nextDay(m.date)))
  // club -> date -> { readable, stories: [{ entry, net }] }
  const clubs = new Map()
  for (const e of entries) {
    if (e.date < season.start || e.date > season.end) continue
    if (!clubs.has(e.team)) clubs.set(e.team, new Map())
    const byDate = clubs.get(e.team)
    if (!byDate.has(e.date)) {
      byDate.set(e.date, { readable: true, stories: [] })
    }
    const day = byDate.get(e.date)
    let net = 0
    for (const [pid, kind] of e.moves) {
      if (trip(e, pid, kind)) continue
      if (OPENS.has(kind)) net += 1
      else if (FILLS.has(kind)) net -= 1
      else if (!NEUTRAL.has(kind)) day.readable = false
    }
    if (net !== 0) day.stories.push({ entry: e, net })
  }

  for (const byDate of clubs.values()) {
    const used = new Set()
    const sum = (day) => day.stories.reduce((n, s) => n + s.net, 0)
    for (const date of [...byDate.keys()].sort()) {
      const day = byDate.get(date)
      if (used.has(date) || !day.readable || !day.stories.length) continue
      let group = null
      if (sum(day) === 0) group = [day]
      else {
        const next = byDate.get(nextDay(date))
        if (next && next.readable && !used.has(nextDay(date)) && sum(day) + sum(next) === 0) {
          group = [day, next]
          used.add(nextDay(date))
        }
      }
      if (!group) continue
      used.add(date)
      const stories = group.flatMap((d) => d.stories)
      const openers = stories.filter((s) => s.net > 0)
      for (const filler of stories.filter((s) => s.net < 0)) {
        // A player's own option never opened the spot his call-up fills.
        const players = new Set(filler.entry.moves.map(([p]) => p))
        for (const opener of openers) {
          if (!opener.entry.moves.some(([p]) => players.has(p))) add(filler.entry, opener.entry)
        }
      }
    }
  }
}

// Rule 5's first half, from the moves alone: a call-up whose player is optioned
// again the same day or the next. Whether he was the 27th man is the schedule's
// to say (gameReply); a club short a man for a day reads the same here.
export function extraManCandidates(days) {
  const out = []
  const all = (days ?? []).flatMap((d) => (d.stories ?? []).map((s) => ({ s, date: d.date })))
  for (const { s, date } of all) {
    for (const [pid, kind] of s.moves ?? []) {
      if (kind !== 'cu' && kind !== 'se') continue
      const back = all.some(
        (o) =>
          (o.s.teamId ?? 0) === (s.teamId ?? 0) &&
          (o.date === date || o.date === nextDay(date)) &&
          (o.s.moves ?? []).some(([p, k]) => p === pid && k === 'opt'),
      )
      if (back) out.push({ id: s.id, team: s.teamId ?? 0, date, playerId: pid })
    }
  }
  return out
}

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']
// AP style, as the cutlines write a date: "April 4", "Aug. 23".
export function apShortDate(iso) {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

// Rule 5's second half: the club's games that day (fetchClubDay) -> the game a
// 27th man replies to, { label, href }, or null when the day allows no extra
// man. Two games is a doubleheader. One game is a special event only when it
// carries a name AND is played away from the home club's own park (Field of
// Dreams, Williamsport, Mexico City); a home opener or a heritage day carries a
// name at home. Teams and date only: no score is read or fetched.
export function gameReply(games, date) {
  // A postponed or cancelled game still sits on the day's schedule.
  games = (games ?? []).filter((x) => !['D', 'C'].includes(x.status?.codedGameState))
  const g = games[0]
  if (!g) return null
  const away = g.teams?.away?.team
  const home = g.teams?.home?.team
  const doubleheader = games.length > 1
  const event = !doubleheader && g.description?.trim() && g.venue?.id !== home?.venue?.id ? g.description.trim() : null
  if (!doubleheader && !event) return null
  const what = doubleheader ? 'Games 1 and 2' : event
  return {
    label: `${away?.teamName} at ${home?.teamName} · ${what} · ${apShortDate(date)}`,
    href: gamePath(date, away?.abbreviation, home?.abbreviation, 'lineup1'),
  }
}

// One club's games on one day, trimmed by `fields` to the teams, the venue and
// the name — the response carries no score at all.
export async function fetchClubDay(teamId, date) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&teamId=${teamId}&date=${date}&hydrate=team(venue)` +
      '&fields=dates,games,gameNumber,description,status,codedGameState,venue,id,teams,away,home,team,teamName,abbreviation',
  )
  return data?.dates?.[0]?.games ?? []
}
