// The D1 masthead's level ladder as data: one stop per level, in rail order,
// with its count line and its accessible name. Pure, so the order and the
// labels are pinned by test/slate-masthead.test.js without a DOM.
//
// THE ORDER. The farm system reads top to bottom: MLB, AAA, AA, A+, A. Winter
// is not a rung of that ladder, so it sits last, after a dashed divider, and
// only while a shipped winter league is in season (useWinter's tabVisible).
// The old level rail put WINTER second, right after MLB; the D1 design moves
// it to the end (Gary's handoff, 2026-10-18).
import { isWinterSport } from '../winter/leagues.js'

const FULL_NAME = {
  MLB: 'Major League',
  AAA: 'Triple-A',
  AA: 'Double-A',
  'A+': 'High-A',
  A: 'Single-A',
  WINTER: 'Winter leagues',
}

// `counts` is null while the read is in flight (a blank line, never a 0), and
// an object once it lands. A level missing from it — a failed read — draws a
// dash, the same as a level with no games.
export function countText(counts, sportId) {
  if (!counts) return ''
  const n = counts[sportId]
  return n > 0 ? String(n) : '—'
}

function ariaFor(full, counts, n) {
  if (!counts || n == null) return full
  if (n === 0) return `${full}, no games`
  return `${full}, ${n} ${n === 1 ? 'game' : 'games'}`
}

export function ladderStops({ levels, counts, sportId, winterGames = null }) {
  const farm = levels.filter((l) => !isWinterSport(l.sportId))
  const winter = levels.find((l) => isWinterSport(l.sportId))
  const all = winter ? [...farm, winter] : farm
  // The Winter count joins only once the farm counts have landed: merged into
  // a null `counts`, it would make every farm level read "no games" while its
  // own count is still in flight.
  const merged = counts && winter && winterGames != null ? { ...counts, [winter.sportId]: winterGames } : counts
  return all.map((l) => {
    const isWinter = isWinterSport(l.sportId)
    const full = FULL_NAME[l.label] ?? l.label
    const n = merged?.[l.sportId]
    return {
      key: String(l.sportId),
      sportId: l.sportId,
      leagueId: l.leagueId ?? null,
      label: isWinter ? 'Winter' : l.label,
      fullName: full,
      count: countText(merged, l.sportId),
      aria: ariaFor(full, merged, n),
      empty: Boolean(merged) && !(n > 0),
      winter: isWinter,
      picked: l.sportId === sportId,
    }
  })
}

// The date stepper's two lines for a YYYY-MM-DD: the weekday over "Mon DD",
// plus the one-line form the compact bar prints. Built from the date's own
// parts, never from a clock, so it names the day the URL names.
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dateLines(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = DOW[new Date(y, m - 1, d).getDay()]
  const md = `${MON[m - 1]} ${d}`
  return { dow, md, short: `${dow.slice(0, 3)} ${md}` }
}
