// The OVR card as data (docs/ovr-rating.md, "The card"). Pure: a rating and a history in,
// what the tile and the menu draw out. No React, no fetch. Spoiler-free, like the rating.
import { clamp } from '../math/number.js'
import { SPORT_LABEL } from '../teams.js'
import { easeOut } from '../scorecard/glide.js'
import { changeSince, seasonSeries } from '../../api/ovr/history.js'
import { CEILING } from '../../api/ovr/minor.js'
import { CONSTANTS } from '../../api/ovr/rating.js'
import { tierFor } from './tiers.js'

const { FLOOR, CAP } = CONSTANTS

// Menu order, which is not the data's: the strongest buckets of each group first.
const BARS = {
  hitting: [['power', 'Power'], ['contact', 'Contact'], ['speed', 'Speed'], ['fielding', 'Fielding']],
  pitching: [['stuff', 'Stuff'], ['results', 'Results'], ['control', 'Control']],
}

export const SEGMENTS = 20

// Lit segments of a bar for a rating on the 0-100 scale (20 shows 4, 99 shows all 20).
export const filledSegments = (value) => Math.round((value / 100) * SEGMENTS)

// The big number's count-up at progress k (0..1): from the floor to the value on the
// app's own ease-out, and exactly the value at k >= 1.
export const countUpValue = (k, to) => (k >= 1 ? to : Math.round(FLOOR + (to - FLOOR) * easeOut(clamp(k, 0, 1))))

// Where a rating sits on the meter, as a percent of the 20-99 scale.
const at = (v) => ((v - FLOOR) / (CAP - FLOOR)) * 100

// The "path to the majors" meter: OVR, POT (null off the Top 100) and the level cap
// (null for a level with none).
export function meterMarks({ ovr, pot = null, level }) {
  const value = CEILING[level]
  return {
    ovr: at(ovr),
    pot: pot == null ? null : at(pot),
    cap: value == null ? null : { value, at: at(value) },
  }
}

// [2026, 2025, 2023] -> "Based on 2023, 2025-2026": the seasons the rating rests on, runs compacted.
export function seasonsLine(seasons) {
  const years = [...new Set(seasons ?? [])].sort((a, b) => a - b)
  if (!years.length) return ''
  const runs = []
  for (const y of years) {
    const last = runs.at(-1)
    if (last && y === last[1] + 1) last[1] = y
    else runs.push([y, y])
  }
  return `Based on ${runs.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join(', ')}`
}

// The change as the card shows it (7 days, or longer when the history is sparse). null when there is none, so no arrow and no zero.
// A seeded end is a prospect-trend percentile, not a rating, so it is no change either.
function changeView(history) {
  const c = changeSince(history)
  if (!c || c.to.seeded) return null
  const { delta, from, to } = c
  // changeSince reaches back to the newest snapshot AT LEAST 7 days older, so say how far it did reach.
  const days = Math.round((Date.parse(to.date) - Date.parse(from.date)) / 864e5)
  return { delta, days, dir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat', text: delta > 0 ? `+${delta}` : String(delta) }
}

// This season's real ratings, oldest first, or null under two points.
function sparkView(history) {
  const year = history.at(-1)?.date.slice(0, 4)
  const values = year ? seasonSeries(history, year).filter((s) => !s.seeded).map((s) => s.ovr) : []
  return values.length > 1 ? values : null
}

// rating: fetchOvr's answer; group: 'hitting' | 'pitching'; history: fetchOvrHistory's rows.
export function ovrView({ rating, group, history = [] }) {
  const { ovr, bars, level, seasons } = rating
  return {
    ovr,
    tier: tierFor(ovr),
    rows: (level == null ? BARS[group] : [])
      .filter(([key]) => bars?.[key] != null)
      .map(([key, label]) => ({ key, label, value: bars[key], tier: tierFor(bars[key]), filled: filledSegments(bars[key]) })),
    minor: level == null ? null : { pot: rating.pot ?? null, levelLabel: SPORT_LABEL[level] ?? '', marks: meterMarks({ ovr, pot: rating.pot, level }) },
    change: changeView(history),
    spark: sparkView(history),
    seasons: seasonsLine(seasons),
  }
}
