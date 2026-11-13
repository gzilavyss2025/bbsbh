// Pure helpers for scripts/research/gen-research-store.mjs (#2234), kept here so they can be
// unit-tested (a gen-*.mjs file runs when imported).

import { shiftDays } from '../../../src/lib/time/standingsDates.js'

export const SAVANT_DAY_CAP = 25000

// Savant's pitch CSV for one day, every game type. `batter_stands`/`pitcher_throws`
// are the hand params; `stand`/`p_throws` are silently ignored (#2234), so never send them.
export function savantDayUrl(day) {
  const p = new URLSearchParams({
    all: 'true',
    type: 'details',
    player_type: 'batter',
    hfGT: 'R|F|D|L|W|',
    game_date_gt: day,
    game_date_lt: day,
  })
  return `https://baseballsavant.mlb.com/statcast_search/csv?${p}`
}

// The days of `season`-`month` a build may read: the 1st through the month's end,
// stopping BEFORE `today` (a game on today's date is never stored). [] when none.
export function monthDays(season, month, today) {
  const days = []
  for (let d = `${season}-${month}-01`; d.slice(5, 7) === month && d < today; d = shiftDays(d, 1)) days.push(d)
  return days
}

// The months a full-season build reads: March through November, up to today.
export function seasonMonths(season, today) {
  return ['03', '04', '05', '06', '07', '08', '09', '10', '11'].filter((m) => `${season}-${m}-01` < today)
}

// Fold one month's summary into the index (see src/api/research/store.js).
export function mergeIndex(index, season, month, shard, pas, built) {
  const next = { v: 1, built, seasons: { ...(index?.seasons ?? {}) } }
  const s = { months: { ...(next.seasons[season]?.months ?? {}) } }
  s.months[month] = { through: shard.through, pitches: shard.cols.g.length, pas }
  next.seasons[season] = s
  return next
}

// The nightly window: the months of the `days` days before `today`, each rebuilt
// WHOLE (a shard is built only from the days a run fetches, so a 3-day fetch would
// replace a month with 3 days). On the 1st to 3rd that is last month and this one.
// Only March to November, the months a season can have. [{ season, month }].
export function recentMonths(today, days = 3) {
  const out = []
  for (let i = days; i >= 1; i--) {
    const d = shiftDays(today, -i)
    const month = d.slice(5, 7)
    if (month < '03' || month > '11') continue
    if (!out.some((m) => m.season === Number(d.slice(0, 4)) && m.month === month)) out.push({ season: Number(d.slice(0, 4)), month })
  }
  return out
}

// Why a rebuilt month may not replace the stored one, or null when it may. A month
// only grows: fewer pitches than the copy on file means Savant answered a day thinly
// (late rows, an outage that still says 200), so the old copy stays.
export function shrinkReason(prev, pitches) {
  if (!prev || pitches >= prev.pitches) return null
  return `${pitches} pitches, fewer than the ${prev.pitches} on file`
}
