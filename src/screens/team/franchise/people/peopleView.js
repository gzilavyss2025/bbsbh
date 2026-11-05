// People and places on the franchise page (#2784), shaped for the cards. Pure: no fetch, no clock.

// [1981, 1982, 1984, 1985] -> "1981–82, 1984–85". A run's end year drops its century when it
// shares the start's ("2018–21"); across a century it stays whole ("1999–2001").
export function yearRuns(seasons) {
  const list = [...new Set(seasons ?? [])].sort((a, b) => a - b)
  const runs = []
  for (const y of list) {
    const last = runs[runs.length - 1]
    if (last && y === last[1] + 1) last[1] = y
    else runs.push([y, y])
  }
  return runs
    .map(([a, b]) => {
      if (a === b) return String(a)
      const end = Math.floor(a / 100) === Math.floor(b / 100) ? String(b).slice(2) : String(b)
      return `${a}–${end}`
    })
    .join(', ')
}

export const pct = (w, l) => (w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '—')
export const years = (from, to) => (from === to ? String(from) : `${from}–${to}`)

// The Hall of Fame card's first group. The plaques name the club as it was then, so a club that
// moved or renamed (the Expos' plaques on the Nationals' page) does not take today's name.
export function hofHeading(teamName, names) {
  const distinct = new Set((names ?? []).map((n) => n.name))
  return distinct.size > 1 ? 'Inducted with this franchise' : `Inducted as ${teamName}`
}

// Ledger rows (any order) -> every manager, newest first (by his last season, then his first).
// A season he shared with no split on file (no w/l) still lists its year, and marks him
// `partial`: his W-L leaves that season out. One with no split at all has `w` null.
// `best` is the id the summary names as winningest, so the two never disagree.
export function managersView(rows, best) {
  const byId = new Map()
  for (const r of rows ?? []) {
    for (const m of r.managers ?? []) {
      const t = byId.get(m.id) ?? { id: m.id, name: m.name, seasons: [], w: 0, l: 0, counted: 0, partial: false }
      t.seasons.push(r.season)
      if (m.w == null || m.l == null) t.partial = true
      else {
        t.w += m.w
        t.l += m.l
        t.counted += 1
      }
      byId.set(m.id, t)
    }
  }
  return [...byId.values()]
    .map((t) => ({ ...t, last: Math.max(...t.seasons), first: Math.min(...t.seasons) }))
    .sort((a, b) => b.last - a.last || b.first - a.first || a.id - b.id)
    .map((t) => ({
      id: t.id,
      name: t.name,
      years: yearRuns(t.seasons),
      wl: t.counted ? `${t.w}-${t.l}` : '—',
      pct: t.counted ? pct(t.w, t.l) : '—',
      partial: t.partial,
      best: t.id === best,
    }))
}

// The retired-numbers file names a person but carries no id. A tile links to the player page when
// its name matches an id the club's own files hold (its Hall of Famers and its all-time leaders),
// so the match is within one club. `people` is [{ id, name }]. Anyone else gets no link.
export function retiredTiles(numbers, people) {
  const ids = new Map()
  for (const p of people ?? []) if (p?.id && p.name && !ids.has(p.name)) ids.set(p.name, p.id)
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
