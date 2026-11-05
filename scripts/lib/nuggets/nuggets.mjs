// The pure half of scripts/gen-nuggets.mjs (issue #2809). A nugget is the first day a
// player's season total met a threshold (src/lib/nuggets/thresholds.js), with how many
// players had met it by the end of that day and the anchor picked for that count, frozen.
//
// A counting stat only goes up, so a crossing is permanent and the count on any past day
// is the number of nuggets up to that day: the store needs no daily snapshot.

import { meets } from '../../../src/lib/nuggets/thresholds.js'

const num = (x) => {
  const n = parseFloat(x)
  return Number.isFinite(n) ? n : 0
}

// statsapi season splits -> Map(playerId -> summed stats). A player traded in-season has
// one split per club; summing counts him once.
export function sumByPlayer(splits) {
  const by = new Map()
  for (const s of splits ?? []) {
    const id = s?.player?.id
    if (id == null) continue
    const row = by.get(id) ?? {}
    for (const [k, v] of Object.entries(s.stat ?? {})) row[k] = (row[k] ?? 0) + num(v)
    by.set(id, row)
  }
  return by
}

// The first game date at which every condition of `t` holds, walking one player's game
// log in date order; null if the log never gets there.
export function crossingDate(games, t) {
  const sorted = [...(games ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const run = Object.fromEntries(t.all.map((c) => [c.stat, 0]))
  for (const g of sorted) {
    for (const c of t.all) run[c.stat] += num(g?.stat?.[c.stat])
    if (t.all.every((c) => run[c.stat] >= c.min)) return g.date
  }
  return null
}

// Players whose season totals meet `t` and who have no nugget for it yet.
export function newCrossers(totals, t, have) {
  const known = new Set((have ?? []).map((n) => n.player))
  const out = []
  for (const [id, sum] of totals) {
    if (known.has(id)) continue
    if (meets(t, sum)) out.push(id)
  }
  return out.sort((a, b) => a - b)
}

const byDate = (a, b) => a.date.localeCompare(b.date) || a.player - b.player

// Append the dated new crossers to a threshold's list. Old entries are never rewritten
// (their count and anchor are frozen at mint). A new entry's count is every entry on or
// before its date, the other new crossers included. A player already listed is skipped,
// so a second run adds nothing.
//
// The key is MLB's person id, which statsapi never reassigns to another person, so this
// needs no lib/reassignable-merge.mjs (scripts/CLAUDE.md).
export function mintNuggets(have, crossers, { pickAnchor }) {
  const list = [...(have ?? [])]
  const known = new Set(list.map((n) => n.player))
  const fresh = (crossers ?? []).filter((c) => c.date && !known.has(c.player) && known.add(c.player))
  const all = [...list, ...fresh]
  const minted = fresh.map((c) => {
    const count = all.filter((n) => n.date <= c.date).length
    const picked = pickAnchor(count, { seed: `${c.player}|${c.date}`, date: c.date })
    return { player: c.player, date: c.date, count, anchor: picked?.anchor?.id ?? null, relation: picked?.relation ?? null }
  })
  return [...list, ...minted].sort(byDate)
}
