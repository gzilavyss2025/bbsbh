// Pure helpers split out of ../../gen-callouts.mjs: date arithmetic, the walk-off
// inning, batting-average formatting and the nearest-milestone pick. No fetch, no
// clock, no module state, so test/gen-callouts-pure.test.js can pin each directly.
import { MILESTONE_DEFS, nearestMilestone } from '../../../src/api/person.js'
import { rate3 } from '../../../src/api/person/shared.js'

export const iso = (d) => d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

// Day-of-week of the game's official date (0 = Sunday … 6 = Saturday, taken at
// UTC noon so a date string never slips a day). A pure calendar fact — no
// lopsidedness floor at the data layer; the note layer applies the sample +
// one-sidedness gate (DOW_* in callout-notes.js) so an ordinary ~.500 weekday
// stays quiet.
export const DOW_OF = (dateApi) => new Date(`${dateApi}T12:00:00Z`).getUTCDay()

// Whether a 'YYYY-MM-DD' birth date falls on the slate's own date — compared
// by MM-DD only (a leap-year Feb 29 birthday just never matches in a non-leap
// year, same as how anyone actually celebrates it). Precomputed here rather
// than shipping raw birth dates, so the app never has to do date math itself.
export function isBirthdayOn(birthDate, dateApi) {
  if (!birthDate) return false
  return birthDate.slice(5) === dateApi.slice(5)
}

// The inning a game was walked off in, or null. A home win's decisive at-bat ends
// the instant it takes the lead, so only the FINAL recorded inning can qualify, and
// only when the home club was not already ahead entering it. Stops at the first
// inning with a missing run value (a skipped bottom half, a suspended game).
export function walkoffInningOf(innings) {
  let cumAway = 0,
    cumHome = 0,
    prevAway = 0,
    prevHome = 0,
    lastInning = null
  for (const inn of innings ?? []) {
    const aR = inn.away?.runs,
      hR = inn.home?.runs
    if (typeof aR !== 'number' || typeof hR !== 'number') break
    prevAway = cumAway
    prevHome = cumHome
    cumAway += aR
    cumHome += hR
    lastInning = { num: inn.num, prevAway, prevHome, cumAway, cumHome }
  }
  // A home win's decisive at-bat ends the instant it takes the lead, so only
  // the game's FINAL recorded inning can be a walk-off, and only if the home
  // team wasn't already leading entering it (an already-leading home team's
  // bottom half is skipped outright, caught by the missing-value break above).
  if (!lastInning) return null
  return lastInning.prevHome <= lastInning.prevAway && lastInning.cumHome > lastInning.cumAway
    ? lastInning.num
    : null
}

// The nearest milestone (any hitting stat family) a raw career stat object
// (`cSt`, the API's own field names) is within single-game-plausible reach
// of, or null. Shared field-name mapping between MILESTONE_DEFS's
// aggregateSplits()-shaped keys (hits/homeRuns/rbi/runs/stolenBases/doubles —
// the same names the raw API stat object already uses for these fields) and
// `cSt` — no translation needed, they line up.
export function nearestHitterMilestone(cSt) {
  return MILESTONE_DEFS.filter((d) => d.group === 'hitting')
    .map((d) => {
      const m = nearestMilestone(cSt[d.stat], d.thresholds, d.gameGate)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null
}

// Pitching counterpart to nearestHitterMilestone — same shared table, the
// pitching field names (wins/strikeOuts/saves) also line up 1:1 with the raw
// API stat object's own names.
export function nearestPitcherMilestone(cSt) {
  return MILESTONE_DEFS.filter((d) => d.group === 'pitching')
    .map((d) => {
      const m = nearestMilestone(cSt[d.stat], d.thresholds, d.gameGate)
      return m && { ...m, stat: d.stat, label: d.label }
    })
    .filter(Boolean)
    .sort((a, b) => a.remaining - b.remaining)[0] ?? null
}

// Batting average as the API formats it (".350", "1.000") from summed hits/AB —
// the birthday line is aggregated across seasons here, so its average has to be
// recomputed rather than read from any one game log's own `avg`.
export function formatAvg(h, ab) {
  if (ab <= 0) return '.000'
  return rate3(h / ab)
}
