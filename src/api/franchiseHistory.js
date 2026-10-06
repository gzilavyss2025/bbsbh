import { staticJsonBy } from './staticJson.js'

// A club's history by season: one name, league and ballpark per run of seasons,
// from public/data/franchise-history/{teamId}.json (hand-run
// scripts/gen-franchise-history.mjs, 1901 to `through`, MLB's own /teams feed).
// Relocated clubs keep one team id, so the Brewers' file starts with the 1969
// Seattle Pilots. Spoiler-free: names and parks, no game.
//
// The data starts in 1901, so a park's first season is the first IN THIS DATA,
// never the year it opened. MLB clubs only: a MiLB id has no file and reads [].

const load = staticJsonBy((id) => `/data/franchise-history/${id}.json`, {
  fallback: { through: null, spans: [], mates: {} },
})

// Everything the Overview module draws, from one read. `through` is the last
// season in the file, so a span or park that reaches it is still running.
export async function franchiseFor(teamId) {
  const d = await load(teamId)
  const spans = d.spans ?? []
  return { spans, through: d.through, parks: parkHistory(spans, d.mates ?? {}) }
}

// Pure: group spans by venue, oldest first. `runs` are the club's stints there
// as [from, to] pairs (a park left and returned to has two). `mates` is the
// file's { venueId: [{ teamId, name, from, to }] }, the other clubs there in the
// same seasons.
export function parkHistory(spans, mates) {
  const byVenue = new Map()
  for (const s of [...spans].sort((a, b) => a.from - b.from)) {
    if (s.venueId == null) continue
    const p = byVenue.get(s.venueId) ?? { venueId: s.venueId, names: [], runs: [] }
    for (const n of s.venueNames ?? [s.venueName]) if (n && !p.names.includes(n)) p.names.push(n)
    const last = p.runs[p.runs.length - 1]
    if (last && s.from === last[1] + 1) last[1] = s.to
    else p.runs.push([s.from, s.to])
    byVenue.set(s.venueId, p)
  }
  return [...byVenue.values()]
    .map((p) => ({ ...p, mates: mates[p.venueId] ?? [] }))
    .sort((a, b) => a.runs[0][0] - b.runs[0][0])
}
