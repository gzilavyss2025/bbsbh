// The words on the /outliers page (#2453). Pure. The callout wording itself is NOT here:
// an open row prints hotColdView's text, so the player page and this page say one thing.
// Here: the heading of a callout type, and what a collapsed row prints.
import { STATS } from '../../api/hotcold/line.js'
import { LIST_VALUE, NOUN } from '../player/next/top/hotColdView.js'

// "Best OPS for the games played", "Worst ERA for the innings pitched".
export const titleOf = ({ role, key, tone }) =>
  `${tone === 'hot' ? 'Best' : 'Worst'} ${NOUN[role][key]} for the ${role === 'pitching' ? 'innings pitched' : 'games played'}`

// "47 G" for a hitter, "31 IP" for a pitcher (the sample is whole innings).
export const sampleOf = (flag) => `${flag.sample} ${flag.role === 'pitching' ? 'IP' : 'G'}`

export const valueOf = (flag) => LIST_VALUE[flag.role][flag.key](flag.value)

// A group shows its top PREVIEW rows; "+ N more" shows the rest.
export const PREVIEW = 3

// The rows a group shows. `openIndex` is the open row's place, so a row that sits under
// "+ N more" stays on screen when it is opened from a list of names.
export function shownFlags(flags, { all, openIndex }) {
  return all || openIndex >= PREVIEW ? flags : flags.slice(0, PREVIEW)
}

// The header line's entry for one callout type: "Best OPS", with its count of players.
export const typeCounts = (groups) =>
  groups.map((g) => ({
    id: g.id,
    short: `${g.tone === 'hot' ? 'Best' : 'Worst'} ${STATS[g.role].find((s) => s.key === g.key).label}`,
    count: g.flags.length,
  }))

// The slider's dates, one a day from `min` to `max` (both ISO dates).
export function dayList(min, max) {
  const out = []
  for (let t = Date.parse(min); t <= Date.parse(max); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}
