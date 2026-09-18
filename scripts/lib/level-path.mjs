// WHICH WAY A PLAYER'S SEASON WENT — the pure half of issue #1122.
//
// A minors pool entry carries `levels`: every level a player's season touched.
// It is built as a Set sorted by level (`combineToPool`, src/api/statsLevels.js)
// and so it says nothing at all about ORDER. Reading its two ends as a climb —
// which is what the offseason page's promotions list did — cannot tell a player
// promoted from High-A to Triple-A from one sent the other way, and reads a
// rehab cameo three levels below a player's own as a three-level rise.
//
// A season stat line has no date on it, so the order has to come from somewhere
// else. It does not need a call per player: the same bulk endpoint the pool
// itself comes from takes a date range (`stats=byDateRange`), so a generator can
// ask each level "who played here between these two dates" a dozen times and
// read the order off the answers. This file is the arithmetic over those
// answers, kept apart from the fetching so the rule that decides whether a
// player was promoted can be tested without a network.
//
// HALF-MONTH WINDOWS. Fine enough that the order is rarely in doubt, coarse
// enough that a level's season is a dozen windows rather than twenty-five. Both
// matter: the resolution is what makes the answer right, and the count is what
// keeps a nightly job honest about what it costs.
//
// EACH WINDOW CARRIES ITS `key`, AND THE KEY IS NOT THE START DATE. The four
// levels do not open together — Triple-A 2026 started March 27, Double-A April
// 2 — so each level's first window is clamped to its own opening day and no two
// levels' April dates match. Ordering on those dates puts a level that started
// earlier ahead of one that started later INSIDE the same fortnight, which
// silently reversed one player's season in a live check: his Double-A April
// looked later than his Triple-A April, and a promotion read as a rehab.
//
// The key is the half-month itself ('2026-04-1'), so every level's first half of
// April is the same instant on one shared clock however its own season began.
export function seasonWindows(startIso, endIso) {
  if (!isIso(startIso) || !isIso(endIso) || endIso < startIso) return []
  const windows = []
  let year = Number(startIso.slice(0, 4))
  let month = Number(startIso.slice(5, 7))
  for (let guard = 0; guard < 48; guard += 1) {
    const first = `${pad4(year)}-${pad2(month)}-01`
    const mid = `${pad4(year)}-${pad2(month)}-15`
    const last = `${pad4(year)}-${pad2(month)}-${pad2(daysInMonth(year, month))}`
    for (const [from, to] of [
      [first, mid],
      [`${pad4(year)}-${pad2(month)}-16`, last],
    ]) {
      // Clamped to the season, so the first and last windows are the part of
      // the half-month the level actually played.
      const start = from < startIso ? startIso : from
      const end = to > endIso ? endIso : to
      // `from`, not `start` — the key names the half-month, never the clamp.
      const key = `${from.slice(0, 7)}-${from.slice(8, 10) === '01' ? 1 : 2}`
      if (start <= end && start <= endIso && end >= startIso) windows.push({ key, start, end })
    }
    if (last >= endIso) break
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return windows
}

// WHERE A SEASON BEGAN AND WHERE IT ENDED. `observations` is one row per
// (window, level) a player was seen in: `{ window, sportId, games }`. The answer
// is `{ from, to }` — two sportIds — or null when he never left one level and
// there is nothing to say.
//
// IT IS NOT A PER-WINDOW WINNER. The obvious reading — take the busiest level in
// each window and string them together — gets the single most interesting row
// wrong. A player called up in the last fortnight of the season plays most of it
// at the old level and a handful of games at the new one, so "busiest" answers
// the level he LEFT and the promotion disappears. Four of nineteen names checked
// against real game logs were lost exactly that way.
//
// So each level is reduced to the SPAN of windows it covers — the first window
// he appeared at it and the last — and the two ends of the season are read off
// those spans:
//
//   from  the level whose span opens earliest
//   to    the level whose span closes latest
//
// When two levels tie, the tie is broken on what else is known about them, and
// the two ends break theirs DIFFERENTLY, because the question is not symmetric:
//
//   from  ties go to the level he played MOST in that opening window — the one
//         he was already at when the season started, the other being where he
//         went. Then to the level he left soonest (smallest last window).
//   to    ties go to the level he arrived at LATEST (largest first window),
//         because the one he had been at all along is the one he moved FROM.
//
// The `to` rule is what recovers the September call-up: High-A since April and
// Double-A appearing for the first time in that same final fortnight means
// Double-A is where the season ended, whatever the game counts say. Game counts
// cannot decide that end — a player promoted with a week to go plays most of
// the fortnight at the level he left — and they are exactly what decides the
// other end, where the level he was already at is the busier one.
//
// Both tie-breaks were chosen by measurement, not taste. Every name the old
// reading listed at all four levels was checked against its own dated game log
// (571 checks); this pair disagrees with the logs once, a pitcher who shuttled
// between Double-A and Triple-A eight times and is read as having moved up.
//
// A REMAINING TIE GOES AGAINST THE CLIMB. If two levels open in the same window
// and close in the same window, nothing distinguishes them, so `from` takes the
// HIGHER and `to` takes the LOWER — the reading that does not claim a promotion.
// That is the whole disposition of this file: a wrong omission costs a reader
// one name on a list, and a wrong inclusion tells them a player was called up
// when he was sent down, which is the failure this exists to stop.
export function levelSpan(observations, rank) {
  if (!Array.isArray(observations)) return null

  // sportId -> { first, last } window index, plus how many games he played at
  // that level in the FIRST window he appeared at it (see `from` below).
  const spans = new Map()
  for (const o of observations) {
    const sportId = o?.sportId
    const window = o?.window
    if (!Number.isInteger(window) || rank(sportId) == null) continue
    const games = Number(o.games) || 0
    if (games <= 0) continue
    const span = spans.get(sportId)
    if (!span) spans.set(sportId, { first: window, last: window, opening: games })
    else {
      if (window < span.first) {
        span.first = window
        span.opening = games
      } else if (window === span.first) span.opening += games
      if (window > span.last) span.last = window
    }
  }
  if (spans.size < 2) return null

  const rows = [...spans.entries()].map(([sportId, span]) => ({ sportId, ...span }))
  const from = rows.reduce((best, r) =>
    r.first < best.first ||
    (r.first === best.first && r.opening > best.opening) ||
    (r.first === best.first && r.opening === best.opening && r.last < best.last) ||
    (r.first === best.first &&
      r.opening === best.opening &&
      r.last === best.last &&
      rank(r.sportId) > rank(best.sportId))
      ? r
      : best,
  )
  const to = rows.reduce((best, r) =>
    r.last > best.last ||
    (r.last === best.last && r.first > best.first) ||
    (r.last === best.last && r.first === best.first && rank(r.sportId) < rank(best.sportId))
      ? r
      : best,
  )
  return { from: from.sportId, to: to.sportId }
}

// Did the season END above where it STARTED. The one question the promotions
// list is allowed to ask, and the reason the span is worth building: a demotion
// answers false, a rehab assignment answers false because the player comes back
// to where he was, and a genuine call-up answers true whatever detours the
// middle of the season held.
export function movedUp(span, rank) {
  if (!span) return false
  const from = rank(span.from)
  const to = rank(span.to)
  return from != null && to != null && to > from
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const isIso = (v) => typeof v === 'string' && ISO.test(v)
const pad2 = (n) => String(n).padStart(2, '0')
const pad4 = (n) => String(n).padStart(4, '0')
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()
