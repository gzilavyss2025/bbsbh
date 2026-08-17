// THE PEN — every club's bullpen, ranked by how much of it is still available
// tonight. Behind /bullpens (src/screens/reports/BullpenPage.jsx).
//
// It adds no data. api/workload.js already owns the rules that decide whether
// one arm is fresh, limited or likely down (the ESPN thresholds: 25+ pitches
// yesterday, 35+ over three days, back-to-back days, three straight days), and
// a game page already draws that board for the two clubs playing. This module
// runs the SAME rules across all thirty and turns thirty boards into one — the
// question a second screen actually raises on a Tuesday, which is not "is this
// reliever tired" but "whose pen is empty".
//
// WHAT THE SOURCE FILE IS, AND THEREFORE WHAT THIS PAGE IS. workload.json
// carries roughly 390 pitchers, about thirteen per club: the arms that have
// pitched recently, not every arm that has appeared this season. So this is a
// board about the CURRENT staff, and the page says so. It is not a season
// ledger and must not be read as one — a club's total relief innings since
// March is a different question that this file cannot answer.
//
// SPOILER-FREE, inherited unchanged from workload.js: everything here is
// backward-looking over completed appearances, and the as-of date excludes the
// current day, so no in-progress line can leak. No SealBox.

import { fetchWorkload, availabilityFor, workloadFor, bullpenStatusCounts } from '../workload.js'

export { fetchWorkload }

// A club's bullpen, arm by arm, as of a date. Starters are excluded outright:
// availabilityFor answers 'fresh' for every SP by design (a rotation is not a
// bullpen), and leaving them in would pad every club's fresh count with five
// names that were never available in relief anyway.
export function bullpenFor(data, teamId, asOfDate) {
  const arms = []
  for (const [personId, p] of Object.entries(data?.pitchers ?? {})) {
    if (p.teamId !== teamId || p.role !== 'RP') continue
    const availability = availabilityFor(data, personId, asOfDate)
    const load = workloadFor(data, personId, asOfDate)
    if (!availability || !load) continue
    arms.push({
      personId: Number(personId),
      name: p.name,
      status: availability.status,
      reasons: availability.reasons,
      last7dayPitches: load.last7dayPitches,
      last7dayApps: load.last7dayApps,
      last3: load.last3.pitches,
      lastOuting: load.last1.date,
      lastOutingPitches: load.last1.pitches,
      consecDays: load.consecDays,
      seasonApps: load.season?.g ?? null,
      seasonPitches: load.season?.pitches ?? null,
    })
  }
  // Most-taxed first, so the top of every club's list is the reason its
  // headline number is what it is.
  arms.sort((a, b) => b.last7dayPitches - a.last7dayPitches || a.name.localeCompare(b.name))
  return arms
}

// The board: one row per club, ranked. `sortBy` picks the column.
//
// The headline column is AVAILABLE SHARE rather than a raw count, because
// clubs carry different numbers of relievers and "four fresh arms out of six"
// is a healthier pen than "five out of eleven". A club with no arms on file
// (none have pitched inside the window) is dropped rather than shown at 0% —
// that is a gap in the file, not an empty bullpen.
export const BULLPEN_SORTS = [
  { key: 'freshPct', label: 'Most available', lowIsBest: false },
  { key: 'downPct', label: 'Most taxed', lowIsBest: false },
  { key: 'last7', label: 'Pitches, last 7 days', lowIsBest: false },
  { key: 'perArm', label: 'Load per arm', lowIsBest: false },
]

export function bullpenBoard(data, teamIds, asOfDate, sortBy = 'freshPct') {
  if (!data?.pitchers) return null
  const sort = BULLPEN_SORTS.find((s) => s.key === sortBy) ?? BULLPEN_SORTS[0]

  const rows = []
  for (const teamId of teamIds ?? []) {
    const arms = bullpenFor(data, teamId, asOfDate)
    if (!arms.length) continue
    const counts = bullpenStatusCounts(arms.map((a) => a.status))
    const last7 = arms.reduce((s, a) => s + a.last7dayPitches, 0)
    rows.push({
      teamId,
      arms,
      counts,
      total: arms.length,
      freshPct: Math.round((counts.fresh / arms.length) * 1000) / 10,
      downPct: Math.round((counts.down / arms.length) * 1000) / 10,
      last7,
      perArm: Math.round((last7 / arms.length) * 10) / 10,
      // The single most-worked arm on the staff over the past week — the name
      // a broadcast puts on screen when it says a pen is running on fumes.
      leader: arms[0] ?? null,
    })
  }
  if (!rows.length) return null

  rows.sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    return sort.lowIsBest ? av - bv : bv - av
  })
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

// League totals under the board — how much of the league's bullpen is
// standing up tonight, in one line.
export function leagueBullpen(board) {
  const counts = { fresh: 0, limited: 0, down: 0 }
  let arms = 0
  let last7 = 0
  for (const row of board ?? []) {
    counts.fresh += row.counts.fresh
    counts.limited += row.counts.limited
    counts.down += row.counts.down
    arms += row.total
    last7 += row.last7
  }
  return { ...counts, arms, last7, clubs: (board ?? []).length }
}
