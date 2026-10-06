// Pure half of gen-franchise-history.mjs: per-season rows in, spans out.
// A row is { season, name, league, venueId, venueName } for one club-season.

// Join consecutive seasons into ranges: [1913, 1914, 1916] -> [[1913, 1914], [1916, 1916]].
function ranges(seasons) {
  const out = []
  for (const s of [...seasons].sort((a, b) => a - b)) {
    const last = out[out.length - 1]
    if (last && s === last[1] + 1) last[1] = s
    else out.push([s, s])
  }
  return out
}

// One span per run of CONSECUTIVE seasons with the same (name, league, venueId).
// A missing season ends a span. A venue renamed inside a span (PacBell -> SBC ->
// AT&T) stays one span: `venueNames` keeps every name, `venueName` is the newest.
export function collapseSeasons(rows) {
  const spans = []
  for (const r of [...rows].sort((a, b) => a.season - b.season)) {
    const last = spans[spans.length - 1]
    if (
      last &&
      r.season === last.to + 1 &&
      r.name === last.name &&
      r.league === last.league &&
      r.venueId === last.venueId
    ) {
      last.to = r.season
      if (!last.venueNames.includes(r.venueName)) last.venueNames.push(r.venueName)
      last.venueName = r.venueName
    } else {
      spans.push({
        from: r.season,
        to: r.season,
        name: r.name,
        league: r.league,
        venueId: r.venueId,
        venueName: r.venueName,
        venueNames: [r.venueName],
      })
    }
  }
  return spans
}

// For one club: the other clubs that used each of its venues in the SAME seasons.
// `byTeam` is { teamId: rows[] } for every club in the feed, defunct ones too.
// Returns { venueId: [{ teamId, name, from, to }] } (`name` as of `from`), with an
// entry only where an overlap exists.
export function venueMates(teamId, byTeam) {
  // venueId -> Map(season -> club name that season)
  const seasonsAt = (rows) => {
    const m = new Map()
    for (const r of rows) {
      if (r.venueId == null) continue
      if (!m.has(r.venueId)) m.set(r.venueId, new Map())
      m.get(r.venueId).set(r.season, r.name)
    }
    return m
  }
  const mine = seasonsAt(byTeam[teamId] ?? [])
  const out = {}
  for (const [id, rows] of Object.entries(byTeam)) {
    if (Number(id) === Number(teamId)) continue
    for (const [venueId, theirs] of seasonsAt(rows)) {
      const shared = [...theirs.keys()].filter((s) => mine.get(venueId)?.has(s))
      for (const [from, to] of ranges(shared)) {
        ;(out[venueId] ??= []).push({ teamId: Number(id), name: theirs.get(from), from, to })
      }
    }
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.from - b.from || a.teamId - b.teamId)
  return out
}
