import { parkHistory } from '../../../../api/history/franchiseSeasons.js'

// People and places on the franchise page (#2784), shaped for the cards. Pure: no fetch, no clock.
import { seasonRuns } from '../../../../components/team/ladder/layout.js'
import { pct } from '../ledgerRows.js'

// A run of seasons, "1970–2000" (one season, "1969").

export const years = (from, to) => (from === to ? String(from) : `${from}–${to}`)

// The Hall of Fame card's first group (#2966). The plaques name the club as it was then: the heading
// names the club unless a plaque names an earlier name of THIS franchise (the Expos' on the
// Nationals' page). `names` is the summary's [{ name, years }]. A plaque club that is no name of the
// franchise (the Hall files a few inductees under another club than the MLB feed does) is not an
// earlier club and is ignored, as is an entry with no `plaqueClub` on file.
export function hofHeading(teamName, inductedAs, names) {
  const own = new Set((names ?? []).map((n) => n.name))
  const earlier = (inductedAs ?? []).some((p) => p.plaqueClub && p.plaqueClub !== teamName && own.has(p.plaqueClub))
  return earlier ? 'Inducted with this franchise' : `Inducted as ${teamName}`
}

// summarizeFranchise's `managers` -> the card's rows, newest first (by his last season, then his
// first). A season listed with no split on file (a shared one, or the live season) still shows its
// year and marks him `partial`: his W-L leaves it out. `best` is the summary's winningest id.
export function managersView(managers, best) {
  return [...(managers ?? [])]
    .sort((a, b) => Math.max(...b.years) - Math.max(...a.years) || Math.min(...b.years) - Math.min(...a.years) || a.id - b.id)
    .map((m) => ({
      id: m.id,
      name: m.name,
      years: seasonRuns(m.years),
      wl: m.seasons ? `${m.w}-${m.l}` : '—',
      pct: m.seasons ? pct(m.w, m.l) : '—',
      partial: m.partial,
      best: m.id === best,
    }))
}

// The retired-numbers file names a person but carries no id. A tile links to the player page when
// its name matches an id the club's own files hold (its Hall of Famers and its all-time leaders),
// so the match is within one club. `people` is [{ id, name }]. A name two ids share in those files
// (Dave Roberts in San Diego) links nowhere, and neither does a name they lack.
export function retiredTiles(numbers, people) {
  const byName = new Map()
  for (const p of people ?? []) if (p?.id && p.name) byName.set(p.name, (byName.get(p.name) ?? new Set()).add(p.id))
  const ids = new Map([...byName].filter(([, set]) => set.size === 1).map(([n, set]) => [n, [...set][0]]))
  return (numbers ?? []).map((n) => ({
    number: n.number,
    name: n.name,
    year: n.year ?? null,
    role: n.role && n.role !== 'player' ? n.role : null,
    playerId: n.role === 'player' ? (ids.get(n.name) ?? null) : null,
  }))
}

// Everyone with an id in the club's Hall of Famers and all-time leaders files.
export function clubPeople(hof, leaders) {
  const out = [...(hof?.inductedAs ?? []), ...(hof?.alsoPlayed ?? [])]
  for (const group of [leaders?.career, leaders?.season]) for (const list of Object.values(group ?? {})) out.push(...list)
  return out.map((p) => ({ id: p.id, name: p.name }))
}


// The club's home parks (#2788), newest first. `history` is franchiseFor's file ({ spans, mates,
// through }); `live` is [{ season, venue: { id, name } | null }] for each season after `through`
// (api/history/franchise.js reads them), so a club that moved this year (the Rays, back at Tropicana in 2026)
// is not "on" at last year's park. A season with no venue read is left out. A park's name is the one
// its newest span gives it (the venue's current name); any other is "also named". A run that
// reaches the newest season reads "2001 on". `clubs` are the club's own names there; `mates` the
// other clubs that used it in the same seasons. The data starts in 1901 and holds one park per run
// of seasons, so a one-off neutral site is not in it.
export function parksView(history, live = [], temporary = []) {
  const known = history?.spans ?? []
  if (!known.length) return []
  const name = known[known.length - 1].name
  const extra = live.filter((l) => l.venue?.id && l.season > (history.through ?? 0))
  const spans = [...known, ...extra.map((l) => ({ from: l.season, to: l.season, name, venueId: l.venue.id, venueName: l.venue.name }))]
  const newest = Math.max(history.through ?? 0, ...extra.map((l) => l.season))
  const regular = parkHistory(spans, history.mates ?? {}).map((p) => {
    const mine = spans.filter((s) => s.venueId === p.venueId)
    const current = mine[mine.length - 1]?.venueName ?? p.names[p.names.length - 1]
    const end = p.runs[p.runs.length - 1][1]
    // A former name runs from its first season to the season before the next name (#2959). That
    // holds only when every name has a first season and the one in use is the newest: the data
    // keeps a name's FIRST season only, so a name that came back (O.co -> Oakland Coliseum) would
    // date the names after it wrong. Such a park lists its former names without years.
    const dated = p.from.every((y) => y != null) && p.names[p.names.length - 1] === current
    const also = p.names.flatMap((n, i) => (n === current ? [] : [dated ? `${n} ${years(p.from[i], (p.from[i + 1] ?? end + 1) - 1)}` : n]))
    return {
      last: end,
      row: {
        id: p.venueId,
        name: current,
        also,
        years: p.runs.map(([a, b]) => (b === newest ? `${a} on` : years(a, b))).join(', '),
        clubs: [...new Set(mine.map((s) => s.name))],
        mates: p.mates.map((m) => `${m.name} ${years(m.from, m.to)}`),
        temporary: false,
      },
    }
  })
  // A temporary home from the hand-curated file: its seasons are part-seasons, so never "on", and a
  // gap between them shows as two runs ("2003, 2005").
  const runsOf = (seasons) =>
    [...new Set(seasons)].sort((a, b) => a - b).reduce((out, y) => {
      const last = out[out.length - 1]
      if (last && y === last[1] + 1) last[1] = y
      else out.push([y, y])
      return out
    }, [])
  const extraParks = temporary.map((t) => ({
    last: Math.max(...t.seasons),
    row: {
      id: `temp-${t.venueId}`,
      name: t.name,
      also: [],
      years: runsOf(t.seasons).map(([a, b]) => years(a, b)).join(', '),
      clubs: [],
      mates: [],
      temporary: true,
      note: t.note,
    },
  }))
  return [...regular, ...extraParks].sort((a, b) => b.last - a.last).map((p) => p.row)
}
