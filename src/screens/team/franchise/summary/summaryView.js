// The franchise summary card (#2784), shaped from summarizeFranchise's result
// (api/history/franchiseSummary.js). Pure: no fetch, no clock.
import { yearRuns } from '../people/peopleView.js'

const pct = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '—')
const span = (from, to) => (from === to ? String(from) : `${from}–${to}`)

// A tile's caption lists the years while there are two at most; a longer list reads "Last {year}"
// there and moves whole into a fact row (`{key}Runs`), so a tile never grows a paragraph.
function listed(key, items, short) {
  if (!items.length) return { [`${key}Caption`]: null, [`${key}Runs`]: null }
  if (items.length <= 2) return { [`${key}Caption`]: short, [`${key}Runs`]: null }
  const years = items.map((x) => x.season ?? x)
  return { [`${key}Caption`]: `Last ${years[years.length - 1]}`, [`${key}Runs`]: yearRuns(years) }
}

// `last` is the newest season on the page. The current name reads "1970 on" when its run
// reaches it, as the About band's franchise card does.
export function summaryView(s) {
  if (!s?.seasons) return null
  const last = s.seasons.to
  const best = s.winningestManager
  const pennants = [...s.pennants].sort((a, b) => a.season - b.season)
  const titles = [...s.titles].sort((a, b) => a - b)
  return {
    seasons: s.seasons.count,
    record: `${s.record.w}-${s.record.l}`,
    pct: pct(s.record.w, s.record.l),
    span: span(s.seasons.from, last),
    postseasons: s.postseasons.length,
    lastPostseason: s.postseasons.length ? Math.max(...s.postseasons) : null,
    postseasonYears: yearRuns(s.postseasons),
    pennants: s.pennants.length,
    ...listed('pennant', pennants, pennants.map((p) => `${p.season} ${p.league}`).join(' · ')),
    titles: s.titles.length,
    ...listed('title', titles, yearRuns(titles)),
    names: s.names.map((n) => ({ name: n.name, years: n.to === last && n.from !== last ? `${n.from} on` : span(n.from, n.to) })),
    best: best ? { id: best.id, name: best.name, wl: `${best.w}-${best.l}`, seasons: best.seasons } : null,
    // Manager data starts in 1969. Say so only for a club that is older than that.
    since: s.managersFrom != null && s.managersFrom > s.seasons.from ? s.managersFrom : null,
  }
}
