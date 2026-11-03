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
// A fifth, the 27th man replying to his GAME, is a stub (see the foot).
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
// extraManDays: a Set of `${teamId}|${date}` club-days that ALLOW a 27th man
// (a doubleheader, a special event); the count steps around them, since a fill
// there may answer the game rather than a move. The 27th-man detection fills it.
// Returns { [storyId]: [{ id, date }] } — the stories each one replies to.
export function findReplies(days, { season = null, extraManDays = null } = {}) {
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

  if (season?.start && season?.end) countReplies(entries, season, extraManDays, add)
  return out
}

function countReplies(entries, season, extraManDays, add) {
  // club -> date -> { readable, stories: [{ entry, net }] }
  const clubs = new Map()
  for (const e of entries) {
    if (e.date < season.start || e.date > season.end) continue
    if (!clubs.has(e.team)) clubs.set(e.team, new Map())
    const byDate = clubs.get(e.team)
    if (!byDate.has(e.date)) {
      byDate.set(e.date, { readable: !extraManDays?.has(`${e.team}|${e.date}`), stories: [] })
    }
    const day = byDate.get(e.date)
    let net = 0
    for (const [, kind] of e.moves) {
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

// Rule 5, a 27th-man call-up replying to his GAME ("Replying to Brewers at
// Royals · Games 1 and 2 · April 4", linked to that game's lineup page, teams
// and date only, never a score), is not built: the detection that says which
// call-ups are a 27th man lands separately, and feeds `extraManDays` above.
